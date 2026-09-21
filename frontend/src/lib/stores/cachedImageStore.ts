import { browser } from '$app/environment';
import { apiFetch } from '$lib/services/api';

// This map stores the *promises* of the blob URLs.
// This is the key to deduplicating requests.
const imagePromiseCache = new Map<string, Promise<string>>();

// This set tracks the blob URLs we've created so we can clean them up.
const createdBlobUrls = new Set<string>();

/**
 * Fetches an image, caches it in memory, and returns a blob URL.
 * This does not use the persistent 'Cache' API, so it works
 * on insecure (http://) mobile connections.
 */
async function fetchAndCreateBlob(src: string): Promise<string> {
  if (!browser) return '';

  try {
    const response = await apiFetch(src);

    if (response instanceof Response) {
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Track this blob URL for cleanup
      createdBlobUrls.add(blobUrl);
      return blobUrl;
    }

    throw new Error(`Invalid response type for image fetch - expected Response object`);
  } catch (e) {
    console.error('Failed to load image:', e);
    throw e;
  }
}

// Snap to 2 discrete height values for optimal cache efficiency
const SMALL_HEIGHT = 1800;
const LARGE_HEIGHT = 2400;
const HEIGHT_THRESHOLD = 1200; // Switch to large if target exceeds this

export const optimizeSrc = (src: string, browser: boolean) => {
  if (!browser) return src;
  try {
    const url = new URL(src, window.location.origin);
    const isOptimizable =
      url.pathname.startsWith('/api/files/volume/') ||
      url.pathname.startsWith('/api/files/series/');
    if (!isOptimizable) return src;
    if (url.searchParams.has('w') || url.searchParams.has('h') || url.searchParams.has('format'))
      return src;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const viewportHeight = window.innerHeight || 900;
    const targetHeight = Math.round(viewportHeight * dpr * 1.2);
    const height = targetHeight > HEIGHT_THRESHOLD ? LARGE_HEIGHT : SMALL_HEIGHT;
    url.searchParams.set('h', height.toString());
    url.searchParams.set('q', '45');
    url.searchParams.set('format', 'avif');
    return `${url.pathname}?${url.searchParams.toString()}`;
  } catch {
    return src;
  }
};

export const imageStore = {
  /**
   * Gets an image blob URL from the session cache or network.
   */
  get: (src: string): Promise<string> => {
    // 1. Check if a promise for this src already exists.
    let request = imagePromiseCache.get(src);

    // 2. If it doesn't, create one.
    if (!request) {
      request = fetchAndCreateBlob(src);
      // Store the *promise* (not the result) in the map.
      imagePromiseCache.set(src, request);
    }

    // 3. Return the promise.
    // (All other components asking for this src will get the same promise)
    return request;
  },

  /**
   * Clears the session cache and revokes all blob URLs.
   * This is called on navigation to prevent memory leaks.
   */
  clear: () => {
    console.log('Clearing image store, revoking URLs...');
    for (const url of createdBlobUrls) {
      URL.revokeObjectURL(url);
    }
    imagePromiseCache.clear();
    createdBlobUrls.clear();
  }
};
