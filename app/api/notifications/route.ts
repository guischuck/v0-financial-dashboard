import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthContext, unauthorized, serverError } from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return unauthorized()

    const { searchParams } = new URL(req.url)
    const unreadOnly = searchParams.get('unread') === 'true'
    const limit = Math.min(Number(searchParams.get('limit')) || 30, 100)

    const where: Record<string, unknown> = { tenantId: ctx.tenantId }
    if (unreadOnly) where.read = false

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.notification.count({
        where: { tenantId: ctx.tenantId, read: false },
      }),
    ])

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    console.error('GET /api/notifications error:', error)
    return serverError()
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return unauthorized()

    const body = await req.json()
    const { id } = body

    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

    await prisma.notification.updateMany({
      where: { id, tenantId: ctx.tenantId },
      data: { read: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('PATCH /api/notifications error:', error)
    return serverError()
  }
}
