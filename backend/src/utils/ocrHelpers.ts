import { FastifyInstance } from 'fastify';
import path from 'path';
import fs from 'fs';
import { PatchApplicator } from '../lib/PatchApplicator';
import { PatchInverter } from '../lib/PatchInverter';
import { parseStoredPatchOperation } from '../lib/PatchOperationValidator';
import { MokuroData } from '../types/mokuro';
import { OcrBranch, Patch } from '../generated/prisma/client';
import { ExtendedPrismaClient } from '../lib/prisma/prisma';
import { HttpError } from '../types/error';

export type OcrBranchWithTimestamps = OcrBranch & {
  headPatch: Pick<Patch, 'id' | 'createdAt' | 'sequence'>;
  rootPatch: Pick<Patch, 'id' | 'createdAt' | 'sequence'> | null;
  snapshotPatch: Pick<Patch, 'id' | 'createdAt' | 'sequence'> | null;
};

// ============================================================================
// LOW-LEVEL HELPERS
// ============================================================================

// --- Helper: Clean up Snapshots ---
export async function deleteBranchSnapshots(fastify: FastifyInstance, branchIds: string[]) {
  for (const branchId of branchIds) {
    const snapshotPath = path.join(fastify.projectRoot, 'uploads', 'cache', 'snapshots', `${branchId}.json`);
    try {
      await fs.promises.unlink(snapshotPath);
    } catch (e: unknown) {
      const error = e as { code?: string; message?: string };
      if (error.code !== 'ENOENT') {
        const message = error.message || 'Unknown error';
        fastify.log.warn(`Failed to delete snapshot ${snapshotPath}: ${message}`);
      }
    }
  }
}

// --- Helper: Load the original .mokuro file (Genesis State) ---
export async function loadOriginalMokuro(fastify: FastifyInstance, mokuroPath: string): Promise<MokuroData> {
  const absPath = path.join(fastify.projectRoot, mokuroPath);
  const content = await fs.promises.readFile(absPath, 'utf-8');
  return JSON.parse(content);
}

// --- Helper: Persist Snapshot ---
export async function saveSnapshot(fastify: FastifyInstance, branchId: string, data: MokuroData, dataPatchId: string): Promise<OcrBranchWithTimestamps> {
  const snapshotPath = path.join(fastify.projectRoot, 'uploads', 'cache', 'snapshots', `${branchId}.json`);
  if (!data.patch_id) throw Error(`Patch data has no associated patchId.`);
  if (data.patch_id !== dataPatchId) throw Error(`PatchId mismatch. Make sure you have the correct version and set data.patch_id.`);

  const updatedBranch = await fastify.prisma.ocrBranch.update({
    where: { id: branchId },
    data: { snapshotPatchId: dataPatchId },
    include: {
      headPatch: { select: { id: true, createdAt: true, sequence: true } },
      rootPatch: { select: { id: true, createdAt: true, sequence: true } },
      snapshotPatch: { select: { id: true, createdAt: true, sequence: true } }
    }
  });
  await fs.promises.mkdir(path.dirname(snapshotPath), { recursive: true });
  await fs.promises.writeFile(snapshotPath, JSON.stringify(data));

  return updatedBranch;
}

// --- Helper: Fetch Ancestry Chain (CTE) ---
// Returns patches from startId walking up to (but not including) stopId
export async function fetchAncestryChain(prisma: ExtendedPrismaClient, startId: string, stopId: string | null = null): Promise<Patch[]> {
  return await prisma.$queryRaw<Patch[]>`
    WITH RECURSIVE chain AS (
      -- Base case: Start with the initial record
      SELECT * FROM "Patch" WHERE id = ${startId}

      UNION ALL

      -- Recursive step: Join the previous record's parentId to the Patch table's id
      SELECT p.* FROM "Patch" p
      INNER JOIN chain c ON c.parentId = p.id
      -- This condition stops the recursion from LOOKING for the stopId's parent
      WHERE c.id <> ${stopId ?? ''}
    )
    -- Final filter: Remove the stopId record itself from the returned set
    SELECT * FROM chain
    WHERE id <> ${stopId ?? ''};
  `;
}

// --- Helper: Regenerate Snapshot from Genesis ---
export async function regenerateFromGenesis(
  fastify: FastifyInstance,
  targetPatchId: string,
  branchId: string
): Promise<{ data: MokuroData, branch: OcrBranch }> {
  fastify.log.warn(`Regenerating snapshot from GENESIS for branch ${branchId}`);
  const history = await fetchAncestryChain(fastify.prisma, targetPatchId, null);
  const rootPatch = history[history.length - 1];
  const genesisPatch = parseStoredPatchOperation(rootPatch.operation, `patch ${rootPatch.id}`);
  if (genesisPatch.op !== 'genesis') throw Error(`Invalid tree: root is not genesis.`)

  const data = await loadOriginalMokuro(fastify, genesisPatch.path);

  // Replay (Reverse: Genesis -> Target)
  for (let i = history.length - 2; i >= 0; i--) {
    const patch = history[i];
    try {
      const op = parseStoredPatchOperation(patch.operation, `patch ${patch.id}`);
      PatchApplicator.apply(data, op);
    } catch (e) {
      throw Error(`Patch apply failed during regen at ${history[i].id}: ${e}`);
    }
  }

  data.patch_id = targetPatchId;
  const branch = await saveSnapshot(fastify, branchId, data, targetPatchId);
  return { data, branch };
}

