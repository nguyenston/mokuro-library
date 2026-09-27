import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { resolveNormalizedPath } from '../routes/files';
import type { TestContext } from './helpers/testContext';
import { createTestContext, registerAndLogin, seedLibrary } from './helpers/testContext';

describe('files routes', () => {
  let ctx: TestContext;
  let cookieHeader: string;
  let deviceFingerprint: string;
  let seriesId: string;
  let volumeId: string;
  let imageName: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    const auth = await registerAndLogin(ctx.app);
    cookieHeader = auth.cookieHeader;
    deviceFingerprint = auth.deviceFingerprint;
    const seeded = await seedLibrary(ctx.prisma, ctx.projectRoot, auth.user.id);
    seriesId = seeded.series.id;
    volumeId = seeded.volume.id;
    imageName = seeded.imageName;
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it('serves series cover images for authenticated users', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/files/series/${seriesId}/cover`,
      headers: {
        cookie: cookieHeader,
        'x-device-fingerprint': deviceFingerprint
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('image/');
  });

  it('serves volume page images for authenticated users', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/files/volume/${volumeId}/image/${imageName}`,
      headers: {
        cookie: cookieHeader,
        'x-device-fingerprint': deviceFingerprint
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('image/');
  });

  it('preserves directory names while resolving decomposed image filenames', async () => {
    const relativeDir = path.join('uploads', 'caf\u00e9');
    const diskName = 'cafe\u0301.png';
    const requestedName = 'caf\u00e9.png';
    const diskPath = path.join(ctx.projectRoot, relativeDir, diskName);
    await fs.mkdir(path.dirname(diskPath), { recursive: true });
    await fs.writeFile(diskPath, 'image');

    expect(await resolveNormalizedPath(ctx.projectRoot, path.join(relativeDir, diskName))).toBe(diskPath);
    expect(await resolveNormalizedPath(ctx.projectRoot, path.join(relativeDir, requestedName))).toBe(diskPath);
  });

  it('returns 404 for missing volume images', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/files/volume/${volumeId}/image/does-not-exist.png`,
      headers: {
        cookie: cookieHeader,
        'x-device-fingerprint': deviceFingerprint
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it('rejects images without device fingerprint', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/files/series/${seriesId}/cover`,
      headers: {
        cookie: cookieHeader,
        // NO x-device-fingerprint header - simulates browser <img> tag
      },
    });

    expect(response.statusCode).toBe(401);
  });
});
