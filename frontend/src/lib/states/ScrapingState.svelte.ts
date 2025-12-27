import { browser } from '$app/environment';
import { apiFetch } from '$lib/api';
import { createId } from '@paralleldrive/cuid2';
import { ReviewSession, type ScrapedPreview } from './ReviewSession.svelte';
import type { Series } from '$lib/types';

export interface DescriptionFilter {
  id: string;
  pattern: string;
  enabled: boolean;
  isRegex: boolean;
}

export interface ScrapeResult {
  scraped: any;
  current: any;
}

class ScrapingState {
  // --- Sub-States ---
  session: ReviewSession;
  isScraping = $state(false);

  // --- Global Lists ---
  descriptionFilters = $state<DescriptionFilter[]>([]);
  excludedSeriesIds = $state<Set<string>>(new Set());
  scrapedSeriesIds = $state<Set<string>>(new Set());

  // --- Constants ---
  readonly defaultFilters: Omit<DescriptionFilter, 'id' | 'enabled'>[] = [
    // Publisher sources
    { pattern: '\\(Source: VIZ Media\\)', isRegex: true },
    { pattern: '\\(Source: Kodansha USA\\)', isRegex: true },
    { pattern: '\\(Source: Seven Seas Entertainment\\)', isRegex: true },
    { pattern: '\\(Source: Yen Press\\)', isRegex: true },
    { pattern: '\\(Source: Dark Horse Manga\\)', isRegex: true },
    { pattern: '\\(Source: Tokyopop\\)', isRegex: true },
    { pattern: '\\(Source: NIS America\\)', isRegex: true },
    { pattern: '\\(Source: Denpa\\)', isRegex: true },
    { pattern: '\\(Source: Glacier Bay Books\\)', isRegex: true },
    { pattern: '\\(Source: Vertical\\)', isRegex: true },
    { pattern: '\\(Source: Anime News Network\\)', isRegex: true },
    { pattern: '\\(Source: SQUARE ENIX\\)', isRegex: true },
    { pattern: '\\(Source: Crunchyroll\\)', isRegex: true },
    { pattern: '\\(Source: [^)]+\\)', isRegex: true }, // Generic source pattern
    // MAL Rewrite
    { pattern: '\\[Written by MAL Rewrite\\]', isRegex: true },
    // HTML artifacts
    { pattern: '&mdash;', isRegex: false },
    { pattern: '&nbsp;', isRegex: false },
    { pattern: '&amp;', isRegex: false },
    { pattern: '&quot;', isRegex: false },
    { pattern: '<br\\s*/?>', isRegex: true },
    { pattern: '<i>|</i>', isRegex: true },
    { pattern: '<b>|</b>', isRegex: true },
    // Trailing whitespace
    { pattern: '\\s+$', isRegex: true },
    { pattern: '\\s{2,}', isRegex: true }
  ];

  preferredProvider = $state<'anilist' | 'mal' | 'kitsu'>('anilist');



  constructor() {
    // Initialize Session with a callback to update our local list
    this.session = new ReviewSession((id) => this.markAsScraped(id));

    if (browser) {
      this.loadFilters();
      this.loadExcludedSeries();
      this.loadScrapedSeries();
      this.loadProvider();

      // Automatically save provider whenever it changes
      $effect.root(() => {
        $effect(() => {
          localStorage.setItem('mokuro_scrape_provider', this.preferredProvider);
        });
      });
    }

  }

  /**
   * Initializes the review session with the selected series.
   * Creates "scraping" preview items instantly using the known current metadata.
   */
  initSession(seriesList: Series[]) {
    this.session.reset(seriesList.length);

    for (const s of seriesList) {
      // Create a preview item using the data we already have in memory
      const newItem: ScrapedPreview = {
        id: createId(),
        seriesId: s.id,
        seriesTitle: s.title || s.folderName,
        searchQuery: s.title || s.folderName,
        current: {
          title: s.title,
          japaneseTitle: s.japaneseTitle,
          romajiTitle: s.romajiTitle,
          synonyms: s.synonyms ?? null,
          description: s.description,
          hasCover: !!s.coverPath,
          coverPath: s.coverPath
        },
        scraped: {},
        status: 'scraping'
      };
      this.session.addIncoming(newItem);
    }
  }

  /**
   * The Main Loop: Processes the 'upcoming' queue.
   * Fetches metadata for scraping items one by one.
   */
  async startScrapingQueue(provider: 'anilist' | 'mal' | 'kitsu') {
    if (this.isScraping) return;
    this.isScraping = true;

    // Wait for next tick to ensure Svelte's reactive updates have completed
    await new Promise(resolve => setTimeout(resolve, 0));

    // Access the raw array from the Deque to iterate
    const queue = this.session.upcoming.items;

    for (const item of queue) {
      if (!this.isScraping) break;

      // Skip if already scraped or if user already processed it (status changed)
      if (item.scraped.title || item.status !== 'scraping') continue;

      try {
        // 1. Fetch Metadata
        const { scraped, current } = await this.scrapeWithFallback(
          item.seriesId,
          item.searchQuery,
          provider
        );

        // 2. Update the item in-place (Reactivity updates the UI)
        item.scraped = scraped;
        item.status = 'pending'

        // Update 'current' if the backend returns fresher data than our initial selection
        if (current) {
          item.current = { ...item.current, ...current };
        }

      } catch (e) {
        console.error(`Failed to scrape ${item.seriesTitle}`, e);
        item.status = 'error'; // Mark as pending even if scraping failed
      }

      // Small delay to prevent rate-limiting and allow UI to breathe
      await new Promise((r) => setTimeout(r, 600));
    }

    this.isScraping = false;
  }

