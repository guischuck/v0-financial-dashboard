import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthContext, unauthorized, cached, withCache } from '@/lib/api-helpers'
import { cacheKeys, cacheTTL } from '@/lib/redis'

export async function GET() {
    try {
        const ctx = await getAuthContext()
        if (!ctx) return unauthorized()

        const key = cacheKeys.accounts(ctx.tenantId)
        const { data, hit } = await withCache(key, cacheTTL.accounts, async () => {
            const accounts = await prisma.pluggyAccount.findMany({
                where: { tenantId: ctx.tenantId },
                include: {
                    pluggyItem: {
                        select: { itemId: true, connectorName: true, connectorLogo: true, status: true, lastSyncAt: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
            })
            return { accounts }
        })

        return cached(data, cacheTTL.accounts, hit)
    } catch (error: any) {
        console.error('GET /api/pluggy/accounts error:', error)
        return NextResponse.json({ error: 'Erro ao listar contas' }, { status: 500 })
    }
}
