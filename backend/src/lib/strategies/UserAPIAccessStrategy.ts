import { FastifyInstance } from 'fastify';
import { VolumeResponse } from '../../types/library';
import {
  ApplyPatchResponse,
  UndoResponse,
  RedoResponse,
  PatchOperation
} from '../../types/history';
import { ReviewRequestEntry, ReviewStatusParams, ReviewStatusResult } from '../../types/reviews';
import { IAPIAccessStrategy } from './IAPIAccessStrategy';
import {
  ensureAdminBranch,
  ensureUserBranch,
  inheritAdminSnapshot,
  syncSnapshot
} from '../../utils/ocrHelpers';
import { PatchInverter } from '../PatchInverter';
import { parseStoredPatchOperation } from '../PatchOperationValidator';
import { MokuroData } from '../../types/mokuro';
import { OcrBranch } from '../../generated/prisma/client';
import { validateAndPlanSubmission } from '../../utils/submissionHelper';
import { HttpError } from '../../types/error';
import { RebaseEngine } from '../rebase/RebaseEngine';
import { RebaseResult, RebaseStateChangedError } from '../../types/rebase';

/**
 * Strategy for standard users.
 * Implements private branching, hybrid library visibility, and "Fork-on-Write" OCR.
 */
export class UserAPIAccessStrategy implements IAPIAccessStrategy {
  /**
   * Storing the FastifyInstance as a field allows the strategy to access
   * prisma, logging, and the project root consistently.
   */
  constructor(
    private fastify: FastifyInstance,
    private userId: string
  ) { }

  /**
   * Retrieves a volume with user-specific divergent state.
   * This is a "Hybrid" read: it merges official data with private edits.
   */
  async getVolume(volumeId: string): Promise<VolumeResponse> {
    // 1. Fetch volume with ownership check (Private OR Admin-owned)
    const cacheKey = `volume:${volumeId}`;
    const volume = await this.fastify.prisma.findCached(
      this.userId,
      cacheKey,
      ["volume:.:shared", "userprogress:progress:private"],
      async () => {
        return await this.fastify.prisma.volume.findFirst({
          where: {
            id: volumeId,
            series: { OR: [{ ownerId: this.userId }, { ownerId: 'admin' }] }
          },
          include: {
            progress: {
              where: { userId: this.userId },
              select: {
                id: true,
                page: true,
                completed: true,
                timeRead: true,
                charsRead: true,
                lastReadAt: true,
                userId: true,
                volumeId: true
              }
            }
          }
        });
      }
    );

    if (!volume) {
      throw new HttpError(404, 'Volume not found or access denied');
    }

    // 2. Ensure both branches exist
    const adminBranch = await ensureAdminBranch(this.fastify, volumeId, volume.mokuroPath);
    const userBranch = await ensureUserBranch(this.fastify, volumeId, this.userId, adminBranch);

    // 3. Compute Divergence Status (hasAhead / hasBehind)
    // hasAhead: User has private patches (Dirty branch)
    const forkSequence = userBranch.rootPatch?.sequence ? userBranch.rootPatch.sequence - 1 : userBranch.headPatch.sequence;
    const hasAhead = userBranch.headPatch.sequence - forkSequence;
    const hasBehind = adminBranch.headPatch.sequence - forkSequence;

    // 4. Get Computed Document State (Syncs database history to JSON snapshot)
    const mokuroData = (await syncSnapshot(this.fastify, userBranch)).data;

    return {
      id: volume.id,
      title: volume.sortTitle,
      folderName: volume.folderName,
      seriesId: volume.seriesId,
      pageCount: volume.pageCount,
      coverImageName: volume.coverImageName,
      progress: volume.progress,
      mokuroData: mokuroData,
      versionInfo: {
        branchId: userBranch.id,
        headPatchId: userBranch.headPatchId,
        branchVersion: userBranch.version,
        hasAhead,
        hasBehind,
        reviewHeadPatchId: userBranch.reviewHeadPatchId,
        reviewRequestedAt: userBranch.reviewRequestedAt,
        rejectionReason: userBranch.rejectionReason
      }
    };
  }

