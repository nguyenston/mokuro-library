import { FastifyPluginAsync, FastifyReply } from 'fastify';
import path from 'path';
import fs from 'fs'; // We need fs to check if the file exists
import { PassThrough } from 'stream';
import { createHash } from 'crypto';
import sharp from 'sharp';
import { LRUCache } from 'lru-cache';
import { libraryCache } from '../lib/caches/libraryCache';
import { SeriesWhereInput } from '../generated/prisma/models';

sharp.cache({ items: 500, memory: 512 });
sharp.concurrency(Math.max(1, require('os').cpus().length - 1));
// Define an interface for our type-safe params
interface FileParams {
  id: string; // This 'id' is the volumeId
  imageName: string;
}

interface ImageTransformQuery {
  w?: string;
  h?: string;
  q?: string;
  format?: string;
}

type ImageFormat = 'webp' | 'jpeg' | 'png' | 'avif'
type TransformOptions = {
  width?: number;
  height?: number;
  quality?: number;
  format?: ImageFormat;
};

const parsePositiveInt = (value?: string) => {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return undefined;
  return parsed;
};

const normalizeFormat = (value?: string): ImageFormat | undefined => {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (!['webp', 'jpeg', 'jpg', 'png', 'avif'].includes(normalized)) {
    return undefined;
  }
  return normalized === 'jpg' ? 'jpeg' : normalized as ImageFormat;
};

const parseTransformOptions = (query: ImageTransformQuery): TransformOptions | null => {
  const width = parsePositiveInt(query.w);
  const height = parsePositiveInt(query.h);
  const quality = parsePositiveInt(query.q);
  const format = normalizeFormat(query.format);

  if (!width && !height && !quality && !format) {
    return null;
  }

  return {
    width,
    height,
    quality: quality ? Math.min(Math.max(quality, 40), 95) : 85,
    format
  };
};

// Track active tasks
const activeRequests = new Map<string, Promise<void>>();

