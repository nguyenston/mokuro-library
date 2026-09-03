import { describe, expect, it } from 'vitest';
import { EffectUtilities } from '../lib/rebase/Effect';
import { PatchTransformer } from '../lib/rebase/PatchTransformer';
import type { PatchOperation } from '../types/history';

interface OracleItem {
  id: string;
  text: string;
}

const ARRAY_PATH = '/pages/0/blocks';

/** Creates a fresh object graph so oracle mutations cannot affect production state. */
function buildItems(size: number): OracleItem[] {
  return Array.from({ length: size }, (_, index) => ({
    id: `item-${index}`,
    text: `text-${index}`
  }));
}

/** Applies the serialized new-index-to-old-index reorder representation. */
function applySerializedReorder<T>(items: T[], newOrder: number[]): T[] {
  return newOrder.map((oldIndex) => items[oldIndex]);
}

/** Generates permutations independently of the production permutation utilities. */
function generatePermutations(size: number): number[][] {
  const permutations: number[][] = [];

  function visit(prefix: number[], remaining: number[]): void {
    if (remaining.length === 0) {
      permutations.push(prefix);
      return;
    }

    for (let index = 0; index < remaining.length; index++) {
      visit(
        [...prefix, remaining[index]],
        [...remaining.slice(0, index), ...remaining.slice(index + 1)]
      );
    }
  }

  visit([], Array.from({ length: size }, (_, index) => index));
  return permutations;
}

/** Reads the item index from the generic paths used by these pure transformer tests. */
function itemIndex(path: string): number {
  const match = /^\/pages\/0\/blocks\/(\d+)\/text$/.exec(path);
  if (!match) throw new Error(`Unexpected item path: ${path}`);
  return Number(match[1]);
}

/** Reduces object state to stable values for comparisons across independent graphs. */
function snapshot(items: OracleItem[]): Array<{ id: string; text: string }> {
  return items.map(({ id, text }) => ({ id, text }));
}