  /**
   * Appends an edit to the user's private history, creating a private root when needed.
   * Editing after undo deletes the abandoned redo history before appending the patch.
   * During a pending review, HEAD must remain at or after the submitted head, so
   * this deletion can only remove unsubmitted patches. An invalid stored review
   * range is reported as a server-state error before any history is deleted.
   */
  async applyPatch(
    volumeId: string,
    op: PatchOperation,
    version: number
  ): Promise<ApplyPatchResponse> {
    const userId = this.userId;

    // 1. Setup Branches
    const volume = await this.fastify.prisma.volume.findFirst({
      where: {
        id: volumeId,
        series: { OR: [{ ownerId: userId }, { ownerId: 'admin' }] }
      },
      include: {
        progress: {
          where: { userId },
          select: {
            id: true,
            page: true,
            completed: true,
            timeRead: true,
            charsRead: true,
            lastReadAt: true,
            userId: true,
            volumeId: true
          }
        }
      }
    });
    if (!volume) throw new HttpError(404, 'Volume not found');

    const adminBranch = await ensureAdminBranch(this.fastify, volumeId, volume.mokuroPath);
    const userBranch = await ensureUserBranch(this.fastify, volumeId, userId, adminBranch);

    // 2. Optimistic Lock
    if (userBranch.version !== version) {
      throw new HttpError(409, 'Version mismatch. Please refresh.');
    }

    const headPatch = userBranch.headPatch;
    const rootPatch = userBranch.rootPatch;
    const snapshotPatch = userBranch.snapshotPatch;

    // 3. Snapshot Sync (outside transaction)
    // If the snapshot is in the "future" (ahead of HEAD), sync it back before writing.
    const isSnapshotAhead = snapshotPatch && snapshotPatch.sequence > headPatch.sequence;
    if (isSnapshotAhead) {
      this.fastify.log.info(`[Strategy] Snapshot ahead of HEAD (${snapshotPatch.sequence} > ${headPatch.sequence}). Syncing back before write.`);
      await syncSnapshot(this.fastify, userBranch);
    }

    // 4. Transactional Write
    const result = await this.fastify.prisma.$transaction(async (tx) => {
      // userBranch was loaded before this transaction, possibly before snapshot sync.
      // Another request may have changed edits or review state since then. Recheck
      // its version here before deleting history based on the captured HEAD/root.
      const currentBranch = await tx.ocrBranch.findUnique({
        where: { id: userBranch.id },
        select: { version: true, reviewHeadPatch: { select: { sequence: true, volumeId: true } } }
      });
      if (!currentBranch || currentBranch.version !== version) {
        throw new HttpError(409, 'Branch or review changed. Please refresh.');
      }
      // Undo prevents HEAD moving behind a pending review. A stored review must
      // therefore lie between the private root and HEAD in this volume; violating
      // that invariant is a server bug (500), not a retryable version conflict (409).
      const reviewHead = currentBranch.reviewHeadPatch;
      if (reviewHead && (!rootPatch || reviewHead.volumeId !== volumeId ||
        rootPatch.sequence > reviewHead.sequence || headPatch.sequence < reviewHead.sequence)) {
        throw new HttpError(500, 'Invalid server branch state: pending review is outside the active private range.');
      }

      // CASE 1: Root is NULL (Clean state -> Fork)
      // No deletion needed

      // CASE 2: Root > Head (User undid past their own root -> Re-fork)
      // We delete the old root, which cascades and deletes the now-abandoned branch history.
      if (rootPatch && rootPatch.sequence > headPatch.sequence) {
        await tx.patch.delete({ where: { id: rootPatch.id } });
      }

      // CASE 3: Head has children (User undid within branch -> Wipe Future)
      // If we are adding a new patch from a middle point, we must prune the 'Redo' path.
      else if (rootPatch) {
        const children = await tx.patch.findMany({
          where: { parentId: headPatch.id },
          select: { id: true }
        });
        if (children.length > 1) this.fastify.log.warn(`User branch shouldn't have multiple leaves: ${userBranch.id}`);
        for (const child of children) {
          await tx.patch.delete({ where: { id: child.id } });
        }
      }

      // Create the New Patch
      // The parentId is always the current head (which is the admin head if the branch is clean).
      const newPatch = await tx.patch.create({
        data: {
          volumeId,
          userId,
          parentId: headPatch.id,
          operation: JSON.stringify(op),
          sequence: headPatch.sequence + 1
        }
      });

      // Update Branch Pointers
      // Determine if we need to set a new branch root (first fork or after a re-fork).
      const shouldSetNewRoot = !rootPatch || (rootPatch.sequence > headPatch.sequence);
      const finalRootId = shouldSetNewRoot ? newPatch.id : rootPatch.id;

      const updatedBranch = await tx.ocrBranch.update({
        where: { id: userBranch.id },
        data: {
          headPatchId: newPatch.id,
          rootPatchId: finalRootId,
          version: { increment: 1 }
        }
      });

      return { newPatch, updatedBranch };
    });

    return {
      success: true,
      newHeadId: result.newPatch.id,
      newVersion: result.updatedBranch.version,
      patch: op
    };
  }

