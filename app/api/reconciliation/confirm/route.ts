import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdvboxConfig, advboxHeaders } from '@/lib/advbox'
import { createAuditLog, resolveUserName } from '@/lib/audit'
import { notifyReconciliation } from '@/lib/notifications'
import { getAuthContext, unauthorized } from '@/lib/api-helpers'
import { invalidatePattern, cacheKeys } from '@/lib/redis'
import { format } from 'date-fns'

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return unauthorized()

    const config = await getAdvboxConfig(ctx.userId)
    if (!config) {
      return NextResponse.json({ error: 'Advbox não configurado' }, { status: 400 })
    }

    const tenantUser = { tenantId: ctx.tenantId }
    const userId = ctx.userId

    const body = await req.json()
    const {
      pluggyTransactionDbId,
      advboxTransactionId,
      matchScore,
      advboxCustomerId,
      pluggyDescription,
      pluggyAmount,
      pluggyDate,
      pluggyPayerName,
      advboxDescription,
      advboxAmount,
      advboxCustomerName,
    } = body

    if (!pluggyTransactionDbId || !advboxTransactionId) {
      return NextResponse.json(
        { error: 'pluggyTransactionDbId e advboxTransactionId são obrigatórios' },
        { status: 400 }
      )
    }

    const today = format(new Date(), 'yyyy-MM-dd')
    const advboxRes = await fetch(`${config.baseUrl}/transactions/${advboxTransactionId}`, {
      method: 'PUT',
      headers: advboxHeaders(config.apiKey),
      body: JSON.stringify({ date_payment: today }),
    })

    if (!advboxRes.ok) {
      const errData = await advboxRes.json().catch(() => ({}))
      console.error('Advbox PUT failed:', advboxRes.status, errData)
      return NextResponse.json(
        { error: errData.message ?? 'Falha ao marcar como pago no Advbox' },
        { status: 502 }
      )
    }

    const record = await prisma.reconciliationRecord.upsert({
      where: { pluggyTransactionDbId },
      create: {
        tenantId: tenantUser.tenantId,
        pluggyTransactionDbId,
        advboxTransactionId,
        advboxCustomerId: advboxCustomerId ?? null,
        matchScore: matchScore ?? 0,
        status: 'paid',
        paidAt: new Date(),
      },
      update: {
        advboxTransactionId,
        advboxCustomerId: advboxCustomerId ?? null,
        matchScore: matchScore ?? 0,
        status: 'paid',
        paidAt: new Date(),
      },
    })

    const userName = await resolveUserName(userId)
    await createAuditLog({
      tenantId: tenantUser.tenantId,
      userId,
      userName,
      action: 'reconciliation.confirmed',
      entityType: 'reconciliation_record',
      entityId: record.id,
      metadata: {
        pluggyTransactionDbId,
        advboxTransactionId,
        matchScore: matchScore ?? 0,
        advboxCustomerId: advboxCustomerId ?? null,
        pluggyDescription: pluggyDescription ?? null,
        pluggyAmount: pluggyAmount ?? null,
        pluggyDate: pluggyDate ?? null,
        pluggyPayerName: pluggyPayerName ?? null,
        advboxDescription: advboxDescription ?? null,
        advboxAmount: advboxAmount ?? null,
        advboxCustomerName: advboxCustomerName ?? null,
      },
    })

    await notifyReconciliation(tenantUser.tenantId, advboxTransactionId, matchScore ?? 0)
    await invalidatePattern(cacheKeys.tenantAll(tenantUser.tenantId).replace(':*', ':recon:*'))

    return NextResponse.json({ success: true, record })
  } catch (error) {
    console.error('POST /api/reconciliation/confirm error:', error)
    return NextResponse.json({ error: 'Erro ao confirmar conciliação' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return unauthorized()

    const tenantUser = { tenantId: ctx.tenantId }
    const userId = ctx.userId

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })
    }

    const record = await prisma.reconciliationRecord.findFirst({
      where: { id, tenantId: tenantUser.tenantId },
    })
    if (!record) {
      return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 })
    }

    await prisma.reconciliationRecord.delete({ where: { id: record.id } })
    await invalidatePattern(cacheKeys.tenantAll(tenantUser.tenantId).replace(':*', ':recon:*'))

    const userName = await resolveUserName(userId)
    await createAuditLog({
      tenantId: tenantUser.tenantId,
      userId,
      userName,
      action: 'reconciliation.deleted',
      entityType: 'reconciliation_record',
      entityId: id,
      metadata: record ? {
        pluggyTransactionDbId: record.pluggyTransactionDbId,
        advboxTransactionId: record.advboxTransactionId,
        matchScore: record.matchScore,
      } : undefined,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/reconciliation/confirm error:', error)
    return NextResponse.json({ error: 'Erro ao remover conciliação' }, { status: 500 })
  }
}
