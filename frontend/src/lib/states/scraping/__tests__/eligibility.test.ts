/** Scrape eligibility keeps read-only selections visible without processing them. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { scrapingState } from '../ScrapingState.svelte';
import { apiFetch, HttpError } from '$lib/services/api';
import BulkScrapePanel from '$lib/components/modals/scraping/BulkScrapePanel.svelte';
import SeriesActionsMenu from '$lib/components/menu/SeriesActionsMenu.svelte';
import type { Series } from '$lib/types';

vi.mock('$app/environment', () => ({ browser: false }));
vi.mock('$lib/services/api', () => ({ apiFetch: vi.fn(), HttpError: class extends Error { statusCode = 403; } }));
vi.mock('svelte/transition', () => ({ fade: () => ({ duration: 0 }) }));

/** Minimal selected series with an explicit server-provided edit permission. */
function series(id: string, canEdit: boolean): Series {
  return { id, title: id, folderName: id, canEdit, coverPath: null } as Series;
}
afterEach(() => { cleanup(); scrapingState.stopScraping(); scrapingState.session.reset(0); vi.clearAllMocks(); });

describe('scrape eligibility', () => {
  it('keeps mixed read-only entries outside navigation and progress', () => {
    scrapingState.initSession([series('shared', false), series('owned', true)]);
    expect(scrapingState.session.current?.seriesId).toBe('owned');
    expect(scrapingState.session.stats.total).toBe(1);
    expect(scrapingState.session.ineligible.map(item => item.seriesId)).toEqual(['shared']);
    scrapingState.session.defer();
    scrapingState.session.rewind();
    expect(scrapingState.session.current?.seriesId).toBe('owned');
  });

  it('shows an empty panel and disabled entries without requests for read-only selections', async () => {
    scrapingState.initSession([series('shared', false)]);
    render(BulkScrapePanel, { onClose: vi.fn() });
    expect(screen.getByText('No eligible series to be scraped.')).toBeTruthy();
    expect((screen.getByRole('button', { name: /shared Shared - read-only/ }) as HTMLButtonElement).disabled).toBe(true);
    await scrapingState.startScrapingQueue('anilist');
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('allows owned shared series and continues after a permission change', async () => {
    scrapingState.initSession([series('changed', true), series('admin-owned', true)]);
    vi.mocked(apiFetch).mockRejectedValueOnce(new HttpError(403, 'Forbidden'))
      .mockResolvedValueOnce({ scraped: { title: 'Found' }, current: null });
    await scrapingState.startScrapingQueue('anilist');
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(scrapingState.session.current?.seriesId).toBe('admin-owned');
    expect(scrapingState.session.current?.status).toBe('pending');
    expect(scrapingState.session.stats.total).toBe(1);
  });

  it.each([false, true])('hero menu respects edit eligibility (%s)', async canScrape => {
    const scrape = vi.fn();
    render(SeriesActionsMenu, { onEdit: vi.fn(), onScrape: scrape, canScrape });
    await fireEvent.click(screen.getByRole('button', { name: 'Scrape Metadata' }));
    expect(scrape).toHaveBeenCalledTimes(canScrape ? 1 : 0);
  });
});
