/**
 * Integration tests for undo's frozen review boundary using real SQLite/Prisma.
 * Each test runs the migrations in an isolated temporary database and starts
 * with p0 -> p1 (root) -> p2 (submitted head) -> p3 (unsubmitted live head).
 * Verify that undo can remove the tail's effect, but cannot undo submitted
 * patches or alter stored history/review metadata when rejected. Cancellation
 * restores ordinary undo. A query hook submits a review between undo's read
 * and write to test the race deterministically, without timing-dependent sleeps.
 * Review lifecycle checks also verify the shared branch-state version contract.
 * Pruning checks distinguish valid tail replacement from impossible server state.
 * Redo checks cover forward movement, invalid boundaries, and both version guards.
 * Reset checks use real DB transactions but stub post-commit snapshot file copying.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { createPrismaClient, type ExtendedPrismaClient } from '../lib/prisma/prisma';
import { UserAPIAccessStrategy } from '../lib/strategies/UserAPIAccessStrategy';
import { AdminAPIAccessStrategy } from '../lib/strategies/AdminAPIAccessStrategy';
import * as ocrHelpers from '../utils/ocrHelpers';
import { RebaseEngine } from '../lib/rebase/RebaseEngine';

let directory: string;
let prisma: ExtendedPrismaClient;

/** Construct a strategy against the isolated database, optionally with a query hook. */
function strategy(client = prisma) {
  return new UserAPIAccessStrategy({ prisma: client } as FastifyInstance, 'contributor');
}

/** Capture persisted state so rejected undo must preserve history and review metadata. */
async function state() {
  return {
    branch: await prisma.ocrBranch.findUniqueOrThrow({ where: { id: 'user-branch' } }),
    patches: await prisma.patch.findMany({ orderBy: { id: 'asc' } })
  };
}

beforeEach(async () => {
  directory = mkdtempSync(path.join(os.tmpdir(), 'mokuro-review-undo-'));
  const databasePath = path.join(directory, 'test.db');
  const database = new DatabaseSync(databasePath);
  try {
    const migrations = path.resolve('prisma/migrations');
    for (const entry of readdirSync(migrations, { withFileTypes: true })
      .filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      database.exec(readFileSync(path.join(migrations, entry.name, 'migration.sql'), 'utf8'));
    }
  } finally {
    database.close();
  }
  prisma = createPrismaClient(`file:${databasePath.replace(/\\/g, '/')}`);
  await prisma.user.createMany({ data: ['admin', 'contributor'].map(id => ({
    id, username: id, password: 'unused', settings: {}
  })) });
  await prisma.series.create({ data: {
    id: 'series', ownerId: 'admin', folderName: 'series', sortTitle: 'series'
  } });
  await prisma.volume.create({ data: {
    id: 'volume', seriesId: 'series', folderName: 'volume', sortTitle: 'volume',
    pageCount: 1, filePath: 'volume', mokuroPath: 'volume.mokuro'
  } });
  for (let index = 0; index <= 3; index++) {
    await prisma.patch.create({ data: {
      id: `p${index}`, parentId: index === 0 ? null : `p${index - 1}`,
      volumeId: 'volume', userId: index === 0 ? 'admin' : 'contributor', sequence: index,
      operation: JSON.stringify(index === 0 ? { op: 'genesis', path: 'volume.mokuro' } : {
        op: 'replace', path: '/pages/0/blocks/0/lines/0/text',
        old_value: `text${index - 1}`, value: `text${index}`
      })
    } });
  }
  await prisma.ocrBranch.createMany({ data: [
    { id: 'admin-branch', volumeId: 'volume', userId: 'admin', headPatchId: 'p0', rootPatchId: 'p0' },
    { id: 'user-branch', volumeId: 'volume', userId: 'contributor', headPatchId: 'p3',
      rootPatchId: 'p1', version: 3, reviewHeadPatchId: 'p2',
      reviewRequestedAt: new Date('2026-09-01T00:00:00Z'), submissionNote: 'Review through p2' }
  ] });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await prisma?.$disconnect();
  // Remove only the temporary directory created by this fixture.
  if (directory) rmSync(directory, { recursive: true, force: true });
});

