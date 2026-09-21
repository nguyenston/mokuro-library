import { Quad, Rect } from './mokuro';

// --- 1. Value Types ---

// Fine Values: Used for 'replace' operations on leaf nodes.
export type FineValue =
  | string  // For text content
  | boolean // For 'vertical' flag
  | number  // For 'font_size'
  | Rect    // For block 'box'
  | Quad;   // For line 'coords'

// --- 2. Coarse / Unified Values ---

// UnifiedLine: Merges the split arrays (lines + lines_coords) into one atomic unit.
export interface UnifiedLine {
  text: string;
  coords: Quad;
}

// UnifiedBlock: Represents a full block structure.
export interface UnifiedBlock {
  box: Rect;
  vertical: boolean;
  font_size?: number;
  lines: UnifiedLine[];
}

export type CoarseValue = UnifiedBlock | UnifiedLine;

// --- 3. The Patch Operation ---
export type OpType = 'replace' | 'add' | 'remove' | 'reorder' | 'genesis';

export type PatchOperation =
  | { op: 'genesis'; path: string }
  | { op: 'replace'; path: string; value: FineValue; old_value: FineValue }
  | { op: 'add'; path: string; value: CoarseValue }
  | { op: 'remove'; path: string; old_value: CoarseValue }
  | { op: 'reorder'; path: string; new_order: number[] };

// --- 4. Network Payload Types ---

export interface ApplyPatchRequest {
  operation: PatchOperation;
  branchVersion: number;
}

export interface ApplyPatchResponse {
  success: boolean;
  newHeadId: string;
  newVersion: number;
  patch: PatchOperation;  // Echo back (with any server-side normalization)
}

export interface UndoRequest {
  branchVersion: number;
}

export interface UndoResponse {
  success: boolean;
  newHeadId: string;
  newVersion: number;
  patch: PatchOperation;      // Inverse patch to apply locally
  draggedToUser?: string;     // Admin only: user who received dragged patches
}

export interface RedoRequest {
  branchVersion: number;
}

export interface RedoResponse {
  success: boolean;
  newHeadId: string;
  newVersion: number;
  patch: PatchOperation;      // Re-applied patch to apply locally
}

export interface BranchStatusResponse {
  hasAhead: number;          // User has patches admin doesn't have
  hasBehind: number;         // Admin has patches user doesn't have
  version: number;
  headPatchId: string;
}

export interface VolumeStateResponse {
  data: import('./mokuro').MokuroData;
  headPatchId: string;
  version: number;
  hasAhead: number;
  hasBehind: number;
}
