import { FastifyPluginAsync, FastifyReply } from 'fastify';
import { pipeline, Readable } from 'stream';
import util from 'util';
import fs from 'fs';
import path from 'path';
import { updateSeriesStatus } from '../utils/seriesStatus';
import { Prisma } from '../generated/prisma/client';

// Promisify pipeline for async/await
const pump = util.promisify(pipeline);

// --- Helpers ---

// 1. Safe Filename (Security)
// Prevents directory traversal (../../) and illegal chars
function safeFilename(str: string): string {
  // Replace illegal chars with underscore, trim whitespace
  return str.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
}

// 2. Cleanup Helper (Rollback)
async function deleteFolder(pathStr: string) {
  try {
    await fs.promises.rm(pathStr, { recursive: true, force: true });
  } catch (e) {
    console.error(`Failed to cleanup folder: ${pathStr}`, e);
  }
}

// 3. File consume
// Drains a readable stream completely by resuming it and waiting for the 'end' event.
// This is used to discard file contents we don't want to save.

function drainStream(stream: Readable): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.on('end', resolve);
    stream.on('error', reject);
    stream.resume(); // Start the flow
  });
}

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

// get request query
interface LibraryQuery {
  page?: number;
  limit?: number;
  q?: string;
  sort?: 'title' | 'created' | 'updated' | 'recent';
  order?: 'asc' | 'desc';
  status?: 'all' | 'read' | 'unread' | 'reading';
  bookmarked?: string;
}

interface MokuroPage { }

