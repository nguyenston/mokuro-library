/** A pending review identifies a frozen prefix, independently of the live branch. */
export interface ReviewRequestEntry {
  id: string; // Branch ID
  volumeId: string;
  volumeTitle: string;
  seriesId: string;
  seriesTitle: string;
  coverImageName: string | null;

  // Review Metadata
  userId: string;
  userDisplayName?: string; // Helpful for Admin view
  reviewRequestedAt: Date;
  submissionNote: string | null;
  rejectionReason: string | null;

  // Version Info
  reviewHeadPatchId: string;
  isBehind: boolean;
}

export interface ReviewStatusParams {
  volumeId: string;
  status: boolean;       // true = Request Review, false = Cancel/Reject
  reason?: string;       // Optional note
  targetUserId?: string; // Required for Admin to target a specific user's branch
}

/** Review-state result with the affected contributor branch's optimistic version. */
export interface ReviewStatusResult {
  newVersion: number;
  volumeId: string;
  status: boolean;
  action: 'submitted' | 'cancelled' | 'rejected' | 'accepted';
}