describe('rebase permutation state equivalence', () => {
  it('transports user edits through every admin reorder by object identity', () => {
    for (let size = 1; size <= 6; size++) {
      for (const adminOrder of generatePermutations(size)) {
        for (let targetIndex = 0; targetIndex < size; targetIndex++) {
          const oracleBase = buildItems(size);
          const oracleTarget = oracleBase[targetIndex];
          const expected = applySerializedReorder(oracleBase, adminOrder);
          oracleTarget.text = 'user-edit';

          const productionBase = buildItems(size);
          const adminOperation: PatchOperation = {
            op: 'reorder',
            path: ARRAY_PATH,
            new_order: adminOrder
          };
          const userOperation: PatchOperation = {
            op: 'replace',
            path: `${ARRAY_PATH}/${targetIndex}/text`,
            value: 'user-edit',
            old_value: `text-${targetIndex}`
          };
          const result = PatchTransformer.transform(
            { id: 'user', operation: userOperation },
            EffectUtilities.fromOperation(adminOperation),
            { id: 'admin', operation: adminOperation }
          );

          expect(result.success).toBe(true);
          if (!result.success || result.op?.op !== 'replace') {
            throw new Error('Expected a transformed replace operation');
          }

          const actual = applySerializedReorder(productionBase, adminOrder);
          actual[itemIndex(result.op.path)].text = result.op.value as string;
          expect(snapshot(actual)).toEqual(snapshot(expected));
        }
      }
    }
  });

  it('transports admin content effects through every user reorder by object identity', () => {
    for (let size = 1; size <= 6; size++) {
      for (const userOrder of generatePermutations(size)) {
        for (let targetIndex = 0; targetIndex < size; targetIndex++) {
          const oracleBase = buildItems(size);
          const oracleTarget = oracleBase[targetIndex];
          const expected = applySerializedReorder(oracleBase, userOrder);
          oracleTarget.text = 'admin-edit';

          const productionBase = buildItems(size);
          const adminOperation: PatchOperation = {
            op: 'replace',
            path: `${ARRAY_PATH}/${targetIndex}/text`,
            value: 'admin-edit',
            old_value: `text-${targetIndex}`
          };
          const userOperation: PatchOperation = {
            op: 'reorder',
            path: ARRAY_PATH,
            new_order: userOrder
          };
          const result = PatchTransformer.transform(
            { id: 'user', operation: userOperation },
            EffectUtilities.fromOperation(adminOperation),
            { id: 'admin', operation: adminOperation }
          );

          expect(result.success).toBe(true);
          if (!result.success || result.op?.op !== 'reorder' || result.effect.type !== 'content') {
            throw new Error('Expected a reorder operation and transported content effect');
          }

          const actual = applySerializedReorder(productionBase, result.op.new_order);
          actual[itemIndex(result.effect.path)].text = result.effect.newValue as string;
          expect(snapshot(actual)).toEqual(snapshot(expected));
        }
      }
    }
  });

  it('preserves the user order for keep_mine reorder collisions', () => {
    for (let size = 1; size <= 4; size++) {
      const permutations = generatePermutations(size);
      for (const adminOrder of permutations) {
        for (const userOrder of permutations) {
          const oracleBase = buildItems(size);
          const expected = applySerializedReorder(oracleBase, userOrder);

          const productionBase = buildItems(size);
          const adminOperation: PatchOperation = {
            op: 'reorder',
            path: ARRAY_PATH,
            new_order: adminOrder
          };
          const userOperation: PatchOperation = {
            op: 'reorder',
            path: ARRAY_PATH,
            new_order: userOrder
          };
          const result = PatchTransformer.transform(
            { id: 'user', operation: userOperation },
            EffectUtilities.fromOperation(adminOperation),
            { id: 'admin', operation: adminOperation },
            'keep_mine'
          );

          expect(result.success).toBe(true);
          if (!result.success || result.op?.op !== 'reorder') {
            throw new Error('Expected a rewritten user reorder operation');
          }

          const adminState = applySerializedReorder(productionBase, adminOrder);
          const actual = applySerializedReorder(adminState, result.op.new_order);
          expect(snapshot(actual)).toEqual(snapshot(expected));
        }
      }
    }
  });

  it('preserves following user edits when keep_admin drops a reorder collision', () => {
    for (let size = 1; size <= 4; size++) {
      const permutations = generatePermutations(size);
      for (const adminOrder of permutations) {
        for (const userOrder of permutations) {
          const adminOperation: PatchOperation = {
            op: 'reorder',
            path: ARRAY_PATH,
            new_order: adminOrder
          };
          const userOperation: PatchOperation = {
            op: 'reorder',
            path: ARRAY_PATH,
            new_order: userOrder
          };
          const collision = PatchTransformer.transform(
            { id: 'user-reorder', operation: userOperation },
            EffectUtilities.fromOperation(adminOperation),
            { id: 'admin', operation: adminOperation },
            'keep_admin'
          );

          expect(collision.success).toBe(true);
          if (!collision.success || collision.op !== null) {
            throw new Error('Expected keep_admin to drop the user reorder');
          }

          for (let targetIndex = 0; targetIndex < size; targetIndex++) {
            const oracleBase = buildItems(size);
            const oracleTarget = oracleBase[targetIndex];
            const userState = applySerializedReorder(oracleBase, userOrder);
            const authoredIndex = userState.indexOf(oracleTarget);
            const expected = applySerializedReorder(oracleBase, adminOrder);
            oracleTarget.text = 'user-edit';

            const followingOperation: PatchOperation = {
              op: 'replace',
              path: `${ARRAY_PATH}/${authoredIndex}/text`,
              value: 'user-edit',
              old_value: `text-${targetIndex}`
            };
            const following = PatchTransformer.transform(
              { id: 'user-edit', operation: followingOperation },
              collision.effect,
              { id: 'admin', operation: adminOperation }
            );

            expect(following.success).toBe(true);
            if (!following.success || following.op?.op !== 'replace') {
              throw new Error('Expected the following replace operation to survive');
            }

            const actual = applySerializedReorder(buildItems(size), adminOrder);
            actual[itemIndex(following.op.path)].text = following.op.value as string;
            expect(snapshot(actual)).toEqual(snapshot(expected));
          }
        }
      }
    }
  });
});