  stopScraping() {
    this.isScraping = false;
  }

  // --- Filter Logic ---

  filterDescription(description: string | undefined): string | undefined {
    if (!description) return description;
    let result = description;

    for (const filter of this.descriptionFilters) {
      if (!filter.enabled) continue;
      try {
        if (filter.isRegex) {
          const regex = new RegExp(filter.pattern, 'gims');
          result = result.replace(regex, ' ');
        } else {
          result = result.split(filter.pattern).join(' ');
        }
      } catch (e) {
        console.warn(`Invalid filter: ${filter.pattern}`);
      }
    }
    return result.replace(/\s+/g, ' ').trim();
  }

  addFilter(pattern: string, isRegex: boolean) {
    if (!pattern.trim()) return;
    this.descriptionFilters = [
      ...this.descriptionFilters,
      { id: createId(), pattern, isRegex, enabled: true }
    ];
    this.saveFilters();
  }

  removeFilter(id: string) {
    this.descriptionFilters = this.descriptionFilters.filter((f) => f.id !== id);
    this.saveFilters();
  }

  toggleFilter(id: string) {
    this.descriptionFilters = this.descriptionFilters.map((f) =>
      f.id === id ? { ...f, enabled: !f.enabled } : f
    );
    this.saveFilters();
  }

  addPresetFilters() {
    const newFilters = this.defaultFilters.map((f) => ({
      ...f,
      id: createId(),
      enabled: true
    }));
    this.descriptionFilters = [...this.descriptionFilters, ...newFilters];
    this.saveFilters();
  }

  clearAllFilters() {
    this.descriptionFilters = [];
    this.saveFilters();
  }

  // --- List Management ---

  excludeSeries(id: string) {
    this.excludedSeriesIds = new Set([...this.excludedSeriesIds, id]);
    this.saveExcludedSeries();
  }

  restoreSeries(id: string) {
    const s = new Set(this.excludedSeriesIds);
    s.delete(id);
    this.excludedSeriesIds = s;
    this.saveExcludedSeries();
  }

  markAsScraped(id: string) {
    this.scrapedSeriesIds = new Set([...this.scrapedSeriesIds, id]);
    this.saveScrapedSeries();
  }

  // --- API Actions ---

  async scrapeWithFallback(
    seriesId: string,
    seriesTitle: string,
    provider: 'anilist' | 'mal' | 'kitsu'
  ): Promise<ScrapeResult> {
    try {
      const response = await apiFetch('/api/metadata/series/scrape', {
        method: 'POST',
        body: { seriesId, seriesName: seriesTitle, provider }
      });

      if (response.error || !response.scraped) {
        return { scraped: {}, current: null };
      }

      // Clean description using current filters
      const cleanedScraped = {
        ...response.scraped,
        description: this.filterDescription(response.scraped.description)
      };

      return {
        scraped: cleanedScraped,
        current: response.current
      };
    } catch (error) {
      console.error(`Failed to scrape:`, error);
      return { scraped: {}, current: null };
    }
  }

  // --- Persistence ---

  private saveFilters() {
    if (browser) {
      localStorage.setItem(
        'mokuro_series_description_scrape_filters',
        JSON.stringify(this.descriptionFilters)
      );
    }
  }

  private loadFilters() {
    const s = localStorage.getItem('mokuro_series_description_scrape_filters');
    if (s) {
      try {
        this.descriptionFilters = JSON.parse(s);
      } catch (e) {
        console.error('Failed to parse filters', e);
      }
    }
  }

  private saveExcludedSeries() {
    if (browser)
      localStorage.setItem('mokuro_excluded_series', JSON.stringify([...this.excludedSeriesIds]));
  }

  private loadExcludedSeries() {
    try {
      const s = localStorage.getItem('mokuro_excluded_series');
      if (s) this.excludedSeriesIds = new Set(JSON.parse(s));
    } catch (e) {
      console.error(e);
    }
  }

  private saveScrapedSeries() {
    if (browser)
      localStorage.setItem('mokuro_scraped_series', JSON.stringify([...this.scrapedSeriesIds]));
  }

  private loadScrapedSeries() {
    try {
      const s = localStorage.getItem('mokuro_scraped_series');
      if (s) this.scrapedSeriesIds = new Set(JSON.parse(s));
    } catch (e) {
      console.error(e);
    }
  }

  private loadProvider() {
    if (browser) {
      const p = localStorage.getItem('mokuro_scrape_provider');
      if (p === 'anilist' || p === 'mal' || p === 'kitsu') {
        this.preferredProvider = p;
      }
    }
  }

}

export const scrapingState = new ScrapingState();
