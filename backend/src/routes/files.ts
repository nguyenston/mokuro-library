import { FastifyPluginAsync } from 'fastify';
import path from 'path';
import fs from 'fs'; // We need fs to check if the file exists

// Define an interface for our type-safe params
interface FileParams {
  id: string; // This 'id' is the volumeId
  imageName: string;
}

const filesRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  // Protect all routes in this file
  fastify.addHook('preHandler', fastify.authenticate);

  /**
   * GET /api/files/volume/:id/image/:imageName
   * Securely serves a specific manga page image.
   */
  fastify.get<{ Params: FileParams }>(
    '/volume/:id/image/:imageName',
    async (request, reply) => {
      const { id: volumeId, imageName } = request.params;
      const userId = request.user.id;

      try {
        // Find the volume and verify ownership
        const volume = await fastify.prisma.volume.findFirst({
          where: {
            id: volumeId,
            series: {
              ownerId: userId,
            },
          },
          select: {
            filePath: true, // Only select the path we need
          },
        });

        // Case 1: Volume not found or user does not own it
        if (!volume) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: 'Volume not found or access denied.',
          });
        }

        // Security: Path Traversal Mitigation
        // We use path.basename() to strip all directory information
        // from the user-provided 'imageName'.
        // This prevents requests like '../other_series/image.jpg'
        const cleanImageName = path.basename(imageName);

        // Construct the absolute file path
        // path.resolve() turns our relative DB path into an absolute one
        const absolutePath = path.resolve(volume.filePath, cleanImageName);

        // 4. Check if file exists before sending
        try {
          await fs.promises.access(absolutePath, fs.constants.R_OK);
        } catch (fileAccessError) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: 'Image file not found.',
          });
        }

        // 5. Securely stream the file
        // 'reply.sendFile' handles Content-Type, ETag, and
        // range requests automatically.
        // We provide the absolute path.
        return reply.sendFile(absolutePath);

      } catch (error) {
        fastify.log.error({ err: error }, 'File serving error');
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'An error occurred while serving the file.',
        });
      }
    }
  );

  /**
   * GET /api/files/series/:id/cover
   * Securely serves the series cover image.
   */
  fastify.get<{ Params: { id: string } }>(
    '/series/:id/cover',
    async (request, reply) => {
      const { id: seriesId } = request.params;
      const userId = request.user.id;

      try {
        const series = await fastify.prisma.series.findFirst({
          where: {
            id: seriesId,
            ownerId: userId,
          },
          select: {
            coverPath: true,
          },
        });

        if (!series || !series.coverPath) {
          return reply.status(405).send('Cover not found');
        }

        // Ensure file exists before trying to send it
        try {
          await fs.promises.access(path.resolve(series.coverPath), fs.constants.R_OK);
        } catch {
          return reply.status(406).send('Cover file missing from disk');
        }

        return reply.sendFile(path.resolve(series.coverPath));
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send('Error serving cover');
      }
    }
  );
};

export default filesRoutes;
