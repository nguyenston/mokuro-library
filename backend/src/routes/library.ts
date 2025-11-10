import { FastifyPluginAsync, FastifyReply } from 'fastify';
import { pipeline, Readable } from 'stream';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Prisma } from '../generated/prisma/client';

// Promisify pipeline for async/await
const pump = util.promisify(pipeline);

// Helper type for organizing uploaded files
type UploadedVolume = {
  seriesTitle: string;
  volumeTitle: string;
  mokuroFile: { originalPath: string; tempPath: string } | null; // Store paths
  imageFiles: { originalPath: string; tempPath: string }[]; // Store paths
};

// an interface for the route parameters
interface VolumeParams {
  id: string; // This 'id' is the volumeId
}

interface SeriesParams {
  id: string; // This 'id' is the seriesId
}

interface MokuroPage { }

interface MokuroData {
  pages: MokuroPage[];
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

    // Track series cover
    const seriesCoverMap = new Map<string, { originalPath: string; tempPath: string }>();

    // 3. Create a unique temp directory for this upload
    let tempUploadDir: string | undefined = undefined;

    try {
      // Define the base temp path relative to permanent storage root
      const tempBaseDir = path.join(fastify.projectRoot, 'uploads', '.tmp');

      // Ensure the base temporary directory exists before making a unique one
      await fs.promises.mkdir(tempBaseDir, { recursive: true });

      tempUploadDir = await fs.promises.mkdtemp(
        path.join(tempBaseDir, 'mokuro-upload-')
      );
      fastify.log.info(`Created temp dir: ${tempUploadDir}`);

      // 1. --- First Pass: Parse and SAVE all files ---
      for await (const part of parts) {
        if (part.type === 'file') {
          const normalizedPath = path.normalize(part.filename);
          const parsedPath = path.parse(normalizedPath);
          const ext = parsedPath.ext.toLowerCase();

          // Rule 1: Skip cache/legacy
          if (normalizedPath.includes('_ocr') || ext === '.html') {
            await drainStream(part.file);
            continue;
          }

          // Rule 2: Only allow known types
          const isMokuro = ext === '.mokuro';
          const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);

          if (!isMokuro && !isImage) {
            await drainStream(part.file);
            continue;
          }

          // 4. Parser logic
          const pathParts = parsedPath.dir.split(path.sep).filter((p) => p);
          let seriesTitle: string, volumeTitle: string;

          // A file is a series cover if:
          // 1. It's an image
          // 3. Its filename matches its folder name (e.g., "Series Title.jpg")
          const isSeriesCover =
            isImage &&
            pathParts.length > 0 &&
            parsedPath.name === pathParts[pathParts.length - 1];

          if (isSeriesCover) {
            seriesTitle = pathParts[pathParts.length - 1];

            // Save to a special subfolder in the temp dir
            const tempPathDir = path.join(
              tempUploadDir,
              seriesTitle,
              '_series_cover_'
            );
            const tempPath = path.join(tempPathDir, parsedPath.base);
            await fs.promises.mkdir(tempPathDir, { recursive: true });
            await pump(part.file, fs.createWriteStream(tempPath));

            // Store in our new map
            seriesCoverMap.set(seriesTitle, {
              originalPath: part.filename,
              tempPath
            });

            continue; // Skip the volume logic below
          }

          if (isMokuro && pathParts.length > 0) {
            volumeTitle = parsedPath.name;
            seriesTitle = pathParts[pathParts.length - 1];
          } else if (isImage && pathParts.length > 1) {
            volumeTitle = pathParts[pathParts.length - 1];
            seriesTitle = pathParts[pathParts.length - 2];
          } else {
            await drainStream(part.file);
            continue;
          }

          // 4. Save file to temp dir immediately to consume stream
          const tempPathDir = path.join(tempUploadDir, seriesTitle, volumeTitle);
          const tempPath = path.join(tempPathDir, parsedPath.base);
          await fs.promises.mkdir(tempPathDir, { recursive: true });
          await pump(part.file, fs.createWriteStream(tempPath));

          // 6. Store paths in the map
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
            vol.mokuroFile = { originalPath: part.filename, tempPath };
          } else {
            vol.imageFiles.push({ originalPath: part.filename, tempPath });
          }
        }
      }
      fastify.log.info(`File iteration complete. Found ${volumesMap.size} volumes.`);

      // 2. --- Second Pass: Process and MOVE files ---
      let processedCount = 0;
      let skippedCount = 0;

      for (const [key, volume] of volumesMap.entries()) {
        if (!volume.mokuroFile) {
          fastify.log.warn(`Skipping volume ${key}: Missing .mokuro file.`);
          // Delete orphaned temp images
          for (const img of volume.imageFiles) {
            await fs.promises.rm(img.tempPath);
          }
          skippedCount++;
          continue;
        }

        // --- DB Collision Check ---
        // 1. Find or create the series
        let series = await fastify.prisma.series.findFirst({
          where: { title: volume.seriesTitle, ownerId: userId }
        });

        if (!series) {
          series = await fastify.prisma.series.create({
            data: {
              title: volume.seriesTitle,
              ownerId: userId,
              coverPath: null // Always create with null cover
            }
          });
        }

        // 2. Check for and process a cover, regardless of whether
        // the series is new or existing.
        if (seriesCoverMap.has(volume.seriesTitle)) {
          const coverFile = seriesCoverMap.get(volume.seriesTitle)!;
          const seriesDir = path.join(
            fastify.projectRoot,
            'uploads',
            userId,
            series.title
          );
          const ext = path.extname(coverFile.originalPath);
          const newCoverName = `${volume.seriesTitle}${ext}`;
          const newCoverPath = path.join(seriesDir, newCoverName);

          // Ensure directory exists and move the file
          await fs.promises.mkdir(seriesDir, { recursive: true });
          await fs.promises.rename(coverFile.tempPath, newCoverPath);

          // remove cover from the map
          seriesCoverMap.delete(volume.seriesTitle);

          // 3. Update the series in the DB if the path is new
          const relativeCoverPath = path
            .join('uploads', userId, series.title, newCoverName)
            .replace(/\\/g, '/');
          if (series.coverPath !== relativeCoverPath) {
            // use 'series.id' to update the record we just found or created
            await fastify.prisma.series.update({
              where: { id: series.id },
              data: { coverPath: relativeCoverPath }
            });
            // Update local 'series' object
            series.coverPath = relativeCoverPath;
          }
        }

        const existingVolume = await fastify.prisma.volume.findFirst({
          where: { title: volume.volumeTitle, seriesId: series.id },
        });

        if (existingVolume) {
          fastify.log.info(`Skipping volume ${key}: Already exists.`);
          // Delete all temp files for this volume
          await fs.promises.rm(volume.mokuroFile.tempPath);
          for (const img of volume.imageFiles) {
            await fs.promises.rm(img.tempPath);
          }
          skippedCount++;
          continue;
        }

        // --- 7. Move Files from Temp to Permanent Storage ---
        const seriesDirRelative = path.join('uploads', userId, series.title);
        const seriesDirAbsolute = path.join(
          fastify.projectRoot,
          seriesDirRelative
        );
        const volumeDirRelative = path.join(seriesDirRelative, volume.volumeTitle);
        const volumeDirAbsolute = path.join(seriesDirAbsolute, volume.volumeTitle);
        const mokuroPathRelative = path.join(
          seriesDirRelative,
          `${volume.volumeTitle}.mokuro`
        );
        const mokuroPathAbsolute = path.join(
          seriesDirAbsolute,
          `${volume.volumeTitle}.mokuro`
        );

        await fs.promises.mkdir(volumeDirAbsolute, { recursive: true });

        // Move .mokuro file
        await fs.promises.rename(volume.mokuroFile.tempPath, mokuroPathAbsolute);

        // Move all image files
        for (const imageFile of volume.imageFiles) {
          const imageName = path.basename(imageFile.originalPath); // Get 001.jpg
          const imagePathAbsolute = path.join(volumeDirAbsolute, imageName);
          await fs.promises.rename(imageFile.tempPath, imagePathAbsolute);
        }

        // --- Find the cover image name ---
        let coverName: string | null = null;
        if (volume.imageFiles.length > 0) {
          // Use reduce to find the file with the lexicographically smallest path
          const firstImage = volume.imageFiles.reduce((min, current) => {
            return min.originalPath.localeCompare(current.originalPath) < 0 ? min : current;
          });
          // Get just the filename (e.g., "001.jpg")
          coverName = path.basename(firstImage.originalPath);
        }

        // --- Create DB Entry ---
        await fastify.prisma.volume.create({
          data: {
            title: volume.volumeTitle,
            seriesId: series.id,
            pageCount: volume.imageFiles.length,
            filePath: volumeDirRelative.replace(/\\/g, '/'),
            mokuroPath: mokuroPathRelative.replace(/\\/g, '/'),
            coverImageName: coverName,
          },
        });

        processedCount++;
      }

      fastify.log.info('Volume processing complete. Sending response.');
      return reply.status(201).send({
        message: 'Upload processed.',
        processed: processedCount,
        skipped: skippedCount,
      });

    } catch (error) {
      fastify.log.error({ err: error }, 'Upload failed with an error.');
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'An error occurred during file upload.',
      });
    } finally {
      // 8. Always clean up the temp directory
      if (tempUploadDir) {
        fastify.log.info(`Cleaning up temp dir: ${tempUploadDir}`);
        await fs.promises.rm(tempUploadDir, { recursive: true, force: true });
      }
    }
  });

  /**
   * POST /api/library/series/:id/cover
   * Uploads and sets the cover image for a series.
   */
  fastify.post<{ Params: SeriesParams }>(
    '/series/:id/cover',
    async (request, reply) => {
      const { id: seriesId } = request.params;
      const userId = request.user.id;

      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ message: 'No file uploaded.' });
      }

      try {
        // 1. Verify ownership and get series details
        const series = await fastify.prisma.series.findFirst({
          where: { id: seriesId, ownerId: userId }
        });

        if (!series) {
          // Consume stream to avoid hanging
          await data.toBuffer();
          return reply.status(404).send({ message: 'Series not found.' });
        }

        // 2. Determine paths
        // We need to find the series root directory. We can infer it.
        // Based on upload logic, it's 'uploads/<userId>/<seriesTitle>/'
        const seriesDirRelative = path.join('uploads', userId, series.title);
        const seriesDirAbsolute = path.join(
          fastify.projectRoot,
          seriesDirRelative
        );

        // Ensure directory exists (it should, but good practice)
        await fs.promises.mkdir(seriesDirAbsolute, { recursive: true });

        // 3. Construct new filename: <seriesTitle>.<ext>
        const ext = path.extname(data.filename).toLowerCase() || '.jpg';
        const newFileName = `${series.title}${ext}`;
        const filePathAbsolute = path.join(seriesDirAbsolute, newFileName);
        const filePathRelative = path.join(seriesDirRelative, newFileName);

        // 4. Save file
        await pump(data.file, fs.createWriteStream(filePathAbsolute));

        // 5. Update DB with absolute path (or relative if you prefer consistent storage)
        // Storing absolute path for consistency with volume.filePath
        await fastify.prisma.series.update({
          where: { id: seriesId },
          data: { coverPath: filePathRelative.replace(/\\/g, '/') }
        });

        return reply.status(200).send({ message: 'Cover updated successfully.' });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ message: 'Failed to upload cover.' });
      }
    }
  );

  /**
   * GET /api/library/series/:id
   * Gets full data for one series, including its volumes.
   */
  fastify.get<{ Params: SeriesParams }>(
    '/series/:id',
    async (request, reply) => {
      const { id: seriesId } = request.params;
      const userId = request.user.id;

      try {
        const series = await fastify.prisma.series.findFirst({
          where: {
            id: seriesId,
            ownerId: userId, // Security check
          },
          include: {
            volumes: {
              orderBy: {
                title: 'asc', // Or by a 'volumeNumber' if we add one later
              },
              include: {
                progress: {
                  where: {
                    userId: userId
                  },
                  select: {
                    page: true,
                    completed: true,
                    timeRead: true,
                    charsRead: true
                  }
                }
              }
            },
          },
        });

        if (!series) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: 'Series not found or you do not have permission to access it.',
          });
        }

        // Return the single series object
        return reply.status(200).send(series);
      } catch (error) {
        fastify.log.error(
          { err: error },
          'Error fetching single series'
        );
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'An unexpected error occurred.',
        });
      }
    }
  );

  /**
   * GET /api/library/volume/:id
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
          include: {
            progress: {
              where: {
                userId: userId
              },
              select: {
                page: true,
                completed: true,
                timeRead: true,
                charsRead: true
              }
            }
          }
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
        const absoluteMokuroPath = path.join(
          fastify.projectRoot,
          volume.mokuroPath
        );
        let mokuroContent: string;
        try {
          mokuroContent = await fs.promises.readFile(absoluteMokuroPath, 'utf-8');
        } catch (fileError) {
          // Handle file system errors (e.g., file deleted)
          fastify.log.error(
            { err: fileError }, // 1. Pass the error object here
            `File not found for volume ${volume.id}: ${absoluteMokuroPath}` // 2. Pass the message here
          );
          return reply.status(500).send({
            statusCode: 500,
            error: 'Internal Server Error',
            message: 'Could not read volume data file.',
          });
        }

        // Case 3: Parse the file content as JSON
        let mokuroJson: MokuroData;
        try {
          mokuroJson = JSON.parse(mokuroContent);
        } catch (parseError) {
          // Handle corrupted or malformed JSON
          fastify.log.error(
            { err: parseError }, // 1. Pass the error object here
            `Malformed JSON for volume ${volume.id}: ${absoluteMokuroPath}` // 2. Pass the message here
          );
          return reply.status(500).send({
            statusCode: 500,
            error: 'Internal Server Error',
            message: 'Failed to parse volume data. The file may be corrupted.',
          });
        }
        // --- THIS IS THE NEW SANITY CHECK ---
        if (
          !mokuroJson.pages ||
          !Array.isArray(mokuroJson.pages) ||
          volume.pageCount !== mokuroJson.pages.length
        ) {
          fastify.log.warn(
            {
              volumeId: volume.id,
              dbPageCount: volume.pageCount,
              mokuroPagesLength: mokuroJson.pages?.length ?? 'undefined',
            },
            'Page count mismatch: DB record and .mokuro file disagree.'
          );
          // We don't stop the request, just log the warning.
        }
        // Case 4: Success. create and send reply.
        const responseData = {
          id: volume.id,
          title: volume.title,
          seriesId: volume.seriesId,
          pageCount: volume.pageCount,
          coverImageName: volume.coverImageName,
          progress: volume.progress,
          mokuroData: mokuroJson,
        };

        return reply.status(200).send(responseData);

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

  /**
   * PUT /api/library/volume/:id/ocr
   * Saves modified OCR data.
   */
  fastify.put<{ Params: VolumeParams }>(
    '/volume/:id/ocr',
    async (request, reply) => {
      const { id: volumeId } = request.params;
      const userId = request.user.id;

      // 1. The request body should be the NEW, complete "pages" array
      const newPagesArray = request.body as Prisma.InputJsonValue;

      if (!Array.isArray(newPagesArray)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Request body must be an array of page data.',
        });
      }

      try {
        // 2. Find the volume and verify ownership
        const volume = await fastify.prisma.volume.findFirst({
          where: {
            id: volumeId,
            series: {
              ownerId: userId,
            },
          },
        });

        if (!volume) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: 'Volume not found or access denied.',
          });
        }

        // 3. Read the existing .mokuro file
        const absoluteMokuroPath = path.join(
          fastify.projectRoot,
          volume.mokuroPath
        );
        let mokuroContent: string;
        try {
          mokuroContent = await fs.promises.readFile(absoluteMokuroPath, 'utf-8');
        } catch (readError) {
          fastify.log.error(
            { err: readError },
            `File not found for volume ${volume.id}: ${absoluteMokuroPath}`
          );
          return reply.status(500).send({
            statusCode: 500,
            error: 'Internal Server Error',
            message: 'Could not read volume data file.',
          });
        }

        // 4. Parse the file
        let mokuroData: any; // Use 'any' to allow dynamic key assignment
        try {
          mokuroData = JSON.parse(mokuroContent);
        } catch (parseError) {
          fastify.log.error(
            { err: parseError },
            `Malformed JSON for volume ${volume.id}: ${absoluteMokuroPath}`
          );
          return reply.status(500).send({
            statusCode: 500,
            error: 'Internal Server Error',
            message: 'Failed to parse volume data. The file may be corrupted.',
          });
        }

        // 5. Replace the 'pages' key with the new array from the request.
        mokuroData.pages = newPagesArray;

        // 6. Stringify and write the updated JSON back to the file
        const updatedMokuroContent = JSON.stringify(mokuroData); // No pretty-print, save space

        try {
          await fs.promises.writeFile(
            absoluteMokuroPath,
            updatedMokuroContent,
            'utf-8'
          );
        } catch (writeError) {
          fastify.log.error(
            { err: writeError },
            `Failed to write updates to ${absoluteMokuroPath}`
          );
          return reply.status(500).send({
            statusCode: 500,
            error: 'Internal Server Error',
            message: 'Could not save OCR data.',
          });
        }

        // 7. Success
        return reply.status(200).send({ message: 'OCR data updated successfully.' });
      } catch (error) {
        fastify.log.error(
          { err: error },
          'An unexpected error occurred in PUT /api/library/volume/:id/ocr'
        );
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'An unexpected error occurred.',
        });
      }
    }
  );

  /**
     * DELETE /api/library/series/:id
     * Deletes an entire series, all its volumes, and all associated files.
     */
  fastify.delete<{ Params: SeriesParams }>(
    '/series/:id',
    async (request, reply) => {
      const { id: seriesId } = request.params;
      const userId = request.user.id;

      try {
        // 1. Find series and verify ownership, include volumes for file paths
        const series = await fastify.prisma.series.findFirst({
          where: {
            id: seriesId,
            ownerId: userId
          },
          include: {
            volumes: {
              select: {
                mokuroPath: true // We only need one path to find the series dir
              }
            }
          }
        });

        if (!series) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: 'Series not found or access denied.'
          });
        }

        let seriesDirRelative: string | null = null;
        // 2. Delete all files from disk
        if (series.volumes.length > 0) {
          // All volumes share the same parent (series) directory.
          // mokuroPath is 'uploads/userId/seriesTitle/volume.mokuro'
          seriesDirRelative = path.dirname(series.volumes[0].mokuroPath);
        } else if (series.coverPath) {
          seriesDirRelative = path.dirname(series.coverPath);
        }

        if (seriesDirRelative) {
          // MODIFIED: Use projectRoot
          const seriesDirAbsolute = path.join(
            fastify.projectRoot,
            seriesDirRelative
          );
          await fs.promises.rm(seriesDirAbsolute, {
            recursive: true,
            force: true
          });
        }

        // 3. Delete series from DB. Prisma 'onDelete: Cascade'
        // will automatically delete all related volumes and progress.
        await fastify.prisma.series.delete({
          where: {
            id: seriesId
          }
        });

        return reply.status(200).send({ message: 'Series deleted successfully.' });
      } catch (error) {
        fastify.log.error(
          { err: error },
          'Error deleting series'
        );
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'An unexpected error occurred while deleting the series.'
        });
      }
    }
  );

  /**
   * DELETE /api/library/volume/:id
   * Deletes a single volume, its files, and its progress.
   */
  fastify.delete<{ Params: VolumeParams }>(
    '/volume/:id',
    async (request, reply) => {
      const { id: volumeId } = request.params;
      const userId = request.user.id;

      try {
        // 1. Find volume and verify ownership
        // We also get the series and a count of its volumes
        const volume = await fastify.prisma.volume.findFirst({
          where: {
            id: volumeId,
            series: {
              ownerId: userId
            }
          },
          include: {
            series: {
              include: {
                _count: {
                  select: { volumes: true }
                }
              }
            }
          }
        });

        if (!volume) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: 'Volume not found or access denied.'
          });
        }

        // 2. Delete volume files from disk
        // filePath is 'uploads/userId/seriesTitle/volumeTitle'
        const absoluteVolumePath = path.join(
          fastify.projectRoot,
          volume.filePath
        );
        await fs.promises.rm(absoluteVolumePath, {
          recursive: true,
          force: true
        });
        // mokuroPath is 'uploads/userId/seriesTitle/volume.mokuro'
        const absoluteMokuroPath = path.join(
          fastify.projectRoot,
          volume.mokuroPath
        );
        await fs.promises.rm(absoluteMokuroPath, { force: true });

        const seriesDirRelative = path.dirname(volume.mokuroPath);
        const volumeCount = volume.series._count.volumes;
        const seriesCoverPath = volume.series.coverPath;

        // 3. Delete volume from DB. Cascade delete handles progress.
        await fastify.prisma.volume.delete({
          where: {
            id: volumeId
          }
        });

        // 4. If this was the last volume, clean up the parent series directory
        if (volumeCount === 1 && !seriesCoverPath) {
          try {
            const seriesDirAbsolute = path.join(
              fastify.projectRoot,
              seriesDirRelative
            );
            await fs.promises.rm(seriesDirAbsolute, {
              recursive: true,
              force: true
            });
          } catch (e) {
            fastify.log.warn(
              `Could not clean up empty series dir: ${seriesDirRelative}`
            );
          }
        }

        return reply.status(200).send({ message: 'Volume deleted successfully.' });
      } catch (error) {
        fastify.log.error(
          { err: error },
          'Error deleting volume'
        );
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'An unexpected error occurred while deleting the volume.'
        });
      }
    }
  );
};

export default libraryRoutes;
