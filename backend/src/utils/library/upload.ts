import fs from 'fs';
import path from 'path';
import util from 'util';
import { pipeline } from 'stream';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Prisma } from '../../generated/prisma/client';
import { safeFilename } from '../safeFilename';
import { drainStream } from '../stream';
import { deleteFolder } from './delete';
import { enqueueUploadJob } from '../../lib/uploadQueue';

const pump = util.promisify(pipeline);

interface UploadMetadata {
  series_title?: string;
  series_description?: string;
  volume_title?: string;
  series_bookmarked?: boolean;
  // Progress Interface
  volume_progress?: {
    page: number;
    isCompleted: boolean;
    timeRead: number;
    charsRead: number;
  };
}

export interface UploadQuery {
  async?: 'true' | 'false';
}

export async function handleLibraryUpload(
  fastify: FastifyInstance,
  request: FastifyRequest<{ Querystring: UploadQuery }>,
  reply: FastifyReply
) {
  const userId = request.user.id;

  // Context State
  let seriesFolder = '';
  let volumeFolder = '';
  let metadata: UploadMetadata = {};

  let targetDir = '';
  let pageCount = 0;

  // Track specific files for DB updates
  let mokuroPathRelative = '';
  let coverImageName: string | null = null;
  let potentialSeriesCoverPath: string | null = null;

  try {
    for await (const part of request.parts()) {
      // --- PHASE 1: Metadata Fields (Must come first) ---
      if (part.type === 'field') {
        const value = typeof part.value === 'string' ? part.value.trim() : '';

        if (part.fieldname === 'series_folder_name') seriesFolder = safeFilename(value);
        if (part.fieldname === 'volume_folder_name') volumeFolder = safeFilename(value);

        if (part.fieldname === 'metadata') {
          try {
            metadata = JSON.parse(value);
          } catch (e) {
            fastify.log.warn('Invalid metadata JSON provided in upload.');
          }
        }
      }

      // --- PHASE 2: File Stream ---
      if (part.type === 'file') {
        // 1. Validation: Ensure we have folders before accepting files
        if (!seriesFolder || !volumeFolder) {
          // Consume stream to prevent hanging, then throw
          await drainStream(part.file);
          throw new Error('Missing folder identifiers. Metadata must be sent before files.');
        }

        // 2. Prepare Directory (Once)
        if (!targetDir) {
          // Check DB for duplicates BEFORE writing to disk (Fail Fast)
          const exists = await fastify.prisma.volume.findFirst({
            where: {
              folderName: volumeFolder,
              series: { folderName: seriesFolder, ownerId: userId }
            }
          });

          if (exists) {
            // Consume stream to prevent hanging, then throw
            await drainStream(part.file);
            return reply.status(409).send({ message: `Volume '${volumeFolder}' already exists.` });
          }

          // Create Directory: uploads/UserId/Series/Volume
          const relativeDir = path.join('uploads', userId, seriesFolder, volumeFolder);
          targetDir = path.join(fastify.projectRoot, relativeDir);
          await fs.promises.mkdir(targetDir, { recursive: true });
        }

        // We flatten the filename (ignore client paths like "Naruto/Vol 1/001.jpg")
        const safeName = safeFilename(path.basename(part.filename));
        let absPath = path.join(targetDir, safeName); // default save path

        // 3. Identify Special Files
        const isMokuro = safeName.endsWith('.mokuro');
        const isImage = /\.(jpg|jpeg|png|webp)$/i.test(safeName);
        const isCoverImage = isImage && path.parse(safeName).name === seriesFolder;

        if (isMokuro) {
          mokuroPathRelative = path.join('uploads', userId, seriesFolder, safeName).replace(/\\/g, '/');
          absPath = path.join(fastify.projectRoot, mokuroPathRelative);
        } else if (isCoverImage) {
          potentialSeriesCoverPath = path.join('uploads', userId, seriesFolder, safeName).replace(/\\/g, '/');
          absPath = path.join(fastify.projectRoot, potentialSeriesCoverPath);
        } else if (isImage) {
          // Only use as Volume Cover if it's NOT the series cover
          // and if we haven't found any other image yet
          if (!coverImageName) coverImageName = safeName;
          // increment page count
          pageCount++;
        } else {
          // invalid file, skip
          await drainStream(part.file);
          continue;
        }

        // 4. Save File
        await pump(part.file, fs.createWriteStream(absPath));
      }
    }

    // --- PHASE 3: Database Update ---
    if (pageCount === 0) throw new Error('No files received.');
    if (!mokuroPathRelative) throw new Error('Mokuro file missing.');

    const finalizeUpload = async () => {
      // 1. Upsert Series (SHARED METADATA ONLY)
      let series = await fastify.prisma.series.findFirst({
        where: { folderName: seriesFolder, ownerId: userId }
      });

      if (!series) {
        series = await fastify.prisma.series.create({
          data: {
            ownerId: userId,
            folderName: seriesFolder,
            title: metadata.series_title || null,
            description: metadata.series_description || null,
            sortTitle: metadata.series_title || seriesFolder,
            // If we found a file matching "SeriesName.jpg", use it as cover
            coverPath: potentialSeriesCoverPath
          }
        });
      } else {
        // Prepare partial update
        const updateData: Prisma.SeriesUpdateInput = { updatedAt: new Date() };
        if (metadata.series_title && !series.title) {
          updateData.title = metadata.series_title;
          updateData.sortTitle = metadata.series_title;
        }
        if (metadata.series_description && !series.description) {
          updateData.description = metadata.series_description;
        }
        if (potentialSeriesCoverPath && !series.coverPath) {
          updateData.coverPath = potentialSeriesCoverPath;
        }

        await fastify.prisma.series.update({
          where: { id: series.id },
          data: updateData
        });
      }

      // 2. Handle User Settings (PRIVATE METADATA)
      // We must explicitly upsert the settings to save the bookmark
      await fastify.prisma.userSeriesSettings.upsert({
        where: { userId_seriesId: { userId, seriesId: series.id } },
        update: {
          // If metadata specifically sends true/false, update it.
          // If undefined, keep existing state.
          bookmarked: metadata.series_bookmarked !== undefined ? metadata.series_bookmarked : undefined
        },
        create: {
          userId,
          seriesId: series.id,
          bookmarked: metadata.series_bookmarked ?? false,
          // Default status is 0 (Unread)
        }
      });

      // 3. Create Volume
      const volumePathRelative = path.join('uploads', userId, seriesFolder, volumeFolder).replace(/\\/g, '/');
      const volume = await fastify.prisma.volume.create({
        data: {
          seriesId: series.id,
          folderName: volumeFolder,
          title: metadata.volume_title || null,
          sortTitle: metadata.volume_title || volumeFolder,
          pageCount,
          filePath: volumePathRelative,
          mokuroPath: mokuroPathRelative || '',
          coverImageName
        }
      });

      // 4. Update Progress (if provided)
      if (metadata.volume_progress) {
        await fastify.prisma.userProgress.upsert({
          where: { userId_volumeId: { userId, volumeId: volume.id } },
          update: {
            page: metadata.volume_progress.page,
            completed: metadata.volume_progress.isCompleted
          },
          create: {
            userId,
            volumeId: volume.id,
            page: metadata.volume_progress.page,
            completed: metadata.volume_progress.isCompleted
          }
        });
      }

      return volume;
    };

    if (request.query.async === 'true') {
      const job = enqueueUploadJob(async () => {
        try {
          const volume = await finalizeUpload();
          return { volumeId: volume.id, message: 'Upload processed.' };
        } catch (error) {
          if (targetDir) await deleteFolder(targetDir);
          throw error;
        }
      });

      return reply.status(202).send({
        message: 'Upload queued.',
        jobId: job.id
      });
    }

    const volume = await finalizeUpload();

    return reply.status(200).send({
      message: 'Upload processed.',
      processed: 1,
      volumeId: volume.id
    });
  } catch (err) {
    // ROLLBACK
    if (targetDir) await deleteFolder(targetDir);

    const message = err instanceof Error ? err.message : 'Upload failed.';
    const statusCodeFromError = (err as Error & { statusCode?: number }).statusCode;
    const isClientError =
      message.startsWith('Missing folder identifiers') ||
      message === 'No files received.' ||
      message === 'Mokuro file missing.';

    fastify.log.error(err);
    return reply.status(statusCodeFromError ?? (isClientError ? 400 : 500)).send({
      message
    });
  }
}
