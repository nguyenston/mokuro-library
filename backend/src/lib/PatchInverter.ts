import { PatchOperation } from '../types/history';
import { Permutation } from './rebase/rebaseUtils';

export class PatchInverter {
  /** Invert an operation that has already passed PatchOperationValidator. */
  static invert(patch: PatchOperation): PatchOperation {
    switch (patch.op) {
      case 'genesis':
        return structuredClone(patch);

      case 'replace':
        return {
          op: 'replace',
          path: patch.path,
          value: patch.old_value,
          old_value: patch.value
        };

      case 'add':
        return {
          op: 'remove',
          path: patch.path,
          old_value: patch.value
        };

      case 'remove':
        return {
          op: 'add',
          path: patch.path,
          value: patch.old_value
        };

      case 'reorder':
        return {
          op: 'reorder',
          path: patch.path,
          new_order: Permutation.invert(patch.new_order)
        };
    }
  }
}
