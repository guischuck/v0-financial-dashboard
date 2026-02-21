import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/encryption'
import { getAuthContext, unauthorized, cached, withCache, serverError } from '@/lib/api-helpers'
import { cacheKeys, cacheTTL, invalidateCache } from '@/lib/redis'

const ADVBOX_API_BASE = 'https://app.advbox.com.br/api/v1'

export async function GET() {
    try {
        const ctx = await getAuthContext()
        if (!ctx) return unauthorized()

        const key = cacheKeys.settings(ctx.tenantId)
        const { data, hit } = await withCache(key, cacheTTL.settings, async () => {
            const tenantUser = await prisma.tenantUser.findFirst({
                where: { clerkUserId: ctx.userId },
                include: { tenant: { include: { settings: true } } },
            })

            const s = tenantUser?.tenant.settings

            return {
                pluggyClientIdConfigured: !!s?.pluggyClientIdEnc,
                pluggyApiKeyConfigured: !!s?.pluggyApiKeyEnc,
                advboxApiKeyConfigured: !!s?.advboxApiKeyEnc,
                pluggyConnected: s?.pluggyConnected ?? false,
                advboxConnected: s?.advboxConnected ?? false,
                advboxLastSyncAt: s?.advboxLastSyncAt ?? null,
                autoMarkPaid: s?.autoMarkPaid ?? false,
                notifyReconciliation: s?.notifyReconciliation ?? true,
                notifyDueTransactions: s?.notifyDueTransactions ?? true,
                notifyMisc: s?.notifyMisc ?? true,
                companyName: s?.companyName ?? '',
                companyLogo: s?.companyLogo ?? '',
                matchWeightCpf: s?.matchWeightCpf ?? 40,
                matchWeightName: s?.matchWeightName ?? 25,
                matchWeightEmail: s?.matchWeightEmail ?? 15,
                matchWeightAmount: s?.matchWeightAmount ?? 20,
                confidenceHigh: s?.confidenceHigh ?? 60,
                confidenceMedium: s?.confidenceMedium ?? 35,
            }
        })

        return cached(data, cacheTTL.settings, hit)
    } catch (error) {
        console.error('GET /api/settings error:', error)
        return serverError()
    }
}

export async function POST(req: Request) {
    try {
        const ctx = await getAuthContext()
        if (!ctx) return unauthorized()

        if (!['OWNER', 'ADMIN'].includes(ctx.role)) {
            return NextResponse.json({ error: 'Sem permissão para alterar configurações' }, { status: 403 })
        }

        const body = await req.json()
        const {
            pluggyApiKey, pluggyClientId, advboxApiKey,
            autoMarkPaid, notifyReconciliation, notifyDueTransactions, notifyMisc,
            companyName, companyLogo,
            matchWeightCpf, matchWeightName, matchWeightEmail, matchWeightAmount,
            confidenceHigh, confidenceMedium,
        } = body

        const updateData: Record<string, unknown> = {
            advboxApiUrl: ADVBOX_API_BASE,
        }

        if (pluggyApiKey) updateData.pluggyApiKeyEnc = encrypt(pluggyApiKey)
        if (pluggyClientId) updateData.pluggyClientIdEnc = encrypt(pluggyClientId)
        if (advboxApiKey) updateData.advboxApiKeyEnc = encrypt(advboxApiKey)
        if (typeof autoMarkPaid === 'boolean') updateData.autoMarkPaid = autoMarkPaid
        if (typeof notifyReconciliation === 'boolean') updateData.notifyReconciliation = notifyReconciliation
        if (typeof notifyDueTransactions === 'boolean') updateData.notifyDueTransactions = notifyDueTransactions
        if (typeof notifyMisc === 'boolean') updateData.notifyMisc = notifyMisc
        if (typeof companyName === 'string') updateData.companyName = companyName
        if (typeof companyLogo === 'string') updateData.companyLogo = companyLogo
        if (companyLogo === null) updateData.companyLogo = null
        if (typeof matchWeightCpf === 'number') updateData.matchWeightCpf = matchWeightCpf
        if (typeof matchWeightName === 'number') updateData.matchWeightName = matchWeightName
        if (typeof matchWeightEmail === 'number') updateData.matchWeightEmail = matchWeightEmail
        if (typeof matchWeightAmount === 'number') updateData.matchWeightAmount = matchWeightAmount
        if (typeof confidenceHigh === 'number') updateData.confidenceHigh = confidenceHigh
        if (typeof confidenceMedium === 'number') updateData.confidenceMedium = confidenceMedium

        await prisma.tenantSettings.upsert({
            where: { tenantId: ctx.tenantId },
            create: { tenantId: ctx.tenantId, ...updateData },
            update: updateData,
        })

        await prisma.auditLog.create({
            data: {
                tenantId: ctx.tenantId,
                userId: ctx.userId,
                action: 'settings.updated',
                metadata: {
                    fields: Object.keys(updateData).map(k => k.replace('Enc', '')),
                },
            },
        })

        await invalidateCache(cacheKeys.settings(ctx.tenantId))

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('POST /api/settings error:', error)
        return serverError()
    }
}
