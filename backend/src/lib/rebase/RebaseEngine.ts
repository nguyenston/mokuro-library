import { ulid } from 'ulid';
import { FastifyInstance } from 'fastify';
import { isDeepStrictEqual } from 'util';
import {
  RebaseResult,
  ExtendedPatch,
  ResolutionType,
  Effect,
  TransformResult
} from '../../types/rebase';
import { PatchOperation } from '../../types/history';
import { PatchTransformer } from './PatchTransformer';
import { EffectUtilities } from './Effect';
import { parseStoredPatchOperation } from '../PatchOperationValidator';
import { fetchAncestryChain, inheritAdminSnapshot, OcrBranchWithTimestamps } from '../../utils/ocrHelpers';
import { Prisma } from '../../generated/prisma/client';

interface RebaseContext {
  sessionId: string;
  branchId: string;
  userId: string;

  adminChain: ExtendedPatch[];
  originalUserChain: ExtendedPatch[];  // Genesis (for restore)

  // Hot state
  currentPatches: ExtendedPatch[];     // Patches entering current admin round
  pendingPatches: ExtendedPatch[];     // Patches already processed this admin round
  currentAdminIndex: number;           // Position in adminChain
  currentUserIndex: number;            // Position in currentPatches (within admin loop)
  currentEffect: Effect;               // Effect at pause point

  resolutions: Map<string, ResolutionType>;  // Key: `${adminPatchId}:${userPatchId}`
  targetHeadId: string;
  originalBranchHeadId: string;
}

const sessionCache = new Map<string, RebaseContext>();

export class RebaseEngine {
  constructor(private fastify: FastifyInstance) { }

  private get prisma() {
    return this.fastify.prisma;
  }

  private async loadBranches(volumeId: string, userId: string): Promise<{
    branch: OcrBranchWithTimestamps;
    adminBranch: OcrBranchWithTimestamps;
  }> {
    // 1) Load user/admin branches with patch metadata.
    const branch = await this.prisma.ocrBranch.findUnique({
      where: { volumeId_userId: { volumeId, userId } },
      include: {
        headPatch: { select: { id: true, createdAt: true, sequence: true } },
        rootPatch: { select: { id: true, createdAt: true, sequence: true } },
        snapshotPatch: { select: { id: true, createdAt: true, sequence: true } }
      }
    });
    if (!branch) throw new Error('Branch not found');

    const adminBranch = await this.prisma.ocrBranch.findUnique({
      where: { volumeId_userId: { volumeId, userId: 'admin' } },
      include: {
        headPatch: { select: { id: true, createdAt: true, sequence: true } },
        rootPatch: { select: { id: true, createdAt: true, sequence: true } },
        snapshotPatch: { select: { id: true, createdAt: true, sequence: true } }
      }
    });
    if (!adminBranch) throw new Error('Admin branch not found');

    // 2) Return both branches for downstream logic.
    return { branch, adminBranch };
  }

  private async buildChains(
    adminHeadId: string,
    userHeadId: string,
    stopId: string
  ): Promise<{ adminChain: ExtendedPatch[]; userChain: ExtendedPatch[] }> {
    // 1) Fetch ancestry from heads back to the fork point (exclusive).
    const adminChainRaw = await fetchAncestryChain(this.prisma, adminHeadId, stopId);
    const userChainRaw = await fetchAncestryChain(this.prisma, userHeadId, stopId);

    // 2) Validate the persisted operations at the rebase boundary, then map them
    // to chronological order. Downstream transformation code assumes this grammar.
    const adminChain: ExtendedPatch[] = adminChainRaw.reverse().map(p => ({
      id: p.id,
      operation: parseStoredPatchOperation(p.operation, `admin patch ${p.id}`)
    }));

    const userChain: ExtendedPatch[] = userChainRaw.reverse().map(p => ({
      id: p.id,
      operation: parseStoredPatchOperation(p.operation, `user patch ${p.id}`)
    }));

    return { adminChain, userChain };
  }

  private buildContext(params: {
    sessionId: string;
    branchId: string;
    userId: string;
    adminChain: ExtendedPatch[];
    userChain: ExtendedPatch[];
    targetHeadId: string;
    originalBranchHeadId: string;
  }): RebaseContext {
    // 1) Initialize hot state for the simulation loop.
    return {
      sessionId: params.sessionId,
      branchId: params.branchId,
      userId: params.userId,
      adminChain: params.adminChain,
      originalUserChain: params.userChain,
      currentPatches: params.userChain,
      pendingPatches: [],
      currentAdminIndex: 0,
      currentUserIndex: 0,
      currentEffect: { type: 'identity', path: '/' },
      resolutions: new Map(),
      targetHeadId: params.targetHeadId,
      originalBranchHeadId: params.originalBranchHeadId
    };
  }

