import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdvboxConfig, advboxHeaders } from '@/lib/advbox'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const tenantUser = await prisma.tenantUser.findFirst({ where: { clerkUserId: userId } })
  if (!tenantUser) return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 })

  const config = await getAdvboxConfig(userId)
  if (!config) return NextResponse.json({ error: 'Advbox não configurado' }, { status: 400 })

  const { searchParams } = req.nextUrl
  const from = searchParams.get('from') ?? '2025-11-01'
  const to = searchParams.get('to') ?? '2026-02-28'

  // 1. Sample Pluggy transactions with raw paymentData
  const pluggyTxs = await prisma.pluggyTransaction.findMany({
    where: { tenantId: tenantUser.tenantId, type: 'CREDIT' },
    include: { pluggyAccount: { select: { name: true } } },
    orderBy: { date: 'desc' },
    take: 10,
  })

  // 2. Sample Advbox transactions
  const advboxUrl = `${config.baseUrl}/transactions?limit=10&date_due_start=${from}&date_due_end=${to}`
  const advboxRes = await fetch(advboxUrl, { headers: advboxHeaders(config.apiKey) })
  const advboxData = advboxRes.ok ? await advboxRes.json() : { error: advboxRes.status }

  // 3. Sample Advbox customers
  const custUrl = `${config.baseUrl}/customers?limit=10`
  const custRes = await fetch(custUrl, { headers: advboxHeaders(config.apiKey) })
  const custData = custRes.ok ? await custRes.json() : { error: custRes.status }

  return NextResponse.json({
    pluggySample: pluggyTxs.map(tx => ({
      id: tx.id,
      description: tx.description,
      amount: tx.amount,
      date: tx.date,
      type: tx.type,
      paymentData: tx.paymentData,
    })),
    advboxSample: advboxData,
    advboxCustomersSample: custData,
  })
}
