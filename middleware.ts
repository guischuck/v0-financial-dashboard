import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
    '/login(.*)',
    '/register(.*)',
    '/forgot-password(.*)',
    '/onboarding(.*)',
    '/api/webhooks/(.*)',
])

const isApiRoute = createRouteMatcher(['/api/(.*)'])

let rateLimiter: any = null
let rateLimiterChecked = false

async function getRateLimiter() {
    if (rateLimiterChecked) return rateLimiter
    rateLimiterChecked = true

    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
        return null
    }

    try {
        const { Ratelimit } = await import('@upstash/ratelimit')
        const { Redis } = await import('@upstash/redis')
        rateLimiter = new Ratelimit({
            redis: new Redis({
                url: process.env.UPSTASH_REDIS_REST_URL!,
                token: process.env.UPSTASH_REDIS_REST_TOKEN!,
            }),
            limiter: Ratelimit.slidingWindow(60, '1 m'),
            prefix: 'ratelimit:api',
        })
    } catch {
        rateLimiter = null
    }
    return rateLimiter
}

export default clerkMiddleware(async (auth, req) => {
    if (!isPublicRoute(req)) {
        await auth.protect()
    }

    if (isApiRoute(req) && !isPublicRoute(req)) {
        const rl = await getRateLimiter()
        if (rl) {
            const { userId } = await auth()
            if (userId) {
                try {
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

                    const response = NextResponse.next()
                    response.headers.set('X-RateLimit-Limit', String(limit))
                    response.headers.set('X-RateLimit-Remaining', String(remaining))
                    response.headers.set('X-RateLimit-Reset', String(reset))
                    return response
                } catch {
                    // rate limiter failed, allow request through
                }
            }
        }
    }
})

export const config = {
    matcher: [
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        '/(api|trpc)(.*)',
    ],
}
