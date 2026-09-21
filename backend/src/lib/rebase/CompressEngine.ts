import { PatchOperation } from '../../types/history';
import { Effect } from '../../types/rebase';
import { PatchTransformer } from './PatchTransformer';
import { EffectUtilities } from './Effect';

export class CompressEngine {
  /**
   * Compresses a sequence of patches from the same timeline.
   * Structural patches pass through unchanged; replace patches are merged.
   * Input operations are assumed to have passed PatchOperationValidator.
   */
  static compress(patches: PatchOperation[]): PatchOperation[] {
    const compressedStructural: PatchOperation[] = [];
    const compressedContent: PatchOperation[] = [];
    const working: Array<PatchOperation | null> = [...patches];

    for (let i = 0; i < working.length; i++) {
      const base = working[i];
      if (!base) continue;

      if (base.op !== 'replace') {
        compressedStructural.push(base);
        continue;
      }

      const effect = EffectUtilities.fromOperation(base);
      if (effect.type !== 'content') continue;

      const originalOld = effect.oldValue;
      const originalNew = effect.newValue;
      effect.oldValue = originalNew;
      effect.newValue = originalOld;

      let currentEffect: Effect = effect;

      for (let j = i + 1; j < working.length; j++) {
        const next = working[j];
        if (!next) continue;

        const result = PatchTransformer.transform(
          { id: `p${j}`, operation: next },
          currentEffect,
          { id: `p${i}`, operation: base },
          'keep_mine'
        );

        if (!result.success) {
          throw new Error('Compression encountered an unexpected conflict');
        }

        working[j] = result.op;
        currentEffect = result.effect;
      }

      if (currentEffect.type !== 'identity') {
        const compressed = EffectUtilities.toOperation(currentEffect);
        if (!compressed) {
          throw new Error('Failed to materialize compressed effect');
        }
        if (compressed.op !== 'replace') {
          throw new Error('Compression produced a non-replace operation');
        }
        compressed.old_value = originalOld;
        compressed.value = originalNew;
        compressedContent.push(compressed);
      }
    }

    return [...compressedStructural, ...compressedContent];
  }
}
