import 'dotenv/config'; // important to make environment variables available to the server
import Fastify from 'fastify';
import { PrismaClient } from './generated/prisma/client'
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'path';

// Import Plugins
import authPlugin from './plugins/auth';

// Import Routes
import authRoutes from './routes/auth';
import settingsRoutes from './routes/settings';
import progressRoutes from './routes/progress';
import libraryRoutes from './routes/library';
import filesRoutes from './routes/files';

// Initialize the Prisma Client
const prisma = new PrismaClient();

// Initialize Fastify server
const fastify = Fastify({
  logger: true,
});

// Register the cookie plugin
fastify.register(fastifyCookie, {
  // We'll set a secret later if we do signed cookies,
  // but for a simple session ID, this is fine for now.
});
fastify.register(authPlugin);
fastify.register(fastifyMultipart);
fastify.register(fastifyStatic, {
  // Register fastify-static
  // We set 'serve: false' because we are not serving an entire
  // public directory. We just want to use the 'reply.sendFile' decorator
  // for our secure, custom routes.
  serve: false,
});

// Decorate Fastify instance with Prisma Client
// This makes 'fastify.prisma' available in all routes
fastify.decorate('prisma', prisma);

// --- Register Routes ---
// Register auth routes with a prefix
fastify.register(authRoutes, { prefix: '/api/auth' });
fastify.register(settingsRoutes, { prefix: '/api/settings' });
fastify.register(progressRoutes, { prefix: '/api/progress' });
fastify.register(libraryRoutes, { prefix: '/api/library' });

// --- Health Check Route ---
fastify.get('/api/health', async (request, reply) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', db: 'connected' };
  } catch (error) {
    fastify.log.error(error);
    return reply
      .status(500)
      .send({ status: 'error', db: 'disconnected' });
  }
});

// --- Start Server ---
const start = async () => {
  try {
    // Listen on 0.0.0.0:3001
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    // Disconnect Prisma on exit
    await prisma.$disconnect();
    process.exit(1);
  }
};

// Add a shutdown hook for Prisma
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

start();
