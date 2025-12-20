import { browser } from '$app/environment';

/**
 * Persistent image cache using IndexedDB.
 * Implements stale-while-revalidate pattern for instant loading with background updates.
 */

const DB_NAME = 'mokuro-image-cache';
const DB_VERSION = 1;
const STORE_NAME = 'covers';
const METADATA_STORE = 'metadata';

interface CachedImage {
	url: string;
	blob: Blob;
	timestamp: number;
	etag?: string;
	lastModified?: string;
}

interface ImageMetadata {
	url: string;
	timestamp: number;
	etag?: string;
	lastModified?: string;
	size: number;
}

/**
 * Opens or creates the IndexedDB database
 */
async function openDB(): Promise<IDBDatabase> {
	if (!browser) throw new Error('IndexedDB not available in SSR');

	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;

			// Create object stores if they don't exist
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
				store.createIndex('timestamp', 'timestamp', { unique: false });
			}

			if (!db.objectStoreNames.contains(METADATA_STORE)) {
				db.createObjectStore(METADATA_STORE, { keyPath: 'url' });
			}
		};
	});
}

/**
 * Stores an image in IndexedDB with metadata
 */
async function storeImage(url: string, blob: Blob, headers?: Headers): Promise<void> {
	const db = await openDB();
	const transaction = db.transaction([STORE_NAME, METADATA_STORE], 'readwrite');

	const cachedImage: CachedImage = {
		url,
		blob,
		timestamp: Date.now(),
		etag: headers?.get('etag') || undefined,
		lastModified: headers?.get('last-modified') || undefined
	};

	const metadata: ImageMetadata = {
		url,
		timestamp: cachedImage.timestamp,
		etag: cachedImage.etag,
		lastModified: cachedImage.lastModified,
		size: blob.size
	};

	transaction.objectStore(STORE_NAME).put(cachedImage);
	transaction.objectStore(METADATA_STORE).put(metadata);

	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = () => reject(transaction.error);
	});
}

/**
 * Retrieves an image from IndexedDB
 */
async function getImage(url: string): Promise<CachedImage | null> {
	const db = await openDB();
	const transaction = db.transaction(STORE_NAME, 'readonly');
	const store = transaction.objectStore(STORE_NAME);

	return new Promise((resolve, reject) => {
		const request = store.get(url);
		request.onsuccess = () => resolve(request.result || null);
		request.onerror = () => reject(request.error);
	});
}

/**
 * Gets metadata for an image without loading the full blob
 */
async function getMetadata(url: string): Promise<ImageMetadata | null> {
	const db = await openDB();
	const transaction = db.transaction(METADATA_STORE, 'readonly');
	const store = transaction.objectStore(METADATA_STORE);

	return new Promise((resolve, reject) => {
		const request = store.get(url);
		request.onsuccess = () => resolve(request.result || null);
		request.onerror = () => reject(request.error);
	});
}

/**
 * Checks if a cached image is fresh by making a HEAD request
 */
async function isCacheFresh(url: string, cachedMetadata: ImageMetadata): Promise<boolean> {
	try {
		const response = await fetch(url, { method: 'HEAD' });

		if (!response.ok) return false;

		// Check ETag if available
		const etag = response.headers.get('etag');
		if (etag && cachedMetadata.etag) {
			return etag === cachedMetadata.etag;
		}

		// Check Last-Modified if available
		const lastModified = response.headers.get('last-modified');
		if (lastModified && cachedMetadata.lastModified) {
			return lastModified === cachedMetadata.lastModified;
		}

		// If no cache headers, consider stale after 1 hour
		const age = Date.now() - cachedMetadata.timestamp;
		return age < 3600000; // 1 hour
	} catch (error) {
		console.warn('Failed to check cache freshness:', error);
		// On network error, use cached version
		return true;
	}
}

/**
 * Fetches an image from the network and stores it in cache
 */
async function fetchAndCache(url: string): Promise<Blob> {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);

	const blob = await response.blob();
	await storeImage(url, blob, response.headers);

	return blob;
}

/**
 * In-memory blob URL cache to avoid creating multiple URLs for the same blob
 */
const blobUrlCache = new Map<string, string>();

/**
 * Creates a blob URL and caches it
 */
function createBlobUrl(blob: Blob, originalUrl: string): string {
	// Check if we already have a blob URL for this original URL
	const existing = blobUrlCache.get(originalUrl);
	if (existing) return existing;

	const blobUrl = URL.createObjectURL(blob);
	blobUrlCache.set(originalUrl, blobUrl);
	return blobUrl;
}

/**
 * Main cache interface with stale-while-revalidate pattern
 */
