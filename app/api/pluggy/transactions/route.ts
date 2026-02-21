import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthContext, unauthorized, cached, withCache } from '@/lib/api-helpers'
import { cacheKeys, cacheTTL, buildCacheHash } from '@/lib/redis'

export async function GET(req: NextRequest) {
    try {
        const ctx = await getAuthContext()
        if (!ctx) return unauthorized()

        const { searchParams } = req.nextUrl
        const accountId = searchParams.get('accountId')
        const from = searchParams.get('from')
        const to = searchParams.get('to')
        const q = searchParams.get('q')
        const page = parseInt(searchParams.get('page') ?? '1', 10)
        const pageSize = parseInt(searchParams.get('pageSize') ?? '50', 10)

        const hash = buildCacheHash({ accountId, from, to, q, page, pageSize })
        const key = cacheKeys.transactions(ctx.tenantId, hash)

        const { data, hit } = await withCache(key, cacheTTL.transactions, async () => {
            const where: any = { tenantId: ctx.tenantId }

            if (q) {
                where.description = { contains: q, mode: 'insensitive' }
            }

            if (accountId) {
                const account = await prisma.pluggyAccount.findUnique({
                    where: { accountId },
                    select: { id: true },
                })
                if (account) {
                    where.pluggyAccountDbId = account.id
                }
            }

            if (from || to) {
                where.date = {}
                if (from) where.date.gte = new Date(from)
                if (to) where.date.lte = new Date(to)
            }

            const activeWhere = { ...where, ignored: false }

            const [transactions, total, incomeAgg, expensesAgg] = await Promise.all([
                prisma.pluggyTransaction.findMany({
                    where,
                    include: {
                        pluggyAccount: {
                            select: { accountId: true, name: true, type: true },
                        },
                    },
                    orderBy: { date: 'desc' },
                    skip: (page - 1) * pageSize,
                    take: pageSize,
                }),
                prisma.pluggyTransaction.count({ where }),
                prisma.pluggyTransaction.aggregate({
                    where: { ...activeWhere, amount: { gt: 0 } },
                    _sum: { amount: true },
                }),
                prisma.pluggyTransaction.aggregate({
                    where: { ...activeWhere, amount: { lt: 0 } },
                    _sum: { amount: true },
                }),
            ])

            const totalIncome = incomeAgg._sum.amount ?? 0
            const totalExpenses = Math.abs(expensesAgg._sum.amount ?? 0)

            return {
                transactions,
                total,
                totalIncome,
                totalExpenses,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
            }
        })

        return cached(data, cacheTTL.transactions, hit)
    } catch (error: any) {
        console.error('GET /api/pluggy/transactions error:', error)
        return NextResponse.json({ error: 'Erro ao listar transações' }, { status: 500 })
    }
}
