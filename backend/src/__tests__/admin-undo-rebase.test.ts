/**
 * Admin undo must not cross an active rebase target or cancel sessions implicitly.
 * Real SQLite transactions verify unchanged state on rejection, explicit abort
 * followed by undo, both orderings of the session-start/undo race, and pruning
 * cleanup, including snapshot cleanup racing with a concurrent admin append.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createPrismaClient, type ExtendedPrismaClient } from '../lib/prisma/prisma';
import { AdminAPIAccessStrategy } from '../lib/strategies/AdminAPIAccessStrategy';
import { UserAPIAccessStrategy } from '../lib/strategies/UserAPIAccessStrategy';
import { RebaseEngine } from '../lib/rebase/RebaseEngine';
import ocrRoutes from '../routes/ocr';
import { pruneAbandonedFuture, syncSnapshot } from '../utils/ocrHelpers';

let directory: string;
let prisma: ExtendedPrismaClient;
let app: FastifyInstance;
let actor: string;

/** Capture branch pointers and patch payloads as well as the session set. */
async function state() {
  return { branches: await prisma.ocrBranch.findMany({ orderBy: { id: 'asc' } }),
    patches: await prisma.patch.findMany({ orderBy: { id: 'asc' } }),
    sessions: await prisma.rebaseSession.findMany({ orderBy: { id: 'asc' } }) };
}

/** Persist a paused-session fixture without changing branch or history state. */
async function session(id = 'affected', targetHeadPatchId = 'a2', branchId = 'user-branch') {
  return prisma.rebaseSession.create({ data: { id, branchId, targetHeadPatchId,
    headPatchIdSnapshot: branchId === 'user-branch' ? 'u2' : 'g',
    expectedVersion: branchId === 'user-branch' ? 2 : 0,
    expiresAt: new Date(Date.now() + 60000) } });
}

/** Exercise ordinary undo with the observed admin version. */
function undo(branchVersion = 2) {
  return app.inject({ method: 'POST', url: '/volume/v/undo',
    payload: { branchVersion } });
}

/** Supply a query-hook client while retaining the real engine and database. */
function admin(client = prisma) {
  return new AdminAPIAccessStrategy({ prisma: client, log: app.log } as FastifyInstance);
}

beforeEach(async () => {
  directory = mkdtempSync(path.join(os.tmpdir(), 'mokuro-admin-undo-'));
  const databasePath = path.join(directory, 'test.db');
  const database = new DatabaseSync(databasePath);
  try {
    for (const entry of readdirSync('prisma/migrations', { withFileTypes: true })
      .filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      database.exec(readFileSync(path.join('prisma/migrations', entry.name, 'migration.sql'), 'utf8'));
    }
  } finally { database.close(); }
  prisma = createPrismaClient(`file:${databasePath.replace(/\\/g, '/')}`);
  await prisma.user.createMany({ data: ['admin', 'user', 'other'].map(id =>
    ({ id, username: id, password: 'unused', settings: {} })) });
  await prisma.series.create({ data: { id: 's', ownerId: 'admin', folderName: 's', sortTitle: 's' } });
  await prisma.volume.create({ data: { id: 'v', seriesId: 's', folderName: 'v', sortTitle: 'v',
    pageCount: 1, filePath: 'v', mokuroPath: 'v.mokuro' } });
  for (const [id, parentId, sequence, userId, old_value, value] of [
    ['g', null, 0, 'admin', '', ''],
    ['a1', 'g', 1, 'admin', 'text0', 'admin1'],
    ['a2', 'a1', 2, 'admin', 'admin1', 'admin2'],
    ['u1', 'g', 1, 'user', 'text0', 'user1'],
    ['u2', 'u1', 2, 'user', 'user1', 'user2']
  ] as const) {
    await prisma.patch.create({ data: { id, parentId, sequence, userId, volumeId: 'v',
      operation: JSON.stringify(id === 'g' ? { op: 'genesis', path: 'v.mokuro' } : {
        op: 'replace', path: '/pages/0/blocks/0/lines/0/text', old_value, value }) } });
  }
  await prisma.patch.update({ where: { id: 'g' }, data: { nextPatchId: 'a1' } });
  await prisma.patch.update({ where: { id: 'a1' }, data: { nextPatchId: 'a2' } });
  await prisma.ocrBranch.createMany({ data: [
    { id: 'admin-branch', volumeId: 'v', userId: 'admin', headPatchId: 'a2', rootPatchId: 'g', version: 2 },
    { id: 'user-branch', volumeId: 'v', userId: 'user', headPatchId: 'u2', rootPatchId: 'u1', version: 2 },
    { id: 'other-branch', volumeId: 'v', userId: 'other', headPatchId: 'g', rootPatchId: null }
  ] });
  app = Fastify();
  app.decorate('prisma', prisma);
  app.decorate('authenticate', async () => {});
  app.decorateRequest('accessStrategy', null as unknown as FastifyRequest['accessStrategy']);
  actor = 'admin';
  app.addHook('preHandler', async request => {
    request.accessStrategy = actor === 'admin' ? new AdminAPIAccessStrategy(app)
      : new UserAPIAccessStrategy(app, actor);
  });
  await app.register(ocrRoutes);
});

