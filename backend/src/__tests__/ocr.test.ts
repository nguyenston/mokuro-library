import { describe, expect, it } from 'vitest';
import { patchBodySchema } from '../routes/ocr';

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
