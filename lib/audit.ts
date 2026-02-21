import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type AuditAction =
  | 'transaction.deleted'
  | 'reconciliation.confirmed'
  | 'reconciliation.deleted'
  | 'reconciliation.linked'
  | 'transaction.created'
  | 'transaction.synced'
  | 'advbox_transaction.marked_paid'
  | 'advbox_transaction.marked_unpaid'
  | 'advbox_transaction.deleted'
  | 'transaction.ignored'
  | 'transaction.unignored'

interface AuditLogParams {
  tenantId: string
  userId: string | null
  userName: string | null
  action: AuditAction
  entityType: string
  entityId: string
  metadata?: Record<string, unknown>
}

export async function createAuditLog(params: AuditLogParams) {
  try {
    return await prisma.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        userName: params.userName,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata
        ? (params.metadata as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      },
    })
  } catch (error) {
    console.error('[AUDIT] Failed to create audit log:', error)
    return null
  }
}

export async function resolveUserName(userId: string): Promise<string | null> {
  try {
    const tenantUser = await prisma.tenantUser.findFirst({
      where: { clerkUserId: userId },
      select: { name: true, email: true },
    })
    return tenantUser?.name ?? tenantUser?.email ?? null
  } catch {
    return null
  }
}
