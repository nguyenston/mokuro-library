import bcrypt from 'bcryptjs';
import type { FastifyBaseLogger } from 'fastify';
import { ExtendedPrismaClient } from '../lib/prisma/prisma';

export async function ensureAdminUser(prisma: ExtendedPrismaClient, logger: FastifyBaseLogger) {
  try {
    // Check if the hardcoded 'admin' user exists
    const admin = await prisma.user.findUnique({
      where: { id: 'admin' },
    });

    if (!admin) {
      logger.info('Bootstrap: "admin" user not found. Creating default admin account...');

      // Create default admin with known ID and default password
      // should probably change this password immediately after logging in
      const hashedPassword = await bcrypt.hash('admin', 10);

      await prisma.user.create({
        data: {
          id: 'admin',
          username: 'admin',
          password: hashedPassword,
          settings: {},
        },
      });

      logger.info('Bootstrap: SUCCESS. Created user "admin" with password "admin".');
    } else {
      logger.info('Bootstrap: "admin" user exists. Skipping.');
    }
  } catch (error) {
    logger.error({ err: error }, 'Bootstrap: Failed to ensure admin user.');
    throw error; // Fail hard so we don't start the server in an invalid state
  }
}
