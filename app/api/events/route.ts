import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { subscribe, type SSEEvent } from '@/lib/sse'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const tenantUser = await prisma.tenantUser.findFirst({
    where: { clerkUserId: userId },
    select: { tenantId: true },
  })

  if (!tenantUser) {
    return new Response('Tenant not found', { status: 404 })
  }

  const tenantId = tenantUser.tenantId
  let unsubscribe: (() => void) | null = null

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      const send = (event: SSEEvent) => {
        try {
          const data = JSON.stringify(event)
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        } catch {
          // stream closed
        }
      }

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        } catch {
          clearInterval(heartbeat)
        }
      }, 30_000)

      unsubscribe = subscribe(tenantId, send)

      // Send initial connection event
      send({ type: 'connected', tenantId })
    },
    cancel() {
      if (unsubscribe) unsubscribe()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