  /**
   * Simulate a rebase without committing changes or mutating branches.
   * Throws if a conflict is encountered.
   */
  async simulate(volumeId: string, userId: string): Promise<PatchOperation[]> {
    // 1) Load branches and short-circuit simple cases.
    const { branch, adminBranch } = await this.loadBranches(volumeId, userId);

    if (!branch.rootPatchId) {
      return [];
    }

    if (branch.headPatchId === adminBranch.headPatchId) {
      return [];
    }

    const rootPatch = await this.prisma.patch.findUnique({ where: { id: branch.rootPatchId } });
    if (!rootPatch || !rootPatch.parentId) {
      throw new Error('Invalid branch state for rebase simulation');
    }

    // 2) Build chains from fork point and simulate rebase.
    const { adminChain, userChain } = await this.buildChains(
      adminBranch.headPatchId,
      branch.headPatchId,
      rootPatch.parentId
    );

    const context = this.buildContext({
      sessionId: `simulate-${volumeId}-${userId}`,
      branchId: branch.id,
      userId,
      adminChain,
      userChain,
      targetHeadId: adminBranch.headPatchId,
      originalBranchHeadId: branch.headPatchId
    });

    const result = await this.runSimulation(context);
    if (result.status === 'paused') {
      throw new Error('Rebase requires manual conflict resolution');
    }
    // 3) Return final transformed operations for downstream callers.
    return result.finalPatches ?? [];
  }

  /**
   * Starts a new rebase session.
   */
  async start(volumeId: string, userId: string): Promise<RebaseResult> {
    // 1) Load branches and short-circuit clean/up-to-date states.
    const { branch, adminBranch } = await this.loadBranches(volumeId, userId);

    // --- Check 1: Clean State ---
    if (!branch.rootPatchId) {
      await this.fastForward(branch, adminBranch);
      return { status: 'complete' };
    }

    // --- Check 2: Already Up to Date ---
    if (branch.headPatchId === adminBranch.headPatchId) {
      return { status: 'complete' };
    }

    // --- Check 3: Invalid Divergence (Detached) ---
    const rootPatch = await this.prisma.patch.findUnique({ where: { id: branch.rootPatchId } });

    if (!rootPatch || !rootPatch.parentId) {
      await this.fastForward(branch, adminBranch);
      return { status: 'complete' };
    }

    // 2) Initialize session + context from fork point chains.
    const { adminChain, userChain } = await this.buildChains(
      adminBranch.headPatchId,
      branch.headPatchId,
      rootPatch.parentId
    );

    const session = await this.prisma.rebaseSession.create({
      data: {
        branchId: branch.id,
        targetHeadPatchId: adminBranch.headPatchId,
        headPatchIdSnapshot: branch.headPatchId,
        resolutions: '[]',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24)
      }
    });

    const context = this.buildContext({
      sessionId: session.id,
      branchId: branch.id,
      userId,
      adminChain,
      userChain,
      targetHeadId: adminBranch.headPatchId,
      originalBranchHeadId: branch.headPatchId
    });
    sessionCache.set(session.id, context);

    // 3) Run simulation, persist conflict or commit on completion.
    const result = await this.runSimulation(context);

    // Persists session to database
    if (result.status === 'paused') {
      await this.prisma.rebaseSession.update({
        where: { id: session.id },
        data: {
          currentConflict: JSON.stringify(result.conflict)
        }
      });
      return result;
    }

