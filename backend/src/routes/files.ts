import { FastifyPluginAsync } from 'fastify';
import path from 'path';
import fs from 'fs'; // We need fs to check if the file exists

// Define an interface for our type-safe params
interface FileParams {
  id: string; // This 'id' is the volumeId
  imageName: string;
}

// Helper function

/**
 * Resolves a file path by checking both NFC and NFD normalization forms.
 * This ensures cross-platform compatibility (Linux/Windows/macOS).
 * * @param baseDir The root directory (e.g., fastify.projectRoot).
 * @param relativePath The path stored in the database.
 * @returns The verified absolute path in its correct normalization, or null if not found.
 */
export async function resolveNormalizedPath(
  baseDir: string,
  relativePath: string
): Promise<string | null> {
  // 1. Generate the primary target (NFC)
  const absolutePathNFC = path.join(baseDir, relativePath).normalize('NFC');

  try {
    // Check if the NFC version exists on disk
    await fs.promises.access(absolutePathNFC, fs.constants.R_OK);
    return absolutePathNFC;
  } catch {
    // 2. Generate the fallback (NFD)
    const absolutePathNFD = absolutePathNFC.normalize('NFD');

    // If the strings are identical, there is no need for a second disk check
    if (absolutePathNFC === absolutePathNFD) {
      return null;
    }

    try {
      await fs.promises.access(absolutePathNFD, fs.constants.R_OK);
      return absolutePathNFD;
    } catch {
      // File does not exist in either form
      return null;
    }
  }
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
        const relativePath = path.join(
          volume.filePath,
          cleanImageName
        );

        // Check if file exists before sending
        const validPath = await resolveNormalizedPath(fastify.projectRoot, relativePath);

        if (!validPath) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: 'Image file not found.',
          });
        }

        // 5. Securely stream the file
        // 'reply.sendFile' handles Content-Type, ETag, and
        // range requests automatically.
        return reply.sendFile(validPath);

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
          return reply.status(404).send('Cover not found');
        }

        const absolutePath = path.join(fastify.projectRoot, series.coverPath.normalize('NFC'));

        // Ensure file exists before trying to send it
        const validPath = await resolveNormalizedPath(fastify.projectRoot, series.coverPath);

        if (!validPath) {
          return reply.status(404).send('Cover file missing from disk');
        }

        return reply.sendFile(absolutePath);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send('Error serving cover');
      }
    }
  );

  /**
   * GET /api/files/preview
   * Serves an image file by path for preview purposes (e.g., scraped covers before confirmation).
   * Security: Only serves files within the user's upload directory.
   */
  fastify.get<{ Querystring: { path: string } }>(
    '/preview',
    async (request, reply) => {
      const { path: filePath } = request.query;
      const userId = request.user.id;

      if (!filePath) {
        return reply.status(400).send({ error: 'Missing path parameter' });
      }

      try {
        // Security check: Ensure the file path starts with uploads/userId
        const expectedPrefix = `uploads/temp/${userId}/`;
        if (!filePath.startsWith(expectedPrefix)) {
          return reply.status(403).send({ error: 'Access denied' });
        }

        // Resolve the file path with normalization support
        const validPath = await resolveNormalizedPath(fastify.projectRoot, filePath);

        if (!validPath) {
          return reply.status(404).send({ error: 'File not found' });
        }

        return reply.sendFile(validPath);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Error serving file' });
      }
    }
  );
};

export default filesRoutes;
