import { FastifyPluginAsync, FastifyReply, FastifyBaseLogger } from 'fastify';
import util from 'util';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import PDFDocument from 'pdfkit';
import { Volume, Series } from '../generated/prisma/client';
import { Readable } from 'stream';

interface MokuroBlock {
  box: [number, number, number, number];
  lines_coords: [[number, number], [number, number], [number, number], [number, number]][];
  lines: string[];
  vertical?: boolean;
  font_size?: number;
}
interface MokuroPage {
  img_width: number;
  img_height: number;
  blocks: MokuroBlock[];
  img_path: string;
}
interface MokuroData {
  title: string;
  title_uuid: string;
  volume: string;
  pages: MokuroPage[];
}

// an interface for the route parameters
interface VolumeParams {
  id: string; // This 'id' is the volumeId
}

interface SeriesParams {
  id: string; // This 'id' is the seriesId
}

interface ExportQuery {
  include_images?: string;
}

// Shared Interface for the Metadata JSON
interface MokuroSeriesMetadata {
  version: string;
  series: {
    title: string | null;
    description: string | null;
    originalFolderName: string;
  };
  volumes: {
    [fileName: string]: {
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

// for a volume that includes its series relation.
// Use a simple, explicit interface as requested.
interface VolumeWithSeries extends Volume {
  series: Series;
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
  volume: VolumeWithSeries,
  projectRoot: string,
  log: FastifyBaseLogger,
  doc: PDFKit.PDFDocument
) => {
  log.info(`Generating PDF pages for: ${volume.series.folderName} - ${volume.folderName}`);

  const absoluteMokuroPath = path.join(
    projectRoot,
    volume.mokuroPath
  );
  const mokuroFileContent = await fs.promises.readFile(
    absoluteMokuroPath,
    'utf-8'
  );
  const mokuroData: MokuroData = JSON.parse(mokuroFileContent);

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

// --- Helper: Generate Metadata Object ---
const generateSeriesMetadata = (
  series: any,
  volumes: any[],
  userId: string
): MokuroSeriesMetadata => {
  const volumeMap: MokuroSeriesMetadata['volumes'] = {};

  for (const vol of volumes) {
    const fileName = `${vol.folderName}`;
    // Find progress for this specific user
    const userProgress = vol.progress.find((p: any) => p.userId === userId);

    volumeMap[fileName] = {
      displayTitle: vol.title,
      progress: userProgress ? {
        page: userProgress.page,
        isCompleted: userProgress.completed,
        timeRead: userProgress.timeRead,
        charsRead: userProgress.charsRead
      } : undefined
    };
  }

  return {
    version: "0.2.0",
    series: {
      title: series.title,
      description: series.description,
      originalFolderName: series.folderName
    },
    volumes: volumeMap
  };
};

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
      const includeImages = request.query.include_images !== 'false'; // Default true

      const volume = await fastify.prisma.volume.findFirst({
        where: { id: volumeId, series: { ownerId: userId } },
        include: {
          series: true,
          progress: { where: { userId } }
        }
      });

      if (!volume) {
        return reply.status(404).send('Volume not found');
      }

      // Create a ZIP containing:
      // 1. All images from volume.filePath
      // 2. The .mokuro file
      const archive = archiver('zip', { zlib: { level: 0 } }); // moderate compression for speed

      reply.header('Content-Type', 'application/zip');
      // Safely encode the filename to handle spaces and special characters
      const safeFileName = encodeURIComponent(`${volume.series.folderName} - ${volume.folderName}`);
      reply.header('Content-Disposition', `attachment; filename="${safeFileName}.zip"`);

      archive.on('error', (err) => {
        fastify.log.error(err);
        if (!reply.raw.headersSent) {
          reply.status(500).send('Archiving error');
        }
      });

      // Generate Metadata for this specific volume context
      // We create a "Series" metadata file even for a single volume export,
      // so that if the user extracts it, they get the Series context.
      const metadata = generateSeriesMetadata(volume.series, [volume], userId);
      archive.append(JSON.stringify(metadata, null, 2), { name: `${volume.series.folderName}.json` });

      if (includeImages) {
        // Add the volume directory (images)
        const absoluteVolumePath = path.join(fastify.projectRoot, volume.filePath);
        archive.directory(absoluteVolumePath, volume.folderName);
      }

      // Add the .mokuro file
      const absoluteMokuroPath = path.join(
        fastify.projectRoot,
        volume.mokuroPath
      );
      archive.file(absoluteMokuroPath, { name: `${volume.folderName}.mokuro` });

      archive.finalize();
      return reply.send(archive);
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

      // The `volume` variable will be inferred as `VolumeWithSeries | null`
      // because of the `include: { series: true }`.
      const volume = await fastify.prisma.volume.findFirst({
        where: { id: volumeId, series: { ownerId: userId } },
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
          volume,
          fastify.projectRoot,
          fastify.log,
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

      try {
        const series = await fastify.prisma.series.findFirst({
          where: { id: seriesId, ownerId: userId },
          include: {
            volumes: {
              include: {
                progress: { where: { userId } }
              }
            }
          }
        });

        if (!series) return reply.status(404).send({ message: 'Series not found' });

        const archive = archiver('zip', { zlib: { level: 5 } });
        const filename = `${series.folderName}.zip`;

        reply.header('Content-Type', 'application/zip');
        reply.header('Content-Disposition', `attachment; filename="${filename}"`);
        reply.send(archive);

        // 1. Generate Metadata
        const metadata = generateSeriesMetadata(series, series.volumes, userId);
        const jsonFilename = `${series.folderName}.json`;

        // Place it at the root of the zip (which unpacks into the series folder)
        archive.append(JSON.stringify(metadata, null, 2), { name: jsonFilename });

        // 2. Add Series Cover
        if (series.coverPath) {
          const absCoverPath = path.join(fastify.projectRoot, series.coverPath);
          if (fs.existsSync(absCoverPath)) {
            archive.file(absCoverPath, { name: path.basename(series.coverPath) });
          }
        }

        // 3. Add Volumes
        for (const vol of series.volumes) {
          const volumePath = path.join(fastify.projectRoot, vol.filePath);
          const mokuroPath = path.join(fastify.projectRoot, vol.mokuroPath);

          if (fs.existsSync(volumePath) && includeImages) {
            archive.directory(volumePath, vol.folderName);
          }
          if (fs.existsSync(mokuroPath)) {
            archive.file(mokuroPath, { name: `${vol.folderName}.mokuro` });
          }
        }

        await archive.finalize();
      } catch (error) {
        fastify.log.error(error);
        if (!reply.raw.headersSent) reply.status(500).send({ message: 'Export failed' });
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

      const series = await fastify.prisma.series.findFirst({
        where: { id: seriesId, ownerId: userId }
      });

      if (!series) {
        return reply.status(404).send('Series not found');
      }

      const volumes = await fastify.prisma.volume.findMany({
        where: { seriesId: series.id },
        include: { series: true },
        orderBy: { folderName: 'asc' }
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
        for (const volume of volumes) {
          const doc = new PDFDocument({ autoFirstPage: false });
          await generateVolumePdf(
            volume,
            fastify.projectRoot,
            fastify.log,
            doc
          );
          doc.end();

          const pdfFileName = `${volume.folderName}.pdf`;
          archive.append(doc as unknown as Readable, { name: pdfFileName });
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

    try {
      const allSeries = await fastify.prisma.series.findMany({
        where: { ownerId: userId },
        include: {
          volumes: {
            include: {
              progress: { where: { userId } }
            }
          }
        }
      });

      const archive = archiver('zip', { zlib: { level: 5 } });
      const filename = `Mokuro_Library_Backup.zip`;

      reply.header('Content-Type', 'application/zip');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      reply.send(archive);

      for (const series of allSeries) {
        const seriesRoot = series.folderName;

        // 1. Generate Metadata
        const metadata = generateSeriesMetadata(series, series.volumes, userId);
        const jsonFilename = path.join(seriesRoot, `${series.folderName}.json`);
        archive.append(JSON.stringify(metadata, null, 2), { name: jsonFilename });

        // 2. Add Series Cover
        if (series.coverPath) {
          const absCoverPath = path.join(fastify.projectRoot, series.coverPath);
          if (fs.existsSync(absCoverPath)) {
            archive.file(absCoverPath, { name: path.join(seriesRoot, path.basename(series.coverPath)) });
          }
        }

        // 3. Add Volumes
        for (const vol of series.volumes) {
          const volumePath = path.join(fastify.projectRoot, vol.filePath);
          const mokuroPath = path.join(fastify.projectRoot, vol.mokuroPath);

          if (fs.existsSync(volumePath) && includeImages) {
            archive.directory(volumePath, path.join(seriesRoot, vol.folderName));
          }
          if (fs.existsSync(mokuroPath)) {
            archive.file(mokuroPath, { name: path.join(seriesRoot, `${vol.folderName}.mokuro`) });
          }
        }
      }

      await archive.finalize();
    } catch (error) {
      fastify.log.error(error);
      if (!reply.raw.headersSent) reply.status(500).send({ message: 'Export failed' });
    }
  });

  /**
   * GET /api/export/pdf
   * Download the entire user library as a zip of organized pdf
   */
  fastify.get('/pdf', async (request, reply) => {
    const userId = request.user.id;

    const volumes = await fastify.prisma.volume.findMany({
      where: { series: { ownerId: userId } },
      include: { series: true },
      orderBy: [
        { series: { folderName: 'asc' } },
        { folderName: 'asc' }
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
      for (const volume of volumes) {
        const doc = new PDFDocument({ autoFirstPage: false });
        await generateVolumePdf(
          volume,
          fastify.projectRoot,
          fastify.log,
          doc
        );
        doc.end();

        const pdfFileName = `${volume.series.folderName}/${volume.folderName}.pdf`;
        archive.append(doc as unknown as Readable, { name: pdfFileName });
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

}

export default exportRoutes;
