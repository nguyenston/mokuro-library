import { FastifyPluginAsync } from 'fastify';
import { getUploadJob } from '../lib/uploadQueue';
import { deleteSeriesById, deleteVolumeById } from '../utils/library/delete';
import { queryLibrary } from '../utils/library/query';
import type { LibraryQuery, LibraryResponse, SeriesResponse } from '../types/library';
import { transformSeriesForLibraryQuery, transformVolumeWithBranches } from '../utils/library/seriesTransform';
import { handleLibraryUpload, UploadQuery } from '../utils/library/upload';
import { handleSeriesCoverUpload } from '../utils/library/seriesCover';
import { HttpError } from '../types/error';

// an interface for the route parameters
interface VolumeParams {
  id: string; // This 'id' is the volumeId
}

interface SeriesParams {
  id: string; // This 'id' is the seriesId
}


interface UploadStatusParams {
  jobId: string;
}

const libraryRoutes: FastifyPluginAsync = async (
  fastify,
  opts
): Promise<void> => {
  // Protect all routes in this file
  fastify.addHook('preHandler', fastify.authenticate);

  /**
   * GET /api/library
   * Gets a list of all Series and Volume metadata visible to the current user.
   * Includes both private uploads and Admin's shared content.
   */
  fastify.get<{ Querystring: LibraryQuery }>('/', async (request, reply) => {
    try {
      const response: LibraryResponse = await queryLibrary(fastify, request.user.id, request.query);
      return reply.send(response);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ message: 'Could not retrieve library.' });
    }
  });

  /**
   * POST /api/library/check
   * Quick check to see if a Series/Volume pair already exists.
   * Prevents "EPIPE" errors by avoiding redundant uploads.
   */
  fastify.post<{ Body: { series_folder_name: string; volume_folder_name: string } }>(
    '/check',
    async (request, reply) => {
      const { series_folder_name, volume_folder_name } = request.body;
      const userId = request.user.id;

      if (!series_folder_name || !volume_folder_name) {
        return reply.status(400).send({ message: 'Missing identifiers' });
      }

      const exists = await fastify.prisma.volume.findFirst({
        where: {
          folderName: volume_folder_name,
          series: {
            folderName: series_folder_name,
            ownerId: userId
          }
        },
        select: { id: true } // Select minimal data
      });

      return reply.send({ exists: !!exists });
    }
  );

  /**
   * POST /api/library/upload
   * Smart Pipeline Upload: Receives one volume at a time.
   * STRICT ORDER: Fields (Identifiers) MUST come before Files.
   */
  fastify.post<{ Querystring: UploadQuery }>('/upload', async (request, reply) => {
    return handleLibraryUpload(fastify, request, reply);
  });

  /**
   * GET /api/library/upload/status/:jobId
   * Polls an async upload job status.
   */
  fastify.get<{ Params: UploadStatusParams }>(
    '/upload/status/:jobId',
    async (request, reply) => {
      const job = getUploadJob(request.params.jobId);
      if (!job) {
        return reply.status(404).send({ message: 'Upload job not found.' });
      }
      return reply.send(job);
    }
  );

  /**
   * POST /api/library/series/:id/cover
   * Uploads and sets the cover image for a series.
   */
  fastify.post<{ Params: SeriesParams }>(
    '/series/:id/cover',
    async (request, reply) => {
      return handleSeriesCoverUpload(fastify, request, reply);
    }
  );

  /**
   * GET /api/library/series/:id
   * Gets full data for one series, including its volumes.
   * Flattens user settings into the series object, but keeps volume progress as an array.
   */
  fastify.get<{ Params: SeriesParams }>(
    '/series/:id',
    async (request, reply) => {
      const { id: seriesId } = request.params;
      const userId = request.user.id;

      try {
        const series = await fastify.prisma.series.findFirst({
          where: {
            id: seriesId,
            OR: [{ ownerId: userId }, { ownerId: 'admin' }]
          },
          include: {
            userSettings: { where: { userId } },
            volumes: {
              orderBy: { sortTitle: 'asc' },
              include: {
                // Fetch Progress
                progress: { where: { userId } },
                branches: {
                  where: {
                    OR: [
                      { userId: userId },
                      { userId: 'admin' }
                    ]
                  },
                  include: {
                    headPatch: true,
                    rootPatch: true
                  }
                }
              }
            },
          },
        });

        if (!series) {
          return reply.status(404).send({ message: 'Series not found' });
        }

        // Transform Series Metadata
        const baseEntry = transformSeriesForLibraryQuery(series, userId);

        // Transform Volumes using the new helper
        const volumes = series.volumes.map(vol =>
          transformVolumeWithBranches(vol, userId)
        );

        const seriesResponse: SeriesResponse = {
          ...baseEntry,
          volumes
        };

        return reply.send(seriesResponse);

      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ message: 'An unexpected error occurred.' });
      }
    }
  );

  /**
   * GET /api/library/volume/:id
   * Gets full data for one volume, including the parsed .mokuro JSON.
   */
  fastify.get<{ Params: VolumeParams }>(
    '/volume/:id',
    async (request, reply) => {
      const { id: volumeId } = request.params;
      try {
        const volume = await request.accessStrategy.getVolume(volumeId);
        return volume;
      } catch (err: unknown) {
        if (err instanceof HttpError) {
          return reply.code(err.statusCode).send({ message: err.message });
        }
        request.log.error(err);
        const message = err instanceof Error ? err.message : 'Internal Server Error';
        return reply.code(500).send({ message });
      }
    }
  );

  /**
     * DELETE /api/library/series/:id
     * Deletes an entire series, all its volumes, and all associated files.
     */
  fastify.delete<{ Params: SeriesParams }>(
    '/series/:id',
    async (request, reply) => {
      try {
        await deleteSeriesById(fastify, request.params.id, request.user.id);
        return reply.status(200).send({ message: 'Series deleted successfully.' });
      } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode ?? 500;
        const message = error instanceof Error
          ? error.message
          : 'An unexpected error occurred while deleting the series.';

        if (statusCode !== 500) {
          return reply.status(statusCode).send({ message });
        }

        fastify.log.error(
          { err: error },
          'Error deleting series'
        );
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message
        });
      }
    }
  );

  /**
   * DELETE /api/library/volume/:id
   * Deletes a single volume, its files, and its progress.
   */
  fastify.delete<{ Params: VolumeParams }>(
    '/volume/:id',
    async (request, reply) => {
      try {
        await deleteVolumeById(fastify, request.params.id, request.user.id);
        return reply.status(200).send({ message: 'Volume deleted successfully.' });
      } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode ?? 500;
        const message = error instanceof Error
          ? error.message
          : 'An unexpected error occurred while deleting the volume.';

        if (statusCode !== 500) {
          return reply.status(statusCode).send({ message });
        }

        fastify.log.error(
          { err: error },
          'Error deleting volume'
        );
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message
        });
      }
    }
  );

  /**
     * POST /api/library/batch/delete
     * Bulk deletion for Series or Volumes.
     */
  fastify.post<{ Body: { ids: string[]; type: 'series' | 'volume' } }>(
    '/batch/delete',
    async (request, reply) => {
      const { ids, type } = request.body;
      const userId = request.user.id;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return reply.status(400).send({ message: 'No IDs provided' });
      }

      const results = {
        success: [] as string[],
        errors: [] as { id: string; error: string }[]
      };

      // Execute sequentially to prevent file system locking issues
      for (const id of ids) {
        try {
          if (type === 'series') {
            await deleteSeriesById(fastify, id, userId);
            results.success.push(id);
          } else {
            await deleteVolumeById(fastify, id, userId);
            results.success.push(id);
          }
        } catch (e) {
          fastify.log.error(e);
          results.errors.push({ id, error: (e as Error).message });
        }
      }

      return reply.send({
        message: `Deleted ${results.success.length} items. Failed: ${results.errors.length}`,
        results
      });
    }
  );
};

export default libraryRoutes;






