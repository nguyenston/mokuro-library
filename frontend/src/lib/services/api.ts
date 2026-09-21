import { toastStore } from '$lib/stores/toastStore.svelte.ts';
import { retryWithBackoff } from '$lib/utils/network/retry';
import { apiCache } from '$lib/utils/caching/apiCache';
import { getStoredFingerprint } from './deviceFingerprint';
import type { UploadResponse } from '$lib/types';
import type { AuthUser } from '$lib/stores/authStore';

/**
 * It's the same as RequestInit, but 'body' can be 'any'
 * We will convert 'body' into a valid type inside of apiFetch.
 */
interface ApiFetchOptions<T> extends Omit<RequestInit, 'body' | 'cache'> {
  body?: unknown;
  retry?: boolean;
  showErrorToast?: boolean;
  cache?: boolean; // Enable caching for GET requests
  skipCache?: boolean; // Force fresh fetch
  onStaleRefetch?: (data: T) => void;
}

/** API failure retaining the server's recovery code as well as its HTTP status. */
export class HttpError extends Error {
  statusCode: number;
  code?: string;

  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'HttpError';

    // Restoration of prototype chain is required when extending built-ins in TS/JS
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

const getCsrfToken = () => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|; )csrfToken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

const isStateChanging = (method?: string) => {
  const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
  return !safeMethods.has((method || 'GET').toUpperCase());
};

/**
 * A simple wrapper for fetch to interact with our backend API.
 * This automatically handles JSON serialization, error handling,
 * and uses relative paths that work with our Vite proxy.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions<T> = {}
): Promise<T> {
  const {
    retry = false,
    showErrorToast = true,
    cache = false,
    skipCache = false,
    ...fetchOptions
  } = options;

  const method = (fetchOptions.method || 'GET').toUpperCase();
  const isGet = method === 'GET';

  const doFetch = async () => {
    // Set default headers
    const defaultHeaders: Record<string, string> = {
      Accept: 'application/json'
    };

    // Stringify the body if it's an object and method is not GET
    // GET request doesn't have a body by specification
    let body: BodyInit | null | undefined;

    // 1. GET requests never have a body
    if (isGet || fetchOptions.body == null) {
      body = undefined;
    }
    // 2. FormData is passed through as-is (letting browser set boundary)
    else if (fetchOptions.body instanceof FormData) {
      body = fetchOptions.body;
    }
    // 3. Objects are stringified for the JSON API
    else if (typeof fetchOptions.body === 'object') {
      body = JSON.stringify(fetchOptions.body);
    }
    // 4. Fallback for primitives (strings, numbers, etc.)
    else {
      body = String(fetchOptions.body);
    }

    // --- Conditionally build headers ---
    const finalHeaders: Record<string, string> = {
      ...defaultHeaders,
      ...(fetchOptions.headers as Record<string, string>)
    };

    if (body !== undefined && !(fetchOptions.body instanceof FormData)) {
      finalHeaders['Content-Type'] = 'application/json';
    }

    if (isStateChanging(fetchOptions.method)) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        finalHeaders['x-csrf-token'] = csrfToken;
      }
    }

    // Add device fingerprint to all requests
    const deviceFingerprint = await getStoredFingerprint();
    finalHeaders['x-device-fingerprint'] = deviceFingerprint;

    if (fetchOptions.body instanceof FormData || fetchOptions.method === 'DELETE') {
      // If body is FormData, delete the 'Content-Type' header
      // so the browser can set it automatically.
      delete finalHeaders['Content-Type'];
    }

    const response = await fetch(path, {
      ...fetchOptions,
      headers: finalHeaders,
      body
    });

    // If not OK, try to parse error message from backend
    if (!response.ok) {
      let message = `HTTP error! Status: ${response.status}`;
      let code: string | undefined;
      try {
        const errorData = await response.json();
        if (typeof errorData?.message === 'string') message = errorData.message;
        if (typeof errorData?.code === 'string') code = errorData.code;
      } catch {
        // Preserve the HTTP failure while explaining why no server message is available.
        message = `HTTP error! Status: ${response.status}. The response could not be parsed as valid JSON.`;
      }
      throw new HttpError(response.status, message, code);
    }

    // Handle successful but empty responses (e.g., 200 OK from /logout)
    // If OK but not JSON, return the response object itself (e.g., for file streams)
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return response;
    }

    // If we get here, it's a successful JSON response
    return response.json();
  };

  // Use cache for GET requests if enabled
  if (isGet && cache) {
    const cacheKey = `${method}:${path}`;
    const onStaleRefetch = options.onStaleRefetch;
    return apiCache.get(cacheKey, () => doFetch(), { skipCache, onStaleRefetch });
  }

  try {
    if (retry) {
      return await retryWithBackoff(doFetch, {
        retries: 3,
        delay: 1000,
        onRetry: (error, attempt) => {
          console.warn(`API request failed (attempt ${attempt}/3):`, error.message);
        }
      });
    } else {
      return await doFetch();
    }
  } catch (error) {
    if (showErrorToast) {
      toastStore.error(`${(error as Error).message}`);
    }
    throw error;
  }
}

/**
 * Track if a refresh is in progress to avoid multiple simultaneous refreshes
 */
