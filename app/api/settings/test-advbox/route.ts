import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'

export async function POST() {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

        const tenantUser = await prisma.tenantUser.findFirst({
            where: { clerkUserId: userId },
            include: { tenant: { include: { settings: true } } },
        })

        if (!tenantUser?.tenant.settings?.advboxApiKeyEnc) {
            return NextResponse.json({ error: 'Chave Advbox não configurada' }, { status: 400 })
        }

        const apiKey = decrypt(tenantUser.tenant.settings.advboxApiKeyEnc)
        const baseUrl = tenantUser.tenant.settings.advboxApiUrl ?? 'https://app.advbox.com.br/api/v1'

        const res = await fetch(`${baseUrl}/settings`, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'HonorariosPay/1.0',
            },
        })

        const connected = res.ok

        await prisma.tenantSettings.update({
            where: { tenantId: tenantUser.tenantId },
            data: {
                advboxConnected: connected,
                ...(connected ? { advboxLastSyncAt: new Date() } : {}),
            },
        })

        if (!connected) {
            const errorBody = await res.text().catch(() => '')
            console.error('AdvBox test failed:', res.status, errorBody)
            return NextResponse.json(
                { error: `Falha na autenticação com Advbox (HTTP ${res.status})` },
                { status: 400 }
            )
        }

        return NextResponse.json({ success: true, message: 'Advbox conectado com sucesso' })
    } catch (error) {
        console.error('Test Advbox error:', error)
        return NextResponse.json({ error: 'Erro ao testar conexão' }, { status: 500 })
    }
}
