import type { Context, MiddlewareHandler } from 'hono';
import { LRUCache } from 'lru-cache';

export type KeyGenerator = (c: Context) => string | null | Promise<string | null>;
export type ResponseValidator = (c: Context) => boolean | Promise<boolean>;

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

  /**
   * A function to validate the response before caching.
   * If it returns false, the response will not be cached.
   * If not set, only successful responses (2xx) will be cached by default.
   */
  validate?: ResponseValidator;
}

/**
 * A middleware function for caching responses in memory using LRU cache.
 *
 * @param opts Cache options
 * @returns Middleware handler
 */
export function memCache(opts: CacheOptions): MiddlewareHandler {
  const { max, ttl, key, validate } = opts;

  const keyGenerator: KeyGenerator = key || defaultKeyGenerator;
  const resValidator: ResponseValidator = validate || defaultResponseValidator;

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
      if (await resValidator(c)) {
        cache.set(key, c.res.clone());
      }
      c.res.headers.set('X-Cache', 'MISS');
    }
  };
}

const defaultKeyGenerator: KeyGenerator = (c: Context) => (c.req.method === 'GET' ? c.req.url : null);
const defaultResponseValidator: ResponseValidator = (c: Context) => c.res.ok;
