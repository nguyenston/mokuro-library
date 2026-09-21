import { apiFetch } from '$lib/services/api';

export type ContributionsSummary = {
  aheadCount: number;
  pendingSubmissionsCount: number;
  pendingReviewCount: number;
  totalEdits: number;
  editsMerged: number;
  volumesEdited: number;
  lastEditAt: string | null;
};

export class ContributionsSummaryState {
  aheadCount = $state(0);
  pendingSubmissionsCount = $state(0);
  pendingReviewCount = $state(0);
  totalEdits = $state(0);
  editsMerged = $state(0);
  volumesEdited = $state(0);
  lastEditAt = $state<string | null>(null);

  private inFlight: Promise<void> | null = null;
  private lastRefreshAt = 0;
  private readonly minRefreshInterval = 15000;

  async refresh(options?: { force?: boolean }) {
    const now = Date.now();
    if (!options?.force) {
      if (this.inFlight) return this.inFlight;
      if (now - this.lastRefreshAt < this.minRefreshInterval) return;
    }

    this.inFlight = (async () => {
      try {
        const data = await apiFetch<ContributionsSummary>('/api/contributions/summary', {
          showErrorToast: false,
          cache: true,
          skipCache: options?.force ?? false
        });
        this.aheadCount = data.aheadCount;
        this.pendingSubmissionsCount = data.pendingSubmissionsCount;
        this.pendingReviewCount = data.pendingReviewCount;
        this.totalEdits = data.totalEdits;
        this.editsMerged = data.editsMerged;
        this.volumesEdited = data.volumesEdited;
        this.lastEditAt = data.lastEditAt;
        this.lastRefreshAt = Date.now();
      } catch (error) {
        console.error('Failed to refresh contributions summary', error);
      } finally {
        this.inFlight = null;
      }
    })();

    return this.inFlight;
  }
}

export const contributionsSummaryState = new ContributionsSummaryState();
