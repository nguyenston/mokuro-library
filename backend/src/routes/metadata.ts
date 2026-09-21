import { FastifyPluginAsync } from 'fastify';
import { Prisma } from '../generated/prisma/client'; // Import Prisma for types
import { scrapeFromProvider } from '../utils/metadata/scrape';
import {
  getVolumeProgress,
  progressBodySchema,
  resetVolumeProgress,
  updateVolumeProgress,
  type ProgressBody
} from '../utils/metadata/progress';
import * as path from 'path';
import * as fs from 'fs';


const seriesUpdateSchema = {
  type: 'object',
  properties: {
    title: { type: ['string', 'null'] }, // Allow string or explicit null
    description: { type: ['string', 'null'] },
    bookmarked: { type: 'boolean' },
    organized: { type: 'boolean' },
    japaneseTitle: { type: ['string', 'null'] },
    romajiTitle: { type: ['string', 'null'] },
    synonyms: { type: ['string', 'null'] },
    tempCoverPath: { type: ['string', 'null'] }
  }
};

const volumeUpdateSchema = {
  type: 'object',
  properties: {
    title: { type: ['string', 'null'] } // Allow string or explicit null
  }
};

// Define an interface for our type-safe params
interface ProgressParams {
  id: string; // This 'id' is the volumeId
}

// Define an interface for our type-safe body
// For Volume or Series id
interface IdParams {
  id: string;
}

// Updated Interface for Series Body
interface SeriesUpdateBody {
  title?: string | null;
  description?: string | null;
  bookmarked?: boolean;
  organized?: boolean;
  japaneseTitle?: string | null;
  romajiTitle?: string | null;
  synonyms?: string | null;
  tempCoverPath?: string;
}

