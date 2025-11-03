import { FastifyPluginAsync } from 'fastify';
import { Prisma } from '../generated/prisma/client';
import bcrypt from 'bcryptjs';

// Schemas for request bodies for validation and safty
const registerBodySchema = {
  type: 'object',
  properties: {
    username: { type: 'string', minLength: 3 },
    password: { type: 'string', minLength: 6 },
  },
  required: ['username', 'password'],
};

const loginBodySchema = {
  type: 'object',
  properties: {
    username: { type: 'string' },
    password: { type: 'string' },
  },
  required: ['username', 'password'],
};

const authRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  // POST /api/auth/register
  fastify.post(
    '/register',
    { schema: { body: registerBodySchema } },
    async (request, reply) => {
      // Type assertion for the validated request body
      const { username, password } = request.body as {
        username: string;
        password: string;
      };

      try {
        // Hash the password before storing
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create the user
        const user = await fastify.prisma.user.create({
          data: {
            username: username,
            password: hashedPassword,
            settings: {}, // Default empty settings
          },
        });

        // Send back 201 Created and the new user (excluding password)
        // We select which fields to return.
        return reply.status(201).send({
          id: user.id,
          username: user.username,
        });

      } catch (error) {
        // Handle potential errors
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' // Unique constraint violation
        ) {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'Username already exists.',
          });
        }

        // Generic server error
        fastify.log.error(error);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'An unexpected error occurred.',
        });
      }
    }
  );

  // POST /api/auth/login
  fastify.post(
    '/login',
    { schema: { body: loginBodySchema } },
    async (request, reply) => {
      const { username, password } = request.body as {
        username: string;
        password: string;
      };

      try {
        // Find the user by their unique username
        const user = await fastify.prisma.user.findUnique({
          where: { username },
        });

        // Case 1: User not found
        if (!user) {
          return reply.status(401).send({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'Invalid username or password.',
          });
        }

        // Case 2: User found, compare password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        // Case 3: Password does not match
        if (!isPasswordValid) {
          return reply.status(401).send({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'Invalid username or password.',
          });
        }

        // Case 4: Success
        // We will use the user's ID as the session token
        // This is a simple session strategy.
        reply.setCookie('sessionId', user.id, {
          path: '/',          // Available to the entire site
          httpOnly: true,     // Not accessible via client-side JS
          secure: false,      // Allow over HTTP (for LAN/VPN)
          // maxAge: 60 * 60 * 24 * 7 // Optional: 1 week expiry
        });

      } catch (error) {
        // Generic server error
        fastify.log.error(error);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'An unexpected error occurred.',
        });
      }
    }
  );

  // POST /api/auth/logout
  fastify.post('/logout', async (request, reply) => {
    try {
      // Clear the session cookie
      reply.clearCookie('sessionId', {
        path: '/',
        httpOnly: true,
        secure: false,
      });

      return reply.status(200).send({ message: 'Logged out successfully.' });
    } catch (error) {
      // Generic server error
      fastify.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred during logout.',
      });
    }
  });

  // GET /api/auth/me ---
  fastify.get('/me', async (request, reply) => {
    try {
      // Get the sessionId from the cookie
      const sessionId = request.cookies.sessionId;

      // Case 1: No session cookie
      if (!sessionId) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'No session token provided.',
        });
      }

      // Case 2: Find user by the ID stored in the cookie
      const user = await fastify.prisma.user.findUnique({
        where: { id: sessionId },
        // Select only the fields we want to send back
        select: {
          id: true,
          username: true,
          settings: true,
        },
      });

      // Case 3: User not found (invalid or expired token)
      if (!user) {
        // Clear the bad cookie
        reply.clearCookie('sessionId', { path: '/' });
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid session token.',
        });
      }

      // Case 4: Success
      return reply.status(200).send(user);

    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred.',
      });
    }
  });
};

export default authRoutes;
