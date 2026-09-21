import Fastify from 'fastify';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';

import authPlugin from '../plugins/auth';

import authRoutes from '../routes/auth';
import settingsRoutes from '../routes/settings';
import metadataRoutes from '../routes/metadata';
import libraryRoutes from '../routes/library';
import filesRoutes from '../routes/files';
import exportRoutes from '../routes/export';
import ocrRoutes from '../routes/ocr';
import statsRoutes from '../routes/stats';
import contributionsRoutes from '../routes/contributions';
import testsRoutes from '../routes/tests';
import { prisma as defaultPrisma, ExtendedPrismaClient } from '../lib/prisma/prisma';
import { loggerOptions } from '../lib/logger';

type BuildOptions = {
  prisma?: ExtendedPrismaClient;
  projectRoot?: string;
  logger?: boolean;
};

const resolveProjectRoot = (options: BuildOptions) => {
  if (options.projectRoot) return options.projectRoot;
  if (process.env.MOKURO_DATA_DIR) return process.env.MOKURO_DATA_DIR;

  const cwd = process.cwd();
  const candidates = [
    cwd,
    path.resolve(cwd, '..'),
    path.resolve(__dirname, process.env.NODE_ENV === 'production' ? '..' : '../../..'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'uploads'))) {
      return candidate;
    }
  }

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'frontend'))) {
      return candidate;
    }
  }

  return candidates[candidates.length - 1];
};

export function buildServer(options: BuildOptions = {}) {
  const useLogger = options.logger ?? true;
  const fastify = Fastify({
    logger: useLogger ? loggerOptions : false,
    genReqId: (req) => (req.headers['x-request-id'] as string) || randomUUID(),
  });

  // HTTPS enforcement for production
  const disableHttpsRedirect = process.env.MOKURO_DISABLE_HTTPS_REDIRECT === 'true';
  if (process.env.NODE_ENV === 'production' && !disableHttpsRedirect) {
    fastify.addHook('onRequest', async (request, reply) => {
      const socket = request.raw.socket as { encrypted?: boolean };
      const host = request.hostname?.toLowerCase() ?? '';
      const isLocalhost =
        host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
      if (isLocalhost) {
        return;
      }
      if (!socket.encrypted && request.headers['x-forwarded-proto'] !== 'https') {
        return reply.redirect(`https://${request.hostname}${request.url}`);
      }
    });
  }

  // Resolve the absolute project root (uploads + frontend build).
  const projectRoot = resolveProjectRoot(options);

  // Register security plugins
  fastify.register(fastifyHelmet, {
    contentSecurityPolicy: false, // Disable for SPA
  });

  fastify.register(fastifyCors, {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || false,
    credentials: true,
  });

  const rateLimitMaxRaw = Number.parseInt(process.env.RATE_LIMIT_MAX ?? '', 10);
  const rateLimitMax = Number.isNaN(rateLimitMaxRaw) ? 1000 : rateLimitMaxRaw;
  const rateLimitWindow = process.env.RATE_LIMIT_WINDOW || '5 minutes';

  fastify.register(fastifyRateLimit, {
    max: rateLimitMax,
    timeWindow: rateLimitWindow,
  });

  // Register the cookie plugin
  const cookieSecret = process.env.COOKIE_SECRET || 'change-me-in-production';
  if (process.env.NODE_ENV === 'production' && cookieSecret === 'change-me-in-production') {
    fastify.log.warn(
      'WARNING: Using default COOKIE_SECRET in production. Set COOKIE_SECRET environment variable.'
    );
  }
  fastify.register(fastifyCookie, {
    secret: cookieSecret,
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
  });

  // Decorate Fastify instance with Prisma Client
  fastify.decorate('prisma', options.prisma ?? defaultPrisma);
  fastify.decorate('projectRoot', projectRoot);

  // --- Register Routes ---
  fastify.register(authRoutes, { prefix: '/api/auth' });
  fastify.register(settingsRoutes, { prefix: '/api/settings' });
  fastify.register(metadataRoutes, { prefix: '/api/metadata' });
  fastify.register(libraryRoutes, { prefix: '/api/library' });
  fastify.register(filesRoutes, { prefix: '/api/files' });
  fastify.register(exportRoutes, { prefix: '/api/export' });
  fastify.register(ocrRoutes, { prefix: '/api/library' });
  fastify.register(statsRoutes, { prefix: '/api/stats' });
  fastify.register(contributionsRoutes, { prefix: '/api/contributions' });
  fastify.register(testsRoutes, { prefix: '/api/tests' });

  // --- Health Check Routes ---
  fastify.get('/api/health', async (request, reply) => {
    try {
      // Test database connection
      await fastify.prisma.$queryRaw`SELECT 1`;

      const checks = {
        database: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memoryUsage: {
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB',
        },
      };

      return { status: 'healthy', checks };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(503).send({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Readiness probe
  fastify.get('/api/ready', async (_request, _reply) => {
    return { ready: true };
  });

  // ---  Frontend Serving Handler ---
  fastify.setNotFoundHandler(async (request, reply) => {
    if (request.raw.url?.startsWith('/api/')) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Route ${request.method}:${request.raw.url} not found`,
      });
    }

    const buildPath = path.join(fastify.projectRoot, 'frontend/build');
    const urlPath = request.raw.url?.split('?')[0] || '';
    const potentialFilePath = path.join(buildPath, urlPath);

    try {
      const resolvedPath = path.resolve(potentialFilePath);
      if (!resolvedPath.startsWith(path.resolve(buildPath))) {
        throw new Error('Path traversal attempt');
      }

      const stat = await fs.promises.stat(resolvedPath);
      if (stat.isFile()) {
        return reply.sendFile(urlPath, buildPath);
      }
    } catch (e) {
      // Not a file, or doesn't exist. Ignore and fall through to index.html
    }

    return reply.sendFile('index.html', buildPath);
  });

  // Cleanup expired refresh tokens every hour
  setInterval(async () => {
    try {
      const deleted = await fastify.prisma.refreshToken.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      if (deleted.count > 0) {
        fastify.log.info(`Cleaned up ${deleted.count} expired refresh tokens`);
      }
    } catch (e) {
      fastify.log.error({ err: e }, 'Failed to cleanup refresh tokens');
    }
  }, 60 * 60 * 1000); // Every hour

  return fastify;
}
