import { LRUCache } from 'lru-cache';

type CacheValue = any;

class LibraryCache {
  private static instance: LibraryCache;
  private queryCache: LRUCache<string, CacheValue>;
  private tagMap: Map<string, Set<string>> = new Map();
  private keyToTagsMap = new Map<string, Set<string>>();

  constructor() {
    this.queryCache = new LRUCache<string, CacheValue>({
      max: 1000,
      ttl: 1000 * 60 * 5, // 5 minutes
      // CRITICAL: This fires whenever a key is deleted OR expires
      dispose: (_value, key, _reason) => {
        this.cleanupTagsForKey(key);
      },
    });
  }

  public static getInstance(): LibraryCache {
    if (!LibraryCache.instance) {
      LibraryCache.instance = new LibraryCache();
    }
    return LibraryCache.instance;
  }

  /**
   * Internal helper to scrub the tag maps when a key is removed
   */
  private cleanupTagsForKey(key: string) {
    const tags = this.keyToTagsMap.get(key);
    if (!tags) return;

    for (const tag of tags) {
      const keysForTag = this.tagMap.get(tag);
      if (keysForTag) {
        keysForTag.delete(key);
        // Save RAM: if no more keys use this tag, remove the Set
        if (keysForTag.size === 0) {
          this.tagMap.delete(tag);
        }
      }
    }
    this.keyToTagsMap.delete(key);
  }

  public async cachedQuery<T>(
    key: string,
    tags: string[],
    queryFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.queryCache.get(key) as T | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const result = await queryFn();

    // Only cache if there's actually data
    if (result !== null && result !== undefined) {
      // 1. Map Key -> Tags for later cleanup
      this.keyToTagsMap.set(key, new Set(tags));

      // 2. Map Tags -> Key for invalidation
      tags.forEach(tag => {
        if (!this.tagMap.has(tag)) this.tagMap.set(tag, new Set());
        this.tagMap.get(tag)!.add(key);
      });

      // 3. Set the actual data (LRU handles the TTL)
      this.queryCache.set(key, result, ttl ? { ttl } : undefined);
    }
    return result;
  }

  public invalidateTags(tags: string[]) {
    tags.forEach(tag => {
      const keys = this.tagMap.get(tag);
      if (keys) {
        // We convert to array because queryCache.delete triggers dispose()
        // which modifies the tagMap we are currently iterating.
        Array.from(keys).forEach(key => {
          this.queryCache.delete(key);
        });
      }
    });
  }

  // Prefix deletion is slow with LRU but works for manual overrides
  public invalidateCacheByPrefix(prefix: string) {
    for (const key of this.queryCache.keys()) {
      if (key.startsWith(prefix)) {
        this.queryCache.delete(key);
      }
    }
  }
}

export const libraryCache = LibraryCache.getInstance();
