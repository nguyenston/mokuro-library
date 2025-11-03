import { FastifyPluginAsync } from 'fastify';
import { Prisma } from '../generated/prisma/client';

const settingsRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {

  // --- IMPORTANT ---
  // This hook applies 'fastify.authenticate' to EVERY route defined in this file.
  // The route handler will only be executed if authentication succeeds.
  fastify.addHook('preHandler', fastify.authenticate);

  /**
   * GET /api/settings
   * Gets the current user's settings.
   */
  fastify.get('/', async (request, reply) => {
    // 'request.user' is guaranteed to be populated here
    // because the 'fastify.authenticate' hook has passed.
    try {
      // The settings are already on the user object we fetched
      return reply.status(200).send(request.user.settings);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Could not retrieve settings.',
      });
    }
  });

  /**
   * PUT /api/settings
   * Updates the current user's settings.
   */
  fastify.put('/', async (request, reply) => {
    try {
      // 'request.body' will contain the new settings JSON
      const newSettings = request.body as Prisma.InputJsonValue;

      const updatedUser = await fastify.prisma.user.update({
        where: {
          id: request.user.id, // Get the ID from the authenticated user
        },
        data: {
          settings: newSettings, // Store the new JSON
        },
        select: {
          settings: true, // Only select the updated settings to send back
        },
      });

      return reply.status(200).send(updatedUser.settings);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Could not update settings.',
      });
    }
  });
};

export default settingsRoutes;
