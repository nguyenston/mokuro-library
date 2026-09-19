// backend/src/lib/strategies/IAPIAccessStrategy.ts
import { ReviewRequestEntry, ReviewStatusParams, ReviewStatusResult } from '../../types/reviews';
import { VolumeResponse } from '../../types/library';
import {
  ApplyPatchResponse,
  UndoResponse,
  RedoResponse,
  PatchOperation
} from '../../types/history';
import { MokuroData } from '../../types/mokuro';
import { OcrBranch } from '../../generated/prisma/client';

export interface IAPIAccessStrategy {

  // --- Volume State ---
  /**
   * Admin: Returns Master state (hasAhead/hasBehind = false).
   * User: Returns Private/Hybrid state with status flags.
   */
  getVolume(volumeId: string): Promise<VolumeResponse>;

  // --- OCR Versioning ---
  applyPatch(volumeId: string, op: PatchOperation, version: number): Promise<ApplyPatchResponse>;
  undo(volumeId: string, version: number): Promise<UndoResponse>;

  /**
   * Admin: Throws 400 Bad Request (Redo disabled for Master).
   */
  redo(volumeId: string, version: number): Promise<RedoResponse>;

  /**
   * Admin: Throws 405 Method Not Allowed (Reset disabled for Admin).
   * Requires the observed branch version; forced confirms pending-review cancellation only.
   */
  reset(volumeId: string, version: number, forced?: boolean): Promise<void>;

  /**
   * Manual trigger to regenerate the .mokuro cache file.
   */
  createSnapshot(volumeId: string): Promise<{ data: MokuroData, branch: OcrBranch }>;

  // --- Submission Lifecycle ---
  /**
   * User: Submits private volumes to Admin.
   * Admin: Throws 403 (Admin cannot submit to self).
   */
  submitVolumes(volumeIds: string[], targetSeriesId?: string): Promise<void>;

  /**
   * Admin: Executes file move and ownership transfer.
   * User: Throws 403 (Unauthorized moderation).
   */
  acceptSubmission(submissionId: string): Promise<void>;

  rejectSubmission(submissionId: string, reason?: string): Promise<void>;

  // --- Admin Advanced Features ---
  /**
   * Admin: Merge a reviewed user branch into master if its frozen review head still matches.
   * User: Throws 403.
   */
  officialize(volumeId: string, sourceUserId: string, reviewHeadPatchId: string): Promise<void>;

  /**
   * Admin: Non-destructive undo (inverse patch).
   * User: Throws 403.
   */
  revert(volumeId: string, patchId: string): Promise<void>;

  /**
     * Fetch pending review requests.
     * - User: Returns their own requests.
     * - Admin: Returns ALL requests.
     */
  getReviews(actorId: string): Promise<ReviewRequestEntry[]>;

  /**
   * Set the review status (Request, Cancel, or Reject).
   */
  setReviewStatus(actorId: string, params: ReviewStatusParams): Promise<ReviewStatusResult>;
}
