import { browser } from '$app/environment';

/**
 * Map of image source URLs to their fetch promises.
 * Ensures only one fetch request is made per unique image URL.
 */
const imagePromiseCache = new Map<string, Promise<string>>();

/**
 * Set of created blob URLs for cleanup tracking.
 * Allows proper memory management by revoking blob URLs when no longer needed.
 */
const createdBlobUrls = new Set<string>();

/**
 * Fetches an image from the network, creates a blob URL, and caches it.
 * Works on insecure (http://) connections unlike the persistent Cache API.
 * @param src - The image source URL to fetch
 * @returns Promise resolving to a blob URL
 * @throws Error if the fetch fails
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

/**
 * Image store for managing cached blob URLs.
 * Provides deduplication and memory management for image loading.
 */
export const imageStore = {
  /**
   * Gets an image blob URL from cache or fetches it from the network.
   * Multiple simultaneous requests for the same image will share a single fetch.
   * @param src - The image source URL
   * @returns Promise resolving to a blob URL that can be used in img src attributes
   */
  get: (src: string): Promise<string> => {
    // 1. Check if a promise for this src already exists.
    let request = imagePromiseCache.get(src);

    // 2. If it doesn't, create one.
    if (!request) {
      request = fetchAndCreateBlob(src).catch((error) => {
        // Remove failed promise from cache so we can retry
        imagePromiseCache.delete(src);
        throw error;
      });
      // Store the *promise* (not the result) in the map.
      imagePromiseCache.set(src, request);
    }

    // 3. Return the promise.
    // (All other components asking for this src will get the same promise)
    return request;
  },

  /**
   * Clears all cached images and revokes blob URLs to prevent memory leaks.
   * Should be called when navigating away from pages that loaded images.
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