describe('explicit rebase review cancellation', () => {
  /** Diverge admin and user edits so starting rebase pauses at a real conflict. */
  beforeEach(async () => {
    await prisma.patch.create({ data: {
      id: 'admin-edit', parentId: 'p0', volumeId: 'volume', userId: 'admin', sequence: 1,
      operation: JSON.stringify({ op: 'replace', path: '/pages/0/blocks/0/lines/0/text',
        old_value: 'text0', value: 'admin text' })
    } });
    await prisma.ocrBranch.update({ where: { id: 'admin-branch' }, data: { headPatchId: 'admin-edit' } });
  });

  it('requires confirmation without changing history, review, or sessions', async () => {
    const before = await state();
    await expect(strategy().startRebase('volume', 3)).rejects.toMatchObject({
      statusCode: 409, code: 'REVIEW_CANCELLATION_CONFIRMATION_REQUIRED'
    });
    expect(await state()).toEqual(before);
    expect(await prisma.rebaseSession.count()).toBe(0);
  });

  it('cancels review when starting, and abort does not restore it', async () => {
    const before = await state();
    const rebase = new RebaseEngine({ prisma } as FastifyInstance);
    const result = await strategy().startRebase('volume', 3, true);
    expect(result.status).toBe('paused');
    const started = await state();
    expect(started.branch).toMatchObject({ headPatchId: 'p3', rootPatchId: 'p1',
      reviewHeadPatchId: null, reviewRequestedAt: null, version: 4,
      rejectionReason: 'Review cancelled because the contributor started an explicit rebase.' });
    expect(started.patches).toEqual(before.patches);
    const session = await prisma.rebaseSession.findFirstOrThrow();
    await rebase.abort(session.id);
    expect(await state()).toEqual(started);
    expect(await prisma.rebaseSession.count()).toBe(0);
  });

  it('forced does not bypass the displayed version', async () => {
    const before = await state();
    await expect(strategy().startRebase('volume', 2, true)).rejects.toMatchObject({ statusCode: 409 });
    expect(await state()).toEqual(before);
    expect(await prisma.rebaseSession.count()).toBe(0);
  });

  it('rejects admin rebase at the access strategy', async () => {
    const before = await state();
    const admin = new AdminAPIAccessStrategy({ prisma } as FastifyInstance);
    await expect(admin.startRebase('volume', 3, true)).rejects.toMatchObject({ statusCode: 405 });
    expect(await state()).toEqual(before);
  });

  it('checks volume access before starting rebase', async () => {
    await prisma.user.create({ data: { id: 'other', username: 'other', password: 'unused', settings: {} } });
    await prisma.series.update({ where: { id: 'series' }, data: { ownerId: 'other' } });
    const before = await state();
    await expect(strategy().startRebase('volume', 3, true)).rejects.toMatchObject({ statusCode: 404 });
    expect(await state()).toEqual(before);
    expect(await prisma.rebaseSession.count()).toBe(0);
  });

  it('keeps review cancelled if creating the session fails', async () => {
    const before = await state();
    const client = prisma.$extends({ query: { rebaseSession: {
      async create() { throw new Error('session creation failed'); }
    } } });
    await expect(strategy(client as ExtendedPrismaClient).startRebase('volume', 3, true))
      .rejects.toThrow('session creation failed');
    const after = await state();
    expect(after.branch).toMatchObject({ version: 4, reviewHeadPatchId: null, reviewRequestedAt: null });
    expect(after.patches).toEqual(before.patches);
    expect(await prisma.rebaseSession.count()).toBe(0);
  });

  it('rolls back session creation if a review changes after the initial start check', async () => {
    let changed: Awaited<ReturnType<typeof state>> | undefined;
    const client = prisma.$extends({ query: { patch: {
      async findUnique({ args, query }) {
        const result = await query(args);
        // Root lookup follows the engine's initial version check.
        if (args.where.id === 'p1' && !changed) {
          await prisma.ocrBranch.update({ where: { id: 'user-branch' }, data: {
            reviewHeadPatchId: 'p3', version: { increment: 1 }
          } });
          changed = await state();
        }
        return result;
      }
    } } });
    await expect(strategy(client as ExtendedPrismaClient).startRebase('volume', 3, true))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(changed).toBeDefined();
    expect(await state()).toEqual(changed);
    expect(await prisma.rebaseSession.count()).toBe(0);
  });

  it('starts without forced when no review is pending', async () => {
    await prisma.ocrBranch.update({ where: { id: 'user-branch' }, data: {
      reviewHeadPatchId: null, reviewRequestedAt: null
    } });
    expect((await strategy().startRebase('volume', 3)).status).toBe('paused');
    expect((await state()).branch.version).toBe(3);
  });

  it('rejects review submission while a rebase session exists', async () => {
    await strategy().startRebase('volume', 3, true);
    const before = await state();
    await expect(strategy().setReviewStatus('contributor', { volumeId: 'volume', status: true }))
      .rejects.toMatchObject({ statusCode: 409, message: 'Cannot submit review during rebase. Finish or abort it first.' });
    expect(await state()).toEqual(before);
  });

  it('rejects a session created between review eligibility checks and submission', async () => {
    await prisma.ocrBranch.update({ where: { id: 'admin-branch' }, data: { headPatchId: 'p0' } });
    await prisma.ocrBranch.update({ where: { id: 'user-branch' }, data: {
      reviewHeadPatchId: null, reviewRequestedAt: null
    } });
    const before = await state();
    const client = prisma.$extends({ query: { ocrBranch: {
      async updateMany({ args, query }) {
        await prisma.rebaseSession.create({ data: { branchId: 'user-branch',
          targetHeadPatchId: 'p0', headPatchIdSnapshot: 'p3', expectedVersion: 3,
          expiresAt: new Date(Date.now() + 60000) } });
        return query(args);
      }
    } } });
    await expect(strategy(client as ExtendedPrismaClient).setReviewStatus('contributor', { volumeId: 'volume', status: true }))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(await state()).toEqual(before);
  });

  it('rejects a stale persisted session after the engine cache is lost', async () => {
    const result = await strategy().startRebase('volume', 3, true);
    if (result.status !== 'paused') throw new Error('Expected a conflict');
    await prisma.ocrBranch.update({ where: { id: 'user-branch' }, data: { version: { increment: 1 } } });
    const before = await state();
    // A fresh module has no hot session and must use the persisted expected version.
    vi.resetModules();
    const { RebaseEngine: RestoredEngine } = await import('../lib/rebase/RebaseEngine');
    await expect(new RestoredEngine({ prisma } as FastifyInstance).continue(result.rebaseId, 'keep_admin'))
      .rejects.toThrow('Branch or review changed. Please refresh.');
    expect(await state()).toEqual(before);
  });

  it.each([false, true])('rejects a version-only change at commit (during commit: %s)', async duringCommit => {
    const result = await strategy().startRebase('volume', 3, true);
    if (result.status !== 'paused') throw new Error('Expected a conflict');
    const session = await prisma.rebaseSession.findFirstOrThrow();
    expect(session.expectedVersion).toBe(4);
    // Bump only the version, leaving HEAD unchanged to exercise the stronger guard.
    const bumpVersion = () => prisma.ocrBranch.update({ where: { id: 'user-branch' },
      data: { version: { increment: 1 } } });
    let client = prisma;
    if (duringCommit) {
      client = prisma.$extends({ query: { ocrBranch: {
        async findUnique({ args, query }) {
          const value = await query(args);
          // Admin lookup follows commit's early contributor-version check.
          if (args.where.volumeId_userId?.userId === 'admin') await bumpVersion();
          return value;
        }
      } } }) as ExtendedPrismaClient;
    } else {
      await bumpVersion();
    }
    const patches = (await state()).patches;
    // Resolve every conflict so the assertion reaches commit rather than the next pause.
    const finish = async () => {
      const engine = new RebaseEngine({ prisma: client } as FastifyInstance);
      for (let i = 0; i < 4; i++) {
        if ((await engine.continue(result.rebaseId, 'keep_admin')).status === 'complete') return;
      }
      throw new Error('Unexpected number of conflicts');
    };
    await expect(finish())
      .rejects.toThrow('Branch or review changed. Please refresh.');
    expect((await state()).patches).toEqual(patches);
    expect((await state()).branch).toMatchObject({ headPatchId: 'p3', version: 5 });
    expect(await prisma.rebaseSession.count()).toBe(1);
  });

  it.each([null, 'p1'])('skips writes when up to date without a review (root %s)', async rootPatchId => {
    await prisma.ocrBranch.update({ where: { id: 'admin-branch' }, data: { headPatchId: 'p3' } });
    await prisma.ocrBranch.update({ where: { id: 'user-branch' }, data: {
      rootPatchId, reviewHeadPatchId: null, reviewRequestedAt: null
    } });
    const before = await state();
    // Prisma's extended client exposes methods dynamically, so intercept access
    // rather than spying on a method descriptor that does not exist.
    const transaction = vi.fn(() => { throw new Error('Unexpected transaction'); });
    const client = new Proxy(prisma, {
      get(target, property) {
        return property === '$transaction' ? transaction : Reflect.get(target, property);
      }
    });
    expect(await strategy(client).startRebase('volume', 3)).toEqual({ status: 'complete' });
    expect(transaction).not.toHaveBeenCalled();
    expect(await state()).toEqual(before);
    expect(await prisma.rebaseSession.count()).toBe(0);
  });

  it('only cancels the review when already up to date', async () => {
    await prisma.ocrBranch.update({ where: { id: 'admin-branch' }, data: { headPatchId: 'p3' } });
    const before = await state();
    expect(await strategy().startRebase('volume', 3, true)).toEqual({ status: 'complete' });
    const after = await state();
    expect(after.branch).toMatchObject({ headPatchId: 'p3', rootPatchId: 'p1', version: 4,
      reviewHeadPatchId: null, reviewRequestedAt: null,
      rejectionReason: 'Review cancelled because the contributor started an explicit rebase.' });
    expect(after.patches).toEqual(before.patches);
    expect(await prisma.rebaseSession.count()).toBe(0);
  });
});

