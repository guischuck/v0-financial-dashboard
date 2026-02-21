import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAuditLog, resolveUserName } from '@/lib/audit'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const tenantUser = await prisma.tenantUser.findFirst({
      where: { clerkUserId: userId },
    })
    if (!tenantUser) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 })
    }

    const { id } = await params
    const body = await req.json()

    const transaction = await prisma.pluggyTransaction.findFirst({
      where: { id, tenantId: tenantUser.tenantId },
    })
    if (!transaction) {
      return NextResponse.json({ error: 'Transação não encontrada' }, { status: 404 })
    }

    const ignored = Boolean(body.ignored)

    const updated = await prisma.pluggyTransaction.update({
      where: { id },
      data: { ignored },
    })

    const userName = await resolveUserName(userId)

    await createAuditLog({
      tenantId: tenantUser.tenantId,
      userId,
      userName,
      action: ignored ? 'transaction.ignored' : 'transaction.unignored',
      entityType: 'pluggy_transaction',
      entityId: id,
      metadata: {
        transactionId: transaction.transactionId,
        description: transaction.description,
        amount: transaction.amount,
        date: transaction.date.toISOString(),
      },
    })

    return NextResponse.json({ success: true, ignored: updated.ignored })
  } catch (error) {
    console.error('PATCH /api/pluggy/transactions/[id] error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar transação' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const tenantUser = await prisma.tenantUser.findFirst({
      where: { clerkUserId: userId },
    })
    if (!tenantUser) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 })
    }

    const { id } = await params

    const transaction = await prisma.pluggyTransaction.findFirst({
      where: { id, tenantId: tenantUser.tenantId },
      include: { reconciliationRecord: true },
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Transação não encontrada' }, { status: 404 })
    }

    if (transaction.reconciliationRecord) {
      await prisma.reconciliationRecord.delete({
        where: { id: transaction.reconciliationRecord.id },
      })
    }

    await prisma.pluggyTransaction.delete({ where: { id } })

    const userName = await resolveUserName(userId)

    await createAuditLog({
      tenantId: tenantUser.tenantId,
      userId,
      userName,
      action: 'transaction.deleted',
      entityType: 'pluggy_transaction',
      entityId: id,
      metadata: {
        transactionId: transaction.transactionId,
        description: transaction.description,
        amount: transaction.amount,
        date: transaction.date.toISOString(),
        type: transaction.type,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/pluggy/transactions/[id] error:', error)
    return NextResponse.json({ error: 'Erro ao excluir transação' }, { status: 500 })
  }
}
