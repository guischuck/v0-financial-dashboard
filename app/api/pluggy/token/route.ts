import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { PluggyClient } from 'pluggy-sdk'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'

export async function POST(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

        const tenantUser = await prisma.tenantUser.findFirst({
            where: { clerkUserId: userId },
            include: { tenant: { include: { settings: true } } },
        })

        const settings = tenantUser?.tenant.settings
        if (!settings?.pluggyApiKeyEnc || !settings?.pluggyClientIdEnc) {
            return NextResponse.json({ error: 'Credenciais da Pluggy não configuradas' }, { status: 400 })
        }

        const clientId = decrypt(settings.pluggyClientIdEnc)
        const clientSecret = decrypt(settings.pluggyApiKeyEnc)

        // Instantiate Pluggy SDK
        const client = new PluggyClient({
            clientId,
            clientSecret,
        })

        // Parse request body for optional itemId (to perform an update on a specific connection)
        const body = await req.json().catch(() => ({}))
        const clientUserId = userId // unique identifier for the user to map back

        // Generate Connect Token
        // We can pass itemId if updating a connection, or clientUserId to help Pluggy map this widget session
        const createTokenOptions: any = {
            clientUserId
        }

        if (body.itemId) {
            createTokenOptions.itemId = body.itemId
        }

        const data = await client.createConnectToken(
            body.itemId, // The Item id to update (if any)
            createTokenOptions
        )

        return NextResponse.json({ accessToken: data.accessToken })
    } catch (error: any) {
        console.error('Erro ao gerar token da Pluggy:', error)
        return NextResponse.json(
            { error: 'Não foi possível gerar o token da Pluggy.' },
            { status: 500 }
        )
    }
}