interface MokuroData {
  pages: MokuroPage[];
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
  fastify.get<{ Querystring: LibraryQuery }>('/', async (request, reply) => {
    const userId = request.user.id; // provided by the authenticate hook

    // 1. Parse Query Params with Defaults
    const page = Math.max(1, request.query.page ?? 1);
    const limit = Math.max(1, Math.min(100, request.query.limit ?? 20)); // Max 100 per page
    const q = request.query.q?.trim() ?? '';
    const sort = request.query.sort ?? 'title';
    const order = request.query.order ?? 'asc';
    const status = request.query.status ?? 'all';
    const bookmarked = request.query.bookmarked === 'false';

    // 2. Build Where Clause (Search)
    const where: Prisma.SeriesWhereInput = {
      ownerId: userId,
    };

    if (q) {
      where.sortTitle = { contains: q };
    }

    if (bookmarked) {
      where.bookmarked = true;
    }

    if (status !== 'all') {
      if (status === 'unread') where.status = 0;
      else if (status === 'reading') where.status = 1;
      else if (status === 'read') where.status = 2;
    }
    // 3. Build OrderBy Clause
    let orderBy: Prisma.SeriesOrderByWithRelationInput | Prisma.SeriesOrderByWithRelationInput[];

    switch (sort) {
      case 'created':
        orderBy = { createdAt: order };
        break;
      case 'updated':
        orderBy = { updatedAt: order };
        break;
      case 'recent':
        // Sort by the denormalized lastReadAt field on Series
        orderBy = { lastReadAt: order };
        break;
      case 'title':
      default:
        // Secondary sort by folderName ensures stable sorting if titles are null/identical
        orderBy = { sortTitle: order };
        break;
    }

    try {
      // 4. Execute Transaction for Data + Count
      const [total, series] = await fastify.prisma.$transaction([
        fastify.prisma.series.count({ where }),
        fastify.prisma.series.findMany({
          where,
          orderBy,
          take: limit,
          skip: (page - 1) * limit,
          include: {
            volumes: {
              orderBy: { title: 'asc' },
              select: {
                pageCount: true,
                progress: {
                  select: {
                    completed: true,
                    page: true
                  }
                }
              }
            },
          },
        }),
      ]);

      // 5. Return Paginated Response
      return reply.status(200).send({
        data: series,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      });

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
   * POST /api/library/check
   * Quick check to see if a Series/Volume pair already exists.
   * Prevents "EPIPE" errors by avoiding redundant uploads.
   */
  fastify.post<{ Body: { series_folder_name: string; volume_folder_name: string } }>(
    '/check',
    async (request, reply) => {
      const { series_folder_name, volume_folder_name } = request.body;
      const userId = request.user.id;

      if (!series_folder_name || !volume_folder_name) {
        return reply.status(400).send({ message: 'Missing identifiers' });
      }

      const exists = await fastify.prisma.volume.findFirst({
        where: {
          folderName: volume_folder_name,
          series: {
            folderName: series_folder_name,
            ownerId: userId
          }
        },
        select: { id: true } // Select minimal data
      });

      return reply.send({ exists: !!exists });
    }
  );

  /**
   * POST /api/library/upload
   * Smart Pipeline Upload: Receives one volume at a time.
   * STRICT ORDER: Fields (Identifiers) MUST come before Files.
   */
  fastify.post('/upload', async (request, reply) => {
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
          }

          else if (isCoverImage) {
            potentialSeriesCoverPath = path.join('uploads', userId, seriesFolder, safeName).replace(/\\/g, '/');
            absPath = path.join(fastify.projectRoot, potentialSeriesCoverPath);
          }

          else if (isImage) {
            // Only use as Volume Cover if it's NOT the series cover
            // and if we haven't found any other image yet
            if (!coverImageName) coverImageName = safeName;
            // increment page count
            pageCount++;
          }

          else {
            // invalid file, skip
            await drainStream(part.file);
            continue;
          }

          // 4. Save File
          await pump(part.file, fs.createWriteStream(absPath));
        }
      }

      // --- PHASE 3: Database Update ---
      if (pageCount === 0) {
        throw new Error('No files received.');
      }
      if (!mokuroPathRelative) {
        throw new Error('Mokuro file missing.');
      }

      // 1. Upsert Series
      // We use the folder name as the ID. Title comes from metadata if available.
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
            bookmarked: metadata.series_bookmarked ?? false,
            // If we found a file matching "SeriesName.jpg", use it as cover
            coverPath: potentialSeriesCoverPath
          }
        });
      } else {
        let updateData: Prisma.SeriesUpdateInput = {
          updatedAt: new Date()
        };

        // Update title if provided and missing
        if (metadata.series_title && !series.title) {
          updateData.title = metadata.series_title;
          updateData.sortTitle = metadata.series_title;
        }

        // Update description if provided and missing
        if (metadata.series_description && !series.description) {
          updateData.description = metadata.series_description;
        }

        // Update cover if we found a better candidate and one didn't exist
        if (potentialSeriesCoverPath && !series.coverPath) {
          updateData.coverPath = potentialSeriesCoverPath;
        }

        await fastify.prisma.series.update({
          where: { id: series.id },
          data: updateData
        });
      }

      // 2. Create Volume
      const volumePathRelative = path.join('uploads', userId, seriesFolder, volumeFolder).replace(/\\/g, '/');

      const volume = await fastify.prisma.volume.create({
        data: {
          seriesId: series.id,
          folderName: volumeFolder,
          title: metadata.volume_title || null,
          sortTitle: metadata.volume_title || volumeFolder,
          pageCount: pageCount,
          filePath: volumePathRelative,
          mokuroPath: mokuroPathRelative || '', // Might be empty if user uploaded raw images
          coverImageName: coverImageName
        }
      });

      // 3. Update Progress (if provided)
      if (metadata.volume_progress) {
        // We upsert progress for the current uploading user
        // Although user progress shouldn't exist at this point,
        // we use upsert as insurance
        await fastify.prisma.userProgress.upsert({
          where: {
            userId_volumeId: {
              userId: userId,
              volumeId: volume.id
            }
          },
          update: {
            page: metadata.volume_progress.page,
            completed: metadata.volume_progress.isCompleted
          },
          create: {
            userId: userId,
            volumeId: volume.id,
            page: metadata.volume_progress.page,
            completed: metadata.volume_progress.isCompleted
          }
        });

        // Recalculate Status (e.g. adding a volume might un-complete a series)
        // TODO: this is O(N^2)! although the number of volumes per series shouldn't go that high
        await updateSeriesStatus(fastify.prisma, series.id);
      }
      return reply.status(200).send({
        message: 'Upload processed.',
        processed: 1,
        volumeId: volume.id
      });

    } catch (err) {
      // ROLLBACK: If anything failed, delete the half-written folder
      if (targetDir) {
        await deleteFolder(targetDir);
      }
      fastify.log.error(err);
      return reply.status(500).send({
        message: (err as Error).message || 'Upload failed.'
      });
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
      fastify.log.info(seriesId);

      try {
        const series = await fastify.prisma.series.findFirst({
          where: {
            id: seriesId,
            ownerId: userId, // Security check
          },
          include: {
            volumes: {
              orderBy: {
                sortTitle: 'asc', // Or by a 'volumeNumber' if we add one later
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
                    charsRead: true,
                    lastReadAt: true
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
        // --- SANITY CHECK ---
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

        // 3.1. Recalculate status of the parent series
        await updateSeriesStatus(fastify.prisma, volume.seriesId);

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