// --- Helper: Load Snapshot ---
// Returns snapshot data if valid, otherwise throw
export async function loadSnapshot(
  fastify: FastifyInstance,
  branch: OcrBranch,
  force: boolean = false // ignore validation
): Promise<MokuroData> {
  const snapshotPath = path.join(fastify.projectRoot, 'uploads', 'cache', 'snapshots', `${branch.id}.json`);

  const content = await fs.promises.readFile(snapshotPath, 'utf-8');
  const data: MokuroData = JSON.parse(content);

  // Validate: snapshot patchId must match DB
  if (force || data.patch_id === branch.snapshotPatchId) {
    return data;
  }

  throw Error(`Snapshot corruption detected for ${branch.id}`);
}

/**
 * Lazily delete the forward history abandoned by admin undo, including descendants.
 * Undo/session-start invariants keep valid rebase targets out of this suffix;
 * cleanup therefore does not scan sessions again. The caller must ensure headId
 * is still admin HEAD inside the deletion transaction; this helper does not check it.
 */
export async function pruneAbandonedFuture(prisma: ExtendedPrismaClient, headId: string): Promise<void> {
  const head = await prisma.patch.findUnique({
    where: { id: headId },
    select: { nextPatchId: true }
  });
  if (!head) throw new HttpError(500, 'Admin HEAD patch not found.');
  if (head.nextPatchId) await prisma.patch.delete({ where: { id: head.nextPatchId } });
}

/** Clean admin future history only while the snapshot result's HEAD remains current. */
async function finishSnapshotSync(
  fastify: FastifyInstance,
  result: { data: MokuroData; branch: OcrBranch }
): Promise<{ data: MokuroData; branch: OcrBranch }> {
  if (result.branch.userId === 'admin') {
    await fastify.prisma.$transaction(async tx => {
      // Acquire the writer lock without advancing the edit version. A stale
      // snapshot result must not mistake a concurrent append for abandoned history.
      const current = await tx.ocrBranch.updateMany({
        where: { id: result.branch.id, userId: 'admin', headPatchId: result.branch.headPatchId },
        data: { headPatchId: result.branch.headPatchId }
      });
      if (current.count === 1) {
        await pruneAbandonedFuture(tx as ExtendedPrismaClient, result.branch.headPatchId);
      }
    });
  }
  return result;
}

// --- Helper: Get Synced Snapshot ---
// Returns up-to-date MokuroData for a branch and up-to-date branch.
// Loads snapshot, syncs if stale, regenerates if corrupt/missing.
export async function syncSnapshot(
  fastify: FastifyInstance,
  branch: OcrBranchWithTimestamps,
  targetPatch: Pick<Patch, 'id' | 'createdAt' | 'sequence'> = branch.headPatch
): Promise<{ data: MokuroData, branch: OcrBranch }> {

  if (targetPatch.sequence > branch.headPatch.sequence) throw Error("Cannot sync to target that is in the future of HEAD");

  let data: MokuroData;
  try {
    data = await loadSnapshot(fastify, branch);
  } catch (e) {
    fastify.log.warn(`Load snapshot for sync failed: ${e}`);
    return finishSnapshotSync(fastify, await regenerateFromGenesis(fastify, targetPatch.id, branch.id));
  }

  const startPatchId = branch.snapshotPatchId!;
  const startPatchSequence = branch.snapshotPatch!.sequence;

  // Already up to date
  if (startPatchId === targetPatch.id) {
    return finishSnapshotSync(fastify, { data, branch });
  }

  const isForward = targetPatch.sequence > startPatchSequence;
  fastify.log.info(`Syncing snapshot ${startPatchId} -> ${targetPatch.id} (${isForward ? 'forward' : 'backward'})`);

  if (isForward) {
    const chain = await fetchAncestryChain(fastify.prisma, targetPatch.id, startPatchId);

    const last = chain[chain.length - 1];
    if (!last || last.parentId !== startPatchId) {
      fastify.log.warn(`Forward chain broken, regenerating from genesis`);
      return finishSnapshotSync(fastify, await regenerateFromGenesis(fastify, targetPatch.id, branch.id));
    }

    // Apply in chronological order (reverse of ancestry)
    for (let i = chain.length - 1; i >= 0; i--) {
      const p = chain[i];
      if (p.operation) {
        const op = parseStoredPatchOperation(p.operation, `patch ${p.id}`);
        if (op.op === 'genesis') continue;
        PatchApplicator.apply(data, op);

      }
    }
  } else {
    const chain = await fetchAncestryChain(fastify.prisma, startPatchId, targetPatch.id);

    const last = chain[chain.length - 1];
    if (!last || last.parentId !== targetPatch.id) {
      fastify.log.warn(`Backward chain broken, regenerating from genesis`);
      return finishSnapshotSync(fastify, await regenerateFromGenesis(fastify, targetPatch.id, branch.id));
    }

    // Invert in reverse chronological order
    for (const p of chain) {
      if (p.operation) {
        const op = parseStoredPatchOperation(p.operation, `patch ${p.id}`);
        if (op.op === 'genesis') continue;
        const inv = PatchInverter.invert(op);
        PatchApplicator.apply(data, inv);
      }
    }
  }

  data.patch_id = targetPatch.id;
  branch = await saveSnapshot(fastify, branch.id, data, targetPatch.id);

  return finishSnapshotSync(fastify, { data, branch });
}

