import { FastifyPluginAsync, FastifyReply } from 'fastify';
import util from 'util';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

// an interface for the route parameters
interface VolumeParams {
  id: string; // This 'id' is the volumeId
}

interface SeriesParams {
  id: string; // This 'id' is the seriesId
}

/**
 * Helper to stream a directory as a ZIP file to the response.
 */
const streamZip = (
  sourceDir: string,
  zipName: string,
  reply: FastifyReply
) => {
  const archive = archiver('zip', {
    zlib: { level: 0 } // no compression
  });

  reply.header('Content-Type', 'application/zip');
  // Using encodeURIComponent for safer filenames in headers
  const safeFileName = encodeURIComponent(zipName);
  reply.header('Content-Disposition', `attachment; filename="${safeFileName}.zip"`);

  archive.on('error', (err) => {
    throw err;
  });

  archive.directory(sourceDir, false);
  archive.finalize();

  return reply.send(archive);
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
  fastify.get<{ Params: VolumeParams }>(
    '/volume/:id/zip',
    async (request, reply) => {
      const { id: volumeId } = request.params;
      const userId = request.user.id;

      const volume = await fastify.prisma.volume.findFirst({
        where: { id: volumeId, series: { ownerId: userId } },
        include: { series: true }
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
      const safeFileName = encodeURIComponent(`${volume.series.title} - ${volume.title}`);
      reply.header('Content-Disposition', `attachment; filename="${safeFileName}.zip"`);

      archive.on('error', (err) => {
        fastify.log.error(err);
        if (!reply.raw.headersSent) {
          reply.status(500).send('Archiving error');
        }
      });

      // Add the volume directory (images)
      const absoluteVolumePath = path.join(fastify.projectRoot, volume.filePath);
      archive.directory(absoluteVolumePath, volume.title);

      // Add the .mokuro file
      const absoluteMokuroPath = path.join(
        fastify.projectRoot,
        volume.mokuroPath
      );
      archive.file(absoluteMokuroPath, { name: `${volume.title}.mokuro` });

      archive.finalize();
      return reply.send(archive);
    }
  );

  /**
   * GET /api/export/series/:id/zip
   * Downloads an entire series as a ZIP.
   */
  fastify.get<{ Params: SeriesParams }>(
    '/series/:id/zip',
    async (request, reply) => {
      const { id: seriesId } = request.params;
      const userId = request.user.id;

      const series = await fastify.prisma.series.findFirst({
        where: { id: seriesId, ownerId: userId },
        include: { volumes: true }
      });

      if (!series) {
        return reply.status(404).send('Series not found');
      }

      if (series.volumes.length === 0) {
        return reply.status(400).send('Series is empty');
      }

      // Find the series root directory from the first volume's path
      const seriesDirRelative = path.dirname(series.volumes[0].mokuroPath);
      const seriesDirAbsolute = path.join(
        fastify.projectRoot,
        seriesDirRelative
      );

      return streamZip(seriesDirAbsolute, series.title, reply);
    }
  );

  /**
   * GET /api/export/zip
   * Downloads the entire user library as a ZIP.
   */
  fastify.get('/download', async (request, reply) => {
    const userId = request.user.id;
    // The user's library root is 'uploads/<userId>'
    // We need to resolve this relative to the project root.
    // Assuming the server runs from the project root or 'backend' folder:
    const userLibraryDir = path.join(
      fastify.projectRoot,
      'uploads',
      userId
    );

    try {
      await fs.promises.access(userLibraryDir, fs.constants.R_OK);
    } catch {
      return reply.status(404).send('Library is empty or not found on disk.');
    }

    return streamZip(userLibraryDir, `${request.user.username}-library`, reply);
  });

}

export default exportRoutes;
