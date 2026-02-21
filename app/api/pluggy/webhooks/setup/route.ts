import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPluggyClientForTenant } from '@/lib/pluggy'

const WEBHOOK_EVENTS = [
    'item/created',
    'item/updated',
    'item/error',
    'item/deleted',
    'transactions/created',
    'transactions/updated',
    'transactions/deleted',
] as const

export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

        const tenantUser = await prisma.tenantUser.findFirst({
            where: { clerkUserId: userId },
        })
        if (!tenantUser || !['OWNER', 'ADMIN'].includes(tenantUser.role)) {
            return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
        }

        const body = await req.json().catch(() => ({}))
        const baseUrl = body.baseUrl as string | undefined

        if (!baseUrl) {
            return NextResponse.json(
                { error: 'baseUrl é obrigatório (ex: https://seu-dominio.com)' },
                { status: 400 }
            )
        }

        const webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/webhooks/pluggy`

        const { client, tenantId } = await getPluggyClientForTenant(tenantUser.tenantId)

        const registered = []

        for (const event of WEBHOOK_EVENTS) {
            try {
                const webhook = await client.createWebhook(event, webhookUrl)

                await prisma.pluggyWebhook.upsert({
                    where: { webhookId: webhook.id },
                    create: {
                        tenantId,
                        webhookId: webhook.id,
                        event: webhook.event,
                        url: webhookUrl,
                    },
                    update: {
                        event: webhook.event,
                        url: webhookUrl,
                        disabledAt: null,
                    },
                })

                registered.push({ event, webhookId: webhook.id })
            } catch (err: any) {
                if (err.message?.includes('already exists')) {
                    registered.push({ event, status: 'already_exists' })
                } else {
                    console.error(`Failed to register webhook ${event}:`, err)
                    registered.push({ event, error: err.message })
                }
            }
        }

        await prisma.tenantSettings.update({
            where: { tenantId },
            data: { pluggyWebhookUrl: webhookUrl },
        })

        await prisma.auditLog.create({
            data: {
                tenantId,
                userId,
                action: 'pluggy.webhooks.setup',
                metadata: { webhookUrl, registered },
            },
        })

        return NextResponse.json({ success: true, webhookUrl, registered })
    } catch (error: any) {
        console.error('POST /api/pluggy/webhooks/setup error:', error)
        return NextResponse.json(
            { error: error.message || 'Erro ao configurar webhooks' },
            { status: 500 }
        )
    }
}

export async function GET() {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

        const tenantUser = await prisma.tenantUser.findFirst({
            where: { clerkUserId: userId },
        })
        if (!tenantUser) {
            return NextResponse.json({ webhooks: [] })
        }

        const webhooks = await prisma.pluggyWebhook.findMany({
            where: { tenantId: tenantUser.tenantId },
            orderBy: { createdAt: 'desc' },
        })

        return NextResponse.json({ webhooks })
    } catch (error: any) {
        console.error('GET /api/pluggy/webhooks/setup error:', error)
        return NextResponse.json({ error: 'Erro ao listar webhooks' }, { status: 500 })
    }
}
