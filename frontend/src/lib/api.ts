/**
 * It's the same as RequestInit, but 'body' can be 'any'
 * We will convert 'body' into a valid type inside of apiFetch.
 */
interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: any;
  cache?: boolean; // Enable response caching
  cacheTTL?: number; // Cache TTL in milliseconds (default: 30000)
}

// Request deduplication cache (prevents duplicate in-flight requests)
const requestCache = new Map<string, Promise<unknown>>();

// Response cache with TTL
interface CachedResponse {
  data: unknown;
  timestamp: number;
}

const responseCache = new Map<string, CachedResponse>();
const DEFAULT_CACHE_TTL = 30000; // 30 seconds

/**
 * Creates a cache key from request parameters
 */
function createCacheKey(path: string, options: ApiFetchOptions): string {
  const method = options.method || 'GET';
  const bodyKey = options.body ? JSON.stringify(options.body) : '';
  return `${method}:${path}:${bodyKey}`;
}

/**
 * Gets cached response if valid
 */
function getCachedResponse(key: string, ttl: number): unknown | null {
  const cached = responseCache.get(key);
  if (!cached) return null;
  
  const age = Date.now() - cached.timestamp;
  if (age > ttl) {
    responseCache.delete(key);
    return null;
  }
  
  return cached.data;
}

/**
 * Sets cached response
 */
function setCachedResponse(key: string, data: unknown): void {
  responseCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Clears expired cache entries (runs periodically)
 */
function cleanupCache(): void {
  const now = Date.now();
  for (const [key, cached] of responseCache.entries()) {
    // Remove entries older than 5 minutes
    if (now - cached.timestamp > 300000) {
      responseCache.delete(key);
    }
  }
}

// Cleanup cache every minute
if (typeof window !== 'undefined') {
  setInterval(cleanupCache, 60000);
}

/**
 * A simple wrapper for fetch to interact with our backend API.
 * This automatically handles JSON serialization, error handling,
 * request deduplication, and response caching.
 * Uses relative paths that work with our Vite proxy.
 */
export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<unknown> {
  const cacheKey = createCacheKey(path, options);
  const useCache = options.cache !== false && (options.method === 'GET' || !options.method);
  const cacheTTL = options.cacheTTL ?? DEFAULT_CACHE_TTL;
  
  // Check response cache first (only for GET requests)
  if (useCache) {
    const cached = getCachedResponse(cacheKey, cacheTTL);
    if (cached !== null) {
      return cached;
    }
  }
  
  // Check if request is already in flight (deduplication)
  if (requestCache.has(cacheKey)) {
    return requestCache.get(cacheKey)!;
  }
  
  // Create new request promise
  const requestPromise = (async () => {
  // Set default headers
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  // Stringify the body if it's an object and method is not GET
  // GET request doesn't have a body by specification
  let body: BodyInit | null | undefined = options.body;
  if (
    options.body &&
    typeof options.body === 'object' &&
    options.method !== 'GET' &&
    !(options.body instanceof FormData)
  ) {
    body = JSON.stringify(options.body);
  }

  // --- Conditionally build headers ---
  const finalHeaders = new Headers(defaultHeaders);
  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        finalHeaders.set(key, value);
      });
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([key, value]) => {
        finalHeaders.set(key, String(value));
      });
    } else {
      Object.entries(options.headers).forEach(([key, value]) => {
        finalHeaders.set(key, String(value));
      });
    }
  }

  if (options.body instanceof FormData || options.method === 'DELETE') {
    // If body is FormData, delete the 'Content-Type' header
    // so the browser can set it automatically.
    finalHeaders.delete('Content-Type');
  }

  // Destructure to exclude custom cache options from fetch call
  const { cache: _, cacheTTL: __, ...fetchOptions } = options;

  const response = await fetch(path, {
    ...fetchOptions,
    headers: finalHeaders,
    body,
  });

  // If not OK, try to parse error message from backend
  if (!response.ok) {
    try {
      const errorData = await response.json();
      const message = errorData?.message || 'An unknown API error occurred.';
      throw new Error(message);
    } catch (e) {
      if (e instanceof Error) {
        throw e;
      }
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
  }

    // Handle successful but empty responses (e.g., 200 OK from /logout)
    // If OK but not JSON, return the response object itself (e.g., for file streams)
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return response;
    }

    // If we get here, it's a successful JSON response
    const data = await response.json();
    
    // Cache successful GET responses
    if (useCache) {
      setCachedResponse(cacheKey, data);
    }
    
    return data;
  })().finally(() => {
    // Remove from request cache when done
    requestCache.delete(cacheKey);
  });
  
  // Store in request cache for deduplication
  requestCache.set(cacheKey, requestPromise);
  
  return requestPromise;
}

