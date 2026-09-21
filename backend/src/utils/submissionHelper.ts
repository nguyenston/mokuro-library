import { FastifyInstance } from 'fastify';
import path from 'path';
import fs from 'fs';
import { HttpError } from '../types/error';
import { Series } from '../generated/prisma/browser';

export interface VolumeMovePlan {
  id: string;
  pageCount: number;
  folderName: string;
  oldPathAbs: string;
  newPathRel: string;
  newPathAbs: string;
  newMokuroRel: string;
}

export interface submissionSeriesMetadata {
  folderName: string;
  coverPath: string | null;
  title: string | null;
  sortTitle: string;
  japaneseTitle: string | null;
  romajiTitle: string | null;
  synonyms: string | null;
  description: string | null;
}

export interface SubmissionExecutionPlan {
  sourceSeriesId: string;
  targetSeriesId: string | null;
  targetSeriesFolder: string;
  volumeMoves: VolumeMovePlan[];
  newSeriesData?: submissionSeriesMetadata;
}

/**
 * Validates a submission request against the current Admin Library state.
 * Returns an Execution Plan if valid.
 */
export async function validateAndPlanSubmission(
  fastify: FastifyInstance,
  targetSeriesId: string | null | undefined,
  sourceSeries: Series,
  volumes: { id: string; pageCount: number; folderName: string; filePath: string; mokuroPath: string }[]
): Promise<SubmissionExecutionPlan> {
  const projectRoot = fastify.projectRoot;
  let targetSeriesFolder = '';
  let newSeriesData: SubmissionExecutionPlan['newSeriesData'] = undefined;

  // --- 1. Series Validation ---
  if (!targetSeriesId) {

    const existing = await fastify.prisma.series.findUnique({
      where: { folderName_ownerId: { folderName: sourceSeries.folderName, ownerId: 'admin' } }
    });

    if (existing) {
      throw new HttpError(409, `Series '${sourceSeries.folderName}' already exists...`);
    }

    targetSeriesFolder = sourceSeries.folderName;
    newSeriesData = structuredClone(sourceSeries);
  } else {
    const targetSeries = await fastify.prisma.series.findUnique({ where: { id: targetSeriesId } });
    if (!targetSeries) {
      throw new HttpError(404, 'Target series not found.');
    }
    targetSeriesFolder = targetSeries.folderName;
  }

  // --- 2. Volume & File System Validation ---
  const volumeMoves: VolumeMovePlan[] = [];
  const adminSeriesDirRel = path.join('uploads', 'admin', targetSeriesFolder);

  for (const vol of volumes) {
    if (targetSeriesId) {
      const collision = await fastify.prisma.volume.findFirst({
        where: { seriesId: targetSeriesId, folderName: vol.folderName }
      });
      if (collision) {
        throw new HttpError(409, `Volume '${vol.folderName}' already exists in the target series.`);
      }
    }

    const oldPathAbs = path.join(projectRoot, vol.filePath);
    const newPathRel = path.join(adminSeriesDirRel, vol.folderName);
    const newPathAbs = path.join(projectRoot, newPathRel);

    try {
      await fs.promises.access(newPathAbs);
      throw new HttpError(409, `Target directory already exists on disk: ${newPathRel}`);
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e;
    }

    let newMokuroRel = vol.mokuroPath;
    if (vol.mokuroPath) {
      const fileName = path.basename(vol.mokuroPath);
      newMokuroRel = path.join(adminSeriesDirRel, fileName).replace(/\\/g, '/');
    }

    volumeMoves.push({
      id: vol.id,
      pageCount: vol.pageCount,
      folderName: vol.folderName,
      oldPathAbs,
      newPathRel: newPathRel.replace(/\\/g, '/'),
      newPathAbs,
      newMokuroRel
    });
  }

  return {
    sourceSeriesId: sourceSeries.id,
    targetSeriesId: targetSeriesId || null,
    targetSeriesFolder,
    volumeMoves,
    newSeriesData
  };
}

/**
 * Robustly moves a directory. Tries atomic rename first, falls back to copy+delete.
 * Solves EACCES/EXDEV issues across Docker volumes.
 */
async function moveDirectory(src: string, dest: string) {
  try {
    await fs.promises.rename(src, dest);
  } catch (error: any) {
    if (error.code === 'EXDEV' || error.code === 'EACCES' || error.code === 'EPERM') {
      // Fallback strategy: Copy recursive -> Remove original
      await fs.promises.cp(src, dest, { recursive: true });
      await fs.promises.rm(src, { recursive: true, force: true });
    } else {
      throw error;
    }
  }
}

/**
 * Executes the file moves defined in the plan.
 * Uses the robust moveDirectory helper.
 */
export async function executeMovePlan(
  fastify: FastifyInstance,
  moves: VolumeMovePlan[]
): Promise<void> {
  const movedVolumes: VolumeMovePlan[] = [];

  try {
    for (const move of moves) {
      // Ensure parent dir exists
      await fs.promises.mkdir(path.dirname(move.newPathAbs), { recursive: true });

      // Robust Move
      await moveDirectory(move.oldPathAbs, move.newPathAbs);

      movedVolumes.push(move);
    }
  } catch (e) {
    fastify.log.error(`Partial failure during file move. Rolling back ${movedVolumes.length} volumes. Error: ${e}`);

    // Internal Rollback
    await revertMoves(fastify, movedVolumes);

    throw new Error(`Failed to move volume files (Changes rolled back): ${e}`);
  }
}

/**
 * Reverts a list of volume moves.
 */
export async function revertMoves(
  fastify: FastifyInstance,
  moves: VolumeMovePlan[]
): Promise<void> {
  // Process in reverse order to unwind the stack
  for (const moved of [...moves].reverse()) {
    try {
      // We assume the old parent directory still exists (standard for move operations)
      await moveDirectory(moved.newPathAbs, moved.oldPathAbs);
    } catch (rollbackError) {
      fastify.log.error(`CRITICAL: Failed to rollback volume ${moved.folderName}. Filesystem may be inconsistent. ${rollbackError}`);
    }
  }
}