    // Commit on finish
    await this.commit(context);
    return result;
  }

  /**
   * Continues an existing rebase with a new resolution.
   */
  async continue(rebaseId: string, resolution: ResolutionType): Promise<RebaseResult> {
    // 1) Restore or reuse hot state from memory.
    let context = sessionCache.get(rebaseId);
    if (!context) {
      context = await this.restoreSession(rebaseId);
    }

    // Get current conflict from hot state
    const adminPatch = context.adminChain[context.currentAdminIndex];
    const userPatch = context.currentPatches[context.currentUserIndex];

    if (!adminPatch || !userPatch) {
      throw new Error('No pending conflict to resolve');
    }

    // Key: adminPatchId:userPatchId
    const resolutionKey = `${adminPatch.id}:${userPatch.id}`;
    context.resolutions.set(resolutionKey, resolution);

    await this.prisma.rebaseSession.update({
      where: { id: rebaseId },
      data: { resolutions: JSON.stringify([...context.resolutions.entries()]) }
    });

    // 2) Continue simulation, persist conflict or commit on completion.
    const result = await this.runSimulation(context);
    if (result.status === 'paused') {
      await this.prisma.rebaseSession.update({
        where: { id: rebaseId },
        data: {
          currentConflict: JSON.stringify(result.conflict)
        }
      });
      return result;
    }

    await this.commit(context);
    return result;
  }

  /**
   * Deletes hot and db sessions
   */
  async abort(rebaseId: string): Promise<void> {
    // 1) Drop in-memory cache, then remove DB session.
    const deleted = sessionCache.delete(rebaseId);

    try {
      await this.prisma.rebaseSession.delete({ where: { id: rebaseId } });
    } catch (e) {
      // Only throw if it wasn't in memory cache either
      if (!deleted) {
        throw new Error('Rebase session not found');
      }
      // Was in memory but not DB — possible expiry, log but don't throw
      this.fastify.log.warn(`Rebase session ${rebaseId} not found in DB (may have expired)`);
    }
  }

  // --- Internal Logic ---

  private async runSimulation(ctx: RebaseContext): Promise<RebaseResult> {
    // 1) Iterate admin chain, transforming user patches per admin effect.
    let currentPatches = ctx.currentPatches;

    for (let i = ctx.currentAdminIndex; i < ctx.adminChain.length; i++) {
      const adminPatch = ctx.adminChain[i];

      // Use saved effect if resuming mid-admin-patch, otherwise compute fresh
      let currentEffect = (i === ctx.currentAdminIndex && ctx.currentUserIndex > 0)
        ? ctx.currentEffect
        : EffectUtilities.fromOperation(adminPatch.operation);

      // Start with pending patches from partial round, or empty
      const nextPatches: ExtendedPatch[] = (i === ctx.currentAdminIndex)
        ? [...ctx.pendingPatches]
        : [];

      // Determine starting user index (resume point or 0)
      const startUserIndex = (i === ctx.currentAdminIndex) ? ctx.currentUserIndex : 0;

      for (let j = startUserIndex; j < currentPatches.length; j++) {
        const userPatch = currentPatches[j];
        const resolutionKey = `${adminPatch.id}:${userPatch.id}`;
        const resolution = ctx.resolutions.get(resolutionKey);

        let result: TransformResult;
        // --- ROOT PEEK DEDUPLICATION ---
        // If this is the current root of the user chain (j=0) and it matches the admin patch,
        // we treat it as already applied. We drop the patch (op: null) and skip the adminPatch (effect: identity)
        if (j === 0 && isDeepStrictEqual(userPatch.operation, adminPatch.operation)) {
          result = {
            success: true,
            op: null,
            effect: { type: 'identity', path: '/' },
            hadConflict: false
          }
        } else {
          result = PatchTransformer.transform(
            userPatch,
            currentEffect,
            adminPatch,
            resolution
          );
        }

        if (!result.success) {
          // Save hot state before returning
          ctx.currentPatches = currentPatches;
          ctx.pendingPatches = nextPatches;
          ctx.currentAdminIndex = i;
          ctx.currentUserIndex = j;
          ctx.currentEffect = currentEffect;

          // Persist conflict to DB so frontend can resume
          // We can run this in background, but awaiting ensures consistency
          return {
            status: 'paused',
            rebaseId: ctx.sessionId,
            conflict: result.conflict
          };
        }

        currentEffect = result.effect;

        if (result.op) {
          nextPatches.push({
            id: userPatch.id,
            operation: result.op
          });
        }
      }

      currentPatches = nextPatches;

      // Reset just in case, but we won't use these until a pause
      ctx.pendingPatches = [];
      ctx.currentUserIndex = 0;
      ctx.currentEffect = { type: 'identity', path: '/' };
    }

    // 2) Finalize hot state for commit/return.
    ctx.currentPatches = currentPatches;
    ctx.pendingPatches = [];
    ctx.currentAdminIndex = ctx.adminChain.length;
    ctx.currentUserIndex = 0;

    return { status: 'complete', finalPatches: currentPatches.map(p => p.operation) };
  }

  private async commit(ctx: RebaseContext) {
    // 1) Rebuild new patch chain off admin head.
    const finalOps = ctx.currentPatches.map(p => p.operation)
    const newPatchesData: Prisma.PatchCreateManyInput[] = [];
    let prevId = ctx.targetHeadId;


    const userBranch = await this.prisma.ocrBranch.findUnique({
      where: { id: ctx.branchId },
    });
    if (!userBranch || userBranch.headPatchId !== ctx.originalBranchHeadId) {
      throw new Error('Branch was modified during rebase. Please retry.');
    }
    const adminBranch = await this.prisma.ocrBranch.findUnique({
      where: { volumeId_userId: { volumeId: userBranch.volumeId, userId: 'admin' } },
      include: {
        headPatch: { select: { id: true, createdAt: true, sequence: true } },
        rootPatch: { select: { id: true, createdAt: true, sequence: true } },
        snapshotPatch: { select: { id: true, createdAt: true, sequence: true } }
      }
    });
    if (!adminBranch) throw new Error('Admin branch not found');

    let currentSequence = adminBranch.headPatch.sequence;
    for (const op of finalOps) {
      currentSequence++;
      const newId = ulid();
      newPatchesData.push({
        id: newId,
        parentId: prevId,
        volumeId: userBranch.volumeId,
        userId: ctx.userId,
        operation: JSON.stringify(op),
        createdAt: new Date(),
        sequence: currentSequence
      });
      prevId = newId;
    }

    // 2) Persist patches + branch updates in a transaction.
    const newUserBranch = await this.prisma.$transaction(async (tx: any) => {
      if (newPatchesData.length > 0) {
        await tx.patch.createMany({ data: newPatchesData });
      }

      const newHeadId = newPatchesData.length > 0
        ? newPatchesData[newPatchesData.length - 1].id
        : ctx.targetHeadId;

      const newRootId = newPatchesData.length > 0
        ? newPatchesData[0].id
        : null;

      await tx.rebaseSession.delete({ where: { id: ctx.sessionId } });

      const updatedBranch = await tx.ocrBranch.update({
        where: { id: ctx.branchId },
        data: {
          headPatchId: newHeadId,
          rootPatchId: newRootId,
          version: { increment: 1 },
          snapshotPatchId: null
        },
        include: {
          headPatch: { select: { id: true, createdAt: true, sequence: true } },
          rootPatch: { select: { id: true, createdAt: true, sequence: true } },
          snapshotPatch: { select: { id: true, createdAt: true, sequence: true } }
        }
      });

      if (ctx.originalUserChain.length > 0) {
        const oldRootId = userBranch.rootPatchId!;
        const exists = await tx.patch.findUnique({ where: { id: oldRootId } });
        if (exists) await tx.patch.delete({ where: { id: oldRootId } });
      }

      return updatedBranch;
    });

    // 3) Inherit snapshot and clear session cache.
    await inheritAdminSnapshot(this.fastify, newUserBranch, adminBranch);
    sessionCache.delete(ctx.sessionId);
  }

  private async fastForward(userBranch: OcrBranchWithTimestamps, adminBranch: OcrBranchWithTimestamps) {
    // 1) Align user branch head to admin head.
    const newUserBranch = await this.prisma.ocrBranch.update({
      where: { id: userBranch.id },
      data: {
        headPatchId: adminBranch.headPatchId,
        rootPatchId: null,
        snapshotPatchId: null,
        version: { increment: 1 }
      },
      include: {
        headPatch: { select: { id: true, createdAt: true, sequence: true } },
        rootPatch: { select: { id: true, createdAt: true, sequence: true } },
        snapshotPatch: { select: { id: true, createdAt: true, sequence: true } }
      }
    });

    // 2) Copy admin snapshot to user.
    await inheritAdminSnapshot(this.fastify, newUserBranch, adminBranch);
  }

  private async restoreSession(sessionId: string): Promise<RebaseContext> {
    // 1) Load session + branch state from DB.
    const session = await this.prisma.rebaseSession.findUnique({
      where: { id: sessionId },
      include: { branch: true }
    });
    if (!session) throw new Error('Session expired or not found');

    const branch = session.branch;
    const rootPatch = await this.prisma.patch.findUnique({ where: { id: branch.rootPatchId! } });

    if (!rootPatch || !rootPatch.parentId) throw new Error('Invalid branch state for restore');

    // 2) Rebuild chains and hot state from persisted session data.
    const { adminChain, userChain } = await this.buildChains(
      session.targetHeadPatchId,
      session.headPatchIdSnapshot,
      rootPatch.parentId
    );

    const context: RebaseContext = {
      ...this.buildContext({
        sessionId: session.id,
        branchId: session.branchId,
        userId: branch.userId,
        adminChain,
        userChain,
        targetHeadId: session.targetHeadPatchId,
        originalBranchHeadId: session.headPatchIdSnapshot
      }),
      resolutions: new Map(JSON.parse(session.resolutions))
    };

    // 3) Replay to reconstruct hot state (no commit).
    await this.runSimulation(context);

    // 4) Cache hot state for subsequent continue calls.
    sessionCache.set(sessionId, context);
    return context;
  }
}