const sendOptimizedImage = async (
  reply: FastifyReply,
  absolutePath: string,
  options: TransformOptions,
  cacheRoot: string
) => {
  const ext = normalizeFormat(path.extname(absolutePath).replace('.', '').toLowerCase());
  const targetFormat: ImageFormat = options.format || (ext || 'webp');
  const sizeKey = `${options.width || ''}x${options.height || ''}-${options.quality || ''}-${targetFormat}`;
  const cacheKey = createHash('sha1').update(`${absolutePath}:${sizeKey}`).digest('hex');

  const cacheDir = path.join(cacheRoot, 'uploads', 'cache', 'images');
  const cachePath = path.join(cacheDir, `${cacheKey}.${targetFormat}`);
  const tempPath = `${cachePath}.tmp`;


  reply.header('Cache-Control', 'public, max-age=31536000, immutable');

  // Attempt to serve from cache immediately
  try {
    const handle = await fs.promises.open(cachePath, 'r');
    return reply.type(`image/${targetFormat}`).send(handle.createReadStream());
  } catch { }

  if (activeRequests.has(cacheKey)) {
    await activeRequests.get(cacheKey);
    const handle = await fs.promises.open(cachePath, 'r');
    return reply.type(`image/${targetFormat}`).send(handle.createReadStream());
  }

  await fs.promises.mkdir(cacheDir, { recursive: true });

  const transformer = sharp(absolutePath)
    .resize({ ...options, fit: 'inside', withoutEnlargement: true })
    .toFormat(targetFormat, {
      ...{ smartSubsample: targetFormat === 'webp' ? true : undefined },
      quality: options.quality,
      progressive: true, // Better for perceived loading speed
      chromaSubsampling: targetFormat === 'webp' ? undefined : '4:2:0',
      effort: targetFormat === 'avif' ? 2 : undefined,
      mozjpeg: targetFormat === 'jpeg' // Use mozjpeg for better compression
    });

  if (targetFormat === 'avif') {
    transformer.avif({
    });
  } else if (targetFormat === 'webp') {
    transformer.webp({
      effort: 4,
      smartSubsample: true // WebP's high-quality 4:2:0 mode
    });
  }

  const responseStream = new PassThrough({ highWaterMark: 1024 * 512 });
  const fileStream = fs.createWriteStream(tempPath);

  let isResponseDestroyed = false;
  let fileBufferFull = false;
  let responseBufferFull = false;

  const updateBackpressure = () => {
    // Only resume if both streams are ready to receive data
    if (!fileBufferFull && !responseBufferFull) {
      transformer.resume();
    }
  };

  transformer.on('data', (chunk) => {
    // Write to file and check for backpressure
    fileBufferFull = !fileStream.write(chunk);

    // Write to response (if active) and check for backpressure
    if (!isResponseDestroyed) {
      responseBufferFull = !responseStream.write(chunk);
    } else {
      responseBufferFull = false; // Ignore backpressure from a dead response
    }

    if (fileBufferFull || responseBufferFull) {
      transformer.pause();
    }
  });

  transformer.on('end', () => {
    fileStream.end();
    if (!isResponseDestroyed) responseStream.end();
  });

  fileStream.on('drain', () => {
    fileBufferFull = false;
    updateBackpressure();
  });

  responseStream.on('drain', () => {
    responseBufferFull = false;
    updateBackpressure();
  });

  const transformTask = new Promise<void>((resolve, reject) => {
    // Set a safety timeout (e.g., 30 seconds) so a hung process doesn't block the key
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Transformation timeout'));
    }, 30000);

    const cleanup = async () => {
      clearTimeout(timeout);
      fileStream.destroy();
      if (!isResponseDestroyed) responseStream.destroy(new Error(`Image serving transformer timed out`));
      try {
        await fs.promises.unlink(tempPath);
      } catch { /* ignore if file doesn't exist */ }
    };

    fileStream.on('finish', async () => {
      try {
        await fs.promises.rename(tempPath, cachePath);
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    transformer.on('error', async (err) => {
      await cleanup();
      reject(err);
    });

    fileStream.on('error', async (err) => {
      await cleanup();
      reject(err);
    });
  });

  activeRequests.set(cacheKey, transformTask);
  transformTask.finally(() => activeRequests.delete(cacheKey));

  // If the client disconnects, mark response as destroyed but let the task continue
  reply.raw.on('close', () => {
    isResponseDestroyed = true;
    responseStream.destroy();
    // Resume transformer in case it was paused waiting for the response stream
    transformer.resume();
  });
  return reply.type(`image/${targetFormat}`).send(responseStream);
};

// Helper function

/**
 * Resolves a file path by checking both NFC and NFD normalization forms.
 * This ensures cross-platform compatibility (Linux/Windows/macOS).
 * @param baseDir The root directory (e.g., fastify.projectRoot).
 * @param relativePath The path stored in the database.
 * @returns The verified absolute path in its correct normalization, or null if not found.
 */

// Initialize the cache.
// max: 1000 entries
// ttl: 24 hours (paths on disk are unlikely to change frequently)
const pathResolutionCache = new LRUCache<string, string>({
  max: 2000,
  ttl: 1000 * 60 * 60 * 24,
});

/**
 * Resolves a file path by checking both NFC and NFD normalization forms.
 * Results are cached in memory to minimize disk I/O.
 */
export async function resolveNormalizedPath(
  baseDir: string,
  relativePath: string
): Promise<string | null> {
  const cacheKey = `${baseDir}:${relativePath}`;

  // 1. Check memory cache first
  const cachedPath = pathResolutionCache.get(cacheKey);
  if (cachedPath) {
    return cachedPath;
  }

  // 2. Generate the primary target (NFC)
  const absolutePathNFC = path.join(baseDir, relativePath).normalize('NFC');

  try {
    // Check if the NFC version exists on disk
    await fs.promises.access(absolutePathNFC, fs.constants.R_OK);

    // Store in cache before returning
    pathResolutionCache.set(cacheKey, absolutePathNFC);
    return absolutePathNFC;
  } catch {
    // 3. Generate the fallback (NFD)
    const absolutePathNFD = absolutePathNFC.normalize('NFD');

    // If the strings are identical, there is no need for a second disk check
    if (absolutePathNFC === absolutePathNFD) {
      return null;
    }

    try {
      await fs.promises.access(absolutePathNFD, fs.constants.R_OK);

      // Store in cache before returning
      pathResolutionCache.set(cacheKey, absolutePathNFD);
      return absolutePathNFD;
    } catch {
      // File does not exist in either form
      return null;
    }
  }
}

const filesRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  // Protect all routes in this file
  fastify.addHook('preHandler', fastify.authenticate);

  /**
   * GET /api/files/volume/:id/image/:imageName
   * Securely serves a specific manga page image.
   */
  fastify.get<{ Params: FileParams; Querystring: ImageTransformQuery }>(
    '/volume/:id/image/:imageName',
    { config: { rateLimit: false } },
    async (request, reply) => {
      const { id: volumeId, imageName } = request.params;
      const userId = request.user.id;
      const transformOptions = parseTransformOptions(request.query);

      let ownerCheck: SeriesWhereInput[] | undefined = [{ ownerId: userId }, { ownerId: 'admin' }];
      if (userId === 'admin') ownerCheck = undefined;

      try {
        // Find the volume and verify ownership (User OR Admin)
        const volume = await fastify.prisma.volume.findFirst({
          where: {
            id: volumeId,
            series: {
              OR: ownerCheck
            },
          },
          select: {
            filePath: true, // Only select the path we need
          },
        });

        // Case 1: Volume not found or access denied
        if (!volume) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: 'Volume not found or access denied.',
          });
        }

        // Security: Path Traversal Mitigation
        const cleanImageName = path.basename(imageName);

        // Construct the absolute file path
        const relativePath = path.join(
          volume.filePath,
          cleanImageName
        );

        // Check if file exists using normalization helper
        const validPath = await resolveNormalizedPath(fastify.projectRoot, relativePath);

        if (!validPath) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: 'Image file not found.',
          });
        }

        if (transformOptions) {
          return await sendOptimizedImage(reply, validPath, transformOptions, fastify.projectRoot);
        }

        return reply.sendFile(validPath);

      } catch (error) {
        fastify.log.error({ err: error }, 'File serving error');
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'An error occurred while serving the file.',
        });
      }
    }
  );

  /**
   * GET /api/files/series/:id/cover
   * Securely serves the series cover image.
   */
  fastify.get<{ Params: { id: string }; Querystring: ImageTransformQuery }>(
    '/series/:id/cover',
    { config: { rateLimit: false } },
    async (request, reply) => {
      const { id: seriesId } = request.params;
      const userId = request.user.id;
      const transformOptions = parseTransformOptions(request.query);

      let ownerCheck: SeriesWhereInput[] | undefined = [{ ownerId: userId }, { ownerId: 'admin' }];
      if (userId === 'admin') ownerCheck = undefined;

      try {
        const cacheKey = `series:${seriesId}:cover-path`;
        const { coverPath } = await fastify.prisma.findCached(
          userId,
          cacheKey,
          ["series:."],
          async () => {
            return await fastify.prisma.series.findFirst({
              where: { id: seriesId, OR: ownerCheck },
              select: { id: true, coverPath: true }
            });
          }
        ) ?? {};
        const validPath = coverPath ? await resolveNormalizedPath(fastify.projectRoot, coverPath) : null;
        if (!validPath) return reply.status(404).send('Cover not found');


        if (transformOptions) {
          return await sendOptimizedImage(reply, validPath, transformOptions, fastify.projectRoot);
        }

        return reply.sendFile(validPath);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send('Error serving cover');
      }
    }
  );

  /**
   * GET /api/files/preview
   * Serves an image file by path for preview purposes (e.g., scraped covers before confirmation).
   * Security: Only serves files within the user's upload directory.
   */
  fastify.get<{ Querystring: { path: string } }>(
    '/preview',
    { config: { rateLimit: false } },
    async (request, reply) => {
      const { path: filePath } = request.query;
      const userId = request.user.id;

      if (!filePath) {
        return reply.status(400).send({ error: 'Missing path parameter' });
      }

      try {
        // Security check: Ensure the file path starts with uploads/temp/userId
        const expectedPrefix = `uploads/temp/${userId}/`;
        if (!filePath.startsWith(expectedPrefix)) {
          return reply.status(403).send({ error: 'Access denied' });
        }

        // Resolve the file path with normalization support
        const validPath = await resolveNormalizedPath(fastify.projectRoot, filePath);

        if (!validPath) {
          return reply.status(404).send({ error: 'File not found' });
        }

        return reply.sendFile(validPath);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Error serving file' });
      }
    }
  );
};

export default filesRoutes;