afterEach(async () => {
  await app?.close();
  await prisma?.$disconnect();
  if (directory) rmSync(directory, { recursive: true, force: true });
});

describe('admin undo of a rebase target', () => {
  it('rejects undo without changing branches, patches, or sessions', async () => {
    await session();
    const before = await state();
    const response = await undo();
    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain('active rebase target');
    expect(await state()).toEqual(before);
  });

  it('cannot bypass the restriction with obsolete forced-cancellation fields', async () => {
    await session();
    const before = await state();
    const response = await app.inject({ method: 'POST', url: '/volume/v/undo',
      payload: { branchVersion: 2, forced: true, cancellingRebaseIds: ['affected'] } });
    expect(response.statusCode).toBe(409);
    expect(await state()).toEqual(before);
  });

  it('allows undo when all session targets are earlier ancestors', async () => {
    await session('ancestor', 'a1');
    expect((await undo()).json()).toMatchObject({ newHeadId: 'a1', newVersion: 3 });
    expect(await prisma.rebaseSession.findUnique({ where: { id: 'ancestor' } })).not.toBeNull();
  });

  it('allows undo after explicit cancellation of the paused engine session', async () => {
    const engine = new RebaseEngine(app);
    const paused = await engine.start('v', 'user', 2);
    if (paused.status !== 'paused') throw new Error('Expected a conflict');
    const before = await state();
    expect((await undo()).statusCode).toBe(409);
    expect(await state()).toEqual(before);
    await engine.abort(paused.rebaseId);
    expect((await undo()).json()).toMatchObject({ newHeadId: 'a1', newVersion: 3,
      patch: { old_value: 'admin2', value: 'admin1' } });
    await expect(engine.continue(paused.rebaseId, 'keep_admin')).rejects.toThrow('Session expired or not found');
  });

  it('preserves sessions even when dependency rules would also reject undo', async () => {
    await session();
    await prisma.ocrBranch.updateMany({ where: { id: { in: ['user-branch', 'other-branch'] } },
      data: { headPatchId: 'a2', rootPatchId: null } });
    const before = await state();
    expect((await undo()).statusCode).toBe(409);
    expect(await state()).toEqual(before);
  });

  it('rejects stale versions without modifying history or sessions', async () => {
    await session();
    const before = await state();
    expect((await undo(1)).statusCode).toBe(409);
    expect(await state()).toEqual(before);
  });

  it('blocks a session created after initial reads but before the undo write', async () => {
    const before = await state();
    let inserted = false;
    const client = prisma.$extends({ query: { patch: {
      async findUnique({ args, query }) {
        const result = await query(args);
        // Persist the session after HEAD is read, before undo starts its transaction.
        if (args.where.id === 'a2' && !inserted) {
          inserted = true;
          await session();
        }
        return result;
      }
    } } });
    await expect(admin(client as ExtendedPrismaClient).undo('v', 2))
      .rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('active rebase target') });
    const after = await state();
    expect(inserted).toBe(true);
    expect(after.branches).toEqual(before.branches);
    expect(after.patches).toEqual(before.patches);
    expect(after.sessions.map(value => value.id)).toEqual(['affected']);
  });

  it('rejects a rebase start that read its target before admin undo finished', async () => {
    let undone = false;
    const client = prisma.$extends({ query: { patch: {
      async findUnique({ args, query }) {
        const result = await query(args);
        if (args.where.id === 'u1' && !undone) {
          undone = true;
          await admin().undo('v', 2);
        }
        return result;
      }
    } } });
    await expect(new RebaseEngine({ prisma: client, log: app.log } as FastifyInstance).start('v', 'user', 2))
      .rejects.toThrow('Branch or review changed. Please refresh.');
    expect(undone).toBe(true);
    expect(await prisma.rebaseSession.count()).toBe(0);
    expect(await prisma.ocrBranch.findUniqueOrThrow({ where: { id: 'admin-branch' } }))
      .toMatchObject({ headPatchId: 'a1', version: 3 });
  });

  it('allows admin append after the rebase target was read', async () => {
    let appended = false;
    const client = prisma.$extends({ query: { patch: {
      async findUnique({ args, query }) {
        const result = await query(args);
        if (args.where.id === 'u1' && !appended) {
          appended = true;
          await admin().applyPatch('v', { op: 'replace', path: '/pages/0/blocks/0/lines/0/text',
            old_value: 'admin2', value: 'admin3' }, 2);
        }
        return result;
      }
    } } });
    const engine = new RebaseEngine({ prisma: client, log: app.log } as FastifyInstance);
    const result = await engine.start('v', 'user', 2);
    if (result.status !== 'paused') throw new Error('Expected a conflict');
    expect(appended).toBe(true);
    expect(await prisma.rebaseSession.findUniqueOrThrow({ where: { id: result.rebaseId } }))
      .toMatchObject({ targetHeadPatchId: 'a2' });
    await engine.abort(result.rebaseId);
  });
});

