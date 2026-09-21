/**
 * Smart prefetching utilities
 * Prefetch pages and data on hover/focus for instant navigation
 */

import { preloadData, preloadCode } from '$app/navigation';
import { apiCache } from './apiCache';
import { apiFetch } from '$lib/services/api';
import { runWhenIdle, shouldPrefetch } from './prefetchHelpers';

let prefetchTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Prefetch a route on hover with debounce
 */
export function onLinkHover(href: string) {
  if (!shouldPrefetch()) return;
  if (prefetchTimer) clearTimeout(prefetchTimer);

  prefetchTimer = setTimeout(() => {
    // Prefetch SvelteKit route data and code
    preloadData(href).catch(() => {});
    preloadCode(href).catch(() => {});

    // Prefetch likely API calls based on route
    prefetchRouteData(href);
  }, 100); // Small delay to avoid prefetching on quick mouseovers
}

/**
 * Cancel pending prefetch
 */
export function cancelPrefetch() {
  if (prefetchTimer) {
    clearTimeout(prefetchTimer);
    prefetchTimer = null;
  }
}

/**
 * Prefetch data for specific routes
 */
function prefetchRouteData(href: string) {
  if (!shouldPrefetch()) return;
  // Extract route pattern
  const url = new URL(href, window.location.origin);
  const path = url.pathname;

  // Series page - prefetch series data
  if (path.match(/^\/series\/[^/]+$/)) {
    const seriesId = path.split('/')[2];
    apiCache.prefetch(`GET:/api/library/series/${seriesId}`, () =>
      apiFetch(`/api/library/series/${seriesId}`, { cache: true, showErrorToast: false })
    );
  }

  // Volume page (reader) - prefetch volume data
  else if (path.match(/^\/volume\/[^/]+$/)) {
    const volumeId = path.split('/')[2];
    apiCache.prefetch(`GET:/api/library/volume/${volumeId}`, () =>
      apiFetch(`/api/library/volume/${volumeId}`, { cache: true, showErrorToast: false })
    );
  }

  // Library page - prefetch first page
  else if (path === '/' || path === '') {
    apiCache.prefetch('GET:/api/library?sort=title&order=asc&page=1', () =>
      apiFetch('/api/library?sort=title&order=asc&page=1', { cache: true, showErrorToast: false })
    );
  }

  // Settings page - no API prefetch needed (loads from user store)
}

/**
 * Prefetch all likely next routes on app init
 * Also preloads reader components eagerly
 */
export async function prefetchCommonRoutes() {
  if (!shouldPrefetch()) return;
  // Prefetch common page bundles
  await runWhenIdle(async () => {
    const routes = ['/settings', '/contributions'];
    routes.forEach((route) => {
      preloadCode(route).catch(() => {});
    });

    // Eagerly load reader components (they're needed for any volume view)
    // This prevents slow first load when opening a volume
    const readerComponents = [
      import('$lib/components/readers/SinglePageReader.svelte'),
      import('$lib/components/readers/DoublePageReader.svelte'),
      import('$lib/components/readers/VerticalReader.svelte'),
      import('$lib/components/settings/ReaderSettings.svelte'),
      import('$lib/components/modals/LineOrderModal.svelte')
    ];

    await Promise.allSettled(readerComponents);
  }, 2000);
}

/**
 * Svelte action for link prefetching
 */
export function prefetchOnHover(node: HTMLElement) {
  const href = node.getAttribute('href');
  if (!href) return;

  const handleMouseEnter = () => onLinkHover(href);
  const handleMouseLeave = () => cancelPrefetch();
  const handleFocus = () => onLinkHover(href);
  const handleBlur = () => cancelPrefetch();

  node.addEventListener('mouseenter', handleMouseEnter);
  node.addEventListener('mouseleave', handleMouseLeave);
  node.addEventListener('focus', handleFocus);
  node.addEventListener('blur', handleBlur);

  return {
    destroy() {
      node.removeEventListener('mouseenter', handleMouseEnter);
      node.removeEventListener('mouseleave', handleMouseLeave);
      node.removeEventListener('focus', handleFocus);
      node.removeEventListener('blur', handleBlur);
    }
  };
}