export const persistentImageCache = {
	/**
	 * Gets an image with instant display of cached version and background revalidation.
	 * Returns immediately with cached version, then updates if changed.
	 * @param url - Image URL to fetch
	 * @param onUpdate - Callback when a fresher version is available
	 * @returns Promise with blob URL for immediate display
	 */
	async get(url: string, onUpdate?: (newBlobUrl: string) => void): Promise<string> {
		if (!browser) return url;

		try {
			// Step 1: Try to get cached version immediately
			const cached = await getImage(url);

			if (cached) {
				const blobUrl = createBlobUrl(cached.blob, url);

				// Step 2: Start background revalidation (don't await)
				if (onUpdate) {
					this.revalidate(url, cached).then((freshBlob) => {
						if (freshBlob) {
							const newBlobUrl = createBlobUrl(freshBlob, url);
							onUpdate(newBlobUrl);
						}
					});
				}

				return blobUrl;
			}

			// Step 3: No cache - fetch and store
			const blob = await fetchAndCache(url);
			return createBlobUrl(blob, url);
		} catch (error) {
			console.error('Persistent cache error:', error);
			// Fallback to direct URL
			return url;
		}
	},

	/**
	 * Revalidates a cached image and returns fresh blob if updated
	 */
	async revalidate(url: string, cached: CachedImage): Promise<Blob | null> {
		try {
			const metadata: ImageMetadata = {
				url: cached.url,
				timestamp: cached.timestamp,
				etag: cached.etag,
				lastModified: cached.lastModified,
				size: cached.blob.size
			};

			const isFresh = await isCacheFresh(url, metadata);

			if (!isFresh) {
				// Cache is stale, fetch new version
				return await fetchAndCache(url);
			}

			return null; // Cache is fresh, no update needed
		} catch (error) {
			console.warn('Revalidation failed:', error);
			return null;
		}
	},

	/**
	 * Preloads images into cache (for prefetching visible items)
	 */
	async preload(urls: string[]): Promise<void> {
		const promises = urls.map(async (url) => {
			try {
				// Check if already cached
				const metadata = await getMetadata(url);
				if (!metadata) {
					// Not cached, fetch and store
					await fetchAndCache(url);
				}
			} catch (error) {
				console.warn(`Failed to preload ${url}:`, error);
			}
		});

		await Promise.allSettled(promises);
	},

	/**
	 * Clears old cached images to free up space
	 * @param maxAge - Maximum age in milliseconds (default: 7 days)
	 */
	async cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
		if (!browser) return;

		try {
			const db = await openDB();
			const transaction = db.transaction(STORE_NAME, 'readwrite');
			const store = transaction.objectStore(STORE_NAME);
			const index = store.index('timestamp');

			const cutoffTime = Date.now() - maxAge;
			const range = IDBKeyRange.upperBound(cutoffTime);

			const request = index.openCursor(range);

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
				if (cursor) {
					cursor.delete();
					cursor.continue();
				}
			};
		} catch (error) {
			console.warn('Cache cleanup failed:', error);
		}
	},

	/**
	 * Clears all cached images
	 */
	async clear(): Promise<void> {
		if (!browser) return;

		try {
			// Revoke all blob URLs
			for (const blobUrl of blobUrlCache.values()) {
				URL.revokeObjectURL(blobUrl);
			}
			blobUrlCache.clear();

			// Clear IndexedDB
			const db = await openDB();
			const transaction = db.transaction([STORE_NAME, METADATA_STORE], 'readwrite');
			transaction.objectStore(STORE_NAME).clear();
			transaction.objectStore(METADATA_STORE).clear();
		} catch (error) {
			console.warn('Cache clear failed:', error);
		}
	},

	/**
	 * Gets cache statistics
	 */
	async getStats(): Promise<{ count: number; totalSize: number }> {
		if (!browser) return { count: 0, totalSize: 0 };

		try {
			const db = await openDB();
			const transaction = db.transaction(METADATA_STORE, 'readonly');
			const store = transaction.objectStore(METADATA_STORE);

			return new Promise((resolve) => {
				const request = store.getAll();
				request.onsuccess = () => {
					const metadata = request.result as ImageMetadata[];
					const count = metadata.length;
					const totalSize = metadata.reduce((sum, m) => sum + m.size, 0);
					resolve({ count, totalSize });
				};
				request.onerror = () => resolve({ count: 0, totalSize: 0 });
			});
		} catch (error) {
			return { count: 0, totalSize: 0 };
		}
	}
};

// Auto cleanup on app load (remove images older than 7 days)
if (browser) {
	persistentImageCache.cleanup().catch(console.warn);
}
