import { apiFetch } from '$lib/services/api';
import type { Series } from '$lib/types';
import { SubmissionSession, type SeriesWithVolumes } from './SubmissionSession.svelte';
import { toastStore } from '$lib/stores/toastStore.svelte';

class SubmissionState {
  session = $state<SubmissionSession | null>(null);
  isLoading = $state(false);

  // --- Lifecycle ---

  startSession(seriesList: Series[]) {
    if (seriesList.length === 0) return;
    this.session = new SubmissionSession(seriesList);
  }

  endSession() {
    this.session = null;
    this.isLoading = false;
  }

  // --- API Interactions ---

  async searchSharedLibrary(query: string): Promise<Series[]> {
    if (!query || query.length < 2) return [];

    try {
      const params = new URLSearchParams({
        search: query,
        owner: 'admin',
        page: '1',
        limit: '15'
      });

      const res = await apiFetch<{ data: Series[] }>(`/api/library?${params.toString()}`);
      return res.data || [];
    } catch (e) {
      console.error('Failed to search shared library:', e);
      return [];
    }
  }

  async fetchRemoteSeriesDetails(seriesId: string): Promise<SeriesWithVolumes | null> {
    this.isLoading = true;
    try {
      const res = await apiFetch<SeriesWithVolumes>(`/api/library/series/${seriesId}`);
      return res;
    } catch (e) {
      console.error('Failed to fetch remote series:', e);
      toastStore.error('Failed to load remote series details');
      return null;
    } finally {
      this.isLoading = false;
    }
  }

  async submitCurrentItem() {
    if (!this.session?.current) return;
    const item = this.session.current;

    const volumeIds = Array.from(item.selectedVolumeIds);
    if (volumeIds.length === 0) {
      toastStore.warning('Please select at least one volume to submit.');
      return;
    }

    item.status = 'submitting';
    item.errorMessage = null;

    try {
      await apiFetch('/api/contributions/submissions', {
        method: 'POST',
        body: {
          volumeIds,
          targetSeriesId: item.submissionType === 'merge' ? item.targetSeries?.id : undefined
        }
      });

      item.status = 'submitted';
      const seriesTitle = item.sourceSeries.sortTitle;
      toastStore.success(`Submitted ${volumeIds.length} volumes from "${seriesTitle}"`);

      // Advance to next item automatically
      this.session.next();

    } catch (e) {
      console.error('Submission failed:', e);
      item.status = 'error';
      item.errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
      toastStore.error(item.errorMessage);
    }
  }
}

export const submissionState = new SubmissionState();
