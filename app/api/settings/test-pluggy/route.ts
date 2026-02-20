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

        if (!tenantUser?.tenant.settings?.pluggyApiKeyEnc) {
            return NextResponse.json({ error: 'Chave Pluggy não configurada' }, { status: 400 })
        }

        const apiKey = decrypt(tenantUser.tenant.settings.pluggyApiKeyEnc)
        const clientId = tenantUser.tenant.settings.pluggyClientIdEnc
            ? decrypt(tenantUser.tenant.settings.pluggyClientIdEnc)
            : ''

        // Test connection to Pluggy API
        const res = await fetch('https://api.pluggy.ai/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId, clientSecret: apiKey }),
        })

        const connected = res.ok

        // Update connection status
        await prisma.tenantSettings.update({
            where: { tenantId: tenantUser.tenantId },
            data: { pluggyConnected: connected },
        })

        if (!connected) {
            return NextResponse.json({ error: 'Falha na autenticação com Pluggy' }, { status: 400 })
        }

        return NextResponse.json({ success: true, message: 'Pluggy conectado com sucesso' })
    } catch (error) {
        console.error('Test Pluggy error:', error)
        return NextResponse.json({ error: 'Erro ao testar conexão' }, { status: 500 })
    }
}
