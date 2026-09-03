import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { TestContext } from './helpers/testContext';
import { createTestContext, registerAndLogin, seedLibrary } from './helpers/testContext';
import {
  ensureAdminBranch,
  ensureUserBranch,
  fetchAncestryChain,
  getComputedMokuroState
} from '../utils/ocrHelpers';
import { RebaseEngine } from '../lib/rebase/RebaseEngine';
import { Permutation } from '../lib/rebase/rebaseUtils';
import type { PatchOperation, UnifiedBlock } from '../types/history';

const buildNativeBlock = (text: string) => ({
  box: [0, 0, 1, 1] as [number, number, number, number],
  vertical: false,
  font_size: 10,
  lines: [text],
  lines_coords: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1]
    ]
  ]
});

const buildUnifiedBlock = (text: string): UnifiedBlock => ({
  box: [0, 0, 1, 1],
  vertical: false,
  font_size: 10,
  lines: [
    {
      text,
      coords: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1]
      ]
    }
  ]
});

const writeMokuroWithBlocks = async (
  projectRoot: string,
  mokuroPath: string,
  blockTexts: string[]
) => {
  const fullPath = path.join(projectRoot, mokuroPath);
  const mokuroData = {
    title: 'Test',
    pages: [
      {
        img_path: 'page_000.png',
        img_width: 1,
        img_height: 1,
        blocks: blockTexts.map(buildNativeBlock)
      }
    ]
  };

  await fs.promises.writeFile(fullPath, JSON.stringify(mokuroData));
};

const seedVolumeWithBlocks = async (ctx: TestContext, userId: string, blockTexts: string[]) => {
  const seeded = await seedLibrary(ctx.prisma, ctx.projectRoot, userId);
  await writeMokuroWithBlocks(ctx.projectRoot, seeded.volume.mokuroPath, blockTexts);
  const adminBranch = await ensureAdminBranch(ctx.app, seeded.volume.id, seeded.volume.mokuroPath);

  return {
    volumeId: seeded.volume.id,
    mokuroPath: seeded.volume.mokuroPath,
    adminBranch,
    blocks: blockTexts.map(buildUnifiedBlock)
  };
};

const createUserBranch = async (
  ctx: TestContext,
  volumeId: string,
  userId: string,
  headPatchId: string,
  snapshotPatchId: string | null
) => {
  return ctx.prisma.ocrBranch.create({
    data: {
      volumeId,
      userId,
      headPatchId,
      rootPatchId: null,
      snapshotPatchId
    },
    include: {
      headPatch: { select: { id: true, createdAt: true, sequence: true } },
      rootPatch: { select: { id: true, createdAt: true, sequence: true } },
      snapshotPatch: { select: { id: true, createdAt: true, sequence: true } }
    }
  });
};

const createAdminPatch = async (
  ctx: TestContext,
  volumeId: string,
  adminBranchId: string,
  adminHeadId: string,
  adminHeadSeq: number,
  operation: PatchOperation
) => {
  const patch = await ctx.prisma.patch.create({
    data: {
      volumeId,
      userId: 'admin',
      parentId: adminHeadId,
      operation: JSON.stringify(operation),
      sequence: adminHeadSeq + 1
    }
  });

  await ctx.prisma.ocrBranch.update({
    where: { id: adminBranchId },
    data: { headPatchId: patch.id }
  });

  return { patch, headId: patch.id, headSeq: adminHeadSeq + 1 };
};

const createUserPatches = async (
  ctx: TestContext,
  volumeId: string,
  userId: string,
  baseHeadId: string,
  baseSeq: number,
  operations: PatchOperation[]
) => {
  const patchIds: string[] = [];
  let currentHeadId = baseHeadId;
  let currentSeq = baseSeq;

  for (const op of operations) {
    currentSeq += 1;
    const patch = await ctx.prisma.patch.create({
      data: {
        volumeId,
        userId,
        parentId: currentHeadId,
        operation: JSON.stringify(op),
        sequence: currentSeq
      }
    });
    currentHeadId = patch.id;
    patchIds.push(patch.id);
  }

  return {
    headId: currentHeadId,
    headSeq: currentSeq,
    rootId: patchIds[0] ?? null,
    patchIds
  };
};

