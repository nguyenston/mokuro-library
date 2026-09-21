import { describe, expect, it } from 'vitest';
import {
  parsePatchOperation,
  parseStoredPatchOperation,
  patchOperationSchema
} from '../lib/PatchOperationValidator';

const quad = [[0, 0], [1, 0], [1, 1], [0, 1]];
const line = { text: 'line', coords: quad };
const block = { box: [0, 0, 1, 1], vertical: false, lines: [line] };

describe('PatchOperationValidator', () => {
  it.each([
    { op: 'genesis', path: 'volume.mokuro' },
    {
      op: 'replace',
      path: '/pages/0/blocks/1/box',
      value: [1, 2, 3, 4],
      old_value: [0, 1, 2, 3]
    },
    {
      op: 'replace',
      path: '/pages/0/blocks/1/lines/2/text',
      value: 'new',
      old_value: 'old'
    },
    { op: 'add', path: '/pages/0/blocks/1', value: block },
    { op: 'add', path: '/pages/0/blocks/1/lines/2', value: line },
    { op: 'remove', path: '/pages/0/blocks/1', old_value: block },
    { op: 'remove', path: '/pages/0/blocks/1/lines/2', old_value: line },
    { op: 'reorder', path: '/pages/0/blocks', new_order: [2, 0, 1] },
    { op: 'reorder', path: '/pages/0/blocks/1/lines', new_order: [1, 0] }
  ])('accepts $op at $path', operation => {
    expect(() => parsePatchOperation(operation)).not.toThrow();
  });

  it.each([
    { op: 'replace', path: '/', value: 'new', old_value: 'old' },
    { op: 'replace', path: '/pages/0/blocks/1/text', value: 'new', old_value: 'old' },
    { op: 'add', path: '/pages/0/blocks', value: block },
    { op: 'remove', path: '/pages/0/blocks/1/box', old_value: [0, 0, 1, 1] },
    { op: 'reorder', path: '/pages/0/blocks/1', new_order: [0] },
    { op: 'reorder', path: '/', new_order: [0] }
  ])('rejects $op at $path', operation => {
    expect(patchOperationSchema.safeParse(operation).success).toBe(false);
  });

  it('requires replace values to match the addressed field', () => {
    expect(patchOperationSchema.safeParse({
      op: 'replace',
      path: '/pages/0/blocks/1/vertical',
      value: 'false',
      old_value: false
    }).success).toBe(false);
  });

  it('requires coarse values to match the addressed element type', () => {
    expect(patchOperationSchema.safeParse({
      op: 'add',
      path: '/pages/0/blocks/1/lines/0',
      value: block
    }).success).toBe(false);
  });

  it.each([
    [1, 1],
    [0, 2],
    [-1, 0],
    [0, 1.5]
  ])('rejects an invalid permutation %j', newOrder => {
    expect(patchOperationSchema.safeParse({
      op: 'reorder',
      path: '/pages/0/blocks',
      new_order: newOrder
    }).success).toBe(false);
  });

  it('parses and validates serialized operations', () => {
    expect(parseStoredPatchOperation(JSON.stringify({
      op: 'reorder',
      path: '/pages/0/blocks',
      new_order: [1, 0]
    }))).toEqual({
      op: 'reorder',
      path: '/pages/0/blocks',
      new_order: [1, 0]
    });
  });

  it('distinguishes invalid JSON from an invalid stored operation', () => {
    expect(() => parseStoredPatchOperation('{', 'patch p1')).toThrow('Invalid JSON in patch p1');
    expect(() => parseStoredPatchOperation('{}', 'patch p2')).toThrow('Invalid patch p2');
  });
});
