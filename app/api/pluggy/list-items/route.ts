import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

        const tenantUser = await prisma.tenantUser.findFirst({
            where: { clerkUserId: userId },
        })

        if (!tenantUser) {
            return NextResponse.json({ items: [] })
        }

        const items = await prisma.pluggyItem.findMany({
            where: { tenantId: tenantUser.tenantId },
            orderBy: { createdAt: 'desc' },
        })

        return NextResponse.json({ items })
    } catch (error: any) {
        console.error('Erro ao listar items:', error)
        return NextResponse.json(
            { error: 'Erro ao listar conexões' },
            { status: 500 }
        )
    }
}
