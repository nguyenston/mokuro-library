import { Deque } from "$lib/utils/Deque.svelte";
import { apiFetch } from '$lib/api';

export interface ScrapedPreview {
  id: string; // Unique ID for the preview card
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
    tempCoverPath?: string;
  };
  status: 'pending' | 'applying' | 'applied' | 'error' | 'denied';
}

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
  private onSeriesUpdated: (seriesId: string) => void;

  constructor(onSeriesUpdated: (seriesId: string) => void) {
    this.onSeriesUpdated = onSeriesUpdated;
  }

  // --- Getters ---
  get current() {
    return this.upcoming.peekFront();
  }
  get totalPending() {
    return this.upcoming.size + this.deferred.length;
  }

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

  // --- Shared Logic ---
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
      this.onSeriesUpdated(preview.seriesId);
    } catch (error) {
      console.error('Failed to apply metadata:', error);
      preview.status = 'error';
    }
  }
}
