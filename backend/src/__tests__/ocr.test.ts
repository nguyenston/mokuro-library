import { describe, expect, it } from 'vitest';
import { officializeBodySchema, patchBodySchema } from '../routes/ocr';

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
