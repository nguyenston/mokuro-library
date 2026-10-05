import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { syncSnapshot, type OcrBranchWithTimestamps } from '../utils/ocrHelpers';

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

/** Supply the small Prisma surface used by snapshot sync and future pruning. */
function fixture() {
  const projectRoot = mkdtempSync(path.join(os.tmpdir(), 'mokuro-snapshot-pruning-'));
  directories.push(projectRoot);
  const headPatch = { id: 'head', sequence: 0, createdAt: new Date() };
  const branch = {
    id: 'admin-branch', userId: 'admin', headPatchId: 'head', headPatch,
    rootPatch: null, snapshotPatch: headPatch, snapshotPatchId: 'head'
  } as OcrBranchWithTimestamps;
  const patchDelete = vi.fn().mockResolvedValue({ id: 'old-future' });
  const client = {
    patch: {
      findUnique: vi.fn().mockResolvedValue({ nextPatchId: 'old-future' }),
      delete: patchDelete
    },
    ocrBranch: {
      update: vi.fn().mockResolvedValue(branch),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    $queryRaw: vi.fn().mockResolvedValue([{
      id: 'head', operation: JSON.stringify({ op: 'genesis', path: 'base.mokuro' })
    }])
  };
  const prisma = {
    ...client,
    $transaction: vi.fn(async (fn: (tx: typeof client) => Promise<unknown>) => fn(client))
  };
  const fastify = { projectRoot, prisma, log: { warn: vi.fn(), info: vi.fn() } } as unknown as FastifyInstance;
  return { projectRoot, branch, patchDelete, fastify };
}

describe('admin snapshot future pruning', () => {
  it('prunes even when the snapshot is already current', async () => {
    const { projectRoot, branch, patchDelete, fastify } = fixture();
    const snapshotPath = path.join(projectRoot, 'uploads', 'cache', 'snapshots', `${branch.id}.json`);
    mkdirSync(path.dirname(snapshotPath), { recursive: true });
    writeFileSync(snapshotPath, JSON.stringify({ patch_id: 'head' }));

    await syncSnapshot(fastify, branch);

    expect(patchDelete).toHaveBeenCalledWith({ where: { id: 'old-future' } });
  });

  it('prunes after regenerating a missing snapshot', async () => {
    const { projectRoot, branch, patchDelete, fastify } = fixture();
    writeFileSync(path.join(projectRoot, 'base.mokuro'), '{}');

    await syncSnapshot(fastify, branch);

    expect(patchDelete).toHaveBeenCalledWith({ where: { id: 'old-future' } });
  });

});
