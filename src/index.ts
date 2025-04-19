import type { Context, MiddlewareHandler } from 'hono';
import { LRUCache } from 'lru-cache';

export type KeyGenerator = (c: Context) => string | null | Promise<string | null>;

export interface CacheOptions {
  /**
   * The maximum number of items in the cache.
   */
  max: number;

  /**
   * The time-to-live (TTL) for cache items in milliseconds.
   * If not set, the cache will not expire items.
   */
  ttl?: number;

  /**
   * A function to generate a cache key based on the request context.
   * If it returns null, the request will not be cached.
   * If not set, the cache key will be generated based on the request method(GET only) and URL.
   */
  key?: KeyGenerator;
}

/**
 * A middleware function for caching responses in memory using LRU cache.
 *
 * @param opts Cache options
 * @returns Middleware handler
 */
export function memCache(opts: CacheOptions): MiddlewareHandler {
  const { max, ttl, key } = opts;

  const keyGenerator: KeyGenerator =
    key ||
    ((c: Context) => {
      const url = c.req.url;
      const method = c.req.method;
      if (method === 'GET') {
        return `${method}:${url}`;
      }
      return null;
    });

  const cache = new LRUCache<string, Response>({
    max,
    ttl,
  });

  return async (c, next) => {
    const key = await keyGenerator(c);
    if (key === null) {
      return next();
    }

    const cachedResponse = cache.get(key);
    if (cachedResponse) {
      c.res = cachedResponse;
      c.res.headers.set('X-Cache', 'HIT');
    } else {
      await next();
      cache.set(key, c.res.clone());
      c.res.headers.set('X-Cache', 'MISS');
    }
  };
}
