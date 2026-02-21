import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAuditLog, resolveUserName } from '@/lib/audit'
import { getAuthContext, unauthorized } from '@/lib/api-helpers'
import { invalidatePattern, cacheKeys } from '@/lib/redis'

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return unauthorized()

    const tenantUser = { tenantId: ctx.tenantId }
    const userId = ctx.userId

    const body = await req.json()
    const {
      payerCpf,
      advboxCustomerId,
      advboxCustomerName,
      advboxCustomerIdentification,
      transactionDescription,
      transactionAmount,
      transactionDate,
      payerName,
    } = body

    if (!payerCpf || !advboxCustomerId) {
      return NextResponse.json(
        { error: 'payerCpf e advboxCustomerId são obrigatórios' },
        { status: 400 }
      )
    }

    const cleanCpf = payerCpf.replace(/[^0-9]/g, '')

    const mapping = await prisma.clientMapping.upsert({
      where: {
        tenantId_payerCpf: {
          tenantId: tenantUser.tenantId,
          payerCpf: cleanCpf,
        },
      },
      create: {
        tenantId: tenantUser.tenantId,
        payerCpf: cleanCpf,
        advboxCustomerId,
        advboxCustomerName: advboxCustomerName ?? null,
        advboxCustomerIdentification: advboxCustomerIdentification ?? null,
      },
      update: {
        advboxCustomerId,
        advboxCustomerName: advboxCustomerName ?? null,
        advboxCustomerIdentification: advboxCustomerIdentification ?? null,
      },
    })

    const userName = await resolveUserName(userId)
    await createAuditLog({
      tenantId: tenantUser.tenantId,
      userId,
      userName,
      action: 'reconciliation.linked',
      entityType: 'client_mapping',
      entityId: mapping.id,
      metadata: {
        payerCpf: cleanCpf,
        advboxCustomerId,
        advboxCustomerName,
        transactionDescription: transactionDescription ?? null,
        transactionAmount: transactionAmount ?? null,
        transactionDate: transactionDate ?? null,
        payerName: payerName ?? null,
      },
    })

    await invalidatePattern(cacheKeys.tenantAll(tenantUser.tenantId).replace(':*', ':recon:*'))

    return NextResponse.json({ success: true, mapping })
  } catch (error) {
    console.error('POST /api/reconciliation/link error:', error)
    return NextResponse.json({ error: 'Erro ao vincular cliente' }, { status: 500 })
  }
}
