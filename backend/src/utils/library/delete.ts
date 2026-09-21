import fs from 'fs';
import path from 'path';
import type { FastifyInstance } from 'fastify/types/instance';
import { deleteBranchSnapshots } from '../ocrHelpers';

// Cleanup Helper (Rollback)
export async function deleteFolder(pathStr: string) {
  try {
    await fs.promises.rm(pathStr, { recursive: true, force: true });
  } catch (e) {
    console.error(`Failed to cleanup folder: ${pathStr}`, e);
  }
}

export async function deleteSeriesById(
  fastify: FastifyInstance,
  seriesId: string,
  userId: string
) {
  // 1. Find series with ownership check
  const series = await fastify.prisma.series.findFirst({
    where: { id: seriesId, ownerId: userId },
    include: {
      volumes: {
        include: {
          branches: { select: { id: true } }
        }
      }
    }
  });

  if (!series) {
    // Improvement: Check if it exists as Admin content to give a better error
    const adminSeries = await fastify.prisma.series.findFirst({
      where: { id: seriesId, ownerId: 'admin' }
    });
    if (adminSeries) {
      const err = new Error('Cannot delete official content. Only the owner can delete this series.');
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const err = new Error('Series not found or access denied');
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }

  // 2. Cleanup Snapshots (Disk)
  const allBranchIds = series.volumes.flatMap((volume) =>
    volume.branches.map((branch) => branch.id)
  );
  await deleteBranchSnapshots(fastify, allBranchIds);

  // 3. Delete Series Directory (Disk)
  // Construct path deterministically: uploads/{userId}/{folderName}
  const seriesDirRelative = path.join('uploads', series.ownerId, series.folderName);
  const seriesDirAbsolute = path.join(fastify.projectRoot, seriesDirRelative);

  try {
    await fs.promises.rm(seriesDirAbsolute, { recursive: true, force: true });
  } catch (e) {
    fastify.log.error(`Failed to delete series directory: ${seriesDirAbsolute}. ${e}`);
  }

  // 4. Delete from DB (Cascade handles Volumes, Branches, Patches, Settings)
  await fastify.prisma.series.delete({ where: { id: seriesId } });

  return series.title || series.folderName;
}

export async function deleteVolumeById(
  fastify: FastifyInstance,
  volumeId: string,
  userId: string
) {
  // 1. Check if owned series exists
  const volume = await fastify.prisma.volume.findFirst({
    where: { id: volumeId, series: { ownerId: userId } },
    include: {
      series: {
        select: {
          id: true,
          ownerId: true,
          folderName: true,
          coverPath: true,
          _count: { select: { volumes: true } }
        }
      },
      branches: { select: { id: true } }
    }
  });

  if (!volume) {
    // 2. Check if trying to delete admin series
    const adminVolume = await fastify.prisma.volume.findFirst({
      where: { id: volumeId, series: { ownerId: 'admin' } }
    });

    if (adminVolume) {
      const err = new Error('Cannot delete official content. Only the admin can delete this volume.');
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const err = new Error('Volume not found or access denied');
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }

  // 3. Cleanup Snapshots (Disk)
  const branchIds = volume.branches.map((branch) => branch.id);
  await deleteBranchSnapshots(fastify, branchIds);

  // 4. Delete Volume Files (Disk)
  const absVolPath = path.join(fastify.projectRoot, volume.filePath);
  const absMokuroPath = path.join(fastify.projectRoot, volume.mokuroPath);

  try {
    await fs.promises.rm(absVolPath, { recursive: true, force: true });
    await fs.promises.rm(absMokuroPath, { force: true });
  } catch (e) {
    fastify.log.warn(`Failed to delete volume files: ${e}`);
  }

  // 5. Delete from DB
  await fastify.prisma.volume.delete({ where: { id: volumeId } });

  // 6. Check if this was the last volume - if so, delete the series
  const remainingVolumes = volume.series._count.volumes - 1; // Subtract the one we just deleted
  if (remainingVolumes === 0) {
    // Delete the series and its directory
    const seriesDirRelative = path.join('uploads', volume.series.ownerId, volume.series.folderName);
    const seriesDirAbsolute = path.join(fastify.projectRoot, seriesDirRelative);

    try {
      await fs.promises.rm(seriesDirAbsolute, { recursive: true, force: true });
    } catch (e) {
      fastify.log.warn(`Failed to delete empty series directory: ${seriesDirAbsolute}. ${e}`);
    }

    await fastify.prisma.series.delete({ where: { id: volume.seriesId } });
  }
  return volume.title || volume.folderName;
}
