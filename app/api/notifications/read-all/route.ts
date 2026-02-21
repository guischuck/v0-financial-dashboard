import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const tenantUser = await prisma.tenantUser.findFirst({
      where: { clerkUserId: userId },
    })
    if (!tenantUser) return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })

    await prisma.notification.updateMany({
      where: { tenantId: tenantUser.tenantId, read: false },
      data: { read: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/notifications/read-all error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
