import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestContext } from './helpers/testContext';
import { createTestContext, registerAndLogin, seedLibrary } from './helpers/testContext';

describe('metadata routes', () => {
  let ctx: TestContext;
  let cookieHeader: string;
  let deviceFingerprint: string;
  let csrfToken: string;
  let seriesId: string;
  let volumeId: string;
  let userId: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    const auth = await registerAndLogin(ctx.app);
    cookieHeader = auth.cookieHeader;
    deviceFingerprint = auth.deviceFingerprint;
    csrfToken = auth.csrfToken;
    userId = auth.user.id;
    const seeded = await seedLibrary(ctx.prisma, ctx.projectRoot, userId);
    seriesId = seeded.series.id;
    volumeId = seeded.volume.id;
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it('returns default progress when none exists', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/metadata/volume/${volumeId}/progress`,
      headers: {
        cookie: cookieHeader,
        'x-device-fingerprint': deviceFingerprint
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      page: 1,
      timeRead: 0,
      charsRead: 0,
      completed: false,
    });
  });

  it('updates volume progress with csrf protection', async () => {
    const response = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/metadata/volume/${volumeId}/progress`,
      headers: {
        cookie: cookieHeader,
        'x-device-fingerprint': deviceFingerprint,
        'x-csrf-token': csrfToken
      },
      payload: { page: 1, completed: true },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.completed).toBe(true);
  });

  it('updates series metadata and user settings', async () => {
    const response = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/metadata/series/${seriesId}`,
      headers: {
        cookie: cookieHeader,
        'x-device-fingerprint': deviceFingerprint,
        'x-csrf-token': csrfToken
      },
      payload: { title: 'Updated Title', bookmarked: true, organized: true },
    });

    expect(response.statusCode).toBe(200);

    const series = await ctx.prisma.series.findUnique({ where: { id: seriesId } });
    const settings = await ctx.prisma.userSeriesSettings.findUnique({
      where: { userId_seriesId: { userId, seriesId } },
    });

    expect(series?.title).toBe('Updated Title');
    expect(settings?.bookmarked).toBe(true);
    expect(settings?.organized).toBe(true);
  });

  it('updates volume display title', async () => {
    const response = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/metadata/volume/${volumeId}`,
      headers: {
        cookie: cookieHeader,
        'x-device-fingerprint': deviceFingerprint,
        'x-csrf-token': csrfToken
      },
      payload: { title: 'Updated Volume' },
    });

    expect(response.statusCode).toBe(200);
    const volume = await ctx.prisma.volume.findUnique({ where: { id: volumeId } });
    expect(volume?.title).toBe('Updated Volume');
  });

  it('rejects state-changing requests without device fingerprint', async () => {
    const response = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/metadata/volume/${volumeId}/progress`,
      headers: {
        cookie: cookieHeader,
        // NO x-device-fingerprint header
        'x-csrf-token': csrfToken
      },
      payload: { page: 2, completed: false },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().message).toBe('Device fingerprint required for all authenticated requests');
  });
});
