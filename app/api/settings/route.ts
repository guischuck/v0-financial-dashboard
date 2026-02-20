import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encrypt, decrypt, maskApiKey } from '@/lib/encryption'

// GET /api/settings — retorna configurações com valores mascarados
export async function GET() {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

        const tenantUser = await prisma.tenantUser.findFirst({
            where: { clerkUserId: userId },
            include: { tenant: { include: { settings: true } } },
        })

        if (!tenantUser) return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })

        const s = tenantUser.tenant.settings

        return NextResponse.json({
            pluggyClientIdMasked: s?.pluggyClientIdEnc ? maskApiKey(decrypt(s.pluggyClientIdEnc)) : null,
            pluggyApiKeyMasked: s?.pluggyApiKeyEnc ? maskApiKey(decrypt(s.pluggyApiKeyEnc)) : null,
            advboxApiKeyMasked: s?.advboxApiKeyEnc ? maskApiKey(decrypt(s.advboxApiKeyEnc)) : null,
            advboxApiUrl: s?.advboxApiUrl ?? 'https://api.advbox.com.br',
            pluggyConnected: s?.pluggyConnected ?? false,
            advboxConnected: s?.advboxConnected ?? false,
        })
    } catch (error) {
        console.error('GET /api/settings error:', error)
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
    }
}

// POST /api/settings — salva/atualiza configurações criptografadas
export async function POST(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

        const tenantUser = await prisma.tenantUser.findFirst({
            where: { clerkUserId: userId },
        })

        if (!tenantUser) return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })

        // Only OWNER and ADMIN can change settings
        if (!['OWNER', 'ADMIN'].includes(tenantUser.role)) {
            return NextResponse.json({ error: 'Sem permissão para alterar configurações' }, { status: 403 })
        }

        const body = await req.json()
        const { pluggyApiKey, pluggyClientId, advboxApiKey, advboxApiUrl } = body

        const updateData: Record<string, unknown> = {}

        if (pluggyApiKey) updateData.pluggyApiKeyEnc = encrypt(pluggyApiKey)
        if (pluggyClientId) updateData.pluggyClientIdEnc = encrypt(pluggyClientId)
        if (advboxApiKey) updateData.advboxApiKeyEnc = encrypt(advboxApiKey)
        if (advboxApiUrl) updateData.advboxApiUrl = advboxApiUrl

        await prisma.tenantSettings.upsert({
            where: { tenantId: tenantUser.tenantId },
            create: { tenantId: tenantUser.tenantId, ...updateData },
            update: updateData,
        })

        await prisma.auditLog.create({
            data: {
                tenantId: tenantUser.tenantId,
                userId,
                action: 'settings.updated',
                metadata: {
                    fields: Object.keys(updateData).map(k => k.replace('Enc', '')),
                },
            },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('POST /api/settings error:', error)
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
    }
}
