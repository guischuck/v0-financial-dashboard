import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getAdvboxConfig, advboxHeaders } from '@/lib/advbox'

/**
 * GET /api/advbox/customers?name=...&limit=20&offset=0
 * Busca clientes no Advbox. Cada cliente inclui seus processos (lawsuits[]).
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
    query.set('limit', searchParams.get('limit') ?? '20')
    query.set('offset', searchParams.get('offset') ?? '0')

    const qs = query.toString()
    const res = await fetch(`${config.baseUrl}/customers?${qs}`, {
      headers: advboxHeaders(config.apiKey),
    })

    if (!res.ok) {
      console.error('Advbox GET /customers failed:', res.status)
      return NextResponse.json({ data: [], totalCount: 0 })
    }

    const data = await res.json()
    const customers = (data.data ?? []).map((c: Record<string, unknown>) => ({
      id: c.id,
      name: c.name ?? '',
      identification: c.identification ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      lawsuits: Array.isArray(c.lawsuits)
        ? (c.lawsuits as Record<string, unknown>[]).map((l) => ({
            lawsuit_id: l.lawsuit_id,
            process_number: l.process_number ?? '',
          }))
        : [],
    }))

    return NextResponse.json({
      data: customers,
      totalCount: data.totalCount ?? customers.length,
    })
  } catch (error) {
    console.error('GET /api/advbox/customers error:', error)
    return NextResponse.json({ data: [], totalCount: 0 }, { status: 500 })
  }
}
