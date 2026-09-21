import { FastifyPluginAsync } from 'fastify';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import PDFDocument from 'pdfkit';
import { Volume, Series, UserSeriesSettings, UserProgress } from '../generated/prisma/client';
import { randomUUID } from 'crypto';
import { FastifyInstance, FastifyReply } from 'fastify';
import { getComputedMokuroState } from '../utils/ocrHelpers';
import {
  buildComicInfoXml,
  generateSeriesMetadata
} from '../utils/export/metadata';


// an interface for the route parameters
interface VolumeParams {
  id: string; // This 'id' is the volumeId
}

interface SeriesParams {
  id: string; // This 'id' is the seriesId
}

interface ExportQuery {
  include_images?: string;
  include_metadata?: string;
}

/**
 * Generates PDF pages for a single volume and adds them to an existing PDF document.
 *
 * @param volume - The Prisma volume object (must include its series)
 * @param projectRoot - The absolute path to the project root
 * @param log - The Fastify logger instance
 * @param doc - The PDFKit document instance to add pages to
 */
const generateVolumePdf = async (
  fastify: FastifyInstance,
  userId: string,
  volume: Volume & { series: Series },
  doc: PDFKit.PDFDocument
) => {
  const projectRoot = fastify.projectRoot;
  const log = fastify.log;
  const mokuroData = await getComputedMokuroState(fastify, userId, volume);

  log.info(`Generating PDF pages for: ${volume.series.folderName} - ${volume.folderName}`);

  const fontPath = path.join(
    projectRoot,
    'frontend',
    'static',
    'fonts',
    'noto-sans-jp-v55-japanese_latin-regular.woff2'
  );

  try {
    await fs.promises.access(fontPath);
  } catch (fontError) {
    log.error(`Font file not found at ${fontPath}`);
    throw new Error('Required font file not found on server.');
  }

  for (const page of mokuroData.pages) {
    const imagePath = path.join(
      projectRoot,
      volume.filePath,
      page.img_path
    );
    const dims = {
      width: page.img_width,
      height: page.img_height
    };

    doc.addPage({ size: [dims.width, dims.height] });

    doc.image(imagePath, 0, 0, {
      width: dims.width,
      height: dims.height
    });

    for (const block of page.blocks) {
      // Apply font size once per block
      const fontSize = block.font_size || 12;
      doc.font(fontPath).fontSize(fontSize);

      block.lines.forEach((lineText, index) => {
        const coords = block.lines_coords[index];

        // Set opacity for invisible text
        doc.fillColor('black').fillOpacity(0);
        const textOptions: PDFKit.Mixins.TextOptions = {
          lineBreak: false,
          align: 'left', // 'left' in rotated context flows "down" from the (0,0) origin
          lineGap: 0,
        };

        if (block.vertical) {
          // Use the TOP-RIGHT corner as the origin
          const x = coords[1][0]; // top-right x
          const y = coords[1][1]; // top-right y

          doc.save();
          // Translate to the text's top-right corner
          doc.translate(x, y);
          // Rotate 90 degrees around this new origin
          doc.rotate(90);

          // Draw text at the new (0,0) origin
          doc.text(lineText, 0, -fontSize / 2, textOptions);

          doc.restore();
        } else {
          // --- HORIZONTAL (STANDARD) LOGIC ---

          // Use the TOP-LEFT corner as the origin
          const x = coords[0][0]; // top-left x
          const y = coords[0][1]; // top-left y

          // Draw text at its absolute (x, y) position
          doc.text(lineText, x, y, textOptions);
        }
      });
    }
  }
};