  /**
   * Reverts the most recent patch in the user's branch history.
   * Follows the head-crawl logic where the pointer moves to the parent.
   * Only unsubmitted tail patches can be undone while a review is pending:
   * moving HEAD to reviewHeadPatchId is allowed; undoing that patch is not.
   * The final write checks the branch version atomically. Review-state changes
   * increment it too, so a concurrent submission invalidates this undo.
   */
  async undo(volumeId: string, version: number): Promise<UndoResponse> {
    const userId = this.userId;

    // 1. Setup and Authorization
    const volume = await this.fastify.prisma.volume.findFirst({
      where: {
        id: volumeId,
        series: { OR: [{ ownerId: this.userId }, { ownerId: 'admin' }] }
      },
      select: { mokuroPath: true }
    });
    if (!volume) throw new HttpError(404, 'Volume not found');

    const adminBranch = await ensureAdminBranch(this.fastify, volumeId, volume.mokuroPath);
    const userBranch = await ensureUserBranch(this.fastify, volumeId, userId, adminBranch);

    // 2. Optimistic Lock Check
    if (userBranch.version !== version) {
      throw new HttpError(409, 'Version mismatch. Please refresh.');
    }

    // 3. Retrieve Current Patch for Inversion
    if (userBranch.headPatchId === userBranch.reviewHeadPatchId) {
      throw new HttpError(409, 'Cannot undo patches that are currently submitted for review.');
    }
    const currentHeadId = userBranch.headPatchId;
    const currentPatch = await this.fastify.prisma.patch.findUnique({
      where: { id: currentHeadId }
    });

    // 4. Boundary Check
    // If no parent exists, the user is at the Genesis patch or the branch start.
    if (!currentPatch) throw new HttpError(500, 'HEAD patch not found.');
    if (!currentPatch.parentId) throw new HttpError(400, 'Cannot undo: Reached start of history.');


    // 5. Invert the Operation
    // This allows the frontend to undo the change in its local state immediately.
    const operation = parseStoredPatchOperation(currentPatch.operation, `patch ${currentPatch.id}`);
    const inversePatch = PatchInverter.invert(operation);
    const newHeadId = currentPatch.parentId;

    // 6. Move HEAD only if neither edits nor review state changed since the read.
    const updatedBranch = await this.fastify.prisma.ocrBranch.updateMany({
      where: {
        id: userBranch.id,
        version
      },
      data: {
        headPatchId: newHeadId,
        version: { increment: 1 }
      }
    });

    if (updatedBranch.count !== 1) {
      throw new HttpError(409, 'Branch or review changed. Please refresh.');
    }

    return {
      success: true,
      newHeadId: newHeadId,
      newVersion: version + 1,
      patch: inversePatch
    };
  }