describe('user undo at a frozen review boundary', () => {
  it('can undo the tail to the review head, then rejects crossing it', async () => {
    const before = await state();
    expect(await strategy().undo('volume', 3)).toMatchObject({
      success: true, newHeadId: 'p2', newVersion: 4,
      patch: { op: 'replace', old_value: 'text3', value: 'text2' }
    });
    const atBoundary = await state();
    expect(atBoundary.branch).toMatchObject({
      headPatchId: 'p2', rootPatchId: 'p1', reviewHeadPatchId: 'p2',
      reviewRequestedAt: before.branch.reviewRequestedAt, submissionNote: before.branch.submissionNote
    });
    expect(atBoundary.patches).toEqual(before.patches);
    await expect(strategy().undo('volume', 4)).rejects.toMatchObject({
      statusCode: 409, message: 'Cannot undo patches that are currently submitted for review.'
    });
    expect(await state()).toEqual(atBoundary);
  });

  it('allows ordinary undo past the former boundary after cancellation', async () => {
    await prisma.ocrBranch.update({ where: { id: 'user-branch' }, data: {
      headPatchId: 'p2'
    } });
    expect(await strategy().setReviewStatus('contributor', { volumeId: 'volume', status: false }))
      .toMatchObject({ action: 'cancelled', newVersion: 4 });
    await expect(strategy().undo('volume', 3)).rejects.toMatchObject({ statusCode: 409 });
    expect(await strategy().undo('volume', 4)).toMatchObject({ newHeadId: 'p1', newVersion: 5 });
  });

  it('rejects stale versions without modifying the branch or patches', async () => {
    const before = await state();
    await expect(strategy().undo('volume', 2)).rejects.toMatchObject({ statusCode: 409 });
    expect(await state()).toEqual(before);
  });

  it('rejects undo if a review freezes the current head immediately before the write', async () => {
    await prisma.ocrBranch.update({ where: { id: 'user-branch' }, data: {
      reviewHeadPatchId: null, reviewRequestedAt: null
    } });
    let afterRequest: Awaited<ReturnType<typeof state>> | undefined;
    const client = prisma.$extends({ query: { ocrBranch: {
      async updateMany({ args, query }) {
        // Use the real submission path between undo's read and conditional write.
        // Its version increment must invalidate the in-flight undo.
        await strategy().setReviewStatus('contributor', { volumeId: 'volume', status: true });
        afterRequest = await state();
        return query(args);
      }
    } } });
    await expect(strategy(client as ExtendedPrismaClient).undo('volume', 3))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(afterRequest).toBeDefined();
    expect(afterRequest?.branch).toMatchObject({ reviewHeadPatchId: 'p3', version: 4 });
    expect(await state()).toEqual(afterRequest);
  });

  it('versions submission without changing history and rejects duplicate submission unchanged', async () => {
    await prisma.ocrBranch.update({ where: { id: 'user-branch' }, data: {
      reviewHeadPatchId: null, reviewRequestedAt: null
    } });
    const before = await state();
    expect(await strategy().setReviewStatus('contributor', { volumeId: 'volume', status: true }))
      .toMatchObject({ action: 'submitted', newVersion: 4 });
    const submitted = await state();
    expect(submitted.branch).toMatchObject({ headPatchId: 'p3', rootPatchId: 'p1', version: 4,
      reviewHeadPatchId: 'p3' });
    expect(submitted.patches).toEqual(before.patches);
    await expect(strategy().setReviewStatus('contributor', { volumeId: 'volume', status: true }))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(await state()).toEqual(submitted);
  });

  it('keeps repeated cancellation a no-op and preserves history and notes', async () => {
    const before = await state();
    await strategy().setReviewStatus('contributor', { volumeId: 'volume', status: false });
    const cancelled = await state();
    expect(cancelled.branch).toMatchObject({ version: 4, headPatchId: 'p3', rootPatchId: 'p1',
      reviewHeadPatchId: null, reviewRequestedAt: null, submissionNote: before.branch.submissionNote });
    expect(cancelled.patches).toEqual(before.patches);
    expect(await strategy().setReviewStatus('contributor', { volumeId: 'volume', status: false }))
      .toMatchObject({ newVersion: 4 });
    expect(await state()).toEqual(cancelled);
  });

  it('versions admin rejection on the contributor branch without changing history', async () => {
    const before = await state();
    const admin = new AdminAPIAccessStrategy({ prisma } as FastifyInstance);
    expect(await admin.setReviewStatus('admin', {
      volumeId: 'volume', status: false, targetUserId: 'contributor', reason: 'Please revise'
    })).toMatchObject({ action: 'rejected', newVersion: 4 });
    const rejected = await state();
    expect(rejected.branch).toMatchObject({ version: 4, headPatchId: 'p3', rootPatchId: 'p1',
      reviewHeadPatchId: null, reviewRequestedAt: null, rejectionReason: 'Please revise' });
    expect(rejected.patches).toEqual(before.patches);
    await expect(strategy().undo('volume', 3)).rejects.toMatchObject({ statusCode: 409 });
    expect(await state()).toEqual(rejected);
  });

  it('rejects a stale cancellation instead of clearing a replacement review', async () => {
    let replacement: Awaited<ReturnType<typeof state>> | undefined;
    const client = prisma.$extends({ query: { ocrBranch: {
      async updateMany({ args, query }) {
        // Replace the request after cancellation reads it, using real lifecycle writes.
        await strategy().setReviewStatus('contributor', { volumeId: 'volume', status: false });
        await strategy().setReviewStatus('contributor', { volumeId: 'volume', status: true });
        replacement = await state();
        return query(args);
      }
    } } });
    await expect(strategy(client as ExtendedPrismaClient).setReviewStatus('contributor', {
      volumeId: 'volume', status: false
    })).rejects.toMatchObject({ statusCode: 409 });
    expect(replacement?.branch).toMatchObject({ version: 5, reviewHeadPatchId: 'p3' });
    expect(await state()).toEqual(replacement);
  });
});

