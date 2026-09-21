import { SvelteSet } from 'svelte/reactivity';
import { apiFetch } from '$lib/services/api'; // Added import
import type { Series, Volume } from '$lib/types';
import { createId } from '@paralleldrive/cuid2';

// Type for the full response from backend
export type SeriesWithVolumes = Series & {
  volumes: Volume[];
};

export type SubmissionStatus = 'pending' | 'submitting' | 'submitted' | 'error';

export class SubmissionItem {
  id: string = createId();

  // The User's local series (starts as basic metadata, populated with volumes later)
  sourceSeries: Series;
  // Local volumes, populated via loadSourceDetails()
  volumes = $state<Volume[]>([]);

  // Loading State for the Source Data
  isLoaded = $state(false);
  isLoadingSource = $state(false);

  // The selected Admin/Shared series.
  targetSeries = $state<SeriesWithVolumes | null>(null);

  // Lifecycle state
  status = $state<SubmissionStatus>('pending');
  errorMessage = $state<string | null>(null);

  // Volume Selection State
  selectedVolumeIds = $state(new SvelteSet<string>());

  constructor(sourceSeries: Series) {
    this.sourceSeries = sourceSeries;
    // We do NOT call resetSelection here because we don't have volumes yet.
  }

  // --- Data Fetching ---

  /**
   * Lazily fetches the full series details (volumes) for the local user series.
   */
  async loadSourceDetails() {
    // Prevent double loading or reloading
    if (this.isLoaded || this.isLoadingSource) return;

    this.isLoadingSource = true;
    try {
      const data = await apiFetch<SeriesWithVolumes>(`/api/library/series/${this.sourceSeries.id}`);

      this.volumes = data.volumes || [];
      this.isLoaded = true;

      // Now that we have volumes, set the default selection
      this.resetSelection();

    } catch (e) {
      console.error('Failed to load source series details', e);
      this.errorMessage = 'Failed to load local volume list.';
    } finally {
      this.isLoadingSource = false;
    }
  }

  // --- Logic ---

  get submissionType(): 'new' | 'merge' {
    return this.targetSeries !== null ? 'merge' : 'new';
  }

  /**
   * Resets volume selection logic.
   * - If merging: Selects only volumes that DON'T exist in the target (by folderName).
   * - If new: Selects all volumes.
   */
  resetSelection() {
    this.selectedVolumeIds.clear();

    // If we haven't loaded volumes yet, we can't select anything
    if (!this.isLoaded) return;

    if (this.targetSeries) {
      // Merge Mode: Filter conflicts
      const targetVolumeFolders = new Set(
        this.targetSeries.volumes.map((v) => v.folderName)
      );

      for (const v of this.volumes) {
        if (!targetVolumeFolders.has(v.folderName)) {
          this.selectedVolumeIds.add(v.id);
        }
      }
    } else {
      // New Mode: Select all
      for (const v of this.volumes) {
        this.selectedVolumeIds.add(v.id);
      }
    }
  }

  toggleVolume(volumeId: string) {
    if (this.selectedVolumeIds.has(volumeId)) {
      this.selectedVolumeIds.delete(volumeId);
    } else {
      this.selectedVolumeIds.add(volumeId);
    }
  }

  isVolumeConflicting(volume: Volume): boolean {
    if (!this.targetSeries) return false;
    return this.targetSeries.volumes.some((v) => v.folderName === volume.folderName);
  }
}

export class SubmissionSession {
  items = $state<SubmissionItem[]>([]);
  currentIndex = $state(0);

  constructor(initialSeries: Series[]) {
    this.items = initialSeries.map((s) => new SubmissionItem(s));

    // Automatically load the first item
    if (this.current) {
      this.current.loadSourceDetails();
    }
  }

  get current(): SubmissionItem | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.items.length) {
      return this.items[this.currentIndex];
    }
    return null;
  }

  get progress() {
    const done = this.items.filter(i => i.status === 'submitted').length;
    return { done, total: this.items.length };
  }

  // --- Navigation ---

  select(index: number) {
    if (index >= 0 && index < this.items.length) {
      this.currentIndex = index;
      // Lazy Load Trigger
      this.current?.loadSourceDetails();
    }
  }

  next() {
    if (this.currentIndex < this.items.length - 1) {
      this.currentIndex++;
      // Lazy Load Trigger
      this.current?.loadSourceDetails();
    }
  }

  previous() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      // Lazy Load Trigger
      this.current?.loadSourceDetails();
    }
  }
}
