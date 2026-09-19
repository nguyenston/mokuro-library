export type Quad = [[number, number], [number, number], [number, number], [number, number]];

export type Rect = [number, number, number, number];

// --- Type definitions Reader GET ---
export interface MokuroBlock {
  box: Rect;
  lines_coords: Quad[];
  lines: string[];
  vertical?: boolean;
  font_size?: number;
  domElement?: HTMLDivElement;
}
export interface MokuroPage {
  img_width: number;
  img_height: number;
  blocks: MokuroBlock[];
  img_path: string;
}
export interface MokuroData {
  patch_id?: string;
  title?: string;
  title_uuid?: string;
  volume?: string;
  pages: MokuroPage[];
}

export interface Volume {
  id: string;
  title: string;
  folderName: string;
  seriesId: string;
  pageCount: number;
  coverImageName: string | null;
  progress: UserProgress[];
  mokuroData: MokuroData;
  versionInfo: {
    branchId: string;
    headPatchId: string;
    branchVersion: number;
    hasAhead: number;
    hasBehind: number;
    reviewHeadPatchId: string | null;
    reviewRequestedAt?: string | null;
    rejectionReason?: string | null;
  };
}

// --- Core Library Types ---

export interface UserProgress {
  page: number;
  completed: boolean;
  timeRead: number;
  charsRead: number;
  lastReadAt?: string;
}

export interface Series {
  id: string;
  title: string | null;
  japaneseTitle: string | null;
  romajiTitle: string | null;
  synonyms: string | null;
  description: string | null;
  folderName: string;
  coverPath: string | null;
  sortTitle: string;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
  // Flattened User Settings
  bookmarked: boolean;
  status: number;
  organized: boolean;
  lastReadAt: Date;
  isOfficial: boolean;
  canEdit: boolean;
  // Progress Stats (Cached)
  totalPageCount: number;
  totalVolumeCount: number;
  readPageCount: number;
  completedVolumeCount: number;

  volumes?: Volume[]; // Optional, present in Detail View
}

export type PaginationData = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// Union for Selection State
export type LibraryItem = Series | Volume;

// --- Upload Pipeline Types ---

export interface UploadJob {
  id: string;
  name: string;
  files: File[];
  status: 'pending' | 'uploading' | 'processing' | 'done' | 'error';
  progress: number;
  resultMsg?: string;
  seriesFolderName: string;
  volumeFolderName: string;
  metadata: {
    seriesTitle?: string | null;
    seriesDescription?: string | null;
    seriesBookmarked?: boolean;
    volumeTitle?: string | null;
    volumeProgress?: { page: number; completed: boolean } | null;
  };
}

export interface DirNode {
  name: string;
  fullPath: string;
  files: File[];
  children: Map<string, DirNode>;
}

export interface SeriesMetadata {
  series: {
    title: string | null;
    description?: string | null;
    bookmarked?: boolean;
  };
  volumes: Record<
    string,
    {
      displayTitle: string | null;
      progress?: { page: number; completed: boolean } | null;
    }
  >;
}

export interface SyncUploadResponse {
  message: 'Upload processed.';
  processed: 1;
  volumeId: string;
}

export interface AsyncUploadResponse {
  message: 'Upload queued.';
  jobId: string;
}

// The combined Union Type
export type UploadResponse = SyncUploadResponse | AsyncUploadResponse | string;

// --- OCR Editing types ---

// Fine Values: Used for 'replace' operations on leaf nodes.
export type FineValue =
  | string // For text content
  | boolean // For 'vertical' flag
  | number // For 'font_size'
  | Rect // For block 'box'
  | Quad; // For line 'coords'

// --- Coarse / Unified Values ---

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

export type PatchValue = FineValue | UnifiedBlock | UnifiedLine;

// --- The Patch Operation ---
export type OpType = 'replace' | 'add' | 'remove' | 'reorder' | 'genesis';

export type PatchOperation =
  | { op: 'genesis'; path: string }
  | { op: 'replace'; path: string; value: PatchValue; old_value: PatchValue }
  | { op: 'add'; path: string; value: PatchValue }
  | { op: 'remove'; path: string; old_value: PatchValue }
  | { op: 'reorder'; path: string; new_order: number[] };

