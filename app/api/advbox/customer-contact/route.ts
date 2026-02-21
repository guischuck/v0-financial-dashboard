import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getAdvboxConfig, advboxHeaders } from '@/lib/advbox'

/**
 * GET /api/advbox/customer-contact?name=...&identification=...
 * Busca dados de contato (email, telefone) de um cliente no Advbox.
 * Tenta localizar primeiro por identification (CPF/CNPJ) e depois por nome.
 */
export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const config = await getAdvboxConfig(userId)
    if (!config) {
      return NextResponse.json({ error: 'Advbox não configurado' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const name = searchParams.get('name')
    const identification = searchParams.get('identification')

    if (!name && !identification) {
      return NextResponse.json({ error: 'Informe name ou identification' }, { status: 400 })
    }

    const query = new URLSearchParams()
    if (name) query.set('name', name)
    query.set('limit', '10')
    query.set('offset', '0')

    const res = await fetch(`${config.baseUrl}/customers?${query}`, {
      headers: advboxHeaders(config.apiKey),
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Falha ao buscar cliente no Advbox' }, { status: 502 })
    }

    const data = await res.json()
    const customers = (data.data ?? []) as Record<string, unknown>[]

    let match = customers[0]

    if (identification && customers.length > 1) {
      const normalizedId = String(identification).replace(/\D/g, '')
      const found = customers.find((c) => {
        const cId = String(c.identification ?? '').replace(/\D/g, '')
        const cDoc = String(c.document ?? '').replace(/\D/g, '')
        return cId === normalizedId || cDoc === normalizedId
      })
      if (found) match = found
    }

    if (!match) {
      return NextResponse.json({ found: false, customer: null })
    }

    return NextResponse.json({
      found: true,
      customer: {
        id: match.id,
        name: match.name ?? '',
        identification: match.identification ?? '',
        email: match.email ?? '',
        phone: match.phone ?? '',
      },
    })
  } catch (error) {
    console.error('GET /api/advbox/customer-contact error:', error)
    return NextResponse.json({ error: 'Erro ao buscar contato' }, { status: 500 })
  }
}
