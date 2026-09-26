import { PatchOperation, CoarseValue, FineValue } from './history';

/** The captured rebase state no longer matches persisted branch/review state. */
export class RebaseStateChangedError extends Error {
  constructor() {
    super('Branch or review changed. Please refresh.');
    this.name = 'RebaseStateChangedError';
  }
}

// --- 0. Extended Patch (Database + Content) ---

export interface ExtendedPatch {
  id: string;
  operation: PatchOperation;
}

// --- 1. Effects (The Wave) ---

export type EffectType =
  | 'identity'
  | 'shift_down'
  | 'shift_up'
  | 'permute'
  | 'content';

export interface BaseEffect {
  type: EffectType;
  path: string;
}

export interface IdentityEffect extends BaseEffect {
  type: 'identity';
}

export interface ShiftDownEffect extends BaseEffect {
  type: 'shift_down';
  index: number;
  deletedValue: CoarseValue;
}

export interface ShiftUpEffect extends BaseEffect {
  type: 'shift_up';
  index: number;
  newValue: CoarseValue;
}

export interface PermuteEffect extends BaseEffect {
  type: 'permute';
  permutation: number[];  // Serialized source map: new index -> old index.
}

export interface ContentEffect extends BaseEffect {
  type: 'content';
  newValue: FineValue;
  oldValue: FineValue;
}

export type Effect =
  | IdentityEffect
  | ShiftDownEffect
  | ShiftUpEffect
  | PermuteEffect
  | ContentEffect;

// --- 2. Conflicts & Resolutions ---

export type ConflictReason =
  | 'shift_down_into_add'    // Auto: direct_hit shift_down + add
  | 'effect_shift'           // Auto: descendant_hit, user add/reorder shifts effect
  | 'double_delete'          // Auto: both deleted same thing
  | 'dead_zone'              // User choice: admin deleted, user edited inside
  | 'reverse_dead_zone'      // User choice: admin edited inside, user deleted
  | 'reorder_collision'      // User choice: both reordered same array
  | 'content_conflict';      // User choice: both edited same field

export interface Conflict {
  reason: ConflictReason;
  userPatch: ExtendedPatch;
  adminPatch: ExtendedPatch;
}

export type ResolutionType = 'keep_admin' | 'keep_mine';

export interface Resolution {
  adminPatchId: string;
  patchId: string;
  resolution: ResolutionType;
}

// --- 3. Engine Output ---

export type TransformResult =
  | {
    success: true;
    op: PatchOperation | null;
    effect: Effect;
    hadConflict: boolean;
  }
  | {
    success: false;
    conflict: Conflict;
  };

export type RebaseResult =
  | {
    status: 'complete';
    finalPatches?: PatchOperation[];
  }
  | {
    status: 'paused';
    rebaseId: string;
    conflict: Conflict;
  };
