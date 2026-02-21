import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { invalidatePattern, cacheKeys } from '@/lib/redis'
import { refreshKpiView } from '@/lib/kpi-view'
import { publishEvent } from '@/lib/sse'
import {
    getTenantIdByPluggyItemId,
    getPluggyClientForTenant,
    syncAccountsForItem,
    syncTransactionsForAccount,
} from '@/lib/pluggy'

export async function POST(req: NextRequest) {
    let payload: any

    try {
        payload = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { event, itemId, accountId, transactionIds } = payload

    if (!event) {
        return NextResponse.json({ error: 'Missing event' }, { status: 400 })
    }

    processWebhookEvent(event, itemId, accountId, transactionIds, payload).catch((err) =>
        console.error('Webhook processing error:', err)
    )

    return NextResponse.json({ received: true })
}

async function processWebhookEvent(
    event: string,
    itemId?: string,
    accountId?: string,
    transactionIds?: string[],
    payload?: any
) {
    if (!itemId) return

    const tenantId = await getTenantIdByPluggyItemId(itemId)
    if (!tenantId) {
        console.warn(`Webhook received for unknown itemId: ${itemId}`)
        return
    }

    await prisma.auditLog.create({
        data: {
            tenantId,
            action: `webhook.pluggy.${event}`,
            metadata: payload,
        },
    })

    const pluggyItem = await prisma.pluggyItem.findUnique({
        where: { itemId },
    })
    if (!pluggyItem) return

    switch (event) {
        case 'item/created':
        case 'item/updated': {
            const { client } = await getPluggyClientForTenant(tenantId)

            const item = await client.fetchItem(itemId)
            await prisma.pluggyItem.update({
                where: { itemId },
                data: {
                    status: item.status,
                    connectorId: item.connector.id,
                    connectorName: item.connector.name,
                    lastSyncAt: new Date(),
                },
            })

            const accounts = await syncAccountsForItem(client, tenantId, pluggyItem.id, itemId)

            for (const acc of accounts) {
                await syncTransactionsForAccount(client, tenantId, acc.id, acc.accountId)
            }
            break
        }

        case 'item/error': {
            await prisma.pluggyItem.update({
                where: { itemId },
                data: { status: 'ERROR' },
            })
            break
        }

        case 'item/deleted': {
            await prisma.pluggyItem.delete({
                where: { itemId },
            }).catch(() => {})
            break
        }

        case 'transactions/created': {
            if (!accountId) break
            const { client } = await getPluggyClientForTenant(tenantId)

            const account = await prisma.pluggyAccount.findUnique({
                where: { accountId },
            })
            if (!account) break

            const createdAtFrom = payload?.transactionsCreatedAtFrom
            await syncTransactionsForAccount(client, tenantId, account.id, accountId, {
                from: createdAtFrom,
            })

            await prisma.pluggyItem.update({
                where: { id: pluggyItem.id },
                data: { lastSyncAt: new Date() },
            })
            break
        }

        case 'transactions/updated': {
            if (!transactionIds?.length || !accountId) break
            const { client } = await getPluggyClientForTenant(tenantId)

            const account = await prisma.pluggyAccount.findUnique({
                where: { accountId },
            })
            if (!account) break

            const txResponse = await client.fetchTransactions(accountId, {
                ids: transactionIds,
            })

            for (const tx of txResponse.results ?? []) {
                await prisma.pluggyTransaction.upsert({
                    where: { transactionId: tx.id },
                    create: {
                        pluggyAccountDbId: account.id,
                        tenantId,
                        transactionId: tx.id,
                        description: tx.description ?? '',
                        descriptionRaw: tx.descriptionRaw ?? null,
                        amount: tx.amount ?? 0,
                        type: tx.type ?? 'DEBIT',
                        category: tx.category ?? null,
                        categoryId: tx.categoryId ?? null,
                        date: new Date(tx.date),
                        balance: tx.balance ?? null,
                        currencyCode: tx.currencyCode ?? 'BRL',
                        status: tx.status ?? null,
                        merchant: tx.merchant ? JSON.parse(JSON.stringify(tx.merchant)) : null,
                        creditCardMetadata: tx.creditCardMetadata ? JSON.parse(JSON.stringify(tx.creditCardMetadata)) : null,
                        paymentData: tx.paymentData ? JSON.parse(JSON.stringify(tx.paymentData)) : null,
                    },
                    update: {
                        description: tx.description ?? '',
                        descriptionRaw: tx.descriptionRaw ?? null,
                        amount: tx.amount ?? 0,
                        type: tx.type ?? 'DEBIT',
                        category: tx.category ?? null,
                        categoryId: tx.categoryId ?? null,
                        date: new Date(tx.date),
                        balance: tx.balance ?? null,
                        status: tx.status ?? null,
                        merchant: tx.merchant ? JSON.parse(JSON.stringify(tx.merchant)) : null,
                        creditCardMetadata: tx.creditCardMetadata ? JSON.parse(JSON.stringify(tx.creditCardMetadata)) : null,
                        paymentData: tx.paymentData ? JSON.parse(JSON.stringify(tx.paymentData)) : null,
                    },
                })
            }

            await prisma.pluggyItem.update({
                where: { id: pluggyItem.id },
                data: { lastSyncAt: new Date() },
            })
            break
        }

        case 'transactions/deleted': {
            if (!transactionIds?.length) break
            await prisma.pluggyTransaction.deleteMany({
                where: {
                    transactionId: { in: transactionIds },
                    tenantId,
                },
            })
            break
        }

        default:
            console.log(`Unhandled Pluggy webhook event: ${event}`)
    }

    await invalidatePattern(cacheKeys.tenantAll(tenantId))
    refreshKpiView().catch(() => {})
    publishEvent(tenantId, { type: 'sync', event })
}
