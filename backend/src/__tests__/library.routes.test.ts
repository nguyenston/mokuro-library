import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestContext } from './helpers/testContext';
import { createTestContext, registerAndLogin, seedLibrary } from './helpers/testContext';

describe('library routes', () => {
  let ctx: TestContext;
  let cookieHeader: string;
  let deviceFingerprint: string;
  let seriesId: string;
  let volumeId: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    const auth = await registerAndLogin(ctx.app);
    cookieHeader = auth.cookieHeader;
    deviceFingerprint = auth.deviceFingerprint;
    const seeded = await seedLibrary(ctx.prisma, ctx.projectRoot, auth.user.id);
    seriesId = seeded.series.id;
    volumeId = seeded.volume.id;
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it('lists library items for the authenticated user', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/library?sort=title&order=asc&page=1',
      headers: {
        cookie: cookieHeader,
        'x-device-fingerprint': deviceFingerprint
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data.some((entry: { id: string }) => entry.id === seriesId)).toBe(true);
  });

  it('returns series details with volumes', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/library/series/${seriesId}`,
      headers: {
        cookie: cookieHeader,
        'x-device-fingerprint': deviceFingerprint
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.id).toBe(seriesId);
    expect(body.volumes.length).toBe(1);
  });

  it('returns volume data with computed mokuro state', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/library/volume/${volumeId}`,
      headers: {
        cookie: cookieHeader,
        'x-device-fingerprint': deviceFingerprint
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.id).toBe(volumeId);
    expect(body.mokuroData.pages.length).toBe(1);
    expect(body.versionInfo.branchId).toBeTruthy();
  });
});