describe('redo with a frozen review boundary', () => {
  it('redoes from the review head into the tail without changing history or review metadata', async () => {
    await strategy().undo('volume', 3);
    const before = await state();
    expect(await strategy().redo('volume', 4)).toMatchObject({
      success: true, newHeadId: 'p3', newVersion: 5,
      patch: { op: 'replace', old_value: 'text2', value: 'text3' }
    });
    const after = await state();
    expect(after.branch).toMatchObject({ headPatchId: 'p3', version: 5,
      rootPatchId: 'p1', reviewHeadPatchId: 'p2',
      reviewRequestedAt: before.branch.reviewRequestedAt, submissionNote: before.branch.submissionNote });
    expect(after.patches).toEqual(before.patches);
  });

  it('still redoes into the private root when no review is pending', async () => {
    await strategy().setReviewStatus('contributor', { volumeId: 'volume', status: false });
    await prisma.ocrBranch.update({ where: { id: 'user-branch' }, data: { headPatchId: 'p0' } });
    expect(await strategy().redo('volume', 4)).toMatchObject({ newHeadId: 'p1', newVersion: 5 });
  });

  it('rejects an already-stale version before reporting nothing to redo', async () => {
    const before = await state();
    await expect(strategy().redo('volume', 2)).rejects.toMatchObject({
      statusCode: 409, message: 'Version mismatch. Please refresh.'
    });
    expect(await state()).toEqual(before);
  });

  it('reports nothing to redo for a current version at the live tip', async () => {
    const before = await state();
    await expect(strategy().redo('volume', 3)).rejects.toMatchObject({
      statusCode: 400, message: 'Nothing to redo'
    });
    expect(await state()).toEqual(before);
  });

  it('reports HEAD behind the review head as a server-state bug without moving it', async () => {
    // Deliberately bypass undo to construct a state normal user actions cannot create.
    await prisma.ocrBranch.update({ where: { id: 'user-branch' }, data: { headPatchId: 'p1' } });
    const before = await state();
    await expect(strategy().redo('volume', 3)).rejects.toMatchObject({
      statusCode: 500,
      message: 'Invalid server branch state: pending review is outside the active private range.'
    });
    expect(await state()).toEqual(before);
  });

  it.each(['review cancellation', 'another redo'])('rejects %s between the read and write', async action => {
    await strategy().undo('volume', 3);
    let afterConcurrentChange: Awaited<ReturnType<typeof state>> | undefined;
    const client = prisma.$extends({ query: { ocrBranch: {
      async updateMany({ args, query }) {
        // Interleave a real competing operation immediately before the conditional write.
        if (action === 'review cancellation') {
          await strategy().setReviewStatus('contributor', { volumeId: 'volume', status: false });
        } else {
          await strategy().redo('volume', 4);
        }
        afterConcurrentChange = await state();
        return query(args);
      }
    } } });
    await expect(strategy(client as ExtendedPrismaClient).redo('volume', 4))
      .rejects.toMatchObject({ statusCode: 409, message: 'Branch or review changed. Please refresh.' });
    expect(afterConcurrentChange?.branch.version).toBe(5);
    expect(await state()).toEqual(afterConcurrentChange);
  });
});

