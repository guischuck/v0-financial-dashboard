import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, unauthorized } from '@/lib/api-helpers'
import { precomputeReconciliation } from '@/lib/reconciliation-worker'

export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return unauthorized()

    const body = await req.json().catch(() => ({}))
    const { from, to, entryType } = body

    precomputeReconciliation(ctx.tenantId, ctx.userId, { from, to, entryType }).catch((err) =>
      console.error('[PRECOMPUTE] Background error:', err)
    )

    return NextResponse.json({ queued: true })
  } catch (error) {
    console.error('POST /api/reconciliation/precompute error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
