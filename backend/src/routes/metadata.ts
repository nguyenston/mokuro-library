import { FastifyPluginAsync } from 'fastify';
import { Prisma } from '../generated/prisma/client'; // Import Prisma for types


// Define a schema for the request body on PUT
// This ensures we only accept valid, partial data for an update
const progressBodySchema = {
  type: 'object',
  properties: {
    page: { type: 'integer', minimum: 1 },
    timeRead: { type: 'integer', minimum: 0 },
    charsRead: { type: 'integer', minimum: 0 },
    completed: { type: 'boolean' },
  },
  // No required fields, as this is a partial update
};

const seriesUpdateSchema = {
  type: 'object',
  properties: {
    title: { type: ['string', 'null'] }, // Allow string or explicit null
    description: { type: ['string', 'null'] },
    bookmarked: { type: ['boolean', 'null'] }
  }
};

const volumeUpdateSchema = {
  type: 'object',
  properties: {
    title: { type: ['string', 'null'] } // Allow string or explicit null
  }
};

// Define an interface for our type-safe params
interface ProgressParams {
  id: string; // This 'id' is the volumeId
}

// Define an interface for our type-safe body
interface ProgressBody {
  page?: number;
  timeRead?: number;
  charsRead?: number;
  completed?: boolean;
}

// For Volume or Series id
interface IdParams {
  id: string;
}

// Updated Interface for Series Body
interface SeriesUpdateBody {
  title?: string | null;
  description?: string | null;
  bookmarked?: boolean;
}

const metadataRoutes: FastifyPluginAsync = async (
  fastify,
  opts
): Promise<void> => {
  // Protect all routes in this file
  fastify.addHook('preHandler', fastify.authenticate);

  // ===========================================================================
  // PROGRESS ENDPOINTS
  // Namespace: /volume/:id/progress
  // ===========================================================================

  /**
   * GET /api/metadata/volume/:id/progress
   * Gets the progress for a specific volume for the current user.
   */
  fastify.get<{ Params: ProgressParams }>(
    '/volume/:id/progress',
    async (request, reply) => {
      const { id: volumeId } = request.params;
      const userId = request.user.id; // we know request has user thanks to the auth hook

      try {
        const progress = await fastify.prisma.userProgress.findUnique({
          where: {
            // Use the @@unique([userId, volumeId]) index
            userId_volumeId: {
              userId,
              volumeId,
            },
          },
          // Select ONLY the fields the client needs
          select: {
            page: true,
            timeRead: true,
            charsRead: true,
            completed: true,
          },
        });

        // If no progress found, return default values
        if (!progress) {
          return reply.status(200).send({
            page: 1,      // From schema default
            timeRead: 0,  // From schema default
            charsRead: 0, // From schema default
            completed: false, // From schema default
          });
        }

        return reply.status(200).send(progress);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Could not retrieve progress.',
        });
      }
    }
  );

  /**
   * PATCH /api/metadata/volume/:id/progress
   * Saves or updates the progress for a volume for the current user.
   */
  fastify.patch<{ Params: ProgressParams; Body: ProgressBody }>(
    '/volume/:id/progress',
    { schema: { body: progressBodySchema } }, // Apply schema validation
    async (request, reply) => {
      const { id: volumeId } = request.params;
      const userId = request.user.id;
      const data = request.body; // 'data' is now type-safe and validated

      try {
        const upsertedProgress = await fastify.prisma.userProgress.upsert({
          where: {
            // Use the @@unique([userId, volumeId]) index
            userId_volumeId: {
              userId,
              volumeId,
            },
          },
          // Data to use if UPDATING an existing record
          update: {
            ...data,
          },
          // Data to use if CREATING a new record
          create: {
            userId,
            volumeId,
            ...data,
          },
        });

        // Update the parent Series 'lastReadAt' timestamp
        // This ensures the series bubbles to the top of "Recently Read" lists
        await fastify.prisma.series.updateMany({
          where: {
            volumes: {
              some: { id: volumeId } // Find series containing this volume
            },
            ownerId: userId // Ensure we only update series owned by user
          },
          data: {
            lastReadAt: new Date()
          }
        });

        return reply.status(200).send(upsertedProgress);
      } catch (error) {
        // Handle case where the volumeId is invalid
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2003' // Foreign key constraint failed
        ) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: 'The specified volume does not exist.',
          });
        }

        fastify.log.error(error);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Could not save progress.',
        });
      }
    }
  );

  /**
     * DELETE /api/metadata/volume/:id/progress
     * Resets progress (Wipe).
     */
  fastify.delete<{ Params: IdParams }>(
    '/volume/:id/progress',
    async (request, reply) => {
      const { id: volumeId } = request.params;
      const userId = request.user.id;

      try {
        await fastify.prisma.userProgress.delete({
          where: { userId_volumeId: { userId, volumeId } },
        });
        return reply.send({ message: 'Progress reset successfully.' });
      } catch (error) {
        // P2025 = Record not found (already empty)
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          return reply.send({ message: 'Progress was already empty.' });
        }
        fastify.log.error(error);
        return reply.status(500).send({ message: 'Could not reset progress.' });
      }
    }
  );

  // ===========================================================================
  // METADATA ENDPOINTS (Renaming & Descriptions)
  // Namespace: /series/:id and /volume/:id
  // ===========================================================================

  /**
   * PATCH /api/metadata/series/:id
   * Updates Series metadata (Title, Description, Bookmarked).
   */
  fastify.patch<{ Params: IdParams; Body: SeriesUpdateBody }>(
    '/series/:id',
    { schema: { body: seriesUpdateSchema } },
    async (request, reply) => {
      const { id } = request.params;
      const { title, description, bookmarked } = request.body;

      try {
        const series = await fastify.prisma.series.findFirst({
          where: {
            id,
            ownerId: request.user.id, // Security check
          },
          select: {
            folderName: true,
          },
        });

        if (!series) return reply.status(404).send({ message: 'Series not found.' });

        // Build the update object dynamically
        // We always calculate sortTitle if title changes, otherwise leave it
        const dataToUpdate: Prisma.SeriesUpdateInput = {};

        if (title !== undefined) {
          dataToUpdate.title = title;
          dataToUpdate.sortTitle = title ?? series.folderName;
        }

        if (description !== undefined) {
          dataToUpdate.description = description;
        }

        if (bookmarked !== undefined) {
          dataToUpdate.bookmarked = bookmarked;
        }

        await fastify.prisma.series.update({
          where: { id, ownerId: request.user.id },
          data: dataToUpdate,
        });

        return reply.send({ message: 'Series title updated.' });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ message: 'Update failed.' });
      }
    }
  );

  /**
   * PATCH /api/metadata/volume/:id
   * Renames the Display Title of a Volume.
   */
  fastify.patch<{ Params: IdParams; Body: { title: string | null } }>(
    '/volume/:id',
    { schema: { body: volumeUpdateSchema } },
    async (request, reply) => {
      const { id } = request.params;
      const { title } = request.body;

      try {
        // Verify ownership via series relation
        const vol = await fastify.prisma.volume.findFirst({
          where: { id, series: { ownerId: request.user.id } },
          select: { folderName: true },
        });

        if (!vol) return reply.status(404).send({ message: 'Volume not found.' });

        await fastify.prisma.volume.update({
          where: { id },
          data: { title, sortTitle: title ?? vol.folderName },
        });

        return reply.send({ message: 'Volume title updated.' });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ message: 'Update failed.' });
      }
    }
  );
};

export default metadataRoutes;
