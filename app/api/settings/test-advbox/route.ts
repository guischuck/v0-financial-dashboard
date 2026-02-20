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
        const baseUrl = tenantUser.tenant.settings.advboxApiUrl ?? 'https://api.advbox.com.br'

        // Test connection to Advbox API
        const res = await fetch(`${baseUrl}/v1/ping`, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        })

        const connected = res.ok

        // Update connection status
        await prisma.tenantSettings.update({
            where: { tenantId: tenantUser.tenantId },
            data: { advboxConnected: connected },
        })

        if (!connected) {
            return NextResponse.json({ error: 'Falha na autenticação com Advbox' }, { status: 400 })
        }

        return NextResponse.json({ success: true, message: 'Advbox conectado com sucesso' })
    } catch (error) {
        console.error('Test Advbox error:', error)
        return NextResponse.json({ error: 'Erro ao testar conexão' }, { status: 500 })
    }
}
