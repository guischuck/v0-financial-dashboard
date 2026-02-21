import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const tenantUser = await prisma.tenantUser.findFirst({
      where: { clerkUserId: userId },
    })
    if (!tenantUser) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 })
    }

    const { searchParams } = req.nextUrl
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')
    const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 200)

    const where: Record<string, unknown> = { tenantId: tenantUser.tenantId }
    if (entityType) where.entityType = entityType
    if (entityId) where.entityId = entityId

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ logs })
  } catch (error) {
    console.error('GET /api/audit-logs error:', error)
    return NextResponse.json({ error: 'Erro ao buscar histórico' }, { status: 500 })
  }
}
