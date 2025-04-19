# Hono Mem Cache

A lightweight, in-memory caching middleware for [Hono](https://hono.dev/) applications.

## Features

- 🚀 Simple LRU-based memory caching
- ⏱️ Configurable time-to-live (TTL) for cached responses
- 🔑 Custom cache key generation
- 🔄 Automatic cache headers

## Installation

```bash
# npm
npm install hono-mem-cache

# yarn
yarn add hono-mem-cache

# pnpm
pnpm add hono-mem-cache
```

## Usage

### Basic Example

```ts
import { Hono } from 'hono'
import { memCache } from 'hono-mem-cache'

const app = new Hono()

// Apply the middleware to cache responses
app.use(
  '/api/*',
  memCache({
    max: 100, // Maximum number of items in cache
    ttl: 60000, // TTL of 60 seconds
  })
)

app.get('/api/users', (c) => {
  // This response will be cached
  return c.json({ users: ['user1', 'user2'] })
})

app.post('/api/users', (c) => {
  // POST requests won't be cached by default
  return c.json({ success: true })
})
```

### Custom Cache Key Generator

You can customize how cache keys are generated:

```ts
import { Hono } from 'hono'
import { memCache } from 'hono-mem-cache'

const app = new Hono()

app.use(
  '/api/*',
  memCache({
    max: 100,
    ttl: 30000, // 30 seconds
    key: (c) => {
      // Cache based on URL and a custom header
      const authHeader = c.req.header('Authorization')
      if (!authHeader) return null // Don't cache if not authenticated

      return `${c.req.method}:${c.req.url}:${authHeader}`
    }
  })
)
```

## API

### `memCache(options)`

Creates a Hono middleware function for caching responses.

#### Options

| Name | Type | Description |
|------|------|-------------|
| `max` | `number` | **Required**. The maximum number of items in the cache. |
| `ttl` | `number` | Optional. Time-to-live in milliseconds. If not set, cache items won't expire. |
| `key` | `(c: Context) => string \| null \| Promise<string \| null>` | Optional. A function to generate cache keys. Return `null` to skip caching. |

### Cache Headers

The middleware automatically adds the following response header:

- `X-Cache: HIT` - When serving a cached response
- `X-Cache: MISS` - When a response wasn't found in cache

## How It Works

1. The middleware generates a cache key based on the request
2. If a cached response exists, it's served immediately
3. If not, the request flows through the middleware chain and the response is cached for future requests

By default, only GET requests are cached.

## License

MIT
