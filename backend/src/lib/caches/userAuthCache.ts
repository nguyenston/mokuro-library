import { LRUCache } from 'lru-cache';
import { AuthUser } from '../../types/fastify';

class UserAuthCache {
  private static instance: UserAuthCache;
  private cache: LRUCache<string, AuthUser>;

  private constructor() {
    this.cache = new LRUCache<string, AuthUser>({
      max: 2000,
      // 5 minutes is a good balance between performance and security/staleness
      ttl: 1000 * 60 * 5,
    });
  }

  public static getInstance(): UserAuthCache {
    if (!UserAuthCache.instance) {
      UserAuthCache.instance = new UserAuthCache();
    }
    return UserAuthCache.instance;
  }

  public get(userId: string): AuthUser | undefined {
    return this.cache.get(userId);
  }

  public set(userId: string, user: AuthUser): void {
    this.cache.set(userId, user);
  }

  public delete(userId: string): void {
    this.cache.delete(userId);
  }

  public clearAll(): void {
    this.cache.clear();
  }
}

export const userAuthCache = UserAuthCache.getInstance();