  /**
   * Re-applies a previously undone patch in the user's branch history.
   * Selects the next patch and moves HEAD only if the branch version still matches.
   * Redo into the unsubmitted tail is allowed during review. A stored review
   * outside the active private range is a server-state error, not a redo restriction.
   */
  async redo(volumeId: string, version: number): Promise<RedoResponse> {
    const userId = this.userId;

    // 1. Setup and Authorization
    const volume = await this.fastify.prisma.volume.findFirst({
      where: {
        id: volumeId,
        series: { OR: [{ ownerId: this.userId }, { ownerId: 'admin' }] }
      },
      select: { mokuroPath: true }
    });
    if (!volume) throw new HttpError(404, 'Volume not found');

    const adminBranch = await ensureAdminBranch(this.fastify, volumeId, volume.mokuroPath);
    const userBranch = await ensureUserBranch(this.fastify, volumeId, userId, adminBranch);

    // 2. Optimistic Lock Check
    if (userBranch.version !== version) {
      throw new HttpError(409, 'Version mismatch. Please refresh.');
    }

    const currentHeadId = userBranch.headPatchId;
    const rootPatchId = userBranch.rootPatchId;

    // 3. Find Candidate "Next" Patches
    const [rootPatch, currentPatch, children, reviewHead] = await Promise.all([
      // Check if the user is at the fork point and about to redo into their own branch root
      rootPatchId
        ? this.fastify.prisma.patch.findUnique({
          where: { id: rootPatchId },
          select: { id: true, parentId: true, operation: true, sequence: true }
        })
        : null,
      // Check if the current patch has an explicit forward link (used in official/admin history)
      this.fastify.prisma.patch.findUnique({
        where: { id: currentHeadId },
        select: { nextPatch: { select: { id: true, operation: true } }, sequence: true }
      }),
      // Find all patches that list the current HEAD as their parent
      this.fastify.prisma.patch.findMany({
        where: { parentId: currentHeadId },
        select: { id: true, operation: true }
      }),
      userBranch.reviewHeadPatchId
        ? this.fastify.prisma.patch.findUnique({
          where: { id: userBranch.reviewHeadPatchId },
          select: { sequence: true, volumeId: true }
        })
        : null
    ]);
    if (!currentPatch) throw new HttpError(500, 'HEAD patch not found.');

    // Undo cannot move HEAD behind a pending review. Detect an invalid stored
    // boundary rather than silently using redo to repair impossible branch state.
    if (userBranch.reviewHeadPatchId && (!reviewHead || !rootPatch ||
      reviewHead.volumeId !== volumeId || rootPatch.sequence > reviewHead.sequence ||
      currentPatch.sequence < reviewHead.sequence)) {
      throw new HttpError(500, 'Invalid server branch state: pending review is outside the active private range.');
    }

    // 4. Selection Logic (Prioritized)
    let nextPatch: { id: string, operation: string } | null = null;

    if (rootPatch?.parentId === currentHeadId) {
      // Redo back into the start of the user's private branch
      nextPatch = rootPatch;
    } else if (currentPatch.nextPatch) {
      // Follow the explicit doubly-linked list (Official history)
      if (rootPatch && rootPatch.sequence <= currentPatch.sequence) throw new HttpError(500, 'Branch HEAD in invalid location.');
      nextPatch = currentPatch.nextPatch;
    } else if (children.length === 1) {
      // Follow the only available child path
      nextPatch = children[0];
    } else if (children.length > 1) {
      // Block redo if the history has branched significantly
      throw new HttpError(500, 'Cannot redo: multiple children paths available.');
    }

    if (!nextPatch) {
      throw new HttpError(400, 'Nothing to redo');
    }

    // 5. Update Branch Pointer
    const operation = parseStoredPatchOperation(nextPatch.operation, `patch ${nextPatch.id}`);

    // The early check rejects already-stale requests; this atomic check also
    // catches edits or review-state changes made while selecting the next patch.
    const updatedBranch = await this.fastify.prisma.ocrBranch.updateMany({
      where: { id: userBranch.id, version },
      data: {
        headPatchId: nextPatch.id,
        version: { increment: 1 }
      }
    });

    if (updatedBranch.count !== 1) {
      throw new HttpError(409, 'Branch or review changed. Please refresh.');
    }

    return {
      success: true,
      newHeadId: nextPatch.id,
      newVersion: version + 1,
      patch: operation
    };
  }

