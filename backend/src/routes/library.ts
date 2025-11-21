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
  seriesFolder: string;
  volumeFolder: string;
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
interface UpdateEntityParams {
  id: string;
}

// Interface for API body (used for PATCH rename)
interface UpdateEntityBody {
  title?: string | null; // Allow setting a string or explicitly nulling it
}

// Interface for Mokuro Metadata JSON (for portable titles/progress)
interface MokuroSeriesMetadata {
  version: string;
  series: {
    title: string | null;
    originalFolderName: string; // Used for safety/validation
    coverImage?: string;
  };
  volumes: {
    [folderName: string]: {
      displayTitle: string | null;
      progress?: {
        page: number;
        isCompleted: boolean;
        timeRead: number;
        charsRead: number;
      };
    }
  };
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
            // Optional: Order volumes by folderName
            orderBy: {
              folderName: 'asc',
            },
          },
        },
        // Optional: Order the series by folderName
        orderBy: {
          folderName: 'asc',
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

    // Track library json
    const seriesJsonMap = new Map<string, { originalPath: string; tempPath: string }>();

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
          const isJson = ext === '.json';

          if (!isMokuro && !isImage && !isJson) {
            await drainStream(part.file);
            continue;
          }

          // 4. Parser logic
          const pathParts = parsedPath.dir.split(path.sep).filter((p) => p);
          let seriesFolder: string, volumeFolder: string;

          // A file is a series cover if:
          // 1. It's an image
          // 3. Its filename matches its folder name (e.g., "series_folder_name/series_folder_name.jpg")
          const isSeriesCoverOrJson =
            pathParts.length > 0 &&
            parsedPath.name === pathParts[pathParts.length - 1];

          if (isJson && isSeriesCoverOrJson) {
            seriesFolder = pathParts[pathParts.length - 1];

            // Save to a special subfolder in the temp dir
            const tempPathDir = path.join(tempUploadDir, seriesFolder, '_series_metadata_');
            const tempPath = path.join(tempPathDir, parsedPath.base);
            await fs.promises.mkdir(tempPathDir, { recursive: true });
            await pump(part.file, fs.createWriteStream(tempPath));

            seriesJsonMap.set(seriesFolder, {
              originalPath: part.filename,
              tempPath
            });

            continue; // Skip the volume logic below
          }

          if (isImage && isSeriesCoverOrJson) {
            seriesFolder = pathParts[pathParts.length - 1];

            // Save to a special subfolder in the temp dir
            const tempPathDir = path.join(tempUploadDir, seriesFolder, '_series_cover_');
            const tempPath = path.join(tempPathDir, parsedPath.base);
            await fs.promises.mkdir(tempPathDir, { recursive: true });
            await pump(part.file, fs.createWriteStream(tempPath));

            // Store in our new map
            seriesCoverMap.set(seriesFolder, {
              originalPath: part.filename,
              tempPath
            });

            continue; // Skip the volume logic below
          }

          if (isMokuro && pathParts.length > 0) {
            volumeFolder = parsedPath.name;
            seriesFolder = pathParts[pathParts.length - 1];
          } else if (isImage && pathParts.length > 1) {
            volumeFolder = pathParts[pathParts.length - 1];
            seriesFolder = pathParts[pathParts.length - 2];
          } else {
            await drainStream(part.file);
            continue;
          }

          // 4. Save file to temp dir immediately to consume stream
          const tempPathDir = path.join(tempUploadDir, seriesFolder, volumeFolder);
          const tempPath = path.join(tempPathDir, parsedPath.base);
          await fs.promises.mkdir(tempPathDir, { recursive: true });
          await pump(part.file, fs.createWriteStream(tempPath));

          // 6. Store paths in the map
          const volumeKey = `${seriesFolder}/${volumeFolder}`;
          if (!volumesMap.has(volumeKey)) {
            volumesMap.set(volumeKey, {
              seriesFolder: seriesFolder,
              volumeFolder: volumeFolder,
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

      // 1.5 --- Optimization Pass: Pre-load Metadata JSONs ---
      // Instead of reading the file from disk for every volume, read it ONCE per series.
      const metadataCache = new Map<string, MokuroSeriesMetadata>();

      for (const [seriesFolder, jsonFile] of seriesJsonMap.entries()) {
        try {
          const jsonContent = await fs.promises.readFile(jsonFile.tempPath, 'utf-8');
          const metadata = JSON.parse(jsonContent) as MokuroSeriesMetadata;
          metadataCache.set(seriesFolder, metadata);
        } catch (e) {
          fastify.log.warn({ err: e }, `Failed to parse metadata JSON for series ${seriesFolder}`);
        }
      }

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

        // Get cached metadata
        const jsonMetadata = metadataCache.get(volume.seriesFolder) ?? null;
        const jsonSeriesTitle = jsonMetadata?.series?.title ?? null;

        // --- DB Collision Check ---
        // 1. Find or create the series
        let series = await fastify.prisma.series.findFirst({
          where: { folderName: volume.seriesFolder, ownerId: userId }
        });

        if (!series) {
          series = await fastify.prisma.series.create({
            data: {
              folderName: volume.seriesFolder,
              title: jsonSeriesTitle,
              ownerId: userId,
              coverPath: null // Always create with null cover
            }
          });
        }

        // 2. Check for and process a cover, regardless of whether
        // the series is new or existing.
        if (seriesCoverMap.has(volume.seriesFolder)) {
          const coverFile = seriesCoverMap.get(volume.seriesFolder)!;
          const seriesDir = path.join(
            fastify.projectRoot,
            'uploads',
            userId,
            series.folderName
          );
          const ext = path.extname(coverFile.originalPath);
          const newCoverName = `${volume.seriesFolder}${ext}`;
          const newCoverPath = path.join(seriesDir, newCoverName);

          // Ensure directory exists and move the file
          await fs.promises.mkdir(seriesDir, { recursive: true });
          await fs.promises.rename(coverFile.tempPath, newCoverPath);

          // remove cover from the map
          seriesCoverMap.delete(volume.seriesFolder);

          // 3. Update the series in the DB if the path is new
          const relativeCoverPath = path
            .join('uploads', userId, series.folderName, newCoverName)
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
          where: { folderName: volume.volumeFolder, seriesId: series.id },
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

        // --- Find Volume Display Title from Cached) ---
        let jsonVolumeTitle: string | null = null;
        if (jsonMetadata && jsonMetadata.volumes) {
          const targetFileName = `${volume.volumeFolder}`;
          const volumeMeta = jsonMetadata.volumes[targetFileName];
          if (volumeMeta && typeof volumeMeta.displayTitle === 'string') {
            jsonVolumeTitle = volumeMeta.displayTitle;
          }
        }

        // --- 7. Move Files from Temp to Permanent Storage ---
        const seriesDirRelative = path.join('uploads', userId, series.folderName);
        const seriesDirAbsolute = path.join(fastify.projectRoot, seriesDirRelative
        );
        const volumeDirRelative = path.join(seriesDirRelative, volume.volumeFolder);
        const volumeDirAbsolute = path.join(seriesDirAbsolute, volume.volumeFolder);
        const mokuroPathRelative = path.join(seriesDirRelative, `${volume.volumeFolder}.mokuro`);
        const mokuroPathAbsolute = path.join(seriesDirAbsolute, `${volume.volumeFolder}.mokuro`);

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
            folderName: volume.volumeFolder,
            title: jsonVolumeTitle,
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
        // Based on upload logic, it's 'uploads/<userId>/<seriesFolderName>/'
        const seriesDirRelative = path.join('uploads', userId, series.folderName);
        const seriesDirAbsolute = path.join(
          fastify.projectRoot,
          seriesDirRelative
        );

        // Ensure directory exists (it should, but good practice)
        await fs.promises.mkdir(seriesDirAbsolute, { recursive: true });

        // 3. Construct new filename: <seriesFolderName>.<ext>
        const ext = path.extname(data.filename).toLowerCase() || '.jpg';
        const newFileName = `${series.folderName}${ext}`;
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
                folderName: 'asc', // Or by a 'volumeNumber' if we add one later
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
          title: volume.title ?? volume.folderName,
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

  // --- PATCH /api/library/series/:id ---
  // Update series metadata, for now it's just title
  fastify.patch<{ Params: UpdateEntityParams; Body: UpdateEntityBody }>(
    '/series/:id',
    async (request, reply) => {
      const { id } = request.params;
      const { title } = request.body;

      try {
        const series = await fastify.prisma.series.updateMany({
          where: { id, ownerId: request.user.id },
          data: { title }
        });

        if (series.count === 0) return reply.status(404).send({ message: 'Series not found or access denied.' });
        return reply.status(200).send({ message: 'Series display title updated.' });
      } catch (e) {
        fastify.log.error(e);
        return reply.status(500).send({ message: 'Update failed.' });
      }
    }
  );

  // --- PATCH /api/library/volume/:id ---
  // Update volume metadata, for now it's just title
  fastify.patch<{ Params: UpdateEntityParams; Body: UpdateEntityBody }>(
    '/volume/:id',
    async (request, reply) => {
      const { id } = request.params;
      const { title } = request.body;

      try {
        const vol = await fastify.prisma.volume.findFirst({
          where: { id, series: { ownerId: request.user.id } }
        });

        if (!vol) return reply.status(404).send({ message: 'Volume not found or access denied.' });

        await fastify.prisma.volume.update({
          where: { id },
          data: { title }
        });

        return reply.status(200).send({ message: 'Volume display title updated.' });
      } catch (e) {
        fastify.log.error(e);
        return reply.status(500).send({ message: 'Update failed.' });
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
          // mokuroPath is 'uploads/userId/seriesFolderName/volume.mokuro'
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
        // filePath is 'uploads/userId/seriesFolderName/volumeFolderName'
        const absoluteVolumePath = path.join(
          fastify.projectRoot,
          volume.filePath
        );
        await fs.promises.rm(absoluteVolumePath, {
          recursive: true,
          force: true
        });
        // mokuroPath is 'uploads/userId/seriesFolderName/volume.mokuro'
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
