import { browser } from '$app/environment';
import { apiFetch } from '$lib/api';
import { createId } from '@paralleldrive/cuid2';
import { ReviewSession, type ScrapedPreview } from './ReviewSession.svelte';

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

  constructor() {
    // Initialize Session with a callback to update our local list
    this.session = new ReviewSession((id) => this.markAsScraped(id));

    if (browser) {
      this.loadFilters();
      this.loadExcludedSeries();
      this.loadScrapedSeries();
    }
  }

  // --- 1. Filter Logic ---

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

  // --- 2. List Management ---

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

  // --- 3. API Actions ---

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
}

export const scrapingState = new ScrapingState();
