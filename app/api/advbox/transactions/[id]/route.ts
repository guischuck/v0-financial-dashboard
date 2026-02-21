import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getAdvboxConfig, advboxHeaders } from '@/lib/advbox'
import { createAuditLog, resolveUserName } from '@/lib/audit'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const config = await getAdvboxConfig(userId)
    if (!config) {
      return NextResponse.json({ error: 'Advbox não configurado' }, { status: 400 })
    }

    const { id } = await params
    const body = await req.json()

    const res = await fetch(`${config.baseUrl}/transactions/${id}`, {
      method: 'PUT',
      headers: advboxHeaders(config.apiKey),
      body: JSON.stringify(body),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      console.error('Advbox PUT /transactions failed:', res.status, data)
      return NextResponse.json(
        { error: data.error ?? data.message ?? 'Falha ao atualizar transação no Advbox', errors: data.errors },
        { status: res.status >= 500 ? 502 : res.status }
      )
    }

    const isMarkingPaid = body.date_payment && body.date_payment !== null
    const isMarkingUnpaid = body.date_payment === null && Object.keys(body).includes('date_payment')

    if (isMarkingPaid || isMarkingUnpaid) {
      const userName = await resolveUserName(userId)
      await createAuditLog({
        tenantId: config.tenantId,
        userId,
        userName,
        action: isMarkingPaid ? 'advbox_transaction.marked_paid' : 'advbox_transaction.marked_unpaid',
        entityType: 'advbox_transaction',
        entityId: id,
        metadata: {
          date_payment: body.date_payment,
          description: body._description,
          amount: body._amount,
        },
      })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('PUT /api/advbox/transactions/[id] error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar transação' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const config = await getAdvboxConfig(userId)
    if (!config) {
      return NextResponse.json({ error: 'Advbox não configurado' }, { status: 400 })
    }

    const { id } = await params

    const { searchParams } = new URL(req.url)
    const description = searchParams.get('description')
    const amount = searchParams.get('amount')

    const res = await fetch(`${config.baseUrl}/transactions/${id}`, {
      method: 'DELETE',
      headers: advboxHeaders(config.apiKey),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      console.error('Advbox DELETE /transactions failed:', res.status, data)
      return NextResponse.json(
        { error: data.error ?? data.message ?? 'Falha ao excluir transação no Advbox' },
        { status: res.status >= 500 ? 502 : res.status }
      )
    }

    const userName = await resolveUserName(userId)
    await createAuditLog({
      tenantId: config.tenantId,
      userId,
      userName,
      action: 'advbox_transaction.deleted',
      entityType: 'advbox_transaction',
      entityId: id,
      metadata: {
        description: description ?? undefined,
        amount: amount ? parseFloat(amount) : undefined,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/advbox/transactions/[id] error:', error)
    return NextResponse.json({ error: 'Erro ao excluir transação' }, { status: 500 })
  }
}