  /**
   * Start an explicit contributor rebase after enforcing request-level policy.
   * The displayed branch version binds the request to the state the contributor
   * confirmed. A pending review requires explicit consent and is cancelled before
   * control passes to the review-agnostic rebase engine.
   */
  async startRebase(volumeId: string, version: number, forced = false): Promise<RebaseResult> {
    // 1. Authorize the volume and ensure both branches exist.
    const volume = await this.fastify.prisma.volume.findFirst({
      where: { id: volumeId, series: { OR: [{ ownerId: this.userId }, { ownerId: 'admin' }] } },
      select: { mokuroPath: true }
    });
    if (!volume) throw new HttpError(404, 'Volume not found or access denied');

    const adminBranch = await ensureAdminBranch(this.fastify, volumeId, volume.mokuroPath);
    const branch = await ensureUserBranch(this.fastify, volumeId, this.userId, adminBranch);

    // 2. Reject stale UI state and require consent before cancelling a review.
    if (branch.version !== version) throw new HttpError(409, 'Branch or review changed. Please refresh.');
    if (branch.reviewHeadPatchId !== null && !forced) {
      throw new HttpError(409,
        'Rebase cancels the pending review. Confirm cancellation and resend with forced = true and the same branchVersion.',
        'REVIEW_CANCELLATION_CONFIRMATION_REQUIRED');
    }

    // 3. Commit review cancellation first. A failed or aborted rebase does not restore it.
    let expectedVersion = version;
    if (branch.reviewHeadPatchId !== null) {
      const cancelled = await this.fastify.prisma.ocrBranch.updateMany({
        where: { id: branch.id, version },
        data: { reviewHeadPatchId: null, reviewRequestedAt: null,
          rejectionReason: 'Review cancelled because the contributor started an explicit rebase.',
          version: { increment: 1 } }
      });
      if (cancelled.count !== 1) throw new HttpError(409, 'Branch or review changed. Please refresh.');
      expectedVersion++;
    }

    // 4. The engine only enforces the resulting branch version; expose stale
    // engine state as the same retryable HTTP conflict used by this strategy.
    try {
      return await new RebaseEngine(this.fastify).start(volumeId, this.userId, expectedVersion);
    } catch (error) {
      if (error instanceof RebaseStateChangedError) throw new HttpError(409, error.message);
      throw error;
    }
  }

