import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import ocrRoutes, { officializeBodySchema, patchBodySchema, resetBodySchema } from '../routes/ocr';
import { HttpError } from '../types/error';
import type { IAPIAccessStrategy } from '../lib/strategies/IAPIAccessStrategy';

describe('ocr patch validation', () => {
  it('accepts a valid replace operation', () => {
    const result = patchBodySchema.safeParse({
      operation: {
        op: 'replace',
        path: '/pages/0/blocks/0/lines/0/text',
        value: 'new',
        old_value: 'old'
      },
      branchVersion: 1
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid patch paths', () => {
    const result = patchBodySchema.safeParse({
      operation: {
        op: 'replace',
        path: 'bad-path',
        value: 'new',
        old_value: 'old'
      },
      branchVersion: 1
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid reorder permutations', () => {
    const result = patchBodySchema.safeParse({
      operation: {
        op: 'reorder',
        path: '/pages/0/blocks',
        new_order: [1, 1]
      },
      branchVersion: 1
    });

    expect(result.success).toBe(false);
  });
});

describe('OCR reset validation', () => {
  it('exposes the confirmation code and forwards explicit forced requests', async () => {
    const app = Fastify();
    const reset = vi.fn().mockRejectedValueOnce(new HttpError(409, 'Confirmation required',
      'REVIEW_CANCELLATION_CONFIRMATION_REQUIRED')).mockResolvedValue(undefined);
    app.decorate('authenticate', async () => {});
    app.decorateRequest('accessStrategy', null as unknown as IAPIAccessStrategy);
    app.addHook('preHandler', async request => {
      request.accessStrategy = { reset } as unknown as IAPIAccessStrategy;
    });
    await app.register(ocrRoutes);
    try {
      const blocked = await app.inject({ method: 'POST', url: '/volume/volume/reset', payload: { branchVersion: 3 } });
      expect(blocked.statusCode).toBe(409);
      expect(blocked.json().code).toBe('REVIEW_CANCELLATION_CONFIRMATION_REQUIRED');
      expect(reset).toHaveBeenLastCalledWith('volume', 3, false);
      const confirmed = await app.inject({ method: 'POST', url: '/volume/volume/reset',
        payload: { branchVersion: 3, forced: true } });
      expect(confirmed.json()).toEqual({ success: true });
      expect(reset).toHaveBeenLastCalledWith('volume', 3, true);
      const invalid = await app.inject({ method: 'POST', url: '/volume/volume/reset', payload: { forced: true } });
      expect(invalid.statusCode).toBe(400);
      expect(reset).toHaveBeenCalledTimes(2);
    } finally {
      await app.close();
    }
  });
  it('defaults forced to false and accepts explicit confirmation', () => {
    expect(resetBodySchema.parse({ branchVersion: 3 })).toEqual({ branchVersion: 3, forced: false });
    expect(resetBodySchema.parse({ branchVersion: 3, forced: true })).toEqual({ branchVersion: 3, forced: true });
  });
  it.each([undefined, {}, { forced: true }, { branchVersion: -1 }, { branchVersion: 1.5 },
    { branchVersion: '3' }, { branchVersion: 3, forced: 'true' }])('rejects invalid reset body %o', body => {
    expect(resetBodySchema.safeParse(body).success).toBe(false);
  });
});

describe('OCR officialize validation', () => {
  it('accepts the frozen review head', () => {
    const result = officializeBodySchema.safeParse({
      sourceBranchUserId: 'contributor',
      reviewHeadPatchId: 'review-head'
    });

    expect(result.success).toBe(true);
  });

  it.each([
    { sourceBranchUserId: 'contributor' },
    { sourceBranchUserId: 'contributor', sourceBranchVersion: 4 },
    { sourceBranchUserId: 'contributor', reviewHeadPatchId: null },
    { sourceBranchUserId: 'contributor', reviewHeadPatchId: '' },
    { sourceBranchUserId: 'contributor', reviewHeadPatchId: 4 }
  ])('rejects a missing or invalid frozen review head: %o', (body) => {
    expect(officializeBodySchema.safeParse(body).success).toBe(false);
  });
});
