import { prisma } from '@/lib/prisma'

export async function refreshKpiView(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_tenant_kpis"')
  } catch (err) {
    console.error('[KPI] Failed to refresh materialized view:', err)
  }
}

export interface TenantKpi {
  tenant_id: string
  month: Date
  type: string
  tx_count: number
  total_amount: number
  avg_amount: number
  active_tx_count: number
  active_total_amount: number
}

export async function getKpisForTenant(tenantId: string, month?: string): Promise<TenantKpi[]> {
  const where = month
    ? `WHERE "tenant_id" = $1 AND "month" = $2::timestamp`
    : `WHERE "tenant_id" = $1`

  const params = month ? [tenantId, month] : [tenantId]

  try {
    return await prisma.$queryRawUnsafe<TenantKpi[]>(
      `SELECT * FROM "mv_tenant_kpis" ${where} ORDER BY "month" DESC`,
      ...params
    )
  } catch {
    return []
  }
}