  /**
   * Discards the user's private history and resets to the Admin Master HEAD.
   * Requires confirmation before cancelling a pending review. Confirmation does
   * not bypass version checks: the reset must apply to the state the caller saw.
   * Moves pointers and clears review state before deleting history, in one transaction.
   * Copies the admin snapshot after commit; filesystem synchronization is separate.
   */
  async reset(volumeId: string, version: number, forced = false): Promise<void> {
    const volume = await this.fastify.prisma.volume.findFirst({
      where: {
        id: volumeId,
        series: { OR: [{ ownerId: this.userId }, { ownerId: 'admin' }] }
      },
      select: { mokuroPath: true }
    });
    if (!volume) throw new HttpError(404, 'Volume not found or access denied');

    const adminBranch = await ensureAdminBranch(this.fastify, volumeId, volume.mokuroPath);
    const userBranch = await ensureUserBranch(this.fastify, volumeId, this.userId, adminBranch);

    if (userBranch.version !== version) throw new HttpError(409, 'Version mismatch. Please refresh.');
    if (userBranch.reviewHeadPatchId !== null && !forced) {
      throw new HttpError(409,
        'Reset will discard your private edits and cancel the pending review. After user confirmation, resend the request with forced = true and the same branchVersion.',
        'REVIEW_CANCELLATION_CONFIRMATION_REQUIRED');
    }

    // 1. Database State Transition
    const newUserBranch = await this.fastify.prisma.$transaction(async (tx) => {
      // Reject a changed reset target as well as a changed contributor branch.
      const currentAdmin = await tx.ocrBranch.findUnique({ where: { id: adminBranch.id } });
      if (!currentAdmin || currentAdmin.version !== adminBranch.version) {
        throw new HttpError(409, 'Admin branch changed. Please refresh.');
      }
      // Move HEAD off the private tree before cascade deletion, which otherwise
      // can delete the branch itself through the BranchHead foreign key.
      // The unique id limits this to one branch; updateMany returns count = 0
      // when the version no longer matches, allowing an explicit 409 below.
      const updated = await tx.ocrBranch.updateMany({
        where: { id: userBranch.id, version },
        data: {
          headPatchId: adminBranch.headPatchId,
          rootPatchId: null,
          snapshotPatchId: null,
          reviewHeadPatchId: null,
          reviewRequestedAt: null,
          ...(userBranch.reviewHeadPatchId !== null
            ? { rejectionReason: 'Review cancelled because the contributor reset their branch.' }
            : {}),
          version: { increment: 1 }
        }
      });
      if (updated.count !== 1) throw new HttpError(409, 'Branch or review changed. Please refresh.');
      if (userBranch.rootPatchId !== null) await tx.patch.delete({ where: { id: userBranch.rootPatchId } });

      return await tx.ocrBranch.findUniqueOrThrow({
        where: { id: userBranch.id },
        include: {
          headPatch: { select: { id: true, createdAt: true, sequence: true } },
          rootPatch: { select: { id: true, createdAt: true, sequence: true } },
          snapshotPatch: { select: { id: true, createdAt: true, sequence: true } }
        }
      });
    });

    // 2. Physical File Sync (Post-Transaction)
    // Since the DB is committed, we now align the disk state.
    await inheritAdminSnapshot(this.fastify, newUserBranch, adminBranch);
  }

  /**
     * Force regenerate snapshot for the user's branch.
     */
  async createSnapshot(volumeId: string): Promise<{ data: MokuroData, branch: OcrBranch }> {
    const volume = await this.fastify.prisma.volume.findFirst({
      where: {
        id: volumeId,
        series: { OR: [{ ownerId: this.userId }, { ownerId: 'admin' }] }
      },
      select: { mokuroPath: true }
    });
    if (!volume) throw new HttpError(404, 'Volume not found');

    const adminBranch = await ensureAdminBranch(this.fastify, volumeId, volume.mokuroPath);
    const userBranch = await ensureUserBranch(this.fastify, volumeId, this.userId, adminBranch);

    return await syncSnapshot(this.fastify, userBranch);
  }

  /**
   * Submits volumes to the shared library.
   */
  async submitVolumes(volumeIds: string[], targetSeriesId?: string): Promise<void> {
    const userId = this.userId;

    // 1. Validation: Ensure user owns all volumes
    const volumes = await this.fastify.prisma.volume.findMany({
      where: {
        id: { in: volumeIds },
        series: { ownerId: userId }
      },
      include: { series: true }
    });

    if (volumes.length !== volumeIds.length) {
      throw new HttpError(400, 'One or more volumes not found or not owned by you.');
    }

    // 2. Validation: Ensure they belong to the same source series
    const sourceSeries = volumes[0].series;
    const allSameSeries = volumes.every(v => v.seriesId === sourceSeries.id);
    if (!allSameSeries) {
      throw new HttpError(400, 'All volumes in a submission must come from the same series.');
    }

    // 3. COLLISION CHECK (Dry Run)
    // We run the planner to check for conflicts, but discard the plan for now.
    await validateAndPlanSubmission(
      this.fastify,
      targetSeriesId,
      sourceSeries,
      volumes
    );

    // 4. Create Submission (Safe to proceed)
    await this.fastify.prisma.$transaction(async (tx) => {
      const submission = await tx.submission.create({
        data: {
          userId,
          status: 'pending',
          targetSeriesId: targetSeriesId || null,
          sourceSeriesId: sourceSeries.id,
          submittedAt: new Date()
        }
      });

      await tx.volume.updateMany({
        where: { id: { in: volumeIds } },
        data: { submissionId: submission.id }
      });
    });
  }

