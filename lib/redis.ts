import { Ratelimit } from '@upstash/ratelimit'

// ─── Redis availability check ────────────────────────────────────────

const isRedisConfigured =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN

let _redis: any = null

function getRedis() {
  if (!isRedisConfigured) return null
  if (_redis) return _redis
  const { Redis } = require('@upstash/redis') as typeof import('@upstash/redis')
  _redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
  return _redis
}

// ─── Cache Helpers (tenant-scoped) ───────────────────────────────────

export async function getCached<T>(key: string): Promise<T | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    return await redis.get<T>(key)
  } catch (err) {
    console.error('[REDIS] getCached error:', err)
    return null
  }
}

export async function setCached<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.set(key, data, { ex: ttlSeconds })
  } catch (err) {
    console.error('[REDIS] setCached error:', err)
  }
}

export async function invalidateCache(...keys: string[]): Promise<void> {
  const redis = getRedis()
  if (!redis || keys.length === 0) return
  try {
    await redis.del(...keys)
  } catch (err) {
    console.error('[REDIS] invalidateCache error:', err)
  }
}

export async function invalidatePattern(pattern: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    let cursor = '0'
    const allKeys: string[] = []
    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 100 })
      cursor = String(nextCursor)
      allKeys.push(...keys)
    } while (cursor !== '0')

    if (allKeys.length > 0) {
      const batchSize = 100
      for (let i = 0; i < allKeys.length; i += batchSize) {
        await redis.del(...allKeys.slice(i, i + batchSize))
      }
    }
  } catch (err) {
    console.error('[REDIS] invalidatePattern error:', err)
  }
}

// ─── Cache Key Builders ──────────────────────────────────────────────

export const cacheKeys = {
  settings: (tenantId: string) => `tenant:${tenantId}:settings`,
  accounts: (tenantId: string) => `tenant:${tenantId}:accounts`,
  transactions: (tenantId: string, hash: string) => `tenant:${tenantId}:txns:${hash}`,
  customers: (tenantId: string) => `tenant:${tenantId}:customers`,
  reconciliation: (tenantId: string, hash: string) => `tenant:${tenantId}:recon:${hash}`,
  kpis: (tenantId: string, month: string) => `tenant:${tenantId}:kpis:${month}`,
  tenantAll: (tenantId: string) => `tenant:${tenantId}:*`,
} as const

// ─── Cache TTLs (seconds) ────────────────────────────────────────────

export const cacheTTL = {
  settings: 300,       // 5 min
  accounts: 120,       // 2 min
  transactions: 60,    // 1 min
  customers: 600,      // 10 min
  reconciliation: 30,  // 30 sec
  kpis: 120,           // 2 min
} as const

// ─── Rate Limiter ────────────────────────────────────────────────────

let _rateLimiter: Ratelimit | null = null

export function getRateLimiter(): Ratelimit | null {
  const redis = getRedis()
  if (!redis) return null
  if (_rateLimiter) return _rateLimiter
  _rateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '1 m'),
    prefix: 'ratelimit:api',
    analytics: true,
  })
  return _rateLimiter
}

/** @deprecated Use getRateLimiter() instead - this may be null */
export const rateLimiter = null as unknown as Ratelimit

// ─── Hash Helper ─────────────────────────────────────────────────────

export function buildCacheHash(params: Record<string, string | number | boolean | null | undefined>): string {
  const sorted = Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
  let hash = 0
  for (let i = 0; i < sorted.length; i++) {
    hash = ((hash << 5) - hash + sorted.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(36)
}
