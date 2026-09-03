import { describe, expect, it } from 'vitest';
import { EffectUtilities } from '../lib/rebase/Effect';
import { PatchTransformer } from '../lib/rebase/PatchTransformer';
import type { PatchOperation } from '../types/history';

const block = {
  box: [0, 0, 1, 1] as [number, number, number, number],
  vertical: false,
  lines: []
};

/** Transform one user operation through one admin operation without database setup. */
function transform(userOperation: PatchOperation, adminOperation: PatchOperation) {
  const userPatch = { id: 'user', operation: userOperation };
  const adminPatch = { id: 'admin', operation: adminOperation };
  return PatchTransformer.transform(
    userPatch,
    EffectUtilities.fromOperation(adminOperation),
    adminPatch
  );
}

describe('rebase structural path transport', () => {
  it('moves an adjacent user add down after an admin removal', () => {
    const result = transform(
      { op: 'add', path: '/pages/0/blocks/2', value: block },
      { op: 'remove', path: '/pages/0/blocks/1', old_value: block }
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.op?.path).toBe('/pages/0/blocks/1');
  });

  it('moves an adjacent user remove down after an admin removal', () => {
    const result = transform(
      { op: 'remove', path: '/pages/0/blocks/2', old_value: block },
      { op: 'remove', path: '/pages/0/blocks/1', old_value: block }
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.op?.path).toBe('/pages/0/blocks/1');
  });
});
