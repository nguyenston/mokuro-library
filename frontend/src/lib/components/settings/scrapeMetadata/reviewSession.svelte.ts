import { Deque } from "$lib/utils/Deque.svelte";
import { createId } from '@paralleldrive/cuid2';
import { apiFetch } from '$lib/api';

export interface ScrapedPreview {
  id: string; // Unique ID for each preview
  seriesId: string;
  seriesTitle: string;
  searchQuery: string;
  current: {
    title: string | null;
    japaneseTitle?: string | null;
    romajiTitle?: string | null;
    synonyms?: string | null;
    description: string | null;
    hasCover: boolean;
    coverPath?: string | null;
  };
  scraped: {
    title?: string;
    japaneseTitle?: string;
    romajiTitle?: string;
    synonyms?: string;
    description?: string;
    hasCover?: boolean;
    tempCoverPath?: string; // Changed from coverPath
  };
  status: 'pending' | 'applying' | 'applied' | 'error' | 'denied';
}

/**
 * Manages the review workflow and API interactions.
 */
export class ReviewSession {
  // --- Data Structures ---
  upcoming = new Deque<ScrapedPreview>();
  deferred = $state<ScrapedPreview[]>([]);
  history = $state<ScrapedPreview[]>([]);

  // --- Stats ---
  stats = $state({
    total: 0,
    scraped: 0,
    success: 0,
    skipped: 0
  });

  // --- Callbacks ---
  // Function to call when a series is successfully updated (to update UI list)
  private onSeriesUpdated: (seriesId: string) => void;

  constructor(onSeriesUpdated: (seriesId: string) => void) {
    this.onSeriesUpdated = onSeriesUpdated;
  }

  // --- Getters ---
  get current() { return this.upcoming.peekFront(); }
  get totalPending() { return this.upcoming.size + this.deferred.length; }

  // --- Queue Management ---

  reset(totalItemsToScrape: number) {
    this.upcoming.clear();
    this.deferred = [];
    this.history = [];
    this.stats = { total: totalItemsToScrape, scraped: 0, success: 0, skipped: 0 };
  }

  addIncoming(item: ScrapedPreview) {
    this.upcoming.pushBack(item);
  }

  incrementScrapedCount() {
    this.stats.scraped++;
  }

  // --- Navigation ---

  defer() {
    const item = this.upcoming.popFront();
    if (item) this.deferred.push(item);
  }

  rewind() {
    const item = this.deferred.pop();
    if (item) this.upcoming.pushFront(item);
  }

  // --- Actions (Bulk) ---

  async confirmCurrent() {
    const item = this.upcoming.peekFront();
    if (!item) return;

    // 1. Optimistic Update in Queue
    const popped = this.upcoming.popFront();
    if (popped) {
      popped.status = 'applied';
      this.history.unshift(popped);
      this.stats.success++;

      // 2. Perform API Call
      await this.commitChange(popped);
    }
  }

  skipCurrent() {
    const item = this.upcoming.popFront();
    if (item) {
      item.status = 'denied';
      this.history.unshift(item);
      this.stats.skipped++;
    }
  }

  // --- Shared Logic (Used by Bulk and Single) ---

  /**
   * Performs the actual API call and triggers the success callback.
   * Can be used by the queue or by a single scrape modal.
   */
  async commitChange(preview: ScrapedPreview) {
    preview.status = 'applying';
    try {
      await apiFetch(`/api/metadata/series/${preview.seriesId}`, {
        method: 'PATCH',
        body: {
          title: preview.scraped.title,
          japaneseTitle: preview.scraped.japaneseTitle,
          romajiTitle: preview.scraped.romajiTitle,
          synonyms: preview.scraped.synonyms,
          description: preview.scraped.description,
          tempCoverPath: preview.scraped.tempCoverPath
        }
      });

      preview.status = 'applied';

      // Notify the parent (Svelte component) to update its list
      this.onSeriesUpdated(preview.seriesId);

    } catch (error) {
      console.error('Failed to apply metadata:', error);
      preview.status = 'error';
      // Note: If this was an optimistic update in the queue, 
      // the UI will show 'Applied' in history but the console has the error.
      // You might want to update the item in history to 'error' here if strictly needed.
    }
  }
}
