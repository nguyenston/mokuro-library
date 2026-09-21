import { PatchOperation } from '../../types/history';
import { Effect, ShiftDownEffect, ShiftUpEffect } from '../../types/rebase';
import { PathUtils, Permutation } from './rebaseUtils';

export class EffectUtilities {
  /**
   * Converts an Admin Patch Operation into a mathematical Effect (The Wave).
   * The operation is assumed to have passed PatchOperationValidator.
   */
  static fromOperation(op: PatchOperation): Effect {
    const { op: opType, path } = op;

    // 1. Add -> Shift Up
    if (opType === 'add') {
      const parts = PathUtils.parse(path);
      const lastSegment = parts[parts.length - 1];
      const index = parseInt(lastSegment, 10);

      if (!isNaN(index)) {
        // e.g. /blocks/5 -> Shift items >= 5 up by 1
        // The path stored in effect is the *parent* array path
        const parentPath = PathUtils.compile(parts.slice(0, -1));
        return {
          type: 'shift_up',
          path: parentPath,
          index: index,
          newValue: op.value
        };
      }
    }

    // 2. Remove -> Shift Down (Dead Zone)
    if (opType === 'remove') {
      const parts = PathUtils.parse(path);
      const lastSegment = parts[parts.length - 1];
      const index = parseInt(lastSegment, 10);

      if (!isNaN(index)) {
        const parentPath = PathUtils.compile(parts.slice(0, -1));
        return {
          type: 'shift_down',
          path: parentPath,
          index: index,
          deletedValue: op.old_value // Critical for resurrection
        };
      }
    }

    // 3. Reorder -> Permute
    if (opType === 'reorder') {
      return {
        type: 'permute',
        path: path,
        permutation: op.new_order
      };
    }

    // 4. Replace -> Content Change
    if (opType === 'replace') {
      return {
        type: 'content',
        path: path,
        newValue: op.value,
        oldValue: op.old_value
      };
    }

    // Fallback / Unknown / Irrelevant -> Identity
    return {
      type: 'identity',
      path: '/'
    };
  }

  static toOperation(effect: Effect): PatchOperation | null {
    if (effect.type === 'identity') return null;

    if (effect.type === 'shift_up') {
      return {
        op: 'add',
        path: this.joinPath(effect.path, effect.index),
        value: effect.newValue
      };
    }

    if (effect.type === 'shift_down') {
      return {
        op: 'remove',
        path: this.joinPath(effect.path, effect.index),
        old_value: effect.deletedValue
      };
    }

    if (effect.type === 'permute') {
      return {
        op: 'reorder',
        path: effect.path,
        new_order: effect.permutation
      };
    }

    if (effect.type === 'content') {
      return {
        op: 'replace',
        path: effect.path,
        value: effect.newValue,
        old_value: effect.oldValue
      };
    }

    return null;
  }

  private static joinPath(path: string, index: number): string {
    const prefix = path === '/' ? '' : path;
    return `${prefix}/${index}`;
  }
}