describe('reset confirmation and atomic review cancellation', () => {
  beforeEach(() => {
    // Keep real DB transactions, but isolate post-commit filesystem snapshot copying.
    vi.spyOn(ocrHelpers, 'inheritAdminSnapshot').mockImplementation(async (_fastify, branch) => branch);
  });

  it('requires confirmation without changing persisted state', async () => {
    const before = await state();
    await expect(strategy().reset('volume', 3)).rejects.toMatchObject({
      statusCode: 409, code: 'REVIEW_CANCELLATION_CONFIRMATION_REQUIRED'
    });
    expect(await state()).toEqual(before);
    expect(ocrHelpers.inheritAdminSnapshot).not.toHaveBeenCalled();
  });

  it('forced reset cancels review before deleting private history and preserves the branch', async () => {
    await strategy().reset('volume', 3, true);
    const after = await state();
    expect(after.branch).toMatchObject({ headPatchId: 'p0', rootPatchId: null, version: 4,
      reviewHeadPatchId: null, reviewRequestedAt: null,
      rejectionReason: 'Review cancelled because the contributor reset their branch.' });
    expect(after.patches.map(patch => patch.id)).toEqual(['p0']);
    expect(ocrHelpers.inheritAdminSnapshot).toHaveBeenCalledOnce();
  });

  it('resets without confirmation when no review is pending, including an undone private root', async () => {
    await strategy().setReviewStatus('contributor', { volumeId: 'volume', status: false });
    await prisma.ocrBranch.update({ where: { id: 'user-branch' }, data: { headPatchId: 'p0' } });
    await strategy().reset('volume', 4);
    expect((await state()).branch).toMatchObject({ rootPatchId: null, headPatchId: 'p0', version: 5 });
    expect((await state()).patches.map(patch => patch.id)).toEqual(['p0']);
  });

  it('forced does not bypass stale versions or authorization', async () => {
    const before = await state();
    await expect(strategy().reset('volume', 2, true)).rejects.toMatchObject({ statusCode: 409 });
    await prisma.series.update({ where: { id: 'series' }, data: { ownerId: 'contributor' } });
    const stranger = new UserAPIAccessStrategy({ prisma } as FastifyInstance, 'stranger');
    await expect(stranger.reset('volume', 3, true)).rejects.toMatchObject({ statusCode: 404 });
    const admin = new AdminAPIAccessStrategy({ prisma } as FastifyInstance);
    await expect(admin.reset('volume', 3, true)).rejects.toMatchObject({ statusCode: 405 });
    expect(await state()).toEqual(before);
  });

  it('rolls back review cancellation and pointer changes if history deletion fails', async () => {
    const before = await state();
    const client = prisma.$extends({ query: { patch: {
      async delete() { throw new Error('Injected deletion failure'); }
    } } });
    await expect(strategy(client as ExtendedPrismaClient).reset('volume', 3, true))
      .rejects.toThrow('Injected deletion failure');
    expect(await state()).toEqual(before);
    expect(ocrHelpers.inheritAdminSnapshot).not.toHaveBeenCalled();
  });

  it('forced does not bypass a review submitted after the initial branch read', async () => {
    await strategy().setReviewStatus('contributor', { volumeId: 'volume', status: false });
    let concurrent: Awaited<ReturnType<typeof state>> | undefined;
    const client = prisma.$extends({ query: { ocrBranch: {
      async findUnique({ args, query }) {
        const result = await query(args);
        if (args.where.volumeId_userId?.userId === 'contributor') {
          await strategy().setReviewStatus('contributor', { volumeId: 'volume', status: true });
          concurrent = await state();
        }
        return result;
      }
    } } });
    await expect(strategy(client as ExtendedPrismaClient).reset('volume', 4, true))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(concurrent?.branch.version).toBe(5);
    expect(await state()).toEqual(concurrent);
    expect(ocrHelpers.inheritAdminSnapshot).not.toHaveBeenCalled();
  });
});

