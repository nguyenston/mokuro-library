import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ensureAdminBranch, ensureUserBranch } from '../utils/ocrHelpers';
import { RebaseEngine } from '../lib/rebase/RebaseEngine';
import { patchOperationSchema } from '../lib/PatchOperationValidator';
import { HttpError } from '../types/error';

// --- Zod Schemas ---

export const patchBodySchema = z.object({
  operation: patchOperationSchema,
  branchVersion: z.number().int().nonnegative(),
});

const ocrRoutes: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.addHook('preHandler', fastify.authenticate);

  /**
   * POST /api/library/volumes/:id/patch
   */
  fastify.post<{ Params: { id: string }, Body: z.infer<typeof patchBodySchema> }>(
    '/volume/:id/patch',
    async (request, reply) => {
      const { id } = request.params;
      const parseResult = patchBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ message: 'Invalid patch', errors: parseResult.error });
      }
      const { operation, branchVersion } = parseResult.data;

      try {
        const result = await request.accessStrategy.applyPatch(id, operation, branchVersion);
        return result;
      } catch (err: any) {
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
   * POST /api/library/volumes/:id/undo
   */
  fastify.post<{ Params: { id: string }, Body: { branchVersion: number } }>(
    '/volume/:id/undo',
    async (request, reply) => {
      const { id } = request.params;
      const { branchVersion } = request.body;

      try {
        const result = await request.accessStrategy.undo(id, branchVersion);
        return result;
      } catch (err: any) {
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
   * POST /api/library/volumes/:id/redo
   */
  fastify.post<{ Params: { id: string }, Body: { branchVersion: number } }>(
    '/volume/:id/redo',
    async (request, reply) => {
      const { id } = request.params;
      const { branchVersion } = request.body;

      try {
        const result = await request.accessStrategy.redo(id, branchVersion);
        return result;
      } catch (err: any) {
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
   * POST /api/library/volumes/:id/reset
   */
  fastify.post<{ Params: { id: string } }>(
    '/volume/:id/reset',
    async (request, reply) => {
      const { id } = request.params;

      try {
        await request.accessStrategy.reset(id);
        return { success: true };
      } catch (err: any) {
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
   * POST /api/library/volume/:id/ocr
   * Synchronizes the snapshot with the current server state (db patches + disk).
   * Returns the fresh data and version to the frontend to reset optimistic locking.
   */
  fastify.post<{ Params: { id: string } }>(
    '/volume/:id/ocr',
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user.id;

      try {
        /**
         * createSnapshot (via syncSnapshot) performs the server-side reconciliation:
         * 1. Replays all pending database patches into the data object.
         * 2. Persists the result to the .json snapshot file on disk.
         * 3. Returns the OcrBranch (including version) and the MokuroData.
         */
        const { data, branch } = await request.accessStrategy.createSnapshot(id);

        // Return everything the frontend needs to stay in sync
        return reply.send({
          success: true,
          data,           // The flattened OCR pages
          version: branch.version, // The new version for the next patch request
          headPatchId: branch.headPatchId
        });
      } catch (err: any) {
        if (err instanceof HttpError) {
          return reply.code(err.statusCode).send({ message: err.message });
        }
        request.log.error(err);
        return reply.code(500).send({ error: 'Failed to synchronize OCR snapshot' });
      }
    }
  );

  /**
     * POST /api/library/volume/:id/officialize
     * Fast-forward merges a user's branch into the official admin branch.
     */
  fastify.post<{ Params: { id: string }, Body: { sourceBranchUserId: string } }>(
    '/volume/:id/officialize',
    async (request, reply) => {
      const { id } = request.params;
      const { sourceBranchUserId } = request.body;

      try {
        await request.accessStrategy.officialize(id, sourceBranchUserId);
        return { success: true };
      } catch (err: any) {
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
   * GET /api/library/rebase/sessions
   * Returns all active rebase sessions for the current user.
   * Used by the frontend to detect interruptions and resume work.
   */
  fastify.get(
    '/rebase/sessions',
    async (request, reply) => {
      const userId = request.user.id;

      try {
        const sessions = await fastify.prisma.rebaseSession.findMany({
          where: {
            branch: { userId } // Only sessions belonging to this user
          },
          include: {
            branch: {
              include: {
                volume: {
                  select: {
                    series: { select: { sortTitle: true } },
                    sortTitle: true
                  }
                }
              }
            }
          }
        });

        // Map to a frontend-friendly format
        const formattedSessions = sessions.map(session => ({
          sessionId: session.id,
          volumeId: session.branch.volumeId,
          volumeTitle: session.branch.volume.sortTitle,
          seriesTitle: session.branch.volume.series.sortTitle,
          currentConflict: session.currentConflict ? JSON.parse(session.currentConflict) : null,
          updatedAt: session.updatedAt
        }));

        return reply.send({ sessions: formattedSessions });
      } catch (err) {
        request.log.error(err);
        return reply.code(500).send({ message: 'Failed to fetch rebase sessions' });
      }
    }
  );

  /**
   * POST /api/library/volumes/:id/rebase/start
   */
  fastify.post<{ Params: { id: string } }>(
    '/volume/:id/rebase/start',
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user.id;

      try {
        // Rebase eligibility is handled in RebaseEngine.start; non-applicable cases fast-forward
        // or return complete rather than rejecting the request.
        const volume = await fastify.prisma.volume.findUnique({ where: { id } });
        if (!volume) return reply.status(404).send({ message: 'Volume not found' });

        const adminBranch = await ensureAdminBranch(fastify, id, volume.mokuroPath);
        await ensureUserBranch(fastify, id, userId, adminBranch);

        const engine = new RebaseEngine(fastify);
        const result = await engine.start(id, userId);

        if (result.status === 'complete') {
          const updatedBranch = await fastify.prisma.ocrBranch.findUnique({
            where: { volumeId_userId: { volumeId: id, userId } }
          });
          return reply.send({
            status: 'complete',
            newHeadId: updatedBranch?.headPatchId,
            hasAhead: result.finalPatches?.length ?? 0
          });
        } else {
          return reply.send(result);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to start rebase';
        fastify.log.error(error);
        return reply.status(500).send({ message });
      }
    }
  );

  /**
   * POST /api/library/volumes/:id/rebase/continue
   */
  fastify.post<{ Params: { id: string }, Body: { rebaseId: string, resolution: 'keep_admin' | 'keep_mine' } }>(
    '/volume/:id/rebase/continue',
    async (request, reply) => {
      const { id } = request.params;
      const { rebaseId, resolution } = request.body;
      const userId = request.user.id;

      try {
        const session = await fastify.prisma.rebaseSession.findUnique({
          where: { id: rebaseId },
          include: { branch: true }
        });
        if (!session) {
          return reply.status(404).send({ message: 'Rebase session not found' });
        }
        if (session.branch.userId !== userId) {
          return reply.status(403).send({ message: 'Not authorized to continue this rebase session' });
        }

        const engine = new RebaseEngine(fastify);
        const result = await engine.continue(rebaseId, resolution);

        if (result.status === 'complete') {
          const updatedBranch = await fastify.prisma.ocrBranch.findUnique({
            where: { volumeId_userId: { volumeId: id, userId } }
          });
          return reply.send({
            status: 'complete',
            newHeadId: updatedBranch?.headPatchId,
            hasAhead: result.finalPatches?.length ?? 0
          });
        } else {
          return reply.send(result);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to continue rebase';
        fastify.log.error(error);
        return reply.status(500).send({ message });
      }
    }
  );

  /**
   * POST /api/library/volumes/:id/rebase/abort
   */
  fastify.post<{ Params: { id: string }, Body: { rebaseId: string } }>(
    '/volume/:id/rebase/abort',
    async (request, reply) => {
      const { id } = request.params;
      const { rebaseId } = request.body;
      const userId = request.user.id;

      try {
        const session = await fastify.prisma.rebaseSession.findUnique({
          where: { id: rebaseId },
          include: { branch: true }
        });
        if (!session) {
          return reply.status(404).send({ message: 'Rebase session not found' });
        }
        if (session.branch.userId !== userId) {
          return reply.status(403).send({ message: 'Not authorized to abort this rebase session' });
        }

        const engine = new RebaseEngine(fastify);
        await engine.abort(rebaseId);
        return reply.send({ status: 'aborted' });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to abort rebase';
        fastify.log.error(error);
        return reply.status(500).send({ message });
      }
    }
  );
};

export default ocrRoutes;
