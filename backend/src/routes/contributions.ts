import { FastifyPluginAsync } from 'fastify';
import { ReviewStatusParams } from '../types/reviews';
import { HttpError } from '../types/error';
import * as similarity from 'string-similarity';

// Define types for request bodies/queries
interface SubmissionBody {
  volumeIds: string[];
  targetSeriesId?: string;
}

interface SubmissionQuery {
  status?: 'pending' | 'accepted' | 'rejected';
}

interface RejectBody {
  reason?: string;
}

interface BulkAcceptBody {
  submissionIds: string[];
}

interface BulkRejectBody {
  submissionIds: string[];
  reason: string;
}

const contributionsRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.addHook('preHandler', fastify.authenticate);

  /**
   * GET /api/contributions/summary
   * Returns user edit stats against admin-owned content plus pending submissions.
   */
  fastify.get('/summary', async (request, reply) => {
    const userId = request.user.id;
    const isAdmin = userId === 'admin';

    const pendingSubmissionsCount = isAdmin
      ? await fastify.prisma.submission.count({ where: { status: 'pending' } })
      : await fastify.prisma.submission.count({ where: { status: 'pending', userId } });

    const summary = await fastify.prisma.ocrBranch.getContributionSummary(userId);

    return reply.send({
      ...summary,
      pendingSubmissionsCount
    });
  });

  /**
   * GET /api/contributions/rebase
   * Returns a list of volumes that require user attention (Rebase Inbox).
   * These volumes have local edits (Ahead) but are missing server updates (Behind).
   */
  fastify.get<{ Querystring: { limit?: number } }>('/rebase', async (request, reply) => {
    const userId = request.user.id;
    const limit = Math.min(100, Number(request.query.limit ?? 50));
    try {
      // Use the rebaseQueryExtension we created in Step 1
      const queue = await fastify.prisma.ocrBranch.getVolumesNeedingRebase(userId, limit);
      return reply.send(queue);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ message: 'Failed to fetch rebase queue' });
    }
  });

  /**
   * GET /api/contributions/reviews
   * Fetches review requests using the injected Strategy.
   */
  fastify.get(
    '/reviews',
    async (request, reply) => {
      const userId = request.user.id;
      try {
        const reviews = await request.accessStrategy.getReviews(userId);
        return reply.send({ reviews });
      } catch (err) {
        request.log.error(err);
        const message = err instanceof Error ? err.message : 'Failed to fetch reviews';
        if (err instanceof HttpError) {
          return reply.code(err.statusCode).send({ message });
        }
        return reply.code(500).send({ message });
      }
    }
  );

  /**
   * GET /api/contributions/reviews/candidates
   * Fetches random eligible review candidates.
   */
  fastify.get<{ Querystring: { limit?: number } }>(
    '/reviews/candidates',
    async (request, reply) => {
      const userId = request.user.id;
      const limit = Math.min(100, Number(request.query.limit ?? 1));
      try {
        const candidates = await fastify.prisma.ocrBranch.getRandomEligibleReviews(userId, limit);
        return reply.send({ candidates });
      } catch (err) {
        request.log.error(err);
        const message = err instanceof Error ? err.message : 'Failed to fetch review candidates';
        return reply.code(500).send({ message });
      }
    }
  );

  /**
   * POST /api/contributions/reviews/set
   * Sets the status of a review request.
   */
  fastify.post<{ Body: ReviewStatusParams }>(
    '/reviews/set',
    async (request, reply) => {
      const userId = request.user.id;
      const params = request.body;

      try {
        const result = await request.accessStrategy.setReviewStatus(userId, params);
        return reply.send(result);
      } catch (err) {
        request.log.error(err);
        const message = err instanceof Error ? err.message : 'Failed to update review status';
        if (err instanceof HttpError) {
          return reply.code(err.statusCode).send({ message });
        }
        return reply.code(500).send({ message });
      }
    }
  );

  /**
   * POST /api/contributions/submissions
   * Submit volumes to the shared library.
   */
  fastify.post<{ Body: SubmissionBody }>(
    '/submissions',
    async (request, reply) => {
      const { volumeIds, targetSeriesId } = request.body;

      if (!volumeIds || volumeIds.length === 0) {
        return reply.status(400).send({ error: 'No volumes specified' });
      }

      try {
        // Delegate to the injected strategy (UserStrategy handles validation, AdminStrategy throws 400)
        await request.accessStrategy.submitVolumes(volumeIds, targetSeriesId);
        return reply.send({ success: true, message: 'Submission created' });
      } catch (e: any) {
        if (e.statusCode) return reply.status(e.statusCode).send({ error: e.message });
        throw e;
      }
    }
  );

  /**
   * GET /api/contributions/submissions
   * List submissions.
   * - Regular Users: See their own history.
   * - Admins: See pending queue (default) or filtered list.
   */
  fastify.get<{ Querystring: SubmissionQuery }>(
    '/submissions',
    async (request, reply) => {
      const userId = request.user.id;
      const isAdmin = userId === 'admin';
      const statusFilter = request.query.status;

      const whereClause: any = {};

      if (!isAdmin) {
        // Users only see their own
        whereClause.userId = userId;
        if (statusFilter) whereClause.status = statusFilter;
      } else {
        // Admins default to 'pending' if no filter is set
        whereClause.status = statusFilter || 'pending';
      }

      const submissions = await fastify.prisma.submission.findMany({
        where: whereClause,
        include: {
          sourceSeries: { select: { id: true, sortTitle: true, coverPath: true } },
          targetSeries: { select: { id: true, sortTitle: true, coverPath: true } },
          user: { select: { username: true } },
          _count: { select: { volumes: true } }
        },
        orderBy: { submittedAt: 'desc' }
      });

      return reply.send(submissions);
    }
  );

  /**
   * GET /api/contributions/submissions/:id
   * Get a single submission by its ID, including full volume details.
   * Auth: User must own submission OR be admin.
   */
  fastify.get<{ Params: { id: string } }>(
    '/submissions/:id',
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user.id;

      const submission = await fastify.prisma.submission.findUnique({
        where: { id },
        include: {
          user: { select: { username: true } },
          sourceSeries: { select: { id: true, sortTitle: true } },
          targetSeries: { select: { id: true, sortTitle: true } },
          volumes: {
            select: {
              id: true,
              title: true,
              folderName: true,
              pageCount: true,
              coverImageName: true,
              seriesId: true,
            },
          },
          comments: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                }
              }
            },
            orderBy: {
              createdAt: 'asc'
            }
          }
        },
      });

      if (!submission) {
        return reply.status(404).send({ error: 'Submission not found' });
      }

      // Check authorization: must be owner or admin
      if (submission.userId !== userId && userId !== 'admin') {
        return reply.status(403).send({ error: 'Not authorized to view this submission' });
      }

      return reply.send(submission);
    },
  );

  /**
   * POST /api/contributions/submissions/:id/comments
   * Adds a comment to a submission.
   * Auth: User must be admin or owner of the submission.
   */
  fastify.post<{ Params: { id: string }; Body: { content: string } }>(
    '/submissions/:id/comments',
    async (request, reply) => {
      const { id: submissionId } = request.params;
      const { content } = request.body;
      const userId = request.user.id;

      if (!content || content.trim().length === 0) {
        return reply.status(400).send({ error: 'Comment content cannot be empty' });
      }

      // First, verify the user has permission to comment.
      const submission = await fastify.prisma.submission.findUnique({
        where: { id: submissionId },
        select: { userId: true },
      });

      if (!submission) {
        return reply.status(404).send({ error: 'Submission not found' });
      }

      if (submission.userId !== userId && userId !== 'admin') {
        return reply.status(403).send({ error: 'You are not authorized to comment on this submission' });
      }

      try {
        const newComment = await fastify.prisma.submissionComment.create({
          data: {
            submissionId,
            userId,
            content: content.trim(),
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        });

        return reply.status(201).send(newComment);
      } catch (e: any) {
        fastify.log.error(e, `Failed to add comment to submission ${submissionId}`);
        return reply.status(500).send({ error: 'Failed to add comment.' });
      }
    }
  );

  /**
   * POST /api/contributions/submissions/:id/accept
   * Admin-only: Accept submission, move files, update DB.
   */
  fastify.post<{ Params: { id: string } }>(
    '/submissions/:id/accept',
    async (request, reply) => {
      const submissionId = request.params.id;

      try {
        // AdminStrategy executes the move; UserStrategy throws 403
        await request.accessStrategy.acceptSubmission(submissionId);
        return reply.send({ success: true, message: 'Submission accepted and volumes moved.' });
      } catch (e: any) {
        if (e.statusCode) return reply.status(e.statusCode).send({ error: e.message });
        fastify.log.error(e);
        return reply.status(500).send({ error: e.message });
      }
    }
  );

  /**
   * POST /api/contributions/submissions/:id/reject
   * Admin-only: Reject submission.
   */
  fastify.post<{ Params: { id: string }; Body: RejectBody }>(
    '/submissions/:id/reject',
    async (request, reply) => {
      const submissionId = request.params.id;
      const { reason } = request.body;

      try {
        // AdminStrategy updates status; UserStrategy throws 403
        await request.accessStrategy.rejectSubmission(submissionId, reason);
        return reply.send({ success: true, message: 'Submission rejected.' });
      } catch (e: any) {
        if (e.statusCode) return reply.status(e.statusCode).send({ error: e.message });
        throw e;
      }
    }
  );

  /**
   * DELETE /api/contributions/submissions/:id
   * Cancel/delete a pending submission.
   * Auth: User must own submission OR be admin.
   */
  fastify.delete<{ Params: { id: string } }>(
    '/submissions/:id',
    async (request, reply) => {
      const submissionId = request.params.id;
      const userId = request.user.id;

      try {
        // Fetch the submission to validate ownership and status
        const submission = await fastify.prisma.submission.findUnique({
          where: { id: submissionId }
        });

        if (!submission) {
          return reply.status(404).send({ error: 'Submission not found' });
        }

        // Check authorization: must be owner or admin
        if (submission.userId !== userId && userId !== 'admin') {
          return reply.status(403).send({ error: 'Not authorized to delete this submission' });
        }

        // Only allow deletion if status is pending
        if (submission.status !== 'pending') {
          return reply.status(400).send({ error: 'Only pending submissions can be cancelled' });
        }

        // Delete the submission (cascade will delete SubmissionVolume records)
        await fastify.prisma.submission.delete({
          where: { id: submissionId }
        });

        return reply.send({ success: true, message: 'Submission cancelled' });
      } catch (e: any) {
        fastify.log.error(e);
        return reply.status(500).send({ error: e.message });
      }
    }
  );

  /**
   * POST /api/contributions/submissions/accept
   * Bulk accept multiple submissions.
   * Admin-only: Process multiple submissions sequentially.
   */
  fastify.post<{ Body: BulkAcceptBody }>(
    '/submissions/accept',
    async (request, reply) => {
      const { submissionIds } = request.body;

      if (!submissionIds || submissionIds.length === 0) {
        return reply.status(400).send({ error: 'No submission IDs provided' });
      }

      const results = {
        success: 0,
        failed: 0,
        errors: [] as Array<{ id: string; error: string }>
      };

      // Process each submission sequentially
      for (const submissionId of submissionIds) {
        try {
          await request.accessStrategy.acceptSubmission(submissionId);
          results.success += 1;
        } catch (e: any) {
          results.failed += 1;
          results.errors.push({
            id: submissionId,
            error: e.message || 'Unknown error'
          });
          fastify.log.error(`Failed to accept submission ${submissionId}:`, e);
        }
      }

      return reply.send(results);
    }
  );

  /**
   * POST /api/contributions/submissions/reject
   * Bulk reject multiple submissions with a shared reason.
   * Admin-only: Apply same reason to all selected submissions.
   */
  fastify.post<{ Body: BulkRejectBody }>(
    '/submissions/reject',
    async (request, reply) => {
      const { submissionIds, reason } = request.body;

      if (!submissionIds || submissionIds.length === 0) {
        return reply.status(400).send({ error: 'No submission IDs provided' });
      }

      if (!reason || reason.trim() === '') {
        return reply.status(400).send({ error: 'Rejection reason is required' });
      }

      const results = {
        success: 0,
        failed: 0,
        errors: [] as Array<{ id: string; error: string }>
      };

      // Process each submission sequentially
      for (const submissionId of submissionIds) {
        try {
          await request.accessStrategy.rejectSubmission(submissionId, reason);
          results.success += 1;
        } catch (e: any) {
          results.failed += 1;
          results.errors.push({
            id: submissionId,
            error: e.message || 'Unknown error'
          });
          fastify.log.error(`Failed to reject submission ${submissionId}:`, e);
        }
      }

      return reply.send(results);
    }
  );

};

export default contributionsRoutes;