// --- Submission & Contribution Types ---

export interface SubmissionComment {
  id: string;
  content: string;
  createdAt: string;
  submissionId: string;
  userId: string;
  user: {
    id: string;
    username: string;
  };
}

export interface SubmissionVolumeDetail {
  id: string;
  title: string | null;
  folderName: string;
  pageCount: number;
  coverImageName: string | null;
  seriesId: string;
}

export interface SubmissionDetail {
  id: string;
  userId: string;
  status: 'pending' | 'accepted' | 'rejected';

  // Target logic: Null means "Create New", String means "Append to Existing"
  targetSeriesId: string | null;
  sourceSeriesId: string;

  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;

  // --- Relations ---
  user: {
    username: string;
  };

  sourceSeries: {
    id: string;
    sortTitle: string;
  };

  targetSeries: {
    id: string;
    sortTitle: string;
  } | null;

  volumes: SubmissionVolumeDetail[];
  comments: SubmissionComment[];
}

export interface SubmissionEntry {
  id: string;
  userId: string;
  status: 'pending' | 'accepted' | 'rejected';

  // --- Relations ---
  user: {
    username: string;
  };

  sourceSeries: {
    sortTitle: string;
  };

  targetSeries: {
    sortTitle: string;
  } | null;

  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  _count: { volumes: number };
}

export interface ContributionsSummary {
  aheadCount: number;
  pendingSubmissionsCount: number;
  pendingReviewCount: number;
  totalEdits: number;
  editsMerged: number;
  volumesEdited: number;
  lastEditAt: string | null;
}

// --- Rebase Types ---

/**
 * The Strict Resolution accepted by the Backend API.
 */
export type RebaseResolution = 'keep_admin' | 'keep_mine';

/**
 * Only the conflict reasons that result in a pause (User Intervention).
 * Automatic conflicts (shift_down_into_add, effect_shift, double_delete)
 * are resolved by the engine and never returned to the UI.
 */
export type RebaseConflictReason =
  | 'dead_zone'           // Admin deleted node, User edited inside it
  | 'reverse_dead_zone'   // Admin edited node, User deleted it
  | 'reorder_collision'   // Both reordered the same array
  | 'content_conflict';   // Both edited the same value

/**
 * A patch combined with its database ID.
 */
export interface ExtendedPatch {
  id: string;
  operation: PatchOperation;
}

/**
 * The Conflict object returned by the API when status is 'paused'.
 */
export interface RebaseConflict {
  reason: RebaseConflictReason;
  userPatch: ExtendedPatch;
  adminPatch: ExtendedPatch;
}

export interface RebaseQueueEntry {
  id: string;
  title: string;
  seriesId: string;
  seriesTitle: string;
  pageCount: number;
  coverImageName: string | null;
  versionInfo: {
    branchId: string;
    headPatchId: string;
    branchVersion: number;
    hasAhead: number;
    hasBehind: number;
    reviewHeadPatchId: string | null;
    reviewRequestedAt?: string | null;
    rejectionReason?: string | null;
  };
}

// Review / Contribution Types

/** Pending OCR review of a frozen prefix rather than the mutable live head. */
export interface ReviewRequestEntry {
  id: string; // The Branch ID
  volumeId: string;
  volumeTitle: string;
  seriesId: string;
  seriesTitle: string;
  coverImageName: string | null;

  // Metadata
  userId: string;
  userDisplayName?: string; // Present if viewed by Admin
  reviewRequestedAt: string; // ISO request time, unaffected by continued editing
  submissionNote: string | null;
  rejectionReason: string | null;

  // Frozen review identity
  reviewHeadPatchId: string;
  isBehind: boolean; // Vital for UI warnings
}

export interface ReviewStatusParams {
  volumeId: string;
  status: boolean;       // true = Request, false = Cancel/Reject
  reason?: string;       // Optional note
  targetUserId?: string; // Only required for Admin actions
}

/** Review-state result; newVersion belongs to the affected contributor branch. */
export interface ReviewStatusResult {
  newVersion: number;
  volumeId: string;
  status: boolean;
  action: 'submitted' | 'cancelled' | 'rejected' | 'accepted';
}
