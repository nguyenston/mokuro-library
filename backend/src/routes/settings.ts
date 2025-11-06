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
   * Server-side: merges changes sent by the client
   */
  fastify.put('/', async (request, reply) => {
    try {
      // 1. Get the current settings from the authenticated user
      // We cast to Record<string, any> and default to {}
      const currentSettings = (request.user.settings || {}) as Record<string, any>;

      // 2. Get the new settings patch from the request
      const settingsPatch = (request.body || {}) as Record<string, any>;

      // 3. Perform the server-side merge
      const newSettings = {
        ...currentSettings,
        ...settingsPatch,
      };

      // 4. Update the database with the new, merged settings
      const updatedUser = await fastify.prisma.user.update({
        where: {
          id: request.user.id,
        },
        data: {
          settings: newSettings,
        },
        select: {
          settings: true,
        },
      });

      return reply.status(200).send(updatedUser.settings);
    } catch (error) {
      fastify.log.error({ err: error }, 'Could not update settings.');
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Could not update settings.',
      });
    }
  });
};

export default settingsRoutes;