describe('RebaseEngine', () => {
  let ctx: TestContext;
  let userId: string;

  beforeEach(async () => {
    ctx = await createTestContext();
    const auth = await registerAndLogin(ctx.app);
    userId = auth.user.id;
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it('fast-forwards clean branches that are behind admin', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2']);
    let adminHeadId = base.adminBranch.headPatchId;
    let adminHeadSeq = base.adminBranch.headPatch.sequence;

    const a1 = await createAdminPatch(
      ctx,
      base.volumeId,
      base.adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      { op: 'replace', path: '/pages/0/blocks/0/lines/0/text', value: 'a1', old_value: 'b0' }
    );
    adminHeadId = a1.headId;
    adminHeadSeq = a1.headSeq;

    const a2 = await createAdminPatch(
      ctx,
      base.volumeId,
      base.adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      { op: 'replace', path: '/pages/0/blocks/1/lines/0/text', value: 'a2', old_value: 'b1' }
    );
    adminHeadId = a2.headId;

    const userBranch = await createUserBranch(
      ctx,
      base.volumeId,
      userId,
      a1.headId,
      base.adminBranch.snapshotPatchId
    );

    const engine = new RebaseEngine(ctx.app);
    const result = await engine.start(base.volumeId, userId);
    expect(result.status).toBe('complete');

    const updatedBranch = await ctx.prisma.ocrBranch.findUnique({
      where: { id: userBranch.id }
    });
    expect(updatedBranch?.headPatchId).toBe(adminHeadId);
    expect(updatedBranch?.rootPatchId).toBeNull();
  });

  it('returns complete when already up to date', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2']);
    let adminHeadId = base.adminBranch.headPatchId;
    let adminHeadSeq = base.adminBranch.headPatch.sequence;

    const a1 = await createAdminPatch(
      ctx,
      base.volumeId,
      base.adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      { op: 'replace', path: '/pages/0/blocks/0/lines/0/text', value: 'a1', old_value: 'b0' }
    );
    adminHeadId = a1.headId;
    adminHeadSeq = a1.headSeq;

    const a2 = await createAdminPatch(
      ctx,
      base.volumeId,
      base.adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      { op: 'replace', path: '/pages/0/blocks/1/lines/0/text', value: 'a2', old_value: 'b1' }
    );
    adminHeadId = a2.headId;

    const userBranch = await createUserBranch(
      ctx,
      base.volumeId,
      userId,
      adminHeadId,
      base.adminBranch.snapshotPatchId
    );

    const engine = new RebaseEngine(ctx.app);
    const result = await engine.start(base.volumeId, userId);
    expect(result.status).toBe('complete');

    const updatedBranch = await ctx.prisma.ocrBranch.findUnique({
      where: { id: userBranch.id }
    });
    expect(updatedBranch?.headPatchId).toBe(adminHeadId);
    expect(updatedBranch?.rootPatchId).toBeNull();
  });

  it('rebases without conflicts and preserves both edits', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2']);
    let adminHeadId = base.adminBranch.headPatchId;
    let adminHeadSeq = base.adminBranch.headPatch.sequence;

    const a1 = await createAdminPatch(
      ctx,
      base.volumeId,
      base.adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      { op: 'replace', path: '/pages/0/blocks/0/lines/0/text', value: 'a1', old_value: 'b0' }
    );
    adminHeadId = a1.headId;
    adminHeadSeq = a1.headSeq;

    const userBranch = await createUserBranch(
      ctx,
      base.volumeId,
      userId,
      adminHeadId,
      base.adminBranch.snapshotPatchId
    );

    const userOps: PatchOperation[] = [
      { op: 'replace', path: '/pages/0/blocks/1/lines/0/text', value: 'user-edit', old_value: 'b1' }
    ];
    const userChain = await createUserPatches(
      ctx,
      base.volumeId,
      userId,
      adminHeadId,
      adminHeadSeq,
      userOps
    );
    await ctx.prisma.ocrBranch.update({
      where: { id: userBranch.id },
      data: { headPatchId: userChain.headId, rootPatchId: userChain.rootId }
    });

    const a2 = await createAdminPatch(
      ctx,
      base.volumeId,
      base.adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      { op: 'replace', path: '/pages/0/blocks/0/lines/0/text', value: 'admin-edit', old_value: 'b0' }
    );
    adminHeadId = a2.headId;

    const engine = new RebaseEngine(ctx.app);
    const result = await engine.start(base.volumeId, userId);
    expect(result.status).toBe('complete');

    const updatedBranch = await ctx.prisma.ocrBranch.findUnique({
      where: { id: userBranch.id }
    });
    expect(updatedBranch?.headPatchId).not.toBe(adminHeadId);
    expect(updatedBranch?.rootPatchId).toBe(updatedBranch?.headPatchId);

    const headPatch = await ctx.prisma.patch.findUnique({
      where: { id: updatedBranch?.headPatchId ?? '' }
    });
    expect(headPatch?.parentId).toBe(adminHeadId);

    const data = await getComputedMokuroState(ctx.app, userId, {
      id: base.volumeId,
      mokuroPath: base.mokuroPath
    });
    expect(data.pages[0].blocks[0].lines[0]).toBe('admin-edit');
    expect(data.pages[0].blocks[1].lines[0]).toBe('user-edit');
  });

  it('pauses on content conflict and resolves with keep_admin', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2']);
    const adminBranch = base.adminBranch;
    const adminHeadId = adminBranch.headPatchId;
    const adminHeadSeq = adminBranch.headPatch.sequence;

    const userBranch = await ensureUserBranch(ctx.app, base.volumeId, userId, adminBranch);
    const userOp: PatchOperation = {
      op: 'replace',
      path: '/pages/0/blocks/0/lines/0/text',
      value: 'user-value',
      old_value: 'b0'
    };
    const userChain = await createUserPatches(
      ctx,
      base.volumeId,
      userId,
      adminHeadId,
      adminHeadSeq,
      [userOp]
    );
    await ctx.prisma.ocrBranch.update({
      where: { id: userBranch.id },
      data: { headPatchId: userChain.headId, rootPatchId: userChain.rootId }
    });

    const adminOp: PatchOperation = {
      op: 'replace',
      path: '/pages/0/blocks/0/lines/0/text',
      value: 'admin-value',
      old_value: 'b0'
    };
    const adminPatch = await createAdminPatch(
      ctx,
      base.volumeId,
      adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      adminOp
    );

    const engine = new RebaseEngine(ctx.app);
    const start = await engine.start(base.volumeId, userId);
    expect(start.status).toBe('paused');
    if (start.status !== 'paused') {
      throw new Error('Expected rebase to pause on conflict');
    }
    expect(start.conflict.reason).toBe('content_conflict');

    const resumed = await engine.continue(start.rebaseId, 'keep_admin');
    expect(resumed.status).toBe('complete');

    const updatedBranch = await ctx.prisma.ocrBranch.findUnique({
      where: { id: userBranch.id }
    });
    expect(updatedBranch?.headPatchId).toBe(adminPatch.headId);
    expect(updatedBranch?.rootPatchId).toBeNull();

    const data = await getComputedMokuroState(ctx.app, userId, {
      id: base.volumeId,
      mokuroPath: base.mokuroPath
    });
    expect(data.pages[0].blocks[0].lines[0]).toBe('admin-value');
  });

  it('resolves content conflict with keep_mine and updates old_value', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2']);
    const adminBranch = base.adminBranch;
    const adminHeadId = adminBranch.headPatchId;
    const adminHeadSeq = adminBranch.headPatch.sequence;

    const userBranch = await ensureUserBranch(ctx.app, base.volumeId, userId, adminBranch);
    const userOp: PatchOperation = {
      op: 'replace',
      path: '/pages/0/blocks/0/lines/0/text',
      value: 'user-value',
      old_value: 'b0'
    };
    const userChain = await createUserPatches(
      ctx,
      base.volumeId,
      userId,
      adminHeadId,
      adminHeadSeq,
      [userOp]
    );
    await ctx.prisma.ocrBranch.update({
      where: { id: userBranch.id },
      data: { headPatchId: userChain.headId, rootPatchId: userChain.rootId }
    });

    const adminOp: PatchOperation = {
      op: 'replace',
      path: '/pages/0/blocks/0/lines/0/text',
      value: 'admin-value',
      old_value: 'b0'
    };
    await createAdminPatch(
      ctx,
      base.volumeId,
      adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      adminOp
    );

    const engine = new RebaseEngine(ctx.app);
    const start = await engine.start(base.volumeId, userId);
    expect(start.status).toBe('paused');
    if (start.status !== 'paused') {
      throw new Error('Expected rebase to pause on conflict');
    }

    const resumed = await engine.continue(start.rebaseId, 'keep_mine');
    expect(resumed.status).toBe('complete');

    const updatedBranch = await ctx.prisma.ocrBranch.findUnique({
      where: { id: userBranch.id }
    });
    expect(updatedBranch?.headPatchId).toBeTruthy();
    expect(updatedBranch?.rootPatchId).toBe(updatedBranch?.headPatchId);

    const headPatch = await ctx.prisma.patch.findUnique({
      where: { id: updatedBranch?.headPatchId ?? '' }
    });
    expect(headPatch).toBeTruthy();

    const op = JSON.parse(headPatch!.operation) as PatchOperation;
    expect(op.op).toBe('replace');
    if (op.op === 'replace') {
      expect(op.old_value).toBe('admin-value');
    }

    const data = await getComputedMokuroState(ctx.app, userId, {
      id: base.volumeId,
      mokuroPath: base.mokuroPath
    });
    expect(data.pages[0].blocks[0].lines[0]).toBe('user-value');
  });

  it('shifts user edit when admin inserts before it', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2']);
    const adminBranch = base.adminBranch;
    const adminHeadId = adminBranch.headPatchId;
    const adminHeadSeq = adminBranch.headPatch.sequence;

    const userBranch = await ensureUserBranch(ctx.app, base.volumeId, userId, adminBranch);
    const userOp: PatchOperation = {
      op: 'replace',
      path: '/pages/0/blocks/1/lines/0/text',
      value: 'user-edit',
      old_value: 'b1'
    };
    const userChain = await createUserPatches(
      ctx,
      base.volumeId,
      userId,
      adminHeadId,
      adminHeadSeq,
      [userOp]
    );
    await ctx.prisma.ocrBranch.update({
      where: { id: userBranch.id },
      data: { headPatchId: userChain.headId, rootPatchId: userChain.rootId }
    });

    const adminOp: PatchOperation = {
      op: 'add',
      path: '/pages/0/blocks/0',
      value: buildUnifiedBlock('inserted')
    };
    await createAdminPatch(
      ctx,
      base.volumeId,
      adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      adminOp
    );

    const engine = new RebaseEngine(ctx.app);
    const result = await engine.start(base.volumeId, userId);
    expect(result.status).toBe('complete');

    const updatedBranch = await ctx.prisma.ocrBranch.findUnique({
      where: { id: userBranch.id }
    });
    const headPatch = await ctx.prisma.patch.findUnique({
      where: { id: updatedBranch?.headPatchId ?? '' }
    });
    const op = JSON.parse(headPatch!.operation) as PatchOperation;
    expect(op.op).toBe('replace');
    expect(op.path).toBe('/pages/0/blocks/2/lines/0/text');

    const data = await getComputedMokuroState(ctx.app, userId, {
      id: base.volumeId,
      mokuroPath: base.mokuroPath
    });
    expect(data.pages[0].blocks[2].lines[0]).toBe('user-edit');
  });

  it('drops user edits inside a deleted block when keep_admin', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2']);
    const adminBranch = base.adminBranch;
    const adminHeadId = adminBranch.headPatchId;
    const adminHeadSeq = adminBranch.headPatch.sequence;

    const userBranch = await ensureUserBranch(ctx.app, base.volumeId, userId, adminBranch);
    const userOp: PatchOperation = {
      op: 'replace',
      path: '/pages/0/blocks/1/lines/0/text',
      value: 'user-edit',
      old_value: 'b1'
    };
    const userChain = await createUserPatches(
      ctx,
      base.volumeId,
      userId,
      adminHeadId,
      adminHeadSeq,
      [userOp]
    );
    await ctx.prisma.ocrBranch.update({
      where: { id: userBranch.id },
      data: { headPatchId: userChain.headId, rootPatchId: userChain.rootId }
    });

    const adminOp: PatchOperation = {
      op: 'remove',
      path: '/pages/0/blocks/1',
      old_value: base.blocks[1]
    };
    await createAdminPatch(
      ctx,
      base.volumeId,
      adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      adminOp
    );

    const engine = new RebaseEngine(ctx.app);
    const start = await engine.start(base.volumeId, userId);
    expect(start.status).toBe('paused');
    if (start.status !== 'paused') {
      throw new Error('Expected rebase to pause on conflict');
    }

    const resumed = await engine.continue(start.rebaseId, 'keep_admin');
    expect(resumed.status).toBe('complete');

    const updatedBranch = await ctx.prisma.ocrBranch.findUnique({
      where: { id: userBranch.id }
    });
    expect(updatedBranch?.rootPatchId).toBeNull();

    const data = await getComputedMokuroState(ctx.app, userId, {
      id: base.volumeId,
      mokuroPath: base.mokuroPath
    });
    expect(data.pages[0].blocks.length).toBe(2);
  });

  it('resurrects deleted content when keep_mine', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2']);
    const adminBranch = base.adminBranch;
    const adminHeadId = adminBranch.headPatchId;
    const adminHeadSeq = adminBranch.headPatch.sequence;

    const userBranch = await ensureUserBranch(ctx.app, base.volumeId, userId, adminBranch);
    const userOp: PatchOperation = {
      op: 'replace',
      path: '/pages/0/blocks/1/lines/0/text',
      value: 'user-edit',
      old_value: 'b1'
    };
    const userChain = await createUserPatches(
      ctx,
      base.volumeId,
      userId,
      adminHeadId,
      adminHeadSeq,
      [userOp]
    );
    await ctx.prisma.ocrBranch.update({
      where: { id: userBranch.id },
      data: { headPatchId: userChain.headId, rootPatchId: userChain.rootId }
    });

    const adminOp: PatchOperation = {
      op: 'remove',
      path: '/pages/0/blocks/1',
      old_value: base.blocks[1]
    };
    await createAdminPatch(
      ctx,
      base.volumeId,
      adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      adminOp
    );

    const engine = new RebaseEngine(ctx.app);
    const start = await engine.start(base.volumeId, userId);
    expect(start.status).toBe('paused');
    if (start.status !== 'paused') {
      throw new Error('Expected rebase to pause on conflict');
    }

    const resumed = await engine.continue(start.rebaseId, 'keep_mine');
    expect(resumed.status).toBe('complete');

    const headPatch = await ctx.prisma.patch.findUnique({
      where: {
        id: (
          await ctx.prisma.ocrBranch.findUnique({
            where: { id: userBranch.id }
          })
        )?.headPatchId ?? ''
      }
    });
    const op = JSON.parse(headPatch!.operation) as PatchOperation;
    expect(op.op).toBe('add');

    const data = await getComputedMokuroState(ctx.app, userId, {
      id: base.volumeId,
      mokuroPath: base.mokuroPath
    });
    expect(data.pages[0].blocks.length).toBe(3);
    expect(data.pages[0].blocks[1].lines[0]).toBe('user-edit');
  });

  it('transforms reorder collisions with keep_mine', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2']);
    const adminBranch = base.adminBranch;
    const adminHeadId = adminBranch.headPatchId;
    const adminHeadSeq = adminBranch.headPatch.sequence;

    const userBranch = await ensureUserBranch(ctx.app, base.volumeId, userId, adminBranch);
    const userOp: PatchOperation = {
      op: 'reorder',
      path: '/pages/0/blocks',
      new_order: [2, 1, 0]
    };
    const userChain = await createUserPatches(
      ctx,
      base.volumeId,
      userId,
      adminHeadId,
      adminHeadSeq,
      [userOp]
    );
    await ctx.prisma.ocrBranch.update({
      where: { id: userBranch.id },
      data: { headPatchId: userChain.headId, rootPatchId: userChain.rootId }
    });

    const adminOp: PatchOperation = {
      op: 'reorder',
      path: '/pages/0/blocks',
      new_order: [1, 0, 2]
    };
    await createAdminPatch(
      ctx,
      base.volumeId,
      adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      adminOp
    );

    const engine = new RebaseEngine(ctx.app);
    const start = await engine.start(base.volumeId, userId);
    expect(start.status).toBe('paused');
    if (start.status !== 'paused') {
      throw new Error('Expected rebase to pause on conflict');
    }

    const resumed = await engine.continue(start.rebaseId, 'keep_mine');
    expect(resumed.status).toBe('complete');

    const updatedBranch = await ctx.prisma.ocrBranch.findUnique({
      where: { id: userBranch.id }
    });
    const headPatch = await ctx.prisma.patch.findUnique({
      where: { id: updatedBranch?.headPatchId ?? '' }
    });
    const op = JSON.parse(headPatch!.operation) as PatchOperation;
    expect(op.op).toBe('reorder');

    if (op.op === 'reorder') {
      const expected = Permutation.compose(Permutation.invert(adminOp.new_order), userOp.new_order);
      expect(op.new_order).toEqual(expected);
    }
  });

  it('drops redundant deletes automatically', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2']);
    const adminBranch = base.adminBranch;
    const adminHeadId = adminBranch.headPatchId;
    const adminHeadSeq = adminBranch.headPatch.sequence;

    const userBranch = await ensureUserBranch(ctx.app, base.volumeId, userId, adminBranch);
    const userOp: PatchOperation = {
      op: 'remove',
      path: '/pages/0/blocks/1',
      old_value: base.blocks[1]
    };
    const userChain = await createUserPatches(
      ctx,
      base.volumeId,
      userId,
      adminHeadId,
      adminHeadSeq,
      [userOp]
    );
    await ctx.prisma.ocrBranch.update({
      where: { id: userBranch.id },
      data: { headPatchId: userChain.headId, rootPatchId: userChain.rootId }
    });

    const adminOp: PatchOperation = {
      op: 'remove',
      path: '/pages/0/blocks/1',
      old_value: base.blocks[1]
    };
    const adminPatch = await createAdminPatch(
      ctx,
      base.volumeId,
      adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      adminOp
    );

    const engine = new RebaseEngine(ctx.app);
    const result = await engine.start(base.volumeId, userId);
    expect(result.status).toBe('complete');

    const updatedBranch = await ctx.prisma.ocrBranch.findUnique({
      where: { id: userBranch.id }
    });
    expect(updatedBranch?.headPatchId).toBe(adminPatch.headId);
    expect(updatedBranch?.rootPatchId).toBeNull();
  });

  it('deduplicates identical root patches', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2']);
    const adminBranch = base.adminBranch;
    const adminHeadId = adminBranch.headPatchId;
    const adminHeadSeq = adminBranch.headPatch.sequence;

    const userBranch = await ensureUserBranch(ctx.app, base.volumeId, userId, adminBranch);
    const userOp: PatchOperation = {
      op: 'replace',
      path: '/pages/0/blocks/0/lines/0/text',
      value: 'same-edit',
      old_value: 'b0'
    };
    const userChain = await createUserPatches(
      ctx,
      base.volumeId,
      userId,
      adminHeadId,
      adminHeadSeq,
      [userOp]
    );
    await ctx.prisma.ocrBranch.update({
      where: { id: userBranch.id },
      data: { headPatchId: userChain.headId, rootPatchId: userChain.rootId }
    });

    const adminOp: PatchOperation = {
      op: 'replace',
      path: '/pages/0/blocks/0/lines/0/text',
      value: 'same-edit',
      old_value: 'b0'
    };
    const adminPatch = await createAdminPatch(
      ctx,
      base.volumeId,
      adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      adminOp
    );

    const engine = new RebaseEngine(ctx.app);
    const result = await engine.start(base.volumeId, userId);
    expect(result.status).toBe('complete');

    const updatedBranch = await ctx.prisma.ocrBranch.findUnique({
      where: { id: userBranch.id }
    });
    expect(updatedBranch?.headPatchId).toBe(adminPatch.headId);
    expect(updatedBranch?.rootPatchId).toBeNull();
  });

  it('deduplicates multiple matching patches across admin chain', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2']);
    let adminHeadId = base.adminBranch.headPatchId;
    let adminHeadSeq = base.adminBranch.headPatch.sequence;

    const adminOps: PatchOperation[] = [
      { op: 'replace', path: '/pages/0/blocks/0/lines/0/text', value: 'u1', old_value: 'b0' },
      { op: 'replace', path: '/pages/0/blocks/1/lines/0/text', value: 'u2', old_value: 'b1' },
      { op: 'replace', path: '/pages/0/blocks/2/lines/0/text', value: 'u3', old_value: 'b2' }
    ];

    for (const op of adminOps) {
      const result = await createAdminPatch(
        ctx,
        base.volumeId,
        base.adminBranch.id,
        adminHeadId,
        adminHeadSeq,
        op
      );
      adminHeadId = result.headId;
      adminHeadSeq = result.headSeq;
    }

    const userBranch = await createUserBranch(
      ctx,
      base.volumeId,
      userId,
      base.adminBranch.headPatchId,
      base.adminBranch.snapshotPatchId
    );
    const userChain = await createUserPatches(
      ctx,
      base.volumeId,
      userId,
      base.adminBranch.headPatchId,
      base.adminBranch.headPatch.sequence,
      adminOps
    );
    await ctx.prisma.ocrBranch.update({
      where: { id: userBranch.id },
      data: { headPatchId: userChain.headId, rootPatchId: userChain.rootId }
    });

    const engine = new RebaseEngine(ctx.app);
    const result = await engine.start(base.volumeId, userId);
    expect(result.status).toBe('complete');

    const updatedBranch = await ctx.prisma.ocrBranch.findUnique({
      where: { id: userBranch.id }
    });
    expect(updatedBranch?.headPatchId).toBe(adminHeadId);
    expect(updatedBranch?.rootPatchId).toBeNull();
  });

  it('handles multiple user patches with a single conflict', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2']);
    const adminBranch = base.adminBranch;
    const adminHeadId = adminBranch.headPatchId;
    const adminHeadSeq = adminBranch.headPatch.sequence;

    const userBranch = await ensureUserBranch(ctx.app, base.volumeId, userId, adminBranch);
    const userOps: PatchOperation[] = [
      { op: 'replace', path: '/pages/0/blocks/1/lines/0/text', value: 'u1', old_value: 'b1' },
      { op: 'replace', path: '/pages/0/blocks/0/lines/0/text', value: 'u2', old_value: 'b0' },
      { op: 'replace', path: '/pages/0/blocks/2/lines/0/text', value: 'u3', old_value: 'b2' }
    ];
    const userChain = await createUserPatches(
      ctx,
      base.volumeId,
      userId,
      adminHeadId,
      adminHeadSeq,
      userOps
    );
    await ctx.prisma.ocrBranch.update({
      where: { id: userBranch.id },
      data: { headPatchId: userChain.headId, rootPatchId: userChain.rootId }
    });

    const adminOp: PatchOperation = {
      op: 'replace',
      path: '/pages/0/blocks/0/lines/0/text',
      value: 'admin',
      old_value: 'b0'
    };
    const adminPatch = await createAdminPatch(
      ctx,
      base.volumeId,
      adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      adminOp
    );

    const engine = new RebaseEngine(ctx.app);
    const start = await engine.start(base.volumeId, userId);
    expect(start.status).toBe('paused');
    if (start.status !== 'paused') {
      throw new Error('Expected rebase to pause on conflict');
    }

    const resumed = await engine.continue(start.rebaseId, 'keep_mine');
    expect(resumed.status).toBe('complete');

    const updatedBranch = await ctx.prisma.ocrBranch.findUnique({
      where: { id: userBranch.id }
    });

    const chain = await fetchAncestryChain(
      ctx.prisma,
      updatedBranch?.headPatchId ?? '',
      adminPatch.headId
    );
    const ordered = [...chain].sort((a, b) => a.sequence - b.sequence);
    const ops = ordered.map((patch) => JSON.parse(patch.operation) as PatchOperation);

    expect(ops).toHaveLength(3);
    expect(ops[0].path).toBe('/pages/0/blocks/1/lines/0/text');
    expect(ops[2].path).toBe('/pages/0/blocks/2/lines/0/text');
    if (ops[1].op === 'replace') {
      expect(ops[1].old_value).toBe('admin');
    }
  });

  it('restores a paused session from the database', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2']);
    const adminBranch = base.adminBranch;
    const adminHeadId = adminBranch.headPatchId;
    const adminHeadSeq = adminBranch.headPatch.sequence;

    const userBranch = await ensureUserBranch(ctx.app, base.volumeId, userId, adminBranch);
    const userOp: PatchOperation = {
      op: 'replace',
      path: '/pages/0/blocks/0/lines/0/text',
      value: 'user-value',
      old_value: 'b0'
    };
    const userChain = await createUserPatches(
      ctx,
      base.volumeId,
      userId,
      adminHeadId,
      adminHeadSeq,
      [userOp]
    );
    await ctx.prisma.ocrBranch.update({
      where: { id: userBranch.id },
      data: { headPatchId: userChain.headId, rootPatchId: userChain.rootId }
    });

    const adminOp: PatchOperation = {
      op: 'replace',
      path: '/pages/0/blocks/0/lines/0/text',
      value: 'admin-value',
      old_value: 'b0'
    };
    await createAdminPatch(
      ctx,
      base.volumeId,
      adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      adminOp
    );

    const engine = new RebaseEngine(ctx.app);
    const start = await engine.start(base.volumeId, userId);
    expect(start.status).toBe('paused');
    if (start.status !== 'paused') {
      throw new Error('Expected rebase to pause on conflict');
    }

    vi.resetModules();
    const { RebaseEngine: FreshEngine } = await import('../lib/rebase/RebaseEngine');
    const fresh = new FreshEngine(ctx.app);
    const resumed = await fresh.continue(start.rebaseId, 'keep_admin');
    expect(resumed.status).toBe('complete');
  });

  it('aborts and removes session records', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2']);
    const adminBranch = base.adminBranch;
    const adminHeadId = adminBranch.headPatchId;
    const adminHeadSeq = adminBranch.headPatch.sequence;

    const userBranch = await ensureUserBranch(ctx.app, base.volumeId, userId, adminBranch);
    const userOp: PatchOperation = {
      op: 'replace',
      path: '/pages/0/blocks/0/lines/0/text',
      value: 'user-value',
      old_value: 'b0'
    };
    const userChain = await createUserPatches(
      ctx,
      base.volumeId,
      userId,
      adminHeadId,
      adminHeadSeq,
      [userOp]
    );
    await ctx.prisma.ocrBranch.update({
      where: { id: userBranch.id },
      data: { headPatchId: userChain.headId, rootPatchId: userChain.rootId }
    });

    const adminOp: PatchOperation = {
      op: 'replace',
      path: '/pages/0/blocks/0/lines/0/text',
      value: 'admin-value',
      old_value: 'b0'
    };
    await createAdminPatch(
      ctx,
      base.volumeId,
      adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      adminOp
    );

    const engine = new RebaseEngine(ctx.app);
    const start = await engine.start(base.volumeId, userId);
    expect(start.status).toBe('paused');
    if (start.status !== 'paused') {
      throw new Error('Expected rebase to pause on conflict');
    }

    await engine.abort(start.rebaseId);
    const session = await ctx.prisma.rebaseSession.findUnique({
      where: { id: start.rebaseId }
    });
    expect(session).toBeNull();

    await expect(engine.continue(start.rebaseId, 'keep_admin')).rejects.toThrow(
      'Session expired or not found'
    );
  });

  it('effect_shift resolves when user add shifts admin effect', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2', 'b3', 'b4']);
    const adminBranch = base.adminBranch;
    const adminHeadId = adminBranch.headPatchId;
    const adminHeadSeq = adminBranch.headPatch.sequence;

    const userBranch = await ensureUserBranch(ctx.app, base.volumeId, userId, adminBranch);
    const userOps: PatchOperation[] = [
      { op: 'add', path: '/pages/0/blocks/1', value: buildUnifiedBlock('inserted') },
      { op: 'replace', path: '/pages/0/blocks/4/lines/0/text', value: 'user-edit', old_value: 'b3' }
    ];
    const userChain = await createUserPatches(
      ctx,
      base.volumeId,
      userId,
      adminHeadId,
      adminHeadSeq,
      userOps
    );
    await ctx.prisma.ocrBranch.update({
      where: { id: userBranch.id },
      data: { headPatchId: userChain.headId, rootPatchId: userChain.rootId }
    });

    const adminOp: PatchOperation = {
      op: 'replace',
      path: '/pages/0/blocks/2/lines/0/text',
      value: 'admin-edit',
      old_value: 'b2'
    };
    await createAdminPatch(
      ctx,
      base.volumeId,
      adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      adminOp
    );

    const engine = new RebaseEngine(ctx.app);
    const result = await engine.start(base.volumeId, userId);
    expect(result.status).toBe('complete');

    const data = await getComputedMokuroState(ctx.app, userId, {
      id: base.volumeId,
      mokuroPath: base.mokuroPath
    });
    expect(data.pages[0].blocks[3].lines[0]).toBe('admin-edit');
    expect(data.pages[0].blocks[4].lines[0]).toBe('user-edit');
  });

  it('effect_shift resolves when user reorder permutes admin effect', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2']);
    const adminBranch = base.adminBranch;
    const adminHeadId = adminBranch.headPatchId;
    const adminHeadSeq = adminBranch.headPatch.sequence;

    const userBranch = await ensureUserBranch(ctx.app, base.volumeId, userId, adminBranch);
    const userOps: PatchOperation[] = [
      { op: 'reorder', path: '/pages/0/blocks', new_order: [2, 0, 1] },
      { op: 'replace', path: '/pages/0/blocks/0/lines/0/text', value: 'user-edit', old_value: 'b2' }
    ];
    const userChain = await createUserPatches(
      ctx,
      base.volumeId,
      userId,
      adminHeadId,
      adminHeadSeq,
      userOps
    );
    await ctx.prisma.ocrBranch.update({
      where: { id: userBranch.id },
      data: { headPatchId: userChain.headId, rootPatchId: userChain.rootId }
    });

    const adminOp: PatchOperation = {
      op: 'replace',
      path: '/pages/0/blocks/1/lines/0/text',
      value: 'admin-edit',
      old_value: 'b1'
    };
    await createAdminPatch(
      ctx,
      base.volumeId,
      adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      adminOp
    );

    const engine = new RebaseEngine(ctx.app);
    const result = await engine.start(base.volumeId, userId);
    expect(result.status).toBe('complete');

    const data = await getComputedMokuroState(ctx.app, userId, {
      id: base.volumeId,
      mokuroPath: base.mokuroPath
    });
    expect(data.pages[0].blocks[0].lines[0]).toBe('user-edit');
    expect(data.pages[0].blocks[2].lines[0]).toBe('admin-edit');
  });

  it('keeps admin edit when user removes the edited block', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2']);
    const adminBranch = base.adminBranch;
    const adminHeadId = adminBranch.headPatchId;
    const adminHeadSeq = adminBranch.headPatch.sequence;

    const userBranch = await ensureUserBranch(ctx.app, base.volumeId, userId, adminBranch);
    const userOp: PatchOperation = {
      op: 'remove',
      path: '/pages/0/blocks/1',
      old_value: base.blocks[1]
    };
    const userChain = await createUserPatches(
      ctx,
      base.volumeId,
      userId,
      adminHeadId,
      adminHeadSeq,
      [userOp]
    );
    await ctx.prisma.ocrBranch.update({
      where: { id: userBranch.id },
      data: { headPatchId: userChain.headId, rootPatchId: userChain.rootId }
    });

    const adminOp: PatchOperation = {
      op: 'replace',
      path: '/pages/0/blocks/1/lines/0/text',
      value: 'admin-edit',
      old_value: 'b1'
    };
    const adminPatch = await createAdminPatch(
      ctx,
      base.volumeId,
      adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      adminOp
    );

    const engine = new RebaseEngine(ctx.app);
    const start = await engine.start(base.volumeId, userId);
    expect(start.status).toBe('paused');
    if (start.status !== 'paused') {
      throw new Error('Expected rebase to pause on conflict');
    }

    const resumed = await engine.continue(start.rebaseId, 'keep_admin');
    expect(resumed.status).toBe('complete');

    const updatedBranch = await ctx.prisma.ocrBranch.findUnique({
      where: { id: userBranch.id }
    });
    expect(updatedBranch?.headPatchId).toBe(adminPatch.headId);
    expect(updatedBranch?.rootPatchId).toBeNull();

    const data = await getComputedMokuroState(ctx.app, userId, {
      id: base.volumeId,
      mokuroPath: base.mokuroPath
    });
    expect(data.pages[0].blocks[1].lines[0]).toBe('admin-edit');
  });

  it('keeps user remove when resolving reverse dead zone', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2']);
    const adminBranch = base.adminBranch;
    const adminHeadId = adminBranch.headPatchId;
    const adminHeadSeq = adminBranch.headPatch.sequence;

    const userBranch = await ensureUserBranch(ctx.app, base.volumeId, userId, adminBranch);
    const userOp: PatchOperation = {
      op: 'remove',
      path: '/pages/0/blocks/1',
      old_value: base.blocks[1]
    };
    const userChain = await createUserPatches(
      ctx,
      base.volumeId,
      userId,
      adminHeadId,
      adminHeadSeq,
      [userOp]
    );
    await ctx.prisma.ocrBranch.update({
      where: { id: userBranch.id },
      data: { headPatchId: userChain.headId, rootPatchId: userChain.rootId }
    });

    const adminOp: PatchOperation = {
      op: 'replace',
      path: '/pages/0/blocks/1/lines/0/text',
      value: 'admin-edit',
      old_value: 'b1'
    };
    await createAdminPatch(
      ctx,
      base.volumeId,
      adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      adminOp
    );

    const engine = new RebaseEngine(ctx.app);
    const start = await engine.start(base.volumeId, userId);
    expect(start.status).toBe('paused');
    if (start.status !== 'paused') {
      throw new Error('Expected rebase to pause on conflict');
    }

    const resumed = await engine.continue(start.rebaseId, 'keep_mine');
    expect(resumed.status).toBe('complete');

    const data = await getComputedMokuroState(ctx.app, userId, {
      id: base.volumeId,
      mokuroPath: base.mokuroPath
    });
    expect(data.pages[0].blocks.length).toBe(2);
    expect(data.pages[0].blocks[1].lines[0]).toBe('b2');
  });

  it('reuses admin reorder when keep_admin and transforms following patch', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2']);
    const adminBranch = base.adminBranch;
    const adminHeadId = adminBranch.headPatchId;
    const adminHeadSeq = adminBranch.headPatch.sequence;

    const userBranch = await ensureUserBranch(ctx.app, base.volumeId, userId, adminBranch);
    const userOps: PatchOperation[] = [
      { op: 'reorder', path: '/pages/0/blocks', new_order: [2, 1, 0] },
      { op: 'replace', path: '/pages/0/blocks/2/lines/0/text', value: 'user-edit', old_value: 'b0' }
    ];
    const userChain = await createUserPatches(
      ctx,
      base.volumeId,
      userId,
      adminHeadId,
      adminHeadSeq,
      userOps
    );
    await ctx.prisma.ocrBranch.update({
      where: { id: userBranch.id },
      data: { headPatchId: userChain.headId, rootPatchId: userChain.rootId }
    });

    const adminOp: PatchOperation = {
      op: 'reorder',
      path: '/pages/0/blocks',
      new_order: [1, 0, 2]
    };
    await createAdminPatch(
      ctx,
      base.volumeId,
      adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      adminOp
    );

    const engine = new RebaseEngine(ctx.app);
    const start = await engine.start(base.volumeId, userId);
    expect(start.status).toBe('paused');
    if (start.status !== 'paused') {
      throw new Error('Expected rebase to pause on conflict');
    }

    const resumed = await engine.continue(start.rebaseId, 'keep_admin');
    expect(resumed.status).toBe('complete');

    const updatedBranch = await ctx.prisma.ocrBranch.findUnique({
      where: { id: userBranch.id }
    });
    const headPatch = await ctx.prisma.patch.findUnique({
      where: { id: updatedBranch?.headPatchId ?? '' }
    });
    const op = JSON.parse(headPatch!.operation) as PatchOperation;
    expect(op.op).toBe('replace');
    expect(op.path).toBe('/pages/0/blocks/1/lines/0/text');
  });

  it('shifts sibling paths down when admin removes', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2']);
    const adminBranch = base.adminBranch;
    const adminHeadId = adminBranch.headPatchId;
    const adminHeadSeq = adminBranch.headPatch.sequence;

    const userBranch = await ensureUserBranch(ctx.app, base.volumeId, userId, adminBranch);
    const userOp: PatchOperation = {
      op: 'replace',
      path: '/pages/0/blocks/2/lines/0/text',
      value: 'user-edit',
      old_value: 'b2'
    };
    const userChain = await createUserPatches(
      ctx,
      base.volumeId,
      userId,
      adminHeadId,
      adminHeadSeq,
      [userOp]
    );
    await ctx.prisma.ocrBranch.update({
      where: { id: userBranch.id },
      data: { headPatchId: userChain.headId, rootPatchId: userChain.rootId }
    });

    const adminOp: PatchOperation = {
      op: 'remove',
      path: '/pages/0/blocks/1',
      old_value: base.blocks[1]
    };
    await createAdminPatch(
      ctx,
      base.volumeId,
      adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      adminOp
    );

    const engine = new RebaseEngine(ctx.app);
    const result = await engine.start(base.volumeId, userId);
    expect(result.status).toBe('complete');

    const updatedBranch = await ctx.prisma.ocrBranch.findUnique({
      where: { id: userBranch.id }
    });
    const headPatch = await ctx.prisma.patch.findUnique({
      where: { id: updatedBranch?.headPatchId ?? '' }
    });
    const op = JSON.parse(headPatch!.operation) as PatchOperation;
    expect(op.op).toBe('replace');
    expect(op.path).toBe('/pages/0/blocks/1/lines/0/text');

    const data = await getComputedMokuroState(ctx.app, userId, {
      id: base.volumeId,
      mokuroPath: base.mokuroPath
    });
    expect(data.pages[0].blocks[1].lines[0]).toBe('user-edit');
  });

  it('shifts sibling paths up when admin adds', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2']);
    const adminBranch = base.adminBranch;
    const adminHeadId = adminBranch.headPatchId;
    const adminHeadSeq = adminBranch.headPatch.sequence;

    const userBranch = await ensureUserBranch(ctx.app, base.volumeId, userId, adminBranch);
    const userOp: PatchOperation = {
      op: 'replace',
      path: '/pages/0/blocks/1/lines/0/text',
      value: 'user-edit',
      old_value: 'b1'
    };
    const userChain = await createUserPatches(
      ctx,
      base.volumeId,
      userId,
      adminHeadId,
      adminHeadSeq,
      [userOp]
    );
    await ctx.prisma.ocrBranch.update({
      where: { id: userBranch.id },
      data: { headPatchId: userChain.headId, rootPatchId: userChain.rootId }
    });

    const adminOp: PatchOperation = {
      op: 'add',
      path: '/pages/0/blocks/1',
      value: buildUnifiedBlock('inserted')
    };
    await createAdminPatch(
      ctx,
      base.volumeId,
      adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      adminOp
    );

    const engine = new RebaseEngine(ctx.app);
    const result = await engine.start(base.volumeId, userId);
    expect(result.status).toBe('complete');

    const updatedBranch = await ctx.prisma.ocrBranch.findUnique({
      where: { id: userBranch.id }
    });
    const headPatch = await ctx.prisma.patch.findUnique({
      where: { id: updatedBranch?.headPatchId ?? '' }
    });
    const op = JSON.parse(headPatch!.operation) as PatchOperation;
    expect(op.op).toBe('replace');
    expect(op.path).toBe('/pages/0/blocks/2/lines/0/text');
  });

  it('permutes sibling paths when admin reorders', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2']);
    const adminBranch = base.adminBranch;
    const adminHeadId = adminBranch.headPatchId;
    const adminHeadSeq = adminBranch.headPatch.sequence;

    const userBranch = await ensureUserBranch(ctx.app, base.volumeId, userId, adminBranch);
    const userOp: PatchOperation = {
      op: 'replace',
      path: '/pages/0/blocks/0/lines/0/text',
      value: 'user-edit',
      old_value: 'b0'
    };
    const userChain = await createUserPatches(
      ctx,
      base.volumeId,
      userId,
      adminHeadId,
      adminHeadSeq,
      [userOp]
    );
    await ctx.prisma.ocrBranch.update({
      where: { id: userBranch.id },
      data: { headPatchId: userChain.headId, rootPatchId: userChain.rootId }
    });

    const adminOp: PatchOperation = {
      op: 'reorder',
      path: '/pages/0/blocks',
      new_order: [2, 0, 1]
    };
    await createAdminPatch(
      ctx,
      base.volumeId,
      adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      adminOp
    );

    const engine = new RebaseEngine(ctx.app);
    const result = await engine.start(base.volumeId, userId);
    expect(result.status).toBe('complete');

    const updatedBranch = await ctx.prisma.ocrBranch.findUnique({
      where: { id: userBranch.id }
    });
    const headPatch = await ctx.prisma.patch.findUnique({
      where: { id: updatedBranch?.headPatchId ?? '' }
    });
    const op = JSON.parse(headPatch!.operation) as PatchOperation;
    expect(op.op).toBe('replace');
    expect(op.path).toBe('/pages/0/blocks/1/lines/0/text');
  });

  it('throws when branch head changes during a paused rebase', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2']);
    const adminBranch = base.adminBranch;
    const adminHeadId = adminBranch.headPatchId;
    const adminHeadSeq = adminBranch.headPatch.sequence;

    const userBranch = await ensureUserBranch(ctx.app, base.volumeId, userId, adminBranch);
    const userOp: PatchOperation = {
      op: 'replace',
      path: '/pages/0/blocks/0/lines/0/text',
      value: 'user-value',
      old_value: 'b0'
    };
    const userChain = await createUserPatches(
      ctx,
      base.volumeId,
      userId,
      adminHeadId,
      adminHeadSeq,
      [userOp]
    );
    await ctx.prisma.ocrBranch.update({
      where: { id: userBranch.id },
      data: { headPatchId: userChain.headId, rootPatchId: userChain.rootId }
    });

    const adminOp: PatchOperation = {
      op: 'replace',
      path: '/pages/0/blocks/0/lines/0/text',
      value: 'admin-value',
      old_value: 'b0'
    };
    await createAdminPatch(
      ctx,
      base.volumeId,
      adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      adminOp
    );

    const engine = new RebaseEngine(ctx.app);
    const start = await engine.start(base.volumeId, userId);
    expect(start.status).toBe('paused');
    if (start.status !== 'paused') {
      throw new Error('Expected rebase to pause on conflict');
    }

    const extraPatch = await createUserPatches(
      ctx,
      base.volumeId,
      userId,
      userChain.headId,
      userChain.headSeq,
      [{ op: 'replace', path: '/pages/0/blocks/2/lines/0/text', value: 'other', old_value: 'b2' }]
    );
    await ctx.prisma.ocrBranch.update({
      where: { id: userBranch.id },
      data: { headPatchId: extraPatch.headId }
    });

    await expect(engine.continue(start.rebaseId, 'keep_admin')).rejects.toThrow(
      'Branch was modified during rebase. Please retry.'
    );
  });

  it('fast-forwards when the user root patch is detached', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2']);
    let adminHeadId = base.adminBranch.headPatchId;
    let adminHeadSeq = base.adminBranch.headPatch.sequence;

    const adminPatch = await createAdminPatch(
      ctx,
      base.volumeId,
      base.adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      { op: 'replace', path: '/pages/0/blocks/0/lines/0/text', value: 'admin', old_value: 'b0' }
    );
    adminHeadId = adminPatch.headId;
    adminHeadSeq = adminPatch.headSeq;

    const detachedPatch = await ctx.prisma.patch.create({
      data: {
        volumeId: base.volumeId,
        userId,
        parentId: null,
        operation: JSON.stringify({ op: 'replace', path: '/pages/0/blocks/1/lines/0/text', value: 'bad', old_value: 'b1' }),
        sequence: adminHeadSeq + 1
      }
    });

    const userBranch = await ctx.prisma.ocrBranch.create({
      data: {
        volumeId: base.volumeId,
        userId,
        headPatchId: detachedPatch.id,
        rootPatchId: detachedPatch.id,
        snapshotPatchId: base.adminBranch.snapshotPatchId
      },
      include: {
        headPatch: { select: { id: true, createdAt: true, sequence: true } },
        rootPatch: { select: { id: true, createdAt: true, sequence: true } },
        snapshotPatch: { select: { id: true, createdAt: true, sequence: true } }
      }
    });

    const engine = new RebaseEngine(ctx.app);
    const result = await engine.start(base.volumeId, userId);
    expect(result.status).toBe('complete');

    const updatedBranch = await ctx.prisma.ocrBranch.findUnique({
      where: { id: userBranch.id }
    });
    expect(updatedBranch?.headPatchId).toBe(adminHeadId);
    expect(updatedBranch?.rootPatchId).toBeNull();
  });

  it('throws when a session has expired', async () => {
    const engine = new RebaseEngine(ctx.app);
    await expect(engine.continue('missing-session', 'keep_admin')).rejects.toThrow(
      'Session expired or not found'
    );
  });

  it('expands reorder and keeps following replace path when admin shift exists', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2']);
    const adminBranch = base.adminBranch;
    const adminHeadId = adminBranch.headPatchId;
    const adminHeadSeq = adminBranch.headPatch.sequence;

    const userBranch = await ensureUserBranch(ctx.app, base.volumeId, userId, adminBranch);
    const userOps: PatchOperation[] = [
      { op: 'reorder', path: '/pages/0/blocks', new_order: [2, 0, 1] },
      { op: 'replace', path: '/pages/0/blocks/0/lines/0/text', value: 'user-edit', old_value: 'b1' }
    ];
    const userChain = await createUserPatches(
      ctx,
      base.volumeId,
      userId,
      adminHeadId,
      adminHeadSeq,
      userOps
    );
    await ctx.prisma.ocrBranch.update({
      where: { id: userBranch.id },
      data: { headPatchId: userChain.headId, rootPatchId: userChain.rootId }
    });

    const adminOp: PatchOperation = {
      op: 'add',
      path: '/pages/0/blocks/1',
      value: buildUnifiedBlock('inserted')
    };
    await createAdminPatch(
      ctx,
      base.volumeId,
      adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      adminOp
    );

    const engine = new RebaseEngine(ctx.app);
    const result = await engine.start(base.volumeId, userId);
    expect(result.status).toBe('complete');

    const updatedBranch = await ctx.prisma.ocrBranch.findUnique({
      where: { id: userBranch.id }
    });
    const headPatch = await ctx.prisma.patch.findUnique({
      where: { id: updatedBranch?.headPatchId ?? '' }
    });
    const op = JSON.parse(headPatch!.operation) as PatchOperation;
    expect(op.op).toBe('replace');
    expect(op.path).toBe('/pages/0/blocks/0/lines/0/text');

    const parentPatch = await ctx.prisma.patch.findUnique({
      where: { id: headPatch!.parentId ?? '' }
    });
    const parentOp = JSON.parse(parentPatch!.operation) as PatchOperation;
    expect(parentOp.op).toBe('reorder');
    if (parentOp.op !== 'reorder') {
      throw new Error('Expected reorder parent patch');
    }
    expect(parentOp.new_order).toEqual([3, 0, 1, 2]);
  });

  it('shrinks reorder and keeps following replace path when admin shift_down exists', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2', 'b3']);
    const adminBranch = base.adminBranch;
    const adminHeadId = adminBranch.headPatchId;
    const adminHeadSeq = adminBranch.headPatch.sequence;

    const userBranch = await ensureUserBranch(ctx.app, base.volumeId, userId, adminBranch);
    const userOps: PatchOperation[] = [
      { op: 'reorder', path: '/pages/0/blocks', new_order: [3, 0, 1, 2] },
      { op: 'replace', path: '/pages/0/blocks/0/lines/0/text', value: 'user-edit', old_value: 'b0' }
    ];
    const userChain = await createUserPatches(
      ctx,
      base.volumeId,
      userId,
      adminHeadId,
      adminHeadSeq,
      userOps
    );
    await ctx.prisma.ocrBranch.update({
      where: { id: userBranch.id },
      data: { headPatchId: userChain.headId, rootPatchId: userChain.rootId }
    });

    const adminOp: PatchOperation = {
      op: 'remove',
      path: '/pages/0/blocks/1',
      old_value: base.blocks[1]
    };
    await createAdminPatch(
      ctx,
      base.volumeId,
      adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      adminOp
    );

    const engine = new RebaseEngine(ctx.app);
    const result = await engine.start(base.volumeId, userId);
    expect(result.status).toBe('complete');

    const updatedBranch = await ctx.prisma.ocrBranch.findUnique({
      where: { id: userBranch.id }
    });
    const headPatch = await ctx.prisma.patch.findUnique({
      where: { id: updatedBranch?.headPatchId ?? '' }
    });
    const op = JSON.parse(headPatch!.operation) as PatchOperation;
    expect(op.op).toBe('replace');
    expect(op.path).toBe('/pages/0/blocks/0/lines/0/text');

    const parentPatch = await ctx.prisma.patch.findUnique({
      where: { id: headPatch!.parentId ?? '' }
    });
    const parentOp = JSON.parse(parentPatch!.operation) as PatchOperation;
    expect(parentOp.op).toBe('reorder');
    if (parentOp.op !== 'reorder') {
      throw new Error('Expected reorder parent patch');
    }
    expect(parentOp.new_order).toEqual([2, 0, 1]);
  });

  it('expands reorder and keeps following add when admin shift_up exists', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2']);
    const adminBranch = base.adminBranch;
    const adminHeadId = adminBranch.headPatchId;
    const adminHeadSeq = adminBranch.headPatch.sequence;

    const userBranch = await ensureUserBranch(ctx.app, base.volumeId, userId, adminBranch);
    const userOps: PatchOperation[] = [
      { op: 'reorder', path: '/pages/0/blocks', new_order: [2, 0, 1] },
      { op: 'add', path: '/pages/0/blocks/0', value: buildUnifiedBlock('user-add') }
    ];
    const userChain = await createUserPatches(
      ctx,
      base.volumeId,
      userId,
      adminHeadId,
      adminHeadSeq,
      userOps
    );
    await ctx.prisma.ocrBranch.update({
      where: { id: userBranch.id },
      data: { headPatchId: userChain.headId, rootPatchId: userChain.rootId }
    });

    const adminOp: PatchOperation = {
      op: 'add',
      path: '/pages/0/blocks/1',
      value: buildUnifiedBlock('inserted')
    };
    await createAdminPatch(
      ctx,
      base.volumeId,
      adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      adminOp
    );

    const engine = new RebaseEngine(ctx.app);
    const result = await engine.start(base.volumeId, userId);
    expect(result.status).toBe('complete');

    const updatedBranch = await ctx.prisma.ocrBranch.findUnique({
      where: { id: userBranch.id }
    });
    const headPatch = await ctx.prisma.patch.findUnique({
      where: { id: updatedBranch?.headPatchId ?? '' }
    });
    const op = JSON.parse(headPatch!.operation) as PatchOperation;
    expect(op.op).toBe('add');
    expect(op.path).toBe('/pages/0/blocks/0');

    const parentPatch = await ctx.prisma.patch.findUnique({
      where: { id: headPatch!.parentId ?? '' }
    });
    const parentOp = JSON.parse(parentPatch!.operation) as PatchOperation;
    expect(parentOp.op).toBe('reorder');
    if (parentOp.op !== 'reorder') {
      throw new Error('Expected reorder parent patch');
    }
    expect(parentOp.new_order).toEqual([3, 0, 1, 2]);
  });

  it('shrinks reorder and keeps following remove when admin shift_down exists', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2', 'b3']);
    const adminBranch = base.adminBranch;
    const adminHeadId = adminBranch.headPatchId;
    const adminHeadSeq = adminBranch.headPatch.sequence;

    const userBranch = await ensureUserBranch(ctx.app, base.volumeId, userId, adminBranch);
    const userOps: PatchOperation[] = [
      { op: 'reorder', path: '/pages/0/blocks', new_order: [3, 0, 1, 2] },
      { op: 'remove', path: '/pages/0/blocks/0', old_value: base.blocks[0] }
    ];
    const userChain = await createUserPatches(
      ctx,
      base.volumeId,
      userId,
      adminHeadId,
      adminHeadSeq,
      userOps
    );
    await ctx.prisma.ocrBranch.update({
      where: { id: userBranch.id },
      data: { headPatchId: userChain.headId, rootPatchId: userChain.rootId }
    });

    const adminOp: PatchOperation = {
      op: 'remove',
      path: '/pages/0/blocks/1',
      old_value: base.blocks[1]
    };
    await createAdminPatch(
      ctx,
      base.volumeId,
      adminBranch.id,
      adminHeadId,
      adminHeadSeq,
      adminOp
    );

    const engine = new RebaseEngine(ctx.app);
    const result = await engine.start(base.volumeId, userId);
    expect(result.status).toBe('complete');

    const updatedBranch = await ctx.prisma.ocrBranch.findUnique({
      where: { id: userBranch.id }
    });
    const headPatch = await ctx.prisma.patch.findUnique({
      where: { id: updatedBranch?.headPatchId ?? '' }
    });
    const op = JSON.parse(headPatch!.operation) as PatchOperation;
    expect(op.op).toBe('remove');
    expect(op.path).toBe('/pages/0/blocks/0');

    const parentPatch = await ctx.prisma.patch.findUnique({
      where: { id: headPatch!.parentId ?? '' }
    });
    const parentOp = JSON.parse(parentPatch!.operation) as PatchOperation;
    expect(parentOp.op).toBe('reorder');
    if (parentOp.op !== 'reorder') {
      throw new Error('Expected reorder parent patch');
    }
    expect(parentOp.new_order).toEqual([2, 0, 1]);
  });

  it('handles multiple admin conflicts with sequential resolutions', async () => {
    const base = await seedVolumeWithBlocks(ctx, userId, ['b0', 'b1', 'b2']);
    const adminBranch = base.adminBranch;
    let adminHeadId = adminBranch.headPatchId;
    let adminHeadSeq = adminBranch.headPatch.sequence;

    const adminOps: PatchOperation[] = [
      { op: 'replace', path: '/pages/0/blocks/0/lines/0/text', value: 'a2', old_value: 'b0' },
      { op: 'replace', path: '/pages/0/blocks/1/lines/0/text', value: 'a3', old_value: 'b1' }
    ];
    for (const op of adminOps) {
      const result = await createAdminPatch(
        ctx,
        base.volumeId,
        adminBranch.id,
        adminHeadId,
        adminHeadSeq,
        op
      );
      adminHeadId = result.headId;
      adminHeadSeq = result.headSeq;
    }

    const userBranch = await createUserBranch(
      ctx,
      base.volumeId,
      userId,
      base.adminBranch.headPatchId,
      base.adminBranch.snapshotPatchId
    );
    const userOps: PatchOperation[] = [
      { op: 'replace', path: '/pages/0/blocks/0/lines/0/text', value: 'u1', old_value: 'b0' },
      { op: 'replace', path: '/pages/0/blocks/1/lines/0/text', value: 'u2', old_value: 'b1' }
    ];
    const userChain = await createUserPatches(
      ctx,
      base.volumeId,
      userId,
      base.adminBranch.headPatchId,
      base.adminBranch.headPatch.sequence,
      userOps
    );
    await ctx.prisma.ocrBranch.update({
      where: { id: userBranch.id },
      data: { headPatchId: userChain.headId, rootPatchId: userChain.rootId }
    });

    const engine = new RebaseEngine(ctx.app);
    const firstPause = await engine.start(base.volumeId, userId);
    expect(firstPause.status).toBe('paused');
    if (firstPause.status !== 'paused') {
      throw new Error('Expected rebase to pause on conflict');
    }

    const second = await engine.continue(firstPause.rebaseId, 'keep_mine');
    expect(second.status).toBe('paused');
    if (second.status !== 'paused') {
      throw new Error('Expected second pause on conflict');
    }

    const done = await engine.continue(second.rebaseId, 'keep_admin');
    expect(done.status).toBe('complete');

    const updatedBranch = await ctx.prisma.ocrBranch.findUnique({
      where: { id: userBranch.id }
    });
    const chain = await fetchAncestryChain(
      ctx.prisma,
      updatedBranch?.headPatchId ?? '',
      adminHeadId
    );
    const ordered = [...chain].sort((a, b) => a.sequence - b.sequence);
    expect(ordered).toHaveLength(1);

    const op = JSON.parse(ordered[0].operation) as PatchOperation;
    expect(op.op).toBe('replace');
    if (op.op === 'replace') {
      expect(op.old_value).toBe('a2');
    }

    const data = await getComputedMokuroState(ctx.app, userId, {
      id: base.volumeId,
      mokuroPath: base.mokuroPath
    });
    expect(data.pages[0].blocks[0].lines[0]).toBe('u1');
    expect(data.pages[0].blocks[1].lines[0]).toBe('a3');
  });
});