export async function inheritAdminSnapshot(fastify: FastifyInstance, userBranch: OcrBranchWithTimestamps, adminBranch: OcrBranchWithTimestamps) {
  if (userBranch.volumeId !== adminBranch.volumeId) throw new HttpError(400, `Failed to inherit admin snapshot: branch volume mismatch.`);
  if (userBranch.rootPatch?.sequence && userBranch.rootPatch.sequence <= adminBranch.headPatch.sequence)
    throw new HttpError(400, `Failed to inherit admin snapshot: user must not be behind of admin.`);
  if (userBranch.headPatch.sequence < adminBranch.headPatch.sequence)
    throw new HttpError(400, `Failed to inherit admin snapshot: user must not be behind of admin.`);

  const { data: new_data } = await syncSnapshot(fastify, adminBranch);
  return await saveSnapshot(fastify, userBranch.id, new_data, new_data.patch_id ?? '');
}

// --- Helper: Ensure Admin Branch ---
export async function ensureAdminBranch(fastify: FastifyInstance, volumeId: string, mokuroPath: string): Promise<OcrBranchWithTimestamps> {
  let adminBranch = await fastify.prisma.ocrBranch.findUnique({
    where: { volumeId_userId: { volumeId, userId: 'admin' } },
    include: {
      headPatch: { select: { id: true, createdAt: true, sequence: true } },
      rootPatch: { select: { id: true, createdAt: true, sequence: true } },
      snapshotPatch: { select: { id: true, createdAt: true, sequence: true } }
    }
  });
  if (adminBranch) return adminBranch;

  const data = await loadOriginalMokuro(fastify, mokuroPath);
  adminBranch = await fastify.prisma.$transaction(async (tx) => {
    const genesisPatch = await tx.patch.create({
      data: {
        volumeId,
        userId: 'admin',
        parentId: null,
        operation: JSON.stringify({ op: 'genesis', path: mokuroPath }),
        sequence: 0
      }
    });

    const newBranch = await tx.ocrBranch.create({
      data: {
        volumeId,
        userId: 'admin',
        headPatchId: genesisPatch.id,
        rootPatchId: genesisPatch.id,
        snapshotPatchId: genesisPatch.id
      },
      include: {
        headPatch: { select: { id: true, createdAt: true, sequence: true } },
        rootPatch: { select: { id: true, createdAt: true, sequence: true } },
        snapshotPatch: { select: { id: true, createdAt: true, sequence: true } }
      }
    });

    return newBranch
  });

  data.patch_id = adminBranch!.snapshotPatchId ?? undefined;
  return await saveSnapshot(fastify, adminBranch!.id, data, adminBranch!.snapshotPatchId ?? '');
}

// --- Helper: Ensure User Branch ---
export async function ensureUserBranch(
  fastify: FastifyInstance,
  volumeId: string,
  userId: string,
  adminBranch: OcrBranchWithTimestamps
) {
  let userBranch = await fastify.prisma.ocrBranch.findUnique({
    where: { volumeId_userId: { volumeId, userId } },
    include: {
      headPatch: { select: { id: true, createdAt: true, sequence: true } },
      rootPatch: { select: { id: true, createdAt: true, sequence: true } },
      snapshotPatch: { select: { id: true, createdAt: true, sequence: true } }
    }
  });
  if (userBranch) return userBranch;

  userBranch = await fastify.prisma.ocrBranch.create({
    data: {
      volumeId,
      userId,
      headPatchId: adminBranch.headPatchId,
      rootPatchId: null,
      snapshotPatchId: adminBranch.snapshotPatchId
    },
    include: {
      headPatch: { select: { id: true, createdAt: true, sequence: true } },
      rootPatch: { select: { id: true, createdAt: true, sequence: true } },
      snapshotPatch: { select: { id: true, createdAt: true, sequence: true } }
    }
  });

  return inheritAdminSnapshot(fastify, userBranch, adminBranch);
}

// ============================================================================
// HIGH-LEVEL HELPER
// ============================================================================

/**
 * Retrieves the fully computed MokuroData for a given user and volume.
 */
export async function getComputedMokuroState(
  fastify: FastifyInstance,
  userId: string,
  volume: { id: string; mokuroPath: string }
): Promise<MokuroData> {
  const adminBranch = await ensureAdminBranch(fastify, volume.id, volume.mokuroPath);
  const userBranch = await ensureUserBranch(fastify, volume.id, userId, adminBranch);
  return (await syncSnapshot(fastify, userBranch)).data;
}
