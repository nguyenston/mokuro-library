import { browser } from '$app/environment';

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
    const response = await fetch(src);
    if (!response.ok) throw new Error(`Failed to fetch ${src}`);

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    // Track this blob URL for cleanup
    createdBlobUrls.add(blobUrl);
    return blobUrl;
  } catch (e) {
    console.error('Failed to load image:', e);
    throw e;
  }
}

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