  async acceptSubmission(submissionId: string): Promise<void> {
    throw new HttpError(403, 'Forbidden: Only admins can accept submissions.');
  }

  async rejectSubmission(submissionId: string, reason?: string): Promise<void> {
    await this.fastify.prisma.submission.update({
      where: { id: submissionId, userId: this.userId },
      data: {
        status: 'rejected',
        reviewedAt: new Date(),
        reviewNote: reason
      }
    });
  }

  /** Users cannot accept reviews, regardless of the supplied frozen boundary. */
  async officialize(
    volumeId: string,
    sourceUserId: string,
    reviewHeadPatchId: string
  ): Promise<void> {
    throw new HttpError(403, 'Forbidden: Only admins can merge branches.');
  }

  async revert(volumeId: string, patchId: string): Promise<void> {
    throw new HttpError(403, 'Forbidden: Only admins can revert changes.');
  }

  /** Return this contributor's frozen pending reviews, ordered by request time. */
  async getReviews(actorId: string): Promise<ReviewRequestEntry[]> {
    const prisma = this.fastify.prisma;

    // 1. Fetch User's Pending Reviews
    const branches = await prisma.ocrBranch.findMany({
      where: {
        userId: actorId,
        reviewHeadPatchId: { not: null }
      },
      include: {
        volume: {
          include: { series: true }
        },
        rootPatch: true,
        headPatch: true
      },
      orderBy: { reviewRequestedAt: 'desc' }
    });

    if (branches.length === 0) return [];

    // 2. Batch Fetch Admin Status for these volumes
    // We need to know if the Admin has moved ahead of our fork point
    const volumeIds = branches.map(b => b.volumeId);

    const adminBranches = await prisma.ocrBranch.findMany({
      where: {
        userId: 'admin',
        volumeId: { in: volumeIds }
      },
      include: { headPatch: true }
    });

    // Create Map: VolumeID -> AdminHeadSequence
    const adminHeadMap = new Map<string, number>();
    adminBranches.forEach(ab => {
      if (ab.headPatch) adminHeadMap.set(ab.volumeId, ab.headPatch.sequence);
    });

    // 3. Map & Calculate Status
    return branches.map(b => {
      const adminHeadSeq = adminHeadMap.get(b.volumeId) || 0;

      // Fork Point Logic:
      // The user's branch started diverging at (rootPatch.sequence - 1).
      // If rootPatch is null, they have no edits (technically shouldn't be pending, but handle safely).
      const forkPointSeq = b.rootPatch ? (b.rootPatch.sequence - 1) : b.headPatch.sequence;

      // IS BEHIND Condition: Admin Head > Fork Point
      // If true, the admin has pushed new patches that this submission does not include.
      const isBehind = adminHeadSeq > forkPointSeq;

      return {
        id: b.id,
        volumeId: b.volumeId,
        volumeTitle: b.volume.sortTitle,
        seriesId: b.volume.seriesId,
        seriesTitle: b.volume.series.sortTitle,
        coverImageName: b.volume.coverImageName,

        userId: b.userId,
        reviewRequestedAt: b.reviewRequestedAt!,
        submissionNote: b.submissionNote,
        rejectionReason: b.rejectionReason,

        reviewHeadPatchId: b.reviewHeadPatchId!,
        isBehind: isBehind
      };
    });
  }

