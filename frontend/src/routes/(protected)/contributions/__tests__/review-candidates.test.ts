import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import ReviewCandidates from '$lib/components/layout/contributions/ReviewCandidates.svelte';
import { getReviewCandidates, setReviewStatus } from '$lib/services/reviewApi';

vi.mock('$lib/services/reviewApi', () => ({
  getReviewCandidates: vi.fn(),
  setReviewStatus: vi.fn()
}));
vi.mock('$lib/services/api', () => ({
  fetchAuthenticatedImage: vi.fn().mockResolvedValue('blob:cover'),
  revokeImageUrl: vi.fn()
}));
vi.mock('$lib/stores/toastStore.svelte', () => ({
  toastStore: { success: vi.fn(), error: vi.fn() }
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('draft review submission', () => {
  it('shows the empty state after submitting the last draft with a cover', async () => {
    vi.mocked(getReviewCandidates)
      .mockResolvedValueOnce([
        {
          id: 'volume-1',
          title: 'Draft volume',
          seriesId: 'series-1',
          seriesTitle: 'Series',
          pageCount: 1,
          coverImageName: 'cover.jpg',
          versionInfo: {
            branchId: 'branch-1',
            headPatchId: 'patch-1',
            branchVersion: 1,
            hasAhead: 1,
            hasBehind: 0,
            reviewHeadPatchId: null
          }
        }
      ])
      .mockResolvedValue([]);
    vi.mocked(setReviewStatus).mockResolvedValue({
      volumeId: 'volume-1',
      status: true,
      action: 'submitted',
      newVersion: 2
    });

    render(ReviewCandidates);
    await fireEvent.click(await screen.findByRole('button', { name: 'Submit Review' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));
    await waitFor(() => expect(getReviewCandidates).toHaveBeenCalledTimes(2));
    await screen.findByText("No pending drafts found. You're all caught up!");
    expect(setReviewStatus).toHaveBeenCalledExactlyOnceWith({
      volumeId: 'volume-1',
      status: true,
      reason: ''
    });
  });
});
