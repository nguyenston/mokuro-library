import 'dotenv/config'; // important to make environment variables available to the server
import Fastify from 'fastify';
import { PrismaClient } from './generated/prisma/client'
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';

// Import Plugins
import authPlugin from './plugins/auth';

// Import Routes
import authRoutes from './routes/auth';
import settingsRoutes from './routes/settings';
import progressRoutes from './routes/progress';
import libraryRoutes from './routes/library';
import filesRoutes from './routes/files';
import exportRoutes from './routes/export';

// Define the absolute project root, /app, in both environments:
// In dev: __dirname is /app/backend/src. Root is two levels up.
// In prod: __dirname is /app/dist. Root is one level up.
const projectRoot = path.resolve(
  __dirname,
  process.env.NODE_ENV === 'production' ? '..' : '../..'
);

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
fastify.register(fastifyMultipart, {
  defCharset: 'utf8',
  preservePath: true,
  limits: {
    // Set the maximum file size in bytes
    // (100 MB = 100 * 1024 * 1024 bytes)
    fileSize: 100 * 1024 * 1024,
    parts: 10000,
  },
});
fastify.register(fastifyStatic, {
  serve: false, // Does not automatically serve any folder
  // Set the root for all file operations
  // root: projectRoot,
});

// Decorate Fastify instance with Prisma Client
// This makes 'fastify.prisma' available in all routes
fastify.decorate('prisma', prisma);
// Make projectRoot available to routes for fs.access checks
fastify.decorate('projectRoot', projectRoot);

// --- Register Routes ---
// Register auth routes with a prefix
fastify.register(authRoutes, { prefix: '/api/auth' });
fastify.register(settingsRoutes, { prefix: '/api/settings' });
fastify.register(progressRoutes, { prefix: '/api/progress' });
fastify.register(libraryRoutes, { prefix: '/api/library' });
fastify.register(filesRoutes, { prefix: '/api/files' });
fastify.register(exportRoutes, { prefix: '/api/export' });

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

// ---  Frontend Serving Handler ---
// This uses setNotFoundHandler so it ONLY fires if no API route matched.
fastify.setNotFoundHandler(async (request, reply) => {
  // 1. Safety check: If it tried to be an API call, return a real 404 JSON
  if (request.raw.url?.startsWith('/api/')) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: `Route ${request.method}:${request.raw.url} not found`
    });
  }

  // 2. Prepare paths for frontend assets
  const buildPath = path.join(fastify.projectRoot, 'frontend/build');
  const urlPath = request.raw.url?.split('?')[0] || ''; // ignore query params
  const potentialFilePath = path.join(buildPath, urlPath);

  try {
    // 3. Try to find a real file (like /_app/immutable/..., /favicon.svg, etc.)
    // Security: Ensure the resolved path is still inside buildPath to prevent traversal
    const resolvedPath = path.resolve(potentialFilePath);
    if (!resolvedPath.startsWith(path.resolve(buildPath))) {
      throw new Error('Path traversal attempt');
    }

    const stat = await fs.promises.stat(resolvedPath);
    if (stat.isFile()) {
      // It's a real file, serve it explicitly from the build folder
      return reply.sendFile(urlPath, buildPath);
    }
  } catch (e) {
    // Not a file, or doesn't exist. Ignore and fall through to index.html
  }

  // 4. Fallback for SPA: Serve index.html for any other route (e.g. /series/123)
  return reply.sendFile('index.html', buildPath);
});

// --- Start Server ---
const start = async () => {
  try {
    // Wait for all plugins to load
    await fastify.ready();
    // Print the routing tree to the console
    console.log(fastify.printRoutes());
    console.log(projectRoot);
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
