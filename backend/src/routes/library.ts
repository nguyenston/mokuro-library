import { FastifyPluginAsync } from 'fastify';

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
  fastify.get('/', async (request, reply) => {
    const userId = request.user.id; // provided by the authenticate hook

    try {
      const series = await fastify.prisma.series.findMany({
        // Find all series owned by the logged-in user
        where: {
          ownerId: userId,
        },
        // Include all related Volume records for each Series
        include: {
          volumes: {
            // Optional: Order volumes by title
            orderBy: {
              title: 'asc',
            },
          },
        },
        // Optional: Order the series by title
        orderBy: {
          title: 'asc',
        },
      });

      // Return the list of series.
      // This will be an empty array ([]) if the user has no uploads,
      // which is the correct response.
      return reply.status(200).send(series);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Could not retrieve library.',
      });
    }
  });
};

export default libraryRoutes;
