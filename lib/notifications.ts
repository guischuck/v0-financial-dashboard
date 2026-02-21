import { prisma } from '@/lib/prisma'
import { NotificationType } from '@prisma/client'

interface CreateNotificationParams {
  tenantId: string
  type: NotificationType
  title: string
  message: string
  metadata?: Record<string, unknown>
}

export async function createNotification(params: CreateNotificationParams) {
  const { tenantId, type, title, message, metadata } = params

  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
  })

  if (settings) {
    if (type === 'RECONCILIATION' && !settings.notifyReconciliation) return null
    if (type === 'DUE_TRANSACTION' && !settings.notifyDueTransactions) return null
    if (type === 'MISC' && !settings.notifyMisc) return null
  }

  return prisma.notification.create({
    data: { tenantId, type, title, message, metadata: metadata ?? undefined },
  })
}

export async function notifyReconciliation(
  tenantId: string,
  advboxTransactionId: number,
  matchScore: number,
) {
  return createNotification({
    tenantId,
    type: 'RECONCILIATION',
    title: 'Conciliação efetuada',
    message: `Lançamento #${advboxTransactionId} foi conciliado com score ${matchScore}%.`,
    metadata: { advboxTransactionId, matchScore },
  })
}

export async function notifySync(
  tenantId: string,
  source: 'pluggy' | 'advbox',
  counts: { accounts?: number; transactions?: number },
) {
  const label = source === 'pluggy' ? 'Pluggy' : 'Advbox'
  const parts: string[] = []
  if (counts.accounts) parts.push(`${counts.accounts} conta(s)`)
  if (counts.transactions) parts.push(`${counts.transactions} transação(ões)`)

  return createNotification({
    tenantId,
    type: 'MISC',
    title: `Sincronização ${label} concluída`,
    message: parts.length > 0
      ? `Dados sincronizados: ${parts.join(' e ')}.`
      : `Sincronização do ${label} concluída sem novos dados.`,
    metadata: { source, ...counts },
  })
}

export async function notifyDueTransactions(
  tenantId: string,
  overdueCount: number,
  upcomingCount: number,
) {
  const parts: string[] = []
  if (overdueCount > 0) parts.push(`${overdueCount} vencido(s)`)
  if (upcomingCount > 0) parts.push(`${upcomingCount} vencendo em breve`)

  if (parts.length === 0) return null

  return createNotification({
    tenantId,
    type: 'DUE_TRANSACTION',
    title: 'Lançamentos com vencimento próximo',
    message: `Você tem ${parts.join(' e ')}.`,
    metadata: { overdueCount, upcomingCount },
  })
}
