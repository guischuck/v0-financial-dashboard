import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthContext, unauthorized } from '@/lib/api-helpers'
import { invalidatePattern, cacheKeys } from '@/lib/redis'
import {
    getPluggyClientForTenant,
    syncAccountsForItem,
    syncTransactionsForAccount,
} from '@/lib/pluggy'
import { notifySync } from '@/lib/notifications'
import { refreshKpiView } from '@/lib/kpi-view'
import { precomputeReconciliation } from '@/lib/reconciliation-worker'
import { publishEvent } from '@/lib/sse'

export async function POST(req: NextRequest) {
    try {
        const ctx = await getAuthContext()
        if (!ctx) return unauthorized()

        const body = await req.json().catch(() => ({}))
        const fromDate = body.from as string | undefined
        const toDate = body.to as string | undefined

        const { client, tenantId } = await getPluggyClientForTenant(ctx.tenantId)

        const items = await prisma.pluggyItem.findMany({
            where: { tenantId },
        })

        if (items.length === 0) {
            return NextResponse.json({ error: 'Nenhuma conexão Pluggy encontrada' }, { status: 400 })
        }

        let totalAccounts = 0
        let totalTransactions = 0

        for (const item of items) {
            const accounts = await syncAccountsForItem(client, tenantId, item.id, item.itemId)
            totalAccounts += accounts.length

            for (const acc of accounts) {
                const txCount = await syncTransactionsForAccount(
                    client,
                    tenantId,
                    acc.id,
                    acc.accountId,
                    { from: fromDate, to: toDate }
                )
                totalTransactions += txCount
            }

            await prisma.pluggyItem.update({
                where: { id: item.id },
                data: { lastSyncAt: new Date() },
            })
        }

        await prisma.auditLog.create({
            data: {
                tenantId,
                userId: ctx.userId,
                action: 'pluggy.sync',
                metadata: { totalAccounts, totalTransactions },
            },
        })

        await notifySync(tenantId, 'pluggy', {
            accounts: totalAccounts,
            transactions: totalTransactions,
        })

        await invalidatePattern(cacheKeys.tenantAll(tenantId))
        refreshKpiView().catch(() => {})
        precomputeReconciliation(tenantId, ctx.userId, { from: fromDate, to: toDate }).catch(() => {})
        publishEvent(tenantId, { type: 'sync_complete', totalAccounts, totalTransactions })

        return NextResponse.json({
            success: true,
            totalAccounts,
            totalTransactions,
        })
    } catch (error: any) {
        console.error('POST /api/pluggy/sync error:', error)
        return NextResponse.json(
            { error: error.message || 'Erro ao sincronizar' },
            { status: 500 }
        )
    }
}
