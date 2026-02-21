import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getRateLimiter } from '@/lib/redis'

export async function checkRateLimit(req?: NextRequest): Promise<NextResponse | null> {
  try {
    const rl = getRateLimiter()
    if (!rl) return null

    const { userId } = await auth()
    if (!userId) return null

    const { success, limit, remaining, reset } = await rl.limit(userId)

    if (!success) {
      return NextResponse.json(
        { error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(reset),
            'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
          },
        }
      )
    }

    return null
  } catch {
    return null
  }
}

export function withRateLimit<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (...args: any[]) => {
    const rateLimited = await checkRateLimit()
    if (rateLimited) return rateLimited
    return handler(...args)
  }) as T
}
