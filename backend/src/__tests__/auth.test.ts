import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestContext } from './helpers/testContext';
import { createTestContext } from './helpers/testContext';

type CookieMap = Record<string, string>;

const parseCookies = (setCookieHeader?: string | string[]): CookieMap => {
  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader].filter((value): value is string => typeof value === 'string');
  const result: CookieMap = {};
  for (const cookie of cookies) {
    const [pair] = cookie.split(';');
    const [name, value] = pair.split('=');
    if (name && value) result[name] = value;
  }
  return result;
};

describe('auth and csrf', () => {
	let ctx: TestContext;
	const testDeviceFingerprint = 'test-device-fingerprint-12345';

	beforeAll(async () => {
		ctx = await createTestContext();
	});

  afterAll(async () => {
		await ctx.cleanup();
  });

	it('issues session and csrf cookies on login', async () => {
		await ctx.app.inject({
			method: 'POST',
			url: '/api/auth/register',
			payload: { username: 'tester', password: 'Test123!' },
    });

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        username: 'tester',
        password: 'Test123!',
        deviceFingerprint: testDeviceFingerprint,
        rememberMe: false
      },
    });

    const cookies = parseCookies(response.headers['set-cookie']);
    expect(response.statusCode).toBe(200);
    expect(cookies.sessionId).toBeTruthy();
    expect(cookies.csrfToken).toBeTruthy();
    expect(cookies.refreshToken).toBeTruthy();
  });

	it('blocks state-changing requests without csrf token', async () => {
		const loginResponse = await ctx.app.inject({
			method: 'POST',
			url: '/api/auth/login',
			payload: {
        username: 'tester',
        password: 'Test123!',
        deviceFingerprint: testDeviceFingerprint,
        rememberMe: false
      },
    });
    const cookies = parseCookies(loginResponse.headers['set-cookie']);
    const cookieHeader = `sessionId=${cookies.sessionId}; csrfToken=${cookies.csrfToken}`;

    const blocked = await ctx.app.inject({
      method: 'POST',
      url: '/api/library/check',
      payload: { series_folder_name: 'series', volume_folder_name: 'vol1' },
      headers: {
        cookie: cookieHeader,
        'x-device-fingerprint': testDeviceFingerprint
      },
    });

    expect(blocked.statusCode).toBe(403);

    const allowed = await ctx.app.inject({
      method: 'POST',
      url: '/api/library/check',
      payload: { series_folder_name: 'series', volume_folder_name: 'vol1' },
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': cookies.csrfToken,
        'x-device-fingerprint': testDeviceFingerprint
      },
    });

    expect(allowed.statusCode).toBe(200);
  });

	it('locks out after repeated failed attempts', async () => {
		for (let i = 0; i < 5; i += 1) {
			await ctx.app.inject({
				method: 'POST',
				url: '/api/auth/login',
        payload: {
          username: 'tester',
          password: 'WrongPass!',
          deviceFingerprint: testDeviceFingerprint,
          rememberMe: false
        },
      });
    }

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        username: 'tester',
        password: 'WrongPass!',
        deviceFingerprint: testDeviceFingerprint,
        rememberMe: false
      },
    });

    expect(response.statusCode).toBe(429);
  });
});
