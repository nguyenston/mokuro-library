import { describe, expect, it } from 'vitest';
import { CompressEngine } from '../lib/rebase/CompressEngine';
import type { PatchOperation } from '../types/history';

describe('CompressEngine', () => {
  it('compresses sequential replaces into a single replace', () => {
    const patches: PatchOperation[] = [
      { op: 'replace', path: '/pages/0/blocks/0/lines/0/text', value: 'b', old_value: 'a' },
      { op: 'replace', path: '/pages/0/blocks/0/lines/0/text', value: 'c', old_value: 'b' },
      { op: 'replace', path: '/pages/0/blocks/0/lines/0/text', value: 'd', old_value: 'c' }
    ];

    const result = CompressEngine.compress(patches);

    expect(result).toEqual([
      { op: 'replace', path: '/pages/0/blocks/0/lines/0/text', value: 'd', old_value: 'a' }
    ]);
  });

  it('keeps structural patches and compresses content after shifts', () => {
    const patches: PatchOperation[] = [
      { op: 'replace', path: '/pages/0/blocks/1/lines/0/text', value: 'b', old_value: 'a' },
      { op: 'remove', path: '/pages/0/blocks/0', old_value: { box: [0, 0, 1, 1], vertical: false, lines: [{ text: 'x', coords: [[0, 0], [1, 0], [1, 1], [0, 1]] }] } },
      { op: 'replace', path: '/pages/0/blocks/0/lines/0/text', value: 'c', old_value: 'b' }
    ];

    const result = CompressEngine.compress(patches);

    expect(result).toEqual([
      { op: 'remove', path: '/pages/0/blocks/0', old_value: { box: [0, 0, 1, 1], vertical: false, lines: [{ text: 'x', coords: [[0, 0], [1, 0], [1, 1], [0, 1]] }] } },
      { op: 'replace', path: '/pages/0/blocks/0/lines/0/text', value: 'c', old_value: 'a' }
    ]);
  });

  it('passes structural patches through unchanged', () => {
    const patches: PatchOperation[] = [
      { op: 'add', path: '/pages/0/blocks/0', value: { box: [0, 0, 1, 1], vertical: false, lines: [{ text: 'A', coords: [[0, 0], [1, 0], [1, 1], [0, 1]] }] } },
      { op: 'add', path: '/pages/0/blocks/1', value: { box: [0, 0, 1, 1], vertical: false, lines: [{ text: 'B', coords: [[0, 0], [1, 0], [1, 1], [0, 1]] }] } },
      { op: 'remove', path: '/pages/0/blocks/2', old_value: { box: [0, 0, 1, 1], vertical: false, lines: [{ text: 'C', coords: [[0, 0], [1, 0], [1, 1], [0, 1]] }] } }
    ];

    const result = CompressEngine.compress(patches);

    expect(result).toEqual(patches);
  });
});
