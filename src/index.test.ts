import type { Context, MiddlewareHandler } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { type CacheOptions, memCache } from './index';

describe('memCache', () => {
  const createMockContext = (opts?: { method?: string; url: string }): Context =>
    ({
      req: { url: opts?.url ?? '/test', method: opts?.method ?? 'GET' },
      res: {
        headers: new Map(),
        clone: vi.fn().mockReturnValue({ headers: new Map() }),
        ok: true,
        status: 200,
      },
    }) as unknown as Context;

  const createMockNext = () => vi.fn();

  it('should cache a response and return it on subsequent requests', async () => {
    const opts: CacheOptions = { max: 10, ttl: 1000 };
    const middleware = memCache(opts);

    const context1 = createMockContext();
    const next1 = createMockNext();

    // First request (cache miss)
    await middleware(context1, next1);
    expect(next1).toHaveBeenCalledOnce();
    expect(context1.res.headers.get('X-Cache')).toBe('MISS');

    const context2 = createMockContext();
    const next2 = createMockNext();

    // Second request (cache hit)
    await middleware(context2, next2);
    expect(next2).not.toHaveBeenCalled();
    expect(context2.res.headers.get('X-Cache')).toBe('HIT');
  });

  it('should not cache a response if keyGenerator returns null', async () => {
    const opts: CacheOptions = {
      max: 10,
      ttl: 1000,
      key: () => null,
    };
    const middleware = memCache(opts);

    const context = createMockContext();
    const next = createMockNext();

    await middleware(context, next);
    expect(next).toHaveBeenCalledOnce();
    expect(context.res.headers.get('X-Cache')).toBeUndefined();
  });

  it('should not cache non-GET requests', async () => {
    const opts: CacheOptions = { max: 10, ttl: 1000 };
    const middleware = memCache(opts);

    const context = createMockContext({ method: 'POST', url: '/test' });
    const next = createMockNext();

    await middleware(context, next);
    expect(next).toHaveBeenCalledOnce();
    expect(context.res.headers.get('X-Cache')).toBeUndefined();
  });

  it('should handle custom keyGenerator', async () => {
    const opts: CacheOptions = {
      max: 10,
      ttl: 1000,
      key: (c) => `custom:${c.req.url}`,
    };
    const middleware = memCache(opts);

    const context1 = createMockContext({ url: '/test1', method: 'GET' });
    const next1 = createMockNext();

    // First request (cache miss)
    await middleware(context1, next1);
    expect(next1).toHaveBeenCalledOnce();
    expect(context1.res.headers.get('X-Cache')).toBe('MISS');

    const context2 = createMockContext({ url: '/test1', method: 'POST' });
    const next2 = createMockNext();

    // Second request (cache hit)
    await middleware(context2, next2);
    expect(next2).not.toHaveBeenCalled();
    expect(context2.res.headers.get('X-Cache')).toBe('HIT');
  });

  it('should evict the oldest item when max size is exceeded', async () => {
    const opts: CacheOptions = { max: 2, ttl: 1000 };
    const middleware = memCache(opts);

    const context1 = createMockContext({ url: '/test1' });
    const context2 = createMockContext({ url: '/test2' });
    const context3 = createMockContext({ url: '/test3' });

    const next = createMockNext();

    // Add three items to the cache
    await middleware(context1, next);
    await middleware(context2, next);
    await middleware(context3, next);

    // First item should be evicted
    const context1Again = createMockContext({ url: '/test1' });
    await middleware(context1Again, next);
    expect(context1Again.res.headers.get('X-Cache')).toBe('MISS');
  });

  it('should expire items after TTL', async () => {
    const opts: CacheOptions = { max: 10, ttl: 100 };
    const middleware = memCache(opts);

    const context = createMockContext();
    const next = createMockNext();

    // Cache the response
    await middleware(context, next);
    expect(context.res.headers.get('X-Cache')).toBe('MISS');

    // Wait for TTL to expire
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Request again (should be a cache miss)
    await middleware(context, next);
    expect(context.res.headers.get('X-Cache')).toBe('MISS');
  });

  it('should clone the response before caching', async () => {
    const opts: CacheOptions = { max: 10, ttl: 1000 };
    const middleware = memCache(opts);

    const context = createMockContext();
    const next = createMockNext();

    await middleware(context, next);

    // Ensure the response was cloned
    expect(context.res.clone).toHaveBeenCalled();
  });

  it('should cache the response if the custom validate function returns true', async () => {
    const opts: CacheOptions = {
      max: 10,
      ttl: 1000,
      validate: () => true,
    };
    const middleware = memCache(opts);

    const context = createMockContext();
    const next = createMockNext();

    await middleware(context, next);
    expect(next).toHaveBeenCalledOnce();
    expect(context.res.headers.get('X-Cache')).toBe('MISS');

    const context2 = createMockContext();
    const next2 = createMockNext();

    await middleware(context2, next2);
    expect(next2).not.toHaveBeenCalled();
    expect(context2.res.headers.get('X-Cache')).toBe('HIT');
  });

  it('should not cache the response if the custom validate function returns false', async () => {
    const opts: CacheOptions = {
      max: 10,
      ttl: 1000,
      validate: () => false,
    };
    const middleware = memCache(opts);

    const context = createMockContext();
    const next = createMockNext();

    await middleware(context, next);
    expect(next).toHaveBeenCalledOnce();
    expect(context.res.headers.get('X-Cache')).toBe('MISS');

    const context2 = createMockContext();
    const next2 = createMockNext();

    await middleware(context2, next2);
    expect(next2).toHaveBeenCalledOnce();
    expect(context2.res.headers.get('X-Cache')).toBe('MISS');
  });

  it('should use the default response validator if no custom validate function is provided', async () => {
    const opts: CacheOptions = { max: 10, ttl: 1000 };
    const middleware = memCache(opts);

    const context = createMockContext();
    const next = createMockNext();

    await middleware(context, next);
    expect(next).toHaveBeenCalledOnce();
    expect(context.res.headers.get('X-Cache')).toBe('MISS');

    const context2 = createMockContext();
    const next2 = createMockNext();

    await middleware(context2, next2);
    expect(next2).not.toHaveBeenCalled();
    expect(context2.res.headers.get('X-Cache')).toBe('HIT');
  });

  it('should handle async custom validate functions', async () => {
    const opts: CacheOptions = {
      max: 10,
      ttl: 1000,
      validate: async () => true,
    };
    const middleware = memCache(opts);

    const context = createMockContext();
    const next = createMockNext();

    await middleware(context, next);
    expect(next).toHaveBeenCalledOnce();
    expect(context.res.headers.get('X-Cache')).toBe('MISS');

    const context2 = createMockContext();
    const next2 = createMockNext();

    await middleware(context2, next2);
    expect(next2).not.toHaveBeenCalled();
    expect(context2.res.headers.get('X-Cache')).toBe('HIT');
  });
});
