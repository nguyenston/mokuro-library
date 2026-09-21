/**
 * Smart API cache with stale-while-revalidate pattern
 * Serves cached data instantly while fetching fresh data in background
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  promise?: Promise<T>;
  stale?: boolean;
}

class APICache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxAge = 60 * 60 * 1000; // 60 minutes default
  private staleTime = 30 * 1000; // 30 seconds - serve stale while revalidating
  private currentUserId: string | null = null;

  /**
   * Get cached data or fetch fresh
   * Returns cached data immediately if available, fetches in background if stale
   */
  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: {
      maxAge?: number;
      staleTime?: number;
      skipCache?: boolean;
      onStaleRefetch?: (data: T) => void;
    }
  ): Promise<T> {
    // We assert here because chance of key collision is near 0
    const now = Date.now();
    const cached = this.cache.get(key) as CacheEntry<T> | undefined;

    // 1. Calculate state
    const age = now - (cached?.timestamp ?? 0);
    const isExpired = !cached || age > (options?.maxAge ?? this.maxAge);
    const isStale = age > (options?.staleTime ?? this.staleTime);

    // 2. GROUPED: Fetch Fresh Logic (Blocking)
    // We fetch and wait if: forced skip, no cache exists, or data is hard-expired.
    if (options?.skipCache || isExpired) {
      const data = await fetcher();
      this.set(key, data);
      return data;
    }

    // 3. Request Collapsing
    // If we get here, cache exists and isn't expired. If it's already fetching, join in.
    if (cached.promise) {
      return await cached.promise;
    }

    // 4. Stale-While-Revalidate (Non-Blocking)
    // Data is usable but old. Trigger background update and return old data immediately.
    if (isStale || cached.stale) {
      const promise = fetcher();
      cached.promise = promise;

      promise
        .then((data) => {
          this.set(key, data);
          options?.onStaleRefetch?.(data);
        })
        .catch((err) => {
          console.error('Background revalidation failed:', err);
          delete cached.promise;
        });

      return cached.data as T;
    }

    // 5. Fresh Hit
    return cached.data as T;
  }

  /**
   * Set cache entry
   */
  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      promise: undefined
    });
  }

  /**
   * Prefetch data (fetch and cache without returning)
   */
  async prefetch<T>(key: string, fetcher: () => Promise<T>): Promise<void> {
    const cached = this.cache.get(key);
    const now = Date.now();

    // Skip if fresh data exists
    if (cached && now - cached.timestamp < this.staleTime) {
      return;
    }

    // Skip if already prefetching
    if (cached?.promise) {
      return;
    }

    try {
      const promise = fetcher();
      this.cache.set(key, {
        data: cached?.data ?? (null as unknown),
        timestamp: now,
        promise
      });
      const data = await promise;
      this.set(key, data);
    } catch (err) {
      console.error('Prefetch failed:', err);
      const current = this.cache.get(key);
      if (current?.promise) {
        delete current.promise;
      }
    }
  }

  /**
   * Invalidate cache entries by prefix
   */
  invalidate(prefix: string, hard: boolean = false): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        if (hard) this.cache.delete(key);
        else {
          const entry = this.cache.get(key);
          if (!entry) return;
          else this.cache.set(key, { ...entry, stale: true });
        }
      }
    }
  }

  invalidateExact(key: string, hard?: boolean): void {
    if (hard) this.cache.delete(key);
    else {
      const entry = this.cache.get(key);
      if (!entry) return;
      else this.cache.set(key, { ...entry, stale: true });
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear all cache including user ID
   * Used on logout or session expiration
   */
  clearAllCache(): void {
    this.cache.clear();
    this.currentUserId = null;
    console.debug('All API cache cleared');
  }

  /**
   * Set current user ID and clear cache if user changed
   * Called after login/auth check to ensure cache is user-specific
   */
  setUserId(userId: string | null): void {
    if (this.currentUserId !== userId) {
      // User changed - clear all cache
      this.clear();
      this.currentUserId = userId;
    }
  }

  /**
   * Get current user ID
   */
  getUserId(): string | null {
    return this.currentUserId;
  }

  /**
   * Get cache stats
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Invalidate cache when user makes changes
   */
  invalidateLibraryCache(hard?: boolean): void {
    this.invalidate('GET:/api/library', hard);
  }

  invalidateStatsCache(hard?: boolean): void {
    this.invalidateExact('GET:/api/stats', hard);
  }

  invalidateContributionsCache(hard?: boolean): void {
    this.invalidate('GET:/api/contributions', hard);
  }

  invalidateSeriesCache(options?: { seriesId?: string; hard?: boolean }): void {
    if (options?.seriesId)
      this.invalidateExact(`GET:/api/library/series/${options.seriesId}`, options.hard);
    else this.invalidate(`GET:/api/library/series`, options?.hard);
  }

  invalidateVolumeCache(options?: { volumeId?: string; hard?: boolean }): void {
    if (options?.volumeId)
      this.invalidateExact(`GET:/api/library/volume/${options.volumeId}`, options.hard);
    else this.invalidate(`GET:/api/library/volume`, options?.hard);
  }
}

export const apiCache = new APICache();