/** Leave an abandoned suffix through ordinary undo, then make its snapshot current. */
async function abandonedFuture() {
  await admin().undo('v', 2);
  await prisma.ocrBranch.update({ where: { id: 'admin-branch' },
    data: { snapshotPatchId: 'a1' } });
}

/** Add a descendant outside the admin forward-link chain to exercise parent cascades. */
async function descendant() {
  await prisma.patch.create({ data: { id: 'descendant', parentId: 'a2', sequence: 3,
    volumeId: 'v', userId: 'user', operation: JSON.stringify({ op: 'replace',
      path: '/pages/0/blocks/0/lines/0/text', old_value: 'admin2', value: 'descendant' }) } });
}

/** Use the existing valid snapshot path so cleanup is isolated from regeneration. */
async function snapshotFixture() {
  const branch = await prisma.ocrBranch.findUniqueOrThrow({ where: { id: 'admin-branch' },
    include: { headPatch: true, rootPatch: true, snapshotPatch: true } });
  const cache = path.join(directory, 'uploads', 'cache', 'snapshots');
  mkdirSync(cache, { recursive: true });
  writeFileSync(path.join(cache, `${branch.id}.json`), JSON.stringify({ patch_id: branch.snapshotPatchId }));
  return { branch, fastify: { prisma, projectRoot: directory, log: app.log } as FastifyInstance };
}

describe('abandoned-future cleanup', () => {
  it('prunes abandoned descendants and preserves ancestor-target sessions', async () => {
    await abandonedFuture();
    await descendant();
    await session('ancestor', 'a1');
    await prisma.$transaction(tx => pruneAbandonedFuture(tx as ExtendedPrismaClient, 'a1'));
    expect(await prisma.patch.findUnique({ where: { id: 'a2' } })).toBeNull();
    expect(await prisma.patch.findUnique({ where: { id: 'descendant' } })).toBeNull();
    expect(await prisma.patch.findUniqueOrThrow({ where: { id: 'a1' } })).toMatchObject({ nextPatchId: null });
    expect(await prisma.rebaseSession.findUnique({ where: { id: 'ancestor' } })).not.toBeNull();
  });

  it('prunes after snapshot sync without advancing the edit version', async () => {
    await abandonedFuture();
    const { fastify, branch } = await snapshotFixture();
    await syncSnapshot(fastify, branch);
    expect(await prisma.patch.findUnique({ where: { id: 'a2' } })).toBeNull();
    expect(await prisma.ocrBranch.findUniqueOrThrow({ where: { id: 'admin-branch' } }))
      .toMatchObject({ headPatchId: 'a1', version: 3 });
  });

  it('does not mistake a concurrent admin append for abandoned history', async () => {
    await prisma.ocrBranch.update({ where: { id: 'admin-branch' }, data: { snapshotPatchId: 'a2' } });
    const { fastify, branch } = await snapshotFixture();
    // Snapshot sync still holds the captured a2 branch after another tab appends.
    await admin().applyPatch('v', { op: 'replace',
      path: '/pages/0/blocks/0/lines/0/text', old_value: 'admin2', value: 'admin3' }, 2);
    const before = await state();
    await syncSnapshot(fastify, branch);
    expect(await state()).toEqual(before);
  });
});
