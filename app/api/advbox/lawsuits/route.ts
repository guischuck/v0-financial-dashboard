import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getAdvboxConfig, advboxHeaders } from '@/lib/advbox'

/**
 * GET /api/advbox/lawsuits?name=...&customer_id=...&process_number=...&limit=20&offset=0
 * Busca processos no Advbox.
 */
export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const config = await getAdvboxConfig(userId)
    if (!config) {
      return NextResponse.json({ data: [], totalCount: 0, error: 'Advbox não configurado' })
    }

    const { searchParams } = new URL(req.url)
    const query = new URLSearchParams()
    const name = searchParams.get('name')
    if (name) query.set('name', name)
    const customerId = searchParams.get('customer_id')
    if (customerId) query.set('customer_id', customerId)
    const processNumber = searchParams.get('process_number')
    if (processNumber) query.set('process_number', processNumber)
    query.set('limit', searchParams.get('limit') ?? '20')
    query.set('offset', searchParams.get('offset') ?? '0')

    const qs = query.toString()
    const res = await fetch(`${config.baseUrl}/lawsuits?${qs}`, {
      headers: advboxHeaders(config.apiKey),
    })

    if (!res.ok) {
      console.error('Advbox GET /lawsuits failed:', res.status)
      return NextResponse.json({ data: [], totalCount: 0 })
    }

    const data = await res.json()
    const lawsuits = (data.data ?? []).map((l: Record<string, unknown>) => ({
      id: l.id,
      process_number: l.process_number ?? '',
      type: l.type ?? '',
      customers: Array.isArray(l.customers)
        ? (l.customers as Record<string, unknown>[]).map((c) => ({
            customer_id: c.customer_id,
            name: c.name ?? '',
          }))
        : [],
    }))

    return NextResponse.json({
      data: lawsuits,
      totalCount: data.totalCount ?? lawsuits.length,
    })
  } catch (error) {
    console.error('GET /api/advbox/lawsuits error:', error)
    return NextResponse.json({ data: [], totalCount: 0 }, { status: 500 })
  }
}