// Helper utility to remove undefined keys
const compact = <T extends object>(obj: T): Partial<T> => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  ) as Partial<T>;
};
const metadataRoutes: FastifyPluginAsync = async (
  fastify,
  opts
): Promise<void> => {
  // Protect all routes in this file
  fastify.addHook('preHandler', fastify.authenticate);

  // ===========================================================================
  // PROGRESS ENDPOINTS
  // Namespace: /volume/:id/progress
  // ===========================================================================

  /**
   * GET /api/metadata/volume/:id/progress
   * Gets the progress for a specific volume for the current user.
   */
  fastify.get<{ Params: ProgressParams }>(
    '/volume/:id/progress',
    async (request, reply) => {
      const { id: volumeId } = request.params;
      const userId = request.user.id; // we know request has user thanks to the auth hook

      try {
        const progress = await getVolumeProgress(fastify, volumeId, userId);
        return reply.status(200).send(progress);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Could not retrieve progress.',
        });
      }
    }
  );

  /**
   * PATCH /api/metadata/volume/:id/progress
   * Saves or updates the progress for a volume for the current user.
   */
  fastify.patch<{ Params: ProgressParams; Body: ProgressBody }>(
    '/volume/:id/progress',
    { schema: { body: progressBodySchema } },
    async (request, reply) => {
      const { id: volumeId } = request.params;
      const userId = request.user.id;
      const data = request.body;

      try {
        const upsertedProgress = await updateVolumeProgress(fastify, volumeId, userId, data);
        return reply.status(200).send(upsertedProgress);
      } catch (error: unknown) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
          return reply.status(404).send({ message: 'Volume not found.' });
        }
        fastify.log.error(error);
        return reply.status(500).send({ message: 'Could not save progress.' });
      }
    }
  );

  /**
     * DELETE /api/metadata/volume/:id/progress
     * Resets progress (Wipe).
     */
  fastify.delete<{ Params: IdParams }>(
    '/volume/:id/progress',
    async (request, reply) => {
      const { id: volumeId } = request.params;
      const userId = request.user.id;

      try {
        const response = await resetVolumeProgress(fastify, volumeId, userId);
        return reply.send(response);
      } catch (error: unknown) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          return reply.send({ message: 'Progress was already empty.' });
        }
        fastify.log.error(error);
        return reply.status(500).send({ message: 'Could not reset progress.' });
      }
    }
  );


  // ===========================================================================
  // METADATA ENDPOINTS (Renaming & Descriptions)
  // Namespace: /series/:id and /volume/:id
  // ===========================================================================

  /**
   * PATCH /api/metadata/series/:id
   * Updates Series metadata (Title, Description, Bookmarked).
   */
  fastify.patch<{ Params: IdParams; Body: SeriesUpdateBody }>(
    '/series/:id',
    { schema: { body: seriesUpdateSchema } },
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user.id;
      const {
        bookmarked,
        organized,
        tempCoverPath,
        ...sharedData
      } = request.body;

      try {
        // 1. Fetch Series to check ownership & existing paths
        const series = await fastify.prisma.series.findFirst({
          where: {
            id,
            OR: [{ ownerId: userId }, { ownerId: 'admin' }]
          },
          select: { ownerId: true, folderName: true, coverPath: true, title: true },
        });

        if (!series) return reply.status(404).send({ message: 'Series not found.' });

        const isOwner = series.ownerId === userId;

        // 2. Handle SHARED Data Update (Only if Owner)
        // If user is NOT owner but tries to update title/description, we ignore/warn
        const hasSharedUpdates = Object.keys(compact(sharedData)).length > 0 || tempCoverPath;

        if (hasSharedUpdates) {
          if (!isOwner) {
            // We don't throw error, just log and ignore shared updates
            // to allow "mixed" requests (bookmark + title) to partially succeed
            fastify.log.warn(`User ${userId} attempted to edit shared series ${id}`);
          } else {
            let finalCoverPath = series.coverPath;

            // Handle Cover Move
            if (tempCoverPath && tempCoverPath.includes(`uploads/temp/${userId}/`)) {
              const tempPathAbsolute = path.join(fastify.projectRoot, tempCoverPath);
              const ext = path.extname(tempCoverPath);
              const seriesDirRelative = path.join('uploads', userId, series.folderName);
              const seriesDirAbsolute = path.join(fastify.projectRoot, seriesDirRelative);

              await fs.promises.mkdir(seriesDirAbsolute, { recursive: true });

              const fileName = `${series.folderName}${ext}`;
              const finalPathAbsolute = path.join(seriesDirAbsolute, fileName);
              finalCoverPath = path.join(seriesDirRelative, fileName).replace(/\\/g, '/');

              await fs.promises.rename(tempPathAbsolute, finalPathAbsolute);
            }

            const dataToUpdate: Prisma.SeriesUpdateInput = compact({
              ...sharedData,
              sortTitle: sharedData.title !== undefined ? (sharedData.title ?? series.folderName) : undefined,
              coverPath: finalCoverPath,
            });

            await fastify.prisma.series.update({
              where: { id },
              data: dataToUpdate,
            });
          }
        }

        // 3. Handle PRIVATE Data Update (Settings)
        if (bookmarked !== undefined || organized !== undefined) {
          const settingsUpdate: Prisma.UserSeriesSettingsUpdateInput = {};
          const settingsCreate: Prisma.UserSeriesSettingsUncheckedCreateInput = {
            userId,
            seriesId: id
          };
          if (bookmarked !== undefined) {
            settingsUpdate.bookmarked = bookmarked;
            settingsCreate.bookmarked = bookmarked;
          }
          if (organized !== undefined) {
            settingsUpdate.organized = organized;
            settingsCreate.organized = organized;
          }

          await fastify.prisma.userSeriesSettings.upsert({
            where: { userId_seriesId: { userId, seriesId: id } },
            create: settingsCreate,
            update: settingsUpdate
          });
        }

        return reply.send({ message: 'Series updated successfully.' });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ message: 'Update failed.' });
      }
    }
  );

  /**
   * PATCH /api/metadata/volume/:id
   * Renames the Display Title of a Volume.
   */
  fastify.patch<{ Params: IdParams; Body: { title: string | null } }>(
    '/volume/:id',
    { schema: { body: volumeUpdateSchema } },
    async (request, reply) => {
      const { id } = request.params;
      const { title } = request.body;
      const userId = request.user.id;

      try {
        // Only owner can rename volume titles
        const vol = await fastify.prisma.volume.findFirst({
          where: { id, series: { ownerId: userId } },
          select: { folderName: true, series: { select: { id: true } } },
        });

        if (!vol) return reply.status(403).send({ message: 'Access denied or volume not found.' });

        await fastify.prisma.volume.update({
          where: { id },
          data: { title, sortTitle: title ?? vol.folderName },
        });

        return reply.send({ message: 'Volume title updated.', seriesId: vol.series.id });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ message: 'Update failed.' });
      }
    }
  );

  /**
   * POST /api/metadata/batch/organize
   * Batch updates the 'organized' status.
   */
  fastify.post<{ Body: { ids: string[]; value: boolean } }>(
    '/batch/organize',
    async (request, reply) => {
      const { ids, value } = request.body;
      const userId = request.user.id;

      if (!ids || !Array.isArray(ids)) return reply.status(400).send({ message: 'No IDs provided' });

      try {
        // Iterate and upsert for each series ID to ensure settings exist
        await fastify.prisma.$transaction(
          ids.map(id =>
            fastify.prisma.userSeriesSettings.upsert({
              where: { userId_seriesId: { userId, seriesId: id } },
              create: { userId, seriesId: id, organized: value },
              update: { organized: value }
            })
          )
        );

        return reply.send({ message: 'Batch update successful.', count: ids.length });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ message: 'Batch update failed.' });
      }
    }
  );

  /**
   * POST /api/metadata/series/scrape
   * Scrapes metadata (title, description, cover) from external APIs.
   * Implements multi-provider fallback for missing critical fields.
   */
  fastify.post<{ Body: { seriesId: string; seriesName: string; provider: 'anilist' | 'mal' | 'kitsu' } }>(
    '/series/scrape',
    async (request, reply) => {
      const { seriesId, seriesName, provider } = request.body;
      const userId = request.user.id;

      try {
        // 1. Verify ownership
        const series = await fastify.prisma.series.findFirst({
          where: { id: seriesId, ownerId: userId },
          select: { id: true, title: true, japaneseTitle: true, romajiTitle: true, synonyms: true, description: true, coverPath: true, folderName: true }
        });

        if (!series) {
          return reply.status(404).send({ message: 'Series not found' });
        }

        // 2. Scrape metadata from primary provider
        const scrapedData = await scrapeFromProvider(fastify, provider, seriesName);

        // 3. Multi-provider fallback: silently fill missing fields from other providers
        const needsFallback = !scrapedData.japaneseName || !scrapedData.romajiName || !scrapedData.description;

        if (needsFallback) {
          const otherProviders: ('anilist' | 'mal' | 'kitsu')[] = ['anilist', 'mal', 'kitsu'].filter(p => p !== provider) as ('anilist' | 'mal' | 'kitsu')[];

          for (const fallbackProvider of otherProviders) {
            // Only fetch if we still have missing fields
            const stillMissing = !scrapedData.japaneseName || !scrapedData.romajiName || !scrapedData.description;
            if (!stillMissing) break;

            const fallbackData = await scrapeFromProvider(fastify, fallbackProvider, seriesName);

            // Fill in ONLY missing fields from fallback (don't replace existing data)
            if (fallbackData.japaneseName && !scrapedData.japaneseName) {
              scrapedData.japaneseName = fallbackData.japaneseName;
            }
            if (fallbackData.romajiName && !scrapedData.romajiName) {
              scrapedData.romajiName = fallbackData.romajiName;
            }
            if (fallbackData.description && !scrapedData.description) {
              scrapedData.description = fallbackData.description;
            }

            // Add delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        const isEmpty = !scrapedData || Object.keys(scrapedData).length === 0;
        if (isEmpty) {
          throw new Error("Scrape returned empty.");
        }

        // Note: We intentionally keep all title variants even if they're identical.
        // This allows users to see all available data and make their own choice.

        // 4.5. Fallback: If no English title, use Romaji as the primary title
        // This ensures the "Title" field is always populated when possible
        if (!scrapedData.englishName && scrapedData.romajiName) {
          scrapedData.englishName = scrapedData.romajiName;
        }

        // 5. Download cover image if available
        let tempCoverPath: string | undefined;
        if (scrapedData.coverUrl) {
          try {
            const imageResp = await fetch(scrapedData.coverUrl);
            if (imageResp.ok) {
              const buffer = await imageResp.arrayBuffer();
              const contentType = imageResp.headers.get('content-type');
              let ext = '.jpg';
              if (contentType?.includes('png')) ext = '.png';
              else if (contentType?.includes('webp')) ext = '.webp';

              // Save to a temporary directory specifically for this user/session
              const tempDir = path.join(fastify.projectRoot, 'uploads', 'temp', userId);
              await fs.promises.mkdir(tempDir, { recursive: true });

              const tempFileName = `temp_${seriesId}_${Date.now()}${ext}`;
              const tempFilePathAbsolute = path.join(tempDir, tempFileName);

              await fs.promises.writeFile(tempFilePathAbsolute, Buffer.from(buffer));
              // Return relative path for the frontend to reference
              tempCoverPath = path.join('uploads', 'temp', userId, tempFileName).replace(/\\/g, '/');
            }
          } catch (err) {
            fastify.log.error(`Failed to download temp cover: ${err}`);
          }
        }

        // 6. Return scraped data for preview (don't save yet)
        return reply.status(200).send({
          current: {
            title: series.title,
            japaneseTitle: series.japaneseTitle,
            romajiTitle: series.romajiTitle,
            synonyms: series.synonyms,
            description: series.description,
            hasCover: !!series.coverPath,
            coverPath: series.coverPath
          },
          scraped: {
            title: scrapedData.englishName,
            japaneseTitle: scrapedData.japaneseName,
            romajiTitle: scrapedData.romajiName,
            synonyms: scrapedData.synonyms?.length ? JSON.stringify(scrapedData.synonyms) : undefined,
            description: scrapedData.description,
            hasCover: !!tempCoverPath,
            tempCoverPath
          }
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const errorStack = err instanceof Error ? err.stack : undefined;
        fastify.log.error({
          error: errorMessage,
          stack: errorStack,
          seriesId,
          seriesName,
          provider
        }, 'Failed to scrape metadata');
        return reply.status(500).send({
          error: 'Failed to scrape metadata',
          message: errorMessage
        });
      }
    }
  );
};

export default metadataRoutes;