const generateVolumePdfBuffer = async (
  fastify: FastifyInstance,
  userId: string,
  volume: Volume & { series: Series }
) => {
  const doc = new PDFDocument({ autoFirstPage: false });
  const chunks: Buffer[] = [];

  return new Promise<Buffer>(async (resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    try {
      await generateVolumePdf(fastify, userId, volume, doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

export const runWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
) => {
  const results: R[] = new Array(items.length);
  let index = 0;

  const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(runners);
  return results;
};

// Maps a UUID ticket to the request body { ids, type, options }
// This is simple and effective for a single-instance personal server.
type BatchExportBody = {
  ids: string[];
  type: 'series' | 'volume';
  options?: { include_images?: boolean; include_metadata?: boolean };
};

const exportTickets = new Map<string, BatchExportBody>();

// --- Shared Batch Logic for both the GET and POST endpoints ---
async function executeBatchExport(
  fastify: FastifyInstance,
  reply: FastifyReply,
  body: BatchExportBody,
  userId: string
) {
  const { ids, type, options } = body;
  const includeImages = options?.include_images ?? true;
  const includeMetadata = options?.include_metadata ?? true;

  if (!ids || ids.length === 0) {
    // If we haven't sent headers yet, send error
    if (!reply.raw.headersSent) return reply.status(400).send('No IDs provided');
    return;
  }

  const archive = archiver('zip', { zlib: { level: includeImages ? 0 : 5 } });
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `mokuro_batch_${type}_${timestamp}.zip`;

  // Set Headers for Download
  reply.header('Content-Type', 'application/zip');
  reply.header('Content-Disposition', `attachment; filename="${filename}"`);

  // Start Streaming
  reply.send(archive);

  try {
    if (type === 'series') {
      const seriesList = await fastify.prisma.series.findMany({
        where: {
          id: { in: ids },
          OR: [
            { ownerId: userId },
            { ownerId: 'admin' }
          ]
        },
        include: {
          userSettings: { where: { userId } },
          volumes: { include: { progress: { where: { userId } } } }
        }
      });

      for (const series of seriesList) {
        // Now 'series' has the correct type structure for the helper
        await addSeriesToArchive(
          fastify,
          archive,
          series,
          series.folderName,
          userId,
          includeImages,
          includeMetadata
        );
      }
    } else if (type === 'volume') {
      // fetch their series ids
      const volumes = await fastify.prisma.volume.findMany({
        where: {
          id: { in: ids },
          series: {
            OR: [
              { ownerId: userId },
              { ownerId: 'admin' }
            ]
          }
        },
        include: {
          series: {
            include: {
              userSettings: { where: { userId } }
            }
          },
          progress: { where: { userId } }
        }
      });

      // sort by series
      const seriesMap = new Map<
        string,
        {
          series: Series & { userSettings: UserSeriesSettings[] };
          volumes: (Volume & { progress: UserProgress[] })[];
        }
      >();
      for (const vol of volumes) {
        const sId = vol.seriesId;
        if (!seriesMap.has(sId)) seriesMap.set(sId, { series: vol.series, volumes: [] });
        seriesMap.get(sId)!.volumes.push(vol);
      }

      // process in series batches
      for (const [_, group] of seriesMap) {
        const { series, volumes } = group;

        await addSeriesToArchive(
          fastify,
          archive,
          { ...series, volumes },
          series.folderName,
          userId,
          includeImages,
          includeMetadata
        );
      }
    }

    await archive.finalize();
  } catch (err) {
    fastify.log.error(err);
    // If the stream has started, we can't send a JSON error. The download will just fail/cut off.
    if (!reply.raw.headersSent) reply.status(500).send('Export failed');
    else reply.raw.destroy();
  }
}

// --- Helper for adding Volume to Archive ---

async function addVolumeToArchive(
  fastify: FastifyInstance,
  archive: archiver.Archiver,
  volume: Volume,
  basePath: string, // "" for root, or "SeriesName" for nesting
  userId: string,
  includeImages: boolean,
  includeMetadata: boolean,
  seriesOverride?: Series & { userSettings?: UserSeriesSettings[] }
) {
  // 1. Add .mokuro file (Computed State)
  try {
    const mokuroData = await getComputedMokuroState(fastify, userId, volume);

    // Append the computed JSON string to the archive
    archive.append(JSON.stringify(mokuroData, null, 2), {
      name: path.join(basePath, `${volume.folderName}.mokuro`)
    });
  } catch (e) {
    fastify.log.error(`Failed to export mokuro state for volume ${volume.id}: ${e}`);
    // Optional: Add a text file explaining the error in the zip?
  }

  if (includeMetadata && seriesOverride) {
    const info = buildComicInfoXml(seriesOverride, volume);
    archive.append(info, { name: path.join(basePath, volume.folderName, 'ComicInfo.xml') });
  }

  // 2. Add Images (Optional)
  if (includeImages) {
    const absVolPath = path.join(fastify.projectRoot, volume.filePath);
    if (fs.existsSync(absVolPath)) {
      archive.directory(absVolPath, path.join(basePath, volume.folderName));
    }
  }
}

// --- Helper: Add an Entire Series (Metadata + Cover + Volumes) ---
async function addSeriesToArchive(
  fastify: FastifyInstance,
  archive: archiver.Archiver,
  series: Series & { volumes: (Volume & { progress: UserProgress[] })[], userSettings: UserSeriesSettings[] },
  basePath: string,
  userId: string,
  includeImages: boolean,
  includeMetadata: boolean
) {
  // 1. Metadata
  if (includeMetadata) {
    const info = buildComicInfoXml(series, undefined);
    const metadata = generateSeriesMetadata(series, series.volumes, userId);
    const jsonName = `${series.folderName}.json`;

    archive.append(info, { name: path.join(basePath, 'ComicInfo.xml') });
    archive.append(JSON.stringify(metadata, null, 2), {
      name: path.join(basePath, jsonName)
    });
  }

  // 2. Series Cover
  if (series.coverPath) {
    const absCover = path.join(fastify.projectRoot, series.coverPath);
    if (fs.existsSync(absCover)) {
      archive.file(absCover, {
        name: path.join(basePath, path.basename(series.coverPath))
      });
    }
  }

  // 3. Volumes
  for (const vol of series.volumes) {
    await addVolumeToArchive(
      fastify,
      archive,
      vol,
      basePath,
      userId,
      includeImages,
      includeMetadata,
      series
    );
  }
}

const exportRoutes: FastifyPluginAsync = async (
  fastify,
  opts
): Promise<void> => {
  // Protect all routes in this file
  fastify.addHook('preHandler', fastify.authenticate);

  /**
   * GET /api/export/volume/:id/zip
   * Downloads a single volume as a ZIP.
   */
  fastify.get<{ Params: VolumeParams; Querystring: ExportQuery }>(
    '/volume/:id/zip',
    async (request, reply) => {
      const { id: volumeId } = request.params;
      const userId = request.user.id;
      const includeImages = request.query.include_images !== 'false';
      const includeMetadata = request.query.include_metadata !== 'false';

      // 1. Fetch Volume with Shared Access Logic
      const volume = await fastify.prisma.volume.findFirst({
        where: {
          id: volumeId,
          series: {
            OR: [
              { ownerId: userId },
              { ownerId: 'admin' }
            ]
          }
        },
        include: {
          series: {
            include: {
              // Fetch user-specific settings to get 'bookmarked' status
              userSettings: { where: { userId } }
            }
          },
          progress: { where: { userId } }
        }
      });

      if (!volume) return reply.status(404).send('Volume not found');

      // Setup Archive
      const archive = archiver('zip', { zlib: { level: includeImages ? 0 : 5 } });
      const safeFileName = encodeURIComponent(`${volume.series.folderName} - ${volume.folderName}`);

      reply.header('Content-Type', 'application/zip');
      reply.header('Content-Disposition', `attachment; filename="${safeFileName}.zip"`);
      reply.send(archive);

      try {
        // 1. Add Metadata (Series Context)
        if (includeMetadata) {
          const metadata = generateSeriesMetadata(volume.series, [volume], userId);
          archive.append(buildComicInfoXml(volume.series, volume), {
            name: 'ComicInfo.xml'
          });
          archive.append(JSON.stringify(metadata, null, 2), {
            name: `${volume.series.folderName}.json`
          });
        }

        // 2. Add Volume Files (At Root)
        await addVolumeToArchive(
          fastify,
          archive,
          volume,
          '',
          userId,
          includeImages,
          includeMetadata,
          volume.series
        );

        await archive.finalize();
      } catch (err) {
        fastify.log.error(err);
        if (!reply.raw.headersSent) reply.status(500).send('Export failed');
        else reply.raw.destroy();
      }
    }
  );

  /**
   * GET /api/export/volume/:id/pdf
   * Downloads a single volume as a PDF with selectable text.
   */
  fastify.get<{ Params: VolumeParams }>(
    '/volume/:id/pdf',
    async (request, reply) => {
      const { id: volumeId } = request.params;
      const userId = request.user.id;

      // 1. Fetch Volume with Shared Access Logic
      const volume = await fastify.prisma.volume.findFirst({
        where: {
          id: volumeId,
          series: {
            OR: [
              { ownerId: userId },
              { ownerId: 'admin' }
            ]
          }
        },
        include: { series: true }
      });

      if (!volume) {
        return reply.status(404).send('Volume not found');
      }

      const doc = new PDFDocument({
        autoFirstPage: false
      });

      try {
        const safeFileName = encodeURIComponent(
          `${volume.series.folderName} - ${volume.folderName}`
        );
        // Trigger save dialog instead of inline
        reply.header('Content-Type', 'application/pdf');
        reply.header(
          'Content-Disposition',
          `inline; filename="${safeFileName}.pdf"`
        );

        await generateVolumePdf(
          fastify,
          userId,
          volume,
          doc
        );

        doc.end();

        return reply.send(doc);

      } catch (err) {
        fastify.log.error(err, 'PDF generation failed');
        if (!reply.raw.headersSent) {
          reply.status(500).send('Error generating PDF');
        } else {
          reply.raw.destroy();
        }
      }
    }
  );

  /**
   * GET /api/export/series/:id/zip
   * Downloads an entire series as a ZIP.
   */
  fastify.get<{ Params: SeriesParams; Querystring: ExportQuery }>(
    '/series/:id/zip',
    async (request, reply) => {
      const { id: seriesId } = request.params;
      const userId = request.user.id;
      const includeImages = request.query.include_images !== 'false';
      const includeMetadata = request.query.include_metadata !== 'false';

      // 1. Fetch Series with Shared Access Logic
      const series = await fastify.prisma.series.findFirst({
        where: {
          id: seriesId,
          OR: [
            { ownerId: userId },
            { ownerId: 'admin' }
          ]
        },
        include: {
          // Fetch user-specific settings to get 'bookmarked' status
          userSettings: { where: { userId } },
          volumes: {
            include: {
              progress: { where: { userId } }
            },
            orderBy: { sortTitle: 'asc' } // Ensure consistent order
          }
        }
      });

      if (!series) return reply.status(404).send({ message: 'Series not found' });

      // Setup Archive
      const archive = archiver('zip', { zlib: { level: includeImages ? 0 : 5 } });
      const safeFileName = encodeURIComponent(series.folderName);

      reply.header('Content-Type', 'application/zip');
      reply.header('Content-Disposition', `attachment; filename="${safeFileName}.zip"`);
      reply.send(archive);

      try {
        // Add Series (At Root)
        await addSeriesToArchive(
          fastify,
          archive,
          series,
          '',
          userId,
          includeImages,
          includeMetadata
        );
        await archive.finalize();
      } catch (error) {
        fastify.log.error(error);
        if (!reply.raw.headersSent) reply.status(500).send({ message: 'Export failed' });
        else reply.raw.destroy();
      }
    }
  );

  /**
   * GET /api/export/series/:id/pdf
   * Download a series as a zip of pdfs
   */
  fastify.get<{ Params: SeriesParams }>(
    '/series/:id/pdf',
    async (request, reply) => {
      const { id: seriesId } = request.params;
      const userId = request.user.id;

      // 1. Fetch Series with Shared Access Logic
      const series = await fastify.prisma.series.findFirst({
        where: {
          id: seriesId,
          OR: [
            { ownerId: userId },
            { ownerId: 'admin' }
          ]
        }
      });

      if (!series) {
        return reply.status(404).send('Series not found');
      }

      // 2. Fetch Volumes (No ownership check needed, implicitly covered by series check)
      const volumes = await fastify.prisma.volume.findMany({
        where: { seriesId: series.id },
        include: { series: true },
        orderBy: { sortTitle: 'asc' }
      });

      if (volumes.length === 0) {
        return reply.status(400).send('Series is empty');
      }

      const safeFileName = encodeURIComponent(series.folderName);
      reply.header('Content-Type', 'application/zip');
      reply.header(
        'Content-Disposition',
        `attachment; filename="${safeFileName}.zip"`
      );

      const archive = archiver('zip', { zlib: { level: 0 } });
      archive.on('error', (err) => {
        fastify.log.error(err, 'ZIP Archiving error');
        if (!reply.raw.headersSent) {
          reply.status(500).send('Archiving error');
        }
      });

      try {
        const pdfBuffers = await runWithConcurrency(
          volumes,
          3,
          (volume) => generateVolumePdfBuffer(fastify, userId, volume)
        );

        for (let i = 0; i < volumes.length; i += 1) {
          const pdfFileName = `${volumes[i].folderName}.pdf`;
          archive.append(pdfBuffers[i], { name: pdfFileName });
        }

        archive.finalize(); // Finalize the archive
        return reply.send(archive); // Send the archive stream

      } catch (err) {
        fastify.log.error(err, 'PDF-in-ZIP generation failed');
        if (!reply.raw.headersSent) {
          reply.status(500).send('Error generating PDF');
        } else {
          reply.raw.destroy(); // In case of error, destroy the raw reply
        }
      }
    }
  );

  /**
   * GET /api/export/zip
   * Downloads the entire user library as a ZIP.
   */
  fastify.get<{ Querystring: ExportQuery }>('/zip', async (request, reply) => {
    const userId = request.user.id;
    const includeImages = request.query.include_images !== 'false';
    const includeMetadata = request.query.include_metadata !== 'false';

    try {
      const allSeries = await fastify.prisma.series.findMany({
        where: {
          OR: [
            { ownerId: userId },
            { ownerId: 'admin' }
          ]
        },
        include: {
          // REQUIRED: Fetch user-specific settings to get 'bookmarked' status
          userSettings: { where: { userId } },
          volumes: {
            include: {
              progress: { where: { userId } }
            },
            orderBy: { sortTitle: 'asc' }
          }
        },
        orderBy: { sortTitle: 'asc' }
      });

      const archive = archiver('zip', { zlib: { level: 5 } });
      const filename = `Mokuro_Library_Backup.zip`;

      reply.header('Content-Type', 'application/zip');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      reply.send(archive);

      for (const series of allSeries) {
        const seriesRoot = series.folderName;

        // 1. Generate Metadata
        if (includeMetadata) {
          const metadata = generateSeriesMetadata(series, series.volumes, userId);
          const jsonFilename = path.join(seriesRoot, `${series.folderName}.json`);

          archive.append(buildComicInfoXml(series, undefined), {
            name: path.join(seriesRoot, 'ComicInfo.xml')
          });
          archive.append(JSON.stringify(metadata, null, 2), { name: jsonFilename });
        }

        // 2. Add Series Cover
        if (series.coverPath) {
          const absCoverPath = path.join(fastify.projectRoot, series.coverPath);
          if (fs.existsSync(absCoverPath)) {
            archive.file(absCoverPath, { name: path.join(seriesRoot, path.basename(series.coverPath)) });
          }
        }

        // 3. Add Volumes
        for (const vol of series.volumes) {
          await addVolumeToArchive(
            fastify,
            archive,
            vol,
            seriesRoot,
            userId,
            includeImages,
            includeMetadata,
            series
          );
        }
      }

      await archive.finalize();
    } catch (error) {
      fastify.log.error(error);
      if (!reply.raw.headersSent) reply.status(500).send({ message: 'Export failed' });
      else reply.raw.destroy();
    }
  });

  /**
   * GET /api/export/pdf
   * Download the entire user library as a zip of organized pdf
   */
  fastify.get('/pdf', async (request, reply) => {
    const userId = request.user.id;

    const volumes = await fastify.prisma.volume.findMany({
      where: {
        series: {
          OR: [
            { ownerId: userId },
            { ownerId: 'admin' }
          ]
        }
      },
      include: { series: true },
      orderBy: [
        { series: { sortTitle: 'asc' } }, // Changed folderName to sortTitle for better sorting
        { sortTitle: 'asc' }
      ]
    });

    if (volumes.length === 0) {
      return reply.status(404).send('Library is empty');
    }

    const safeFileName = encodeURIComponent(`${request.user.username}-library`);
    reply.header('Content-Type', 'application/zip');
    reply.header(
      'Content-Disposition',
      `attachment; filename="${safeFileName}.zip"`
    );

    const archive = archiver('zip', { zlib: { level: 0 } });
    archive.on('error', (err) => {
      fastify.log.error(err, 'ZIP Archiving error');
      if (!reply.raw.headersSent) {
        reply.status(500).send('Archiving error');
      }
    });

    try {
      const pdfBuffers = await runWithConcurrency(
        volumes,
        3,
        (volume) => generateVolumePdfBuffer(fastify, userId, volume)
      );

      for (let i = 0; i < volumes.length; i += 1) {
        const pdfFileName = `${volumes[i].series.folderName}/${volumes[i].folderName}.pdf`;
        archive.append(pdfBuffers[i], { name: pdfFileName });
      }

      archive.finalize();
      return reply.send(archive);

    } catch (err) {
      fastify.log.error(err, 'PDF-in-ZIP generation failed');
      if (!reply.raw.headersSent) {
        reply.status(500).send('Error generating PDF');
      } else {
        reply.raw.destroy();
      }
    }
  });

  /**
   * POST /api/export/batch/ticket
   * Generates a temporary ticket for batch downloading.
   */
  fastify.post<{
    Body: {
      ids: string[];
      type: 'series' | 'volume';
      options?: { include_images?: boolean; include_metadata?: boolean };
    }
  }>('/batch/ticket', async (request, reply) => {
    const ticket = randomUUID();

    // Store the body options associated with this ticket
    exportTickets.set(ticket, request.body);

    // Auto-expire ticket after 60 seconds to prevent memory leaks
    setTimeout(() => exportTickets.delete(ticket), 60000);

    return { ticket };
  });

  /**
   * GET /api/export/batch
   * Consumes a ticket and starts the stream.
   * Browser navigates here directly.
   */
  fastify.get<{ Querystring: { ticket: string } }>('/batch', async (request, reply) => {
    const { ticket } = request.query;
    const body = exportTickets.get(ticket);

    if (!body) {
      return reply.status(404).send('Invalid or expired download ticket.');
    }

    // Invalidate ticket immediately (One-time use)
    exportTickets.delete(ticket);

    // Reuse the exact same logic
    return executeBatchExport(fastify, reply, body, request.user.id);
  });

  /**
   * POST /api/export/batch (Legacy/Direct API access)
   * We keep this for programmatic access (e.g. curl scripts)
   */
  fastify.post<{
    Body: {
      ids: string[];
      type: 'series' | 'volume';
      options?: { include_images?: boolean; include_metadata?: boolean };
    }
  }>('/batch', async (request, reply) => {
    return executeBatchExport(fastify, reply, request.body, request.user.id);
  });
}

export default exportRoutes;