let refreshPromise: Promise<AuthUser | null> | null = null;

export const refreshAccessToken = async (): Promise<AuthUser | null> => {
  // If a refresh is already running, return that existing promise
  if (refreshPromise) {
    return refreshPromise;
  }

  // Create a new promise for the refresh operation
  refreshPromise = (async () => {
    try {
      const deviceFingerprint = await getStoredFingerprint();

      const response = await apiFetch<AuthUser>('/api/auth/refresh', {
        method: 'POST',
        body: { deviceFingerprint },
        showErrorToast: false
      });

      return response;
    } catch (e) {
      console.debug('Token refresh failed:', e);
      return null;
    } finally {
      // Clear the promise so subsequent calls can start a new refresh
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

/**
 * Enhanced apiFetch that automatically retries with token refresh on 401.
 */
export const apiFetchWithRefresh = async <T = unknown>(
  url: string,
  options?: ApiFetchOptions<T>
): Promise<T> => {
  try {
    return await apiFetch<T>(url, options);
  } catch (error) {
    // If 401 and not already a refresh/login request, try to refresh token
    if (
      error instanceof HttpError &&
      error.statusCode === 401 &&
      !url.includes('/api/auth/refresh') &&
      !url.includes('/api/auth/login')
    ) {
      const refreshed = await refreshAccessToken();

      if (refreshed) {
        // Retry original request
        return await apiFetch<T>(url, options);
      }
    }

    throw error;
  }
};

/**
 * Specialized upload function using XMLHttpRequest to support progress tracking.
 * fetch() does not support upload progress, so we must use XHR.
 */
export async function apiUpload(
  path: string,
  formData: FormData,
  onProgress: (percent: number) => void,
  maxRetries = 2
): Promise<UploadResponse> {
  // 1. Get fingerprint before starting the promise chain
  const deviceFingerprint = await getStoredFingerprint();

  return new Promise<UploadResponse>((res, rej) => {
    let attempts = 0;

    const tryUpload = () => {
      attempts++;
      const xhr = new XMLHttpRequest();
      let hasStarted = false;

      // 2. Stuck Timer
      const stuckTimer = setTimeout(() => {
        if (!hasStarted) {
          xhr.abort();
          if (attempts <= maxRetries) {
            setTimeout(tryUpload, 200);
          } else {
            rej(new Error('Upload failed: request never started after retries'));
          }
        }
      }, 5000);

      xhr.open('POST', path);

      // 3. Headers
      const csrfToken = getCsrfToken();
      if (csrfToken) xhr.setRequestHeader('x-csrf-token', csrfToken);
      xhr.setRequestHeader('x-device-fingerprint', deviceFingerprint);

      // 4. Progress Tracking
      if (xhr.upload) {
        xhr.upload.onprogress = (event) => {
          hasStarted = true;
          clearTimeout(stuckTimer);
          if (event.lengthComputable) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        };
      }

      xhr.onload = () => {
        clearTimeout(stuckTimer);
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            // Type assertion here to satisfy the return type
            res(JSON.parse(xhr.responseText) as UploadResponse);
          } catch {
            // If the server sends a 200 but not JSON, we have a contract break
            rej(new Error('Server returned success but invalid JSON format'));
          }
        } else {
          try {
            const errorData = JSON.parse(xhr.responseText);
            rej(new Error(errorData.message || 'Upload failed'));
          } catch {
            rej(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      };

      // 5. Error & Timeout Handling
      xhr.onerror = () => {
        clearTimeout(stuckTimer);
        if (attempts <= maxRetries) {
          setTimeout(tryUpload, 200);
        } else {
          rej(new Error('Network error during upload'));
        }
      };

      xhr.timeout = 300000;
      xhr.ontimeout = xhr.onerror; // Reuse the retry logic

      xhr.send(formData);
    };

    tryUpload();
  });
}

/**
 * Triggers a browser download by navigating to the URL.
 */
export function triggerDownload(path: string) {
  window.location.assign(path);
}

// ==================== AUTHENTICATED IMAGE LOADING ====================

/**
 * Cache for blob URLs to avoid refetching the same image
 * Key: original image URL, Value: { blobUrl, refCount }
 */
const blobUrlCache = new Map<string, { blobUrl: string; refCount: number }>();

/**
 * Fetches an image/file with authentication and returns a blob URL
 * for use in <img> src, CSS backgrounds, etc.
 *
 * This is necessary because browser <img> tags cannot send custom headers
 * (like x-device-fingerprint), so we must fetch via JavaScript and create
 * blob URLs for authenticated image loading.
 *
 * @param path - The API path to the image (e.g., '/api/files/volume/123/image/page1.jpg')
 * @param useCache - Whether to use cached blob URLs (default: true)
 * @returns Promise<string> - A blob: URL that can be used in img.src
 */
export async function fetchAuthenticatedImage(path: string, useCache = true): Promise<string> {
  // Check cache first
  if (useCache && blobUrlCache.has(path)) {
    const cached = blobUrlCache.get(path)!;
    cached.refCount++;
    console.debug(`[AuthImage] Using cached blob for ${path} (refs: ${cached.refCount})`);
    return cached.blobUrl;
  }

  try {
    const response = await apiFetch<Response>(path);

    // apiFetch returns Response for non-JSON content
    if (response instanceof Response) {
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Cache the blob URL
      if (useCache) {
        blobUrlCache.set(path, { blobUrl, refCount: 1 });
        console.debug(`[AuthImage] Cached blob for ${path}`);
      }

      return blobUrl;
    }

    throw new Error('Invalid response type for image fetch - expected Response object');
  } catch (error) {
    console.error(`[AuthImage] Failed to fetch ${path}:`, error);
    throw error;
  }
}

/**
 * Revokes a blob URL and cleans up memory
 * Should be called when the image is no longer needed (e.g., component unmount)
 *
 * @param url - The blob: URL to revoke
 * @param originalPath - The original API path (for cache cleanup)
 */
export function revokeImageUrl(url: string, originalPath?: string) {
  if (!url || !url.startsWith('blob:')) {
    return;
  }

  // If we have the original path, manage ref counting
  if (originalPath && blobUrlCache.has(originalPath)) {
    const cached = blobUrlCache.get(originalPath)!;
    cached.refCount--;

    console.debug(`[AuthImage] Decreased ref count for ${originalPath} (refs: ${cached.refCount})`);

    // Only revoke when no more references
    if (cached.refCount <= 0) {
      URL.revokeObjectURL(cached.blobUrl);
      blobUrlCache.delete(originalPath);
      console.debug(`[AuthImage] Revoked and removed ${originalPath} from cache`);
    }
  } else {
    // No original path or not in cache - just revoke directly
    URL.revokeObjectURL(url);
    console.debug(`[AuthImage] Revoked blob URL directly`);
  }
}

/**
 * Preloads multiple images in parallel and caches their blob URLs
 * Useful for reader page preloading
 *
 * @param paths - Array of image paths to preload
 * @returns Promise<void>
 */
export async function preloadImages(paths: string[]): Promise<void> {
  const promises = paths.map((path) =>
    fetchAuthenticatedImage(path, true).catch((err) => {
      console.warn(`[AuthImage] Failed to preload ${path}:`, err);
    })
  );

  await Promise.all(promises);
  console.debug(`[AuthImage] Preloaded ${paths.length} images`);
}

/**
 * Clears all cached blob URLs and frees memory
 * Useful when navigating away from image-heavy pages
 */
export function clearImageCache() {
  for (const [, { blobUrl }] of blobUrlCache.entries()) {
    URL.revokeObjectURL(blobUrl);
  }
  blobUrlCache.clear();
  console.debug('[AuthImage] Cleared all cached blob URLs');
}
