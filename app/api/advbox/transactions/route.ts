import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getAdvboxConfig, advboxHeaders } from '@/lib/advbox'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/advbox/transactions
 * Lista transações do Advbox. Repassa os query params para a API (date_due_start, date_due_end, category, debit_bank, etc.).
 * Resposta: { totalCount, limit, offset, data[] }
 */
export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const config = await getAdvboxConfig(userId)
    if (!config) {
      return NextResponse.json(
        { error: 'Advbox não configurado', totalCount: 0, data: [] }
      )
    }

    const { searchParams } = new URL(req.url)
    const query = new URLSearchParams()
    searchParams.forEach((value, key) => query.set(key, value))
    const qs = query.toString()
    const url = `${config.baseUrl}/transactions${qs ? `?${qs}` : ''}`

    const res = await fetch(url, {
      headers: advboxHeaders(config.apiKey),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('Advbox GET /transactions failed:', res.status, text)
      return NextResponse.json(
        { error: 'Falha ao listar transações no Advbox', totalCount: 0, data: [] },
        { status: res.status >= 500 ? 502 : res.status }
      )
    }

    const data = await res.json()

    await prisma.tenantSettings.update({
      where: { tenantId: config.tenantId },
      data: { advboxLastSyncAt: new Date() },
    }).catch(() => {})

    return NextResponse.json({
      totalCount: data.totalCount ?? 0,
      limit: data.limit ?? 50,
      offset: data.offset ?? 0,
      data: data.data ?? [],
    })
  } catch (error) {
    console.error('GET /api/advbox/transactions error:', error)
    return NextResponse.json(
      { error: 'Erro ao listar transações', totalCount: 0, data: [] },
      { status: 500 }
    )
  }
}

/**
 * POST /api/advbox/transactions
 * Cria uma transação no Advbox (receita ou despesa).
 * Body: users_id, entry_type, debit_account, categories_id, cost_centers_id, amount, date_due + opcionais.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const config = await getAdvboxConfig(userId)
    if (!config) {
      return NextResponse.json({ error: 'Advbox não configurado' }, { status: 400 })
    }

    const body = await req.json()
    const res = await fetch(`${config.baseUrl}/transactions`, {
      method: 'POST',
      headers: advboxHeaders(config.apiKey),
      body: JSON.stringify(body),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error ?? data.message ?? 'Falha ao criar transação no Advbox', errors: data.errors },
        { status: res.status >= 500 ? 502 : res.status }
      )
    }

    return NextResponse.json({
      success: data.success ?? true,
      transactions_id: data.transactions_id ?? data.transaction?.id,
    })
  } catch (error) {
    console.error('POST /api/advbox/transactions error:', error)
    return NextResponse.json({ error: 'Erro ao criar transação' }, { status: 500 })
  }
}
