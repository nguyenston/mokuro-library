import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestContext } from './helpers/testContext';
import { createTestContext, registerAndLogin, seedLibrary } from './helpers/testContext';

describe('contributions routes', () => {
  let ctx: TestContext;
  let cookieHeader: string;
  let deviceFingerprint: string;
  let volumeId: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    const auth = await registerAndLogin(ctx.app);
    cookieHeader = auth.cookieHeader;
    deviceFingerprint = auth.deviceFingerprint;
    const seeded = await seedLibrary(ctx.prisma, ctx.projectRoot, auth.user.id);
    volumeId = seeded.volume.id;

    await ctx.app.inject({
      method: 'GET',
      url: `/api/library/volume/${volumeId}`,
      headers: {
        cookie: cookieHeader,
        'x-device-fingerprint': deviceFingerprint
      },
    });
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it('returns contribution summary for the user', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/contributions/summary',
      headers: {
        cookie: cookieHeader,
        'x-device-fingerprint': deviceFingerprint
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      totalEdits: 0,
      editsMerged: 0,
      volumesEdited: 0,
      pendingReviewCount: 0,
      aheadCount: 0,
      pendingSubmissionsCount: 0,
      lastEditAt: null
    });
  });
});
