import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestContext } from './helpers/testContext';
import { createTestContext, registerAndLogin } from './helpers/testContext';

describe('settings routes', () => {
  let ctx: TestContext;
  let cookieHeader: string;
  let deviceFingerprint: string;
  let csrfToken: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    const auth = await registerAndLogin(ctx.app);
    cookieHeader = auth.cookieHeader;
    deviceFingerprint = auth.deviceFingerprint;
    csrfToken = auth.csrfToken;
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it('returns current user settings', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/settings',
      headers: {
        cookie: cookieHeader,
        'x-device-fingerprint': deviceFingerprint
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({});
  });

  it('updates settings with csrf protection', async () => {
    const response = await ctx.app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: {
        cookie: cookieHeader,
        'x-device-fingerprint': deviceFingerprint,
        'x-csrf-token': csrfToken
      },
      payload: { theme: 'midnight', reader: { zoom: 1.25 } },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ theme: 'midnight', reader: { zoom: 1.25 } });
  });
});
