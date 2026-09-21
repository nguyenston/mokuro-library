import 'dotenv/config'; // important to make environment variables available to the server
import './core/config';
import { ensureAdminUser } from './utils/bootstrap';
import { prisma } from './lib/prisma/prisma';
import { buildServer } from './core/app';

const fastify = buildServer();

// --- Start Server ---
const start = async () => {
  try {
    // Wait for all plugins to load
    await fastify.ready();

    // Ensure the system "admin" user exists for OCR constraints
    await ensureAdminUser(prisma, fastify.log);

    // Print the routing tree to the console
    console.log(fastify.printRoutes({ commonPrefix: false }));
    console.log(fastify.projectRoot);

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
