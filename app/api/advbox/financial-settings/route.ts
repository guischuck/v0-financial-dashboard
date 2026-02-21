import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getAdvboxConfig, advboxHeaders } from '@/lib/advbox'

/**
 * GET /api/advbox/financial-settings
 * Retorna users, banks, categories e cost_centers do Advbox (GET /settings)
 * para preencher formulários de Nova receita / Nova despesa.
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const config = await getAdvboxConfig(userId)
    if (!config) {
      return NextResponse.json({
        users: [],
        banks: [],
        categories: [],
        cost_centers: [],
        message: 'Advbox não configurado',
      })
    }

    const res = await fetch(`${config.baseUrl}/settings`, {
      headers: advboxHeaders(config.apiKey),
    })

    if (!res.ok) {
      console.error('Advbox GET /settings failed:', res.status, await res.text().catch(() => ''))
      return NextResponse.json({
        users: [],
        banks: [],
        categories: [],
        cost_centers: [],
        error: 'Falha ao buscar configurações do Advbox',
      })
    }

    const data = await res.json()
    const financial = data?.financial ?? {}
    const users = Array.isArray(data?.users) ? data.users : []
    const banks = Array.isArray(financial.banks) ? financial.banks : []
    const categories = Array.isArray(financial.categories) ? financial.categories : []
    const cost_centers = Array.isArray(financial.cost_centers) ? financial.cost_centers : []

    return NextResponse.json({
      users: users.map((u: { id?: number; name?: string }) => ({ id: u.id, name: u.name ?? '' })),
      banks: banks.map((b: { id?: number; name?: string; account?: string; type?: string }) => ({
        id: b.id,
        name: b.name ?? '',
        account: b.account ?? '',
        type: b.type ?? 'corrente',
      })),
      categories: categories.map((c: { id?: number; category?: string; name?: string; type?: string }) => ({
        id: c.id,
        name: c.category ?? c.name ?? '',
        type: (c.type ?? '').toUpperCase(),
      })),
      cost_centers: cost_centers.map((cc: { id?: number; cost_center?: string; name?: string }) => ({
        id: cc.id,
        name: cc.cost_center ?? cc.name ?? '',
      })),
    })
  } catch (error) {
    console.error('GET /api/advbox/financial-settings error:', error)
    return NextResponse.json(
      { users: [], banks: [], categories: [], cost_centers: [], error: 'Erro ao buscar configurações' },
      { status: 500 }
    )
  }
}
