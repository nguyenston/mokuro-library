/**
 * Eager caching system
 * Prefetch and cache common data immediately after login
 */

import { apiFetch } from '$lib/services/api';
import { apiCache } from './apiCache';
import { runWhenIdle, shouldPrefetch } from './prefetchHelpers';

/**
 * Prefetch all common app data after login
 * This makes navigation feel instant
 */
export async function prefetchAppData() {
  if (!shouldPrefetch()) return;

  await runWhenIdle(async () => {
    const prefetches = [
      // Library - first page
      apiCache.prefetch('GET:/api/library?sort=title&order=asc&page=1', () =>
        apiFetch('/api/library?sort=title&order=asc&page=1', { cache: true, showErrorToast: false })
      ),

      // User settings (already loaded in auth, but ensure cached)
      apiCache.prefetch('GET:/api/settings', () =>
        apiFetch('/api/settings', { cache: true, showErrorToast: false })
      ),

      // Contributions summary
      apiCache.prefetch('GET:/api/contributions/summary', () =>
        apiFetch('/api/contributions/summary', { cache: true, showErrorToast: false })
      ),

      // Stats summary
      apiCache.prefetch('GET:/api/stats/summary', () =>
        apiFetch('/api/stats/summary', { cache: true, showErrorToast: false })
      )
    ];

    // Fire all prefetches in parallel, ignore errors
    await Promise.allSettled(prefetches);
  }, 2000);
}
