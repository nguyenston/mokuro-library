import { apiFetch } from './api';
import type { RebaseQueueEntry, ReviewRequestEntry, ReviewStatusParams, ReviewStatusResult } from '$lib/types';

/**
 * Fetches pending review requests.
 * The backend automatically determines if it returns "My Requests" (User)
 * or "All Requests" (Admin) based on the session.
 */
export async function getReviews(limit: number = 20): Promise<ReviewRequestEntry[]> {
  const data = await apiFetch<{ reviews: ReviewRequestEntry[] }>(`/api/contributions/reviews?limit=${limit}`);
  return data.reviews;
}

/**
 * Fetches a random set of eligible review candidates (drafts).
 * Used for the "Review Roulette" / Discovery feature.
 */
export async function getReviewCandidates(limit: number = 20): Promise<RebaseQueueEntry[]> {
  const data = await apiFetch<{ candidates: RebaseQueueEntry[] }>(
    `/api/contributions/reviews/candidates?limit=${limit}`
  );
  return data.candidates;
}

/**
 * Toggles the review status.
 * - User: Request Review (true) or Cancel (false)
 * - Admin: Reject (false)
 */
export async function setReviewStatus(params: ReviewStatusParams): Promise<ReviewStatusResult> {
  return await apiFetch<ReviewStatusResult>('/api/contributions/reviews/set', {
    method: 'POST',
    body: JSON.stringify(params)
  });
}
