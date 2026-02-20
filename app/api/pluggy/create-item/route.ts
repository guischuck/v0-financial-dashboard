import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { PluggyClient } from 'pluggy-sdk'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'

export async function POST(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

        const { itemId } = await req.json()
        if (!itemId) {
            return NextResponse.json({ error: 'Item ID ausente' }, { status: 400 })
        }

        const tenantUser = await prisma.tenantUser.findFirst({
            where: { clerkUserId: userId },
            include: { tenant: { include: { settings: true } } },
        })

        const tenantId = tenantUser?.tenantId
        const settings = tenantUser?.tenant.settings
        if (!tenantId || !settings?.pluggyApiKeyEnc || !settings?.pluggyClientIdEnc) {
            return NextResponse.json({ error: 'Pluggy credentials missing' }, { status: 400 })
        }

        // Decrypt credentials
        const clientId = decrypt(settings.pluggyClientIdEnc)
        const clientSecret = decrypt(settings.pluggyApiKeyEnc)
        const client = new PluggyClient({ clientId, clientSecret })

        // Validate if item exists via API
        const item = await client.fetchItem(itemId)

        // Check if the item is already registered for this tenant
        const existing = await prisma.pluggyItem.findUnique({
            where: { itemId },
        })

        if (!existing) {
            // Save item
            await prisma.pluggyItem.create({
                data: {
                    itemId,
                    tenantId,
                    connectorId: item.connectorId,
                    status: item.status,
                },
            })
        } else {
            // Update item
            await prisma.pluggyItem.update({
                where: { itemId },
                data: {
                    connectorId: item.connectorId,
                    status: item.status,
                },
            })
        }

        return NextResponse.json({ success: true, item })
    } catch (error: any) {
        console.error('Erro ao salvar item da Pluggy:', error)
        return NextResponse.json({ error: 'Erro ao salvar integração' }, { status: 500 })
    }
}