describe('patch pruning at a frozen review boundary', () => {
  const edit = {
    op: 'replace' as const, path: '/pages/0/blocks/0/lines/0/text',
    old_value: 'text2', value: 'replacement'
  };

  it('replaces only the undone tail when HEAD is the review head', async () => {
    await strategy().undo('volume', 3);
    const before = await state();
    const result = await strategy().applyPatch('volume', edit, 4);
    const after = await state();
    expect(result).toMatchObject({ success: true, newVersion: 5 });
    expect(after.branch).toMatchObject({ headPatchId: result.newHeadId, rootPatchId: 'p1',
      reviewHeadPatchId: 'p2', reviewRequestedAt: before.branch.reviewRequestedAt });
    expect(after.patches.filter(patch => ['p0', 'p1', 'p2'].includes(patch.id)))
      .toEqual(before.patches.filter(patch => ['p0', 'p1', 'p2'].includes(patch.id)));
    expect(after.patches.some(patch => patch.id === 'p3')).toBe(false);
    expect(after.patches.find(patch => patch.id === result.newHeadId)?.parentId).toBe('p2');
  });

  it.each(['p1', 'p0'])('reports HEAD %s behind the review head as a server-state bug without pruning', async headPatchId => {
    // Bypass undo deliberately: normal user actions cannot produce this state.
    await prisma.ocrBranch.update({ where: { id: 'user-branch' }, data: { headPatchId } });
    const before = await state();
    await expect(strategy().applyPatch('volume', edit, 3)).rejects.toMatchObject({
      statusCode: 500,
      message: 'Invalid server branch state: pending review is outside the active private range.'
    });
    expect(await state()).toEqual(before);
  });
});
