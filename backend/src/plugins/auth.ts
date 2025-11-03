import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin'; // Import fastify-plugin
import { AuthUser } from '../types/fastify'; // Import our new type

// Define the core authentication logic
const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const sessionId = request.cookies.sessionId;
    if (!sessionId) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'No session token provided.',
      });
    }

    // Find user by the ID stored in the cookie
    // We use request.server.prisma to access prisma inside a hook
    const user = await request.server.prisma.user.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        username: true,
        settings: true,
      },
    });

    if (!user) {
      // Clear the bad cookie
      reply.clearCookie('sessionId', { path: '/' });
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid session token.',
      });
    }

    // --- SUCCESS ---
    // Attach the user to the request object
    request.user = user as AuthUser; // We know this matches our AuthUser type
  } catch (error) {
    request.server.log.error(error);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Authentication process failed.',
    });
  }
};

// Create the plugin
const authPlugin: FastifyPluginAsync = async (fastify) => {
  // Decorate the fastify instance with the authenticate function
  fastify.decorate('authenticate', authenticate);
};

// Export the plugin using 'fastify-plugin'
// This ensures that our decorations (like 'authenticate')
// are available to all routes and plugins.
export default fp(authPlugin);