  /**
   * Creates or cancels an OCR review request for the acting contributor's volume branch.
   *
   * With status=true, captures the current HEAD as reviewHeadPatchId, the inclusive
   * end of the submitted private range. Later appended patches are outside this
   * review. An existing request must be cancelled before its boundary can change.
   * Submission requires a private root and rejects a branch detected as behind
   * the admin timeline. The conditional write rejects changes to the captured
   * user branch or a competing review request before recording the boundary.
   *
   * With status=false, clears the pending boundary and request timestamp without
   * changing patch history, HEAD, or root. Existing notes and rejection reasons
   * remain; a successful new submission replaces the note and clears rejection.
   *
   * @param actorId Contributor whose branch is targeted.
   * @param params Volume and requested pending state; reason is the submission note.
   * Review-state changes increment the branch version without changing OCR
   * content, invalidating in-flight edits based on the previous branch state.
   * @returns The resulting pending state, action, and branch version.
   */
  async setReviewStatus(actorId: string, params: ReviewStatusParams): Promise<ReviewStatusResult> {
    const { volumeId, status, reason } = params;
    const prisma = this.fastify.prisma;

    if (status === true) {
      // Load the branch whose current private prefix will be submitted.

      const branch = await prisma.ocrBranch.findUnique({
        where: {
          volumeId_userId: {
            volumeId: volumeId,
            userId: actorId
          }
        },
        include: { rootPatch: true, rebaseSession: { select: { id: true } } }
      });

      if (!branch) throw new HttpError(404, 'Branch not found');
      if (branch.rebaseSession) throw new HttpError(409, 'Cannot submit review during rebase. Finish or abort it first.');
      if (branch.reviewHeadPatchId) throw new HttpError(409, 'A review is already pending.');
      if (!branch.rootPatch) throw new HttpError(400, 'Nothing to submit (No edits made).');

      // The private root follows the fork point. Compare that point with the
      // observed admin HEAD to require rebase before requesting review.
      const adminBranch = await prisma.ocrBranch.findUnique({
        where: {
          volumeId_userId: {
            volumeId,
            userId: 'admin'
          }
        },
        select: { headPatch: { select: { sequence: true } } }
      });
      const adminSeq = adminBranch?.headPatch?.sequence;
      const forkPointSeq = branch.rootPatch.sequence - 1;
      const isBehind = adminSeq !== undefined && adminSeq > forkPointSeq;

      if (isBehind) {
        throw new HttpError(409, 'Cannot submit: Your branch is behind. Please Rebase first.');
      }

      // The version covers both edits and competing review-state changes.
      // The admin read above is an eligibility check, not an admin branch lock.
      const submitted = await prisma.ocrBranch.updateMany({
        where: {
          id: branch.id,
          version: branch.version,
          // Recheck atomically: a session may have started since the branch read.
          rebaseSession: { is: null }
        },
        data: {
          reviewHeadPatchId: branch.headPatchId,
          reviewRequestedAt: new Date(),
          submissionNote: reason || null,
          rejectionReason: null,
          version: { increment: 1 }
        }
      });

      if (submitted.count !== 1) throw new HttpError(409, 'Branch or review changed. Please refresh.');
      return { volumeId, status: true, action: 'submitted', newVersion: branch.version + 1 };

    } else {
      // Capture the current request; a concurrent state change must not let this
      // cancellation clear a replacement review. Already-cancelled is a no-op.
      const branch = await prisma.ocrBranch.findUnique({
        where: {
          volumeId_userId: {
            volumeId: volumeId,
            userId: actorId
          }
        }
      });
      if (!branch) throw new HttpError(404, 'Branch not found');
      if (branch.reviewHeadPatchId === null) {
        return { volumeId, status: false, action: 'cancelled', newVersion: branch.version };
      }
      const cancelled = await prisma.ocrBranch.updateMany({
        where: { id: branch.id, version: branch.version },
        data: {
          reviewHeadPatchId: null,
          reviewRequestedAt: null,
          version: { increment: 1 }
        }
      });

      if (cancelled.count !== 1) throw new HttpError(409, 'Branch or review changed. Please refresh.');
      return { volumeId, status: false, action: 'cancelled', newVersion: branch.version + 1 };
    }
  }
}
