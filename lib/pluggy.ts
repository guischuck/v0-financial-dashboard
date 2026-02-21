import { PluggyClient } from 'pluggy-sdk'
import { prisma } from './prisma'
import { decrypt } from './encryption'

export interface PluggyTenantContext {
    client: PluggyClient
    tenantId: string
}

/**
 * Creates a PluggyClient from a given tenant's encrypted credentials.
 * Throws if credentials are missing.
 */
export async function getPluggyClientForTenant(tenantId: string): Promise<PluggyTenantContext> {
    const settings = await prisma.tenantSettings.findUnique({
        where: { tenantId },
    })

    if (!settings?.pluggyApiKeyEnc || !settings?.pluggyClientIdEnc) {
        throw new Error('Credenciais da Pluggy não configuradas para este tenant')
    }

    const clientId = decrypt(settings.pluggyClientIdEnc)
    const clientSecret = decrypt(settings.pluggyApiKeyEnc)

    const client = new PluggyClient({ clientId, clientSecret })

    return { client, tenantId }
}

/**
 * Resolves tenantId from a Pluggy itemId (used in webhook processing
 * where we only receive itemId, not tenant info).
 */
export async function getTenantIdByPluggyItemId(itemId: string): Promise<string | null> {
    const item = await prisma.pluggyItem.findUnique({
        where: { itemId },
        select: { tenantId: true },
    })
    return item?.tenantId ?? null
}

/**
 * Sync all accounts for a given PluggyItem and persist them.
 */
export async function syncAccountsForItem(
    client: PluggyClient,
    tenantId: string,
    pluggyItemDbId: string,
    itemId: string
) {
    const accountsResponse = await client.fetchAccounts(itemId)
    const accounts = accountsResponse.results ?? []

    const synced = []

    for (const acc of accounts) {
        const upserted = await prisma.pluggyAccount.upsert({
            where: { accountId: acc.id },
            create: {
                pluggyItemDbId,
                tenantId,
                accountId: acc.id,
                name: acc.name,
                type: acc.type,
                subtype: acc.subtype ?? null,
                number: acc.number ?? null,
                balance: acc.balance ?? 0,
                currencyCode: acc.currencyCode ?? 'BRL',
                bankData: acc.bankData ? JSON.parse(JSON.stringify(acc.bankData)) : null,
            },
            update: {
                name: acc.name,
                type: acc.type,
                subtype: acc.subtype ?? null,
                number: acc.number ?? null,
                balance: acc.balance ?? 0,
                currencyCode: acc.currencyCode ?? 'BRL',
                bankData: acc.bankData ? JSON.parse(JSON.stringify(acc.bankData)) : null,
            },
        })
        synced.push(upserted)
    }

    return synced
}

/**
 * Sync transactions for a single account. Fetches from Pluggy API and upserts into DB.
 * Supports optional date filters.
 */
export async function syncTransactionsForAccount(
    client: PluggyClient,
    tenantId: string,
    pluggyAccountDbId: string,
    accountId: string,
    options?: { from?: string; to?: string }
) {
    let page = 1
    let totalPages = 1
    let totalSynced = 0

    while (page <= totalPages) {
        const params: any = {
            accountId,
            page,
            pageSize: 500,
        }
        if (options?.from) params.from = options.from
        if (options?.to) params.to = options.to

        const txResponse = await client.fetchTransactions(accountId, params)
        totalPages = txResponse.totalPages ?? 1

        const transactions = txResponse.results ?? []

        for (const tx of transactions) {
            await prisma.pluggyTransaction.upsert({
                where: { transactionId: tx.id },
                create: {
                    pluggyAccountDbId,
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
            totalSynced++
        }

        page++
    }

    return totalSynced
}