/**
 * Clears the response cache (useful for logout or data invalidation)
 */
export function clearApiCache(): void {
  responseCache.clear();
  requestCache.clear();
}

/**
 * Specialized upload function using XMLHttpRequest to support progress tracking.
 * fetch() does not support upload progress, so we must use XHR.
 */
// Constants for upload configuration
const UPLOAD_STUCK_TIMEOUT = 5000; // 5 seconds
const UPLOAD_TIMEOUT = 300000; // 5 minutes
const RETRY_DELAY = 200; // 200ms

export function apiUpload(
  path: string,
  formData: FormData,
  onProgress: (percent: number) => void,
  maxRetries = 2
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const tryUpload = () => {
      attempts++;
      console.log(`Upload attempt ${attempts}/${maxRetries + 1}`);

      const xhr = new XMLHttpRequest();
      let hasStarted = false;

      // Short timeout to detect "stuck" requests that never start
      let stuckTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        if (!hasStarted) {
          console.log('Request appears stuck, aborting...');
          xhr.abort();
          if (stuckTimer) clearTimeout(stuckTimer);
          if (attempts <= maxRetries) {
            setTimeout(tryUpload, RETRY_DELAY);
          } else {
            reject(new Error('Upload failed: request never started after retries'));
          }
        }
      }, UPLOAD_STUCK_TIMEOUT);

      xhr.open('POST', path);

      const clearStuckTimer = () => {
        if (stuckTimer) {
          clearTimeout(stuckTimer);
          stuckTimer = null;
        }
      };

      xhr.onreadystatechange = () => {
        // readyState 2 = HEADERS_RECEIVED (server has received the request)
        if (xhr.readyState >= 2 && !hasStarted) {
          hasStarted = true;
          clearStuckTimer();
          console.log('Request started successfully');
        }
      };

      if (xhr.upload) {
        xhr.upload.onprogress = (event) => {
          hasStarted = true;
          clearStuckTimer();
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        };
      }

      // Longer timeout for the actual upload (adjust based on your file sizes)
      xhr.timeout = UPLOAD_TIMEOUT;

      xhr.ontimeout = () => {
        clearStuckTimer();
        if (attempts <= maxRetries) {
          console.log('Request timed out, retrying...');
          setTimeout(tryUpload, RETRY_DELAY);
        } else {
          reject(new Error('Upload timed out after retries'));
        }
      };

      xhr.onload = () => {
        clearStuckTimer();
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            resolve(xhr.responseText);
          }
        } else {
          // Don't retry on server errors (4xx, 5xx) - only on stuck/timeout
          try {
            const errorData = JSON.parse(xhr.responseText);
            reject(new Error(errorData?.message || 'Upload failed'));
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => {
        clearStuckTimer();
        if (attempts <= maxRetries) {
          console.log('Network error, retrying...');
          setTimeout(tryUpload, RETRY_DELAY);
        } else {
          reject(new Error('Network error during upload'));
        }
      };

      xhr.send(formData);
    };

    tryUpload();
  });
}

/**
 * Triggers a browser download by navigating to the URL.
 */
export function triggerDownload(path: string): void {
  // Create a temporary hidden link and click it
  const link = document.createElement('a');
  link.href = path;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
