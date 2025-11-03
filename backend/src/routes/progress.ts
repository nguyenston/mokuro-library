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

const progressRoutes: FastifyPluginAsync = async (
  fastify,
  opts
): Promise<void> => {
  // Protect all routes in this file
  fastify.addHook('preHandler', fastify.authenticate);

  /**
   * GET /api/progress/volume/:id
   * Gets the progress for a specific volume for the current user.
   */
  fastify.get<{ Params: ProgressParams }>(
    '/volume/:id',
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
   * PUT /api/progress/volume/:id
   * Saves or updates the progress for a volume for the current user.
   */
  fastify.put<{ Params: ProgressParams; Body: ProgressBody }>(
    '/volume/:id',
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
};

export default progressRoutes;
