import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getAdvboxConfig, advboxHeaders } from '@/lib/advbox'

/**
 * GET /api/advbox/accounts
 * Busca as contas bancárias configuradas no Advbox (GET /settings -> financial.banks).
 * Retorna a mesma estrutura usada no card da dashboard.
 */
export async function GET() {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

        const config = await getAdvboxConfig(userId)
        if (!config) {
            return NextResponse.json({ accounts: [], message: 'Advbox não configurado' })
        }

        const res = await fetch(`${config.baseUrl}/settings`, {
            headers: advboxHeaders(config.apiKey),
        })

        if (!res.ok) {
            console.error('Advbox GET /settings failed:', res.status, await res.text().catch(() => ''))
            return NextResponse.json({ accounts: [], error: 'Falha ao buscar configurações do Advbox' })
        }

        const data = await res.json()
        const banks = data?.financial?.banks ?? []

        const accounts = (Array.isArray(banks) ? banks : []).map(
            (b: { id?: number; name?: string; account?: string; type?: string }) => ({
                id: String(b.id ?? ''),
                name: b.name ?? 'Conta sem nome',
                account: b.account ?? '',
                type: b.type ?? 'corrente',
                balance: null as number | null,
            })
        )

        return NextResponse.json({ accounts })
    } catch (error) {
        console.error('GET /api/advbox/accounts error:', error)
        return NextResponse.json({ accounts: [], error: 'Erro ao listar contas do Advbox' }, { status: 500 })
    }
}
