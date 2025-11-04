import { FastifyPluginAsync } from 'fastify';
import { pipeline, Readable } from 'stream';
import util from 'util';
import fs from 'fs';
import path from 'path';

// Promisify pipeline for async/await
const pump = util.promisify(pipeline);

// Helper type for organizing uploaded files
type UploadedVolume = {
  seriesTitle: string;
  volumeTitle: string;
  mokuroFile: import('@fastify/multipart').MultipartFile | null;
  imageFiles: import('@fastify/multipart').MultipartFile[];
};

// an interface for the route parameters
interface VolumeParams {
  id: string; // This 'id' is the volumeId
}

/**
 * Drains a readable stream completely by resuming it and waiting for the 'end' event.
 * This is used to discard file contents we don't want to save.
 */
function drainStream(stream: Readable): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.on('end', resolve);
    stream.on('error', reject);
    stream.resume(); // Start the flow
  });
}

const libraryRoutes: FastifyPluginAsync = async (
  fastify,
  opts
): Promise<void> => {
  // Protect all routes in this file
  fastify.addHook('preHandler', fastify.authenticate);

  /**
   * GET /api/library
   * Gets a list of all Series and Volume metadata owned by the current user.
   */
  fastify.get('/', async (request, reply) => {
    const userId = request.user.id; // provided by the authenticate hook

    try {
      const series = await fastify.prisma.series.findMany({
        // Find all series owned by the logged-in user
        where: {
          ownerId: userId,
        },
        // Include all related Volume records for each Series
        include: {
          volumes: {
            // Optional: Order volumes by title
            orderBy: {
              title: 'asc',
            },
          },
        },
        // Optional: Order the series by title
        orderBy: {
          title: 'asc',
        },
      });

      // Return the list of series.
      // This will be an empty array ([]) if the user has no uploads,
      // which is the correct response.
      return reply.status(200).send(series);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Could not retrieve library.',
      });
    }
  });

  /**
   * POST /api/library/upload 
   */
  fastify.post('/upload', async (request, reply) => {
    const userId = request.user.id;
    const parts = request.parts();
    const volumesMap = new Map<string, UploadedVolume>();

    try {
      // 1. --- First Pass: Parse and group all files ---
      for await (const part of parts) {
        if (part.type === 'file') {
          // --- Normalize the path for cross-platform compatibility ---
          // The browser sends paths with '/', e.g., "Series/Volume/001.jpg"
          // We normalize it to use the OS's specific separator, e.g., "Series\Volume\001.jpg"
          const normalizedPath = path.normalize(part.filename);
          const parsedPath = path.parse(normalizedPath);
          const ext = parsedPath.ext.toLowerCase();

          // Rule 1: Skip known cache/legacy files
          if (normalizedPath.includes('_ocr') || ext === '.html') {
            fastify.log.info(`Skipping cache/legacy file: ${part.filename}`);
            await drainStream(part.file);
            continue; // Skip to next file
          }

          // Rule 2: Only allow known file types
          const isMokuro = ext === '.mokuro';
          const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);

          if (!isMokuro && !isImage) {
            fastify.log.info(`Skipping unknown file type: ${part.filename}`);
            await drainStream(part.file);
            continue; // Skip to next file
          }

          // 'parsedPath.dir' is now "Series\Volume" or "Series"
          const pathParts = parsedPath.dir.split(path.sep);

          let seriesTitle: string, volumeTitle: string;
          if (isMokuro) {
            if (pathParts.length < 1) continue; // Invalid path
            seriesTitle = pathParts[pathParts.length - 1];
            volumeTitle = parsedPath.name; // e.g., "Volume 1"
          } else {
            if (pathParts.length < 2) continue; // Invalid path
            volumeTitle = pathParts[pathParts.length - 1];
            seriesTitle = pathParts[pathParts.length - 2];
          }

          if (!seriesTitle || !volumeTitle) continue;

          const volumeKey = `${seriesTitle}/${volumeTitle}`;

          if (!volumesMap.has(volumeKey)) {
            volumesMap.set(volumeKey, {
              seriesTitle,
              volumeTitle,
              mokuroFile: null,
              imageFiles: [],
            });
          }
          const vol = volumesMap.get(volumeKey)!;

          if (isMokuro) {
            vol.mokuroFile = part;
          } else {
            vol.imageFiles.push(part);
          }
        }
      }

      // 2. --- Second Pass: Process and save valid volumes ---
      let processedCount = 0;
      let skippedCount = 0;

      for (const [key, volume] of volumesMap.entries()) {
        if (!volume.mokuroFile) {
          fastify.log.warn(`Skipping volume ${key}: Missing .mokuro file.`);
          // drain stream to avoid memory leaks
          for (const img of volume.imageFiles) { await drainStream(img.file); }
          skippedCount++;
          continue;
        }

        // --- DB Collision Check ---
        let series = await fastify.prisma.series.findFirst({
          where: { title: volume.seriesTitle, ownerId: userId },
        });
        if (!series) {
          series = await fastify.prisma.series.create({
            data: { title: volume.seriesTitle, ownerId: userId },
          });
        }

        const existingVolume = await fastify.prisma.volume.findFirst({
          where: { title: volume.volumeTitle, seriesId: series.id },
        });

        if (existingVolume) {
          fastify.log.info(`Skipping volume ${key}: Already exists.`);
          // drain stream to avoid memory leaks
          await drainStream(volume.mokuroFile.file);
          for (const img of volume.imageFiles) { await drainStream(img.file); }
          skippedCount++;
          continue;
        }

        // --- Save Files ---
        // Use path.join for cross-platform paths
        const seriesDir = path.join('backend', 'uploads', userId, series.title);
        const volumeDir = path.join(seriesDir, volume.volumeTitle);
        const mokuroPath = path.join(seriesDir, `${volume.volumeTitle}.mokuro`);

        await fs.promises.mkdir(volumeDir, { recursive: true });

        await pump(
          volume.mokuroFile.file,
          fs.createWriteStream(mokuroPath)
        );

        // Save all image files
        for (const imageFile of volume.imageFiles) {
          // --- FIX 3: Use path.basename to get just the filename ---
          // 'imageFile.filename' is the full "Series/Volume/001.jpg" path
          // 'path.basename(imageFile.filename)' gives "001.jpg"
          const imageName = path.basename(imageFile.filename);
          const imagePath = path.join(volumeDir, imageName);
          await pump(imageFile.file, fs.createWriteStream(imagePath));
        }

        // --- Create DB Entry ---
        await fastify.prisma.volume.create({
          data: {
            title: volume.volumeTitle,
            seriesId: series.id,
            pageCount: volume.imageFiles.length,
            // Store paths with forward slashes
            filePath: volumeDir.replace(/\\/g, '/'),
            mokuroPath: mokuroPath.replace(/\\/g, '/'),
          },
        });

        processedCount++;
      }

      return reply.status(201).send({
        message: 'Upload processed.',
        processed: processedCount,
        skipped: skippedCount,
      });

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'An error occurred during file upload.',
      });
    }
  });
  /**
   * 2. Add GET /api/library/volume/:id
   * Gets full data for one volume, including the parsed .mokuro JSON.
   */
  fastify.get<{ Params: VolumeParams }>(
    '/volume/:id',
    async (request, reply) => {
      const { id: volumeId } = request.params;
      const userId = request.user.id;

      try {
        // First, find the volume and verify ownership
        const volume = await fastify.prisma.volume.findFirst({
          where: {
            id: volumeId,
            series: {
              // This nested 'where' is the security check
              ownerId: userId,
            },
          },
        });

        // Case 1: Volume not found or user does not own it
        if (!volume) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: 'Volume not found or you do not have permission to access it.',
          });
        }

        // Case 2: Volume found, read the .mokuro file
        let mokuroContent: string;
        try {
          mokuroContent = await fs.promises.readFile(volume.mokuroPath, 'utf-8');
        } catch (fileError) {
          // Handle file system errors (e.g., file deleted)
          fastify.log.error(
            { err: fileError }, // 1. Pass the error object here
            `File not found for volume ${volume.id}: ${volume.mokuroPath}` // 2. Pass the message here
          );
          return reply.status(500).send({
            statusCode: 500,
            error: 'Internal Server Error',
            message: 'Could not read volume data file.',
          });
        }

        // Case 3: Parse the file content as JSON
        let mokuroJson: unknown;
        try {
          mokuroJson = JSON.parse(mokuroContent);
        } catch (parseError) {
          // Handle corrupted or malformed JSON
          fastify.log.error(
            { err: parseError }, // 1. Pass the error object here
            `Malformed JSON for volume ${volume.id}: ${volume.mokuroPath}` // 2. Pass the message here
          );
          return reply.status(500).send({
            statusCode: 500,
            error: 'Internal Server Error',
            message: 'Failed to parse volume data. The file may be corrupted.',
          });
        }

        // Case 4: Success. Send the parsed JSON.
        return reply.status(200).send(mokuroJson);

      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'An unexpected error occurred.',
        });
      }
    }
  );
};

export default libraryRoutes;
