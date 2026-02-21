'use client'

import { useCallback, useEffect, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Trash2,
  CheckCircle2,
  Link2,
  Plus,
  RefreshCw,
  History,
  Loader2,
  User,
  ArrowRight,
  Building2,
  FileText,
  CreditCard,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'

interface AuditLog {
  id: string
  userId: string | null
  userName: string | null
  action: string
  entityType: string | null
  entityId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(value))
}

function formatDateShort(dateStr: string) {
  try {
    return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR })
  } catch {
    return dateStr
  }
}

const ACTION_CONFIG: Record<string, { label: string; icon: typeof History; color: string }> = {
  'transaction.deleted': {
    label: 'Transação excluída',
    icon: Trash2,
    color: 'text-red-500 bg-red-500/10',
  },
  'reconciliation.confirmed': {
    label: 'Pagamento confirmado',
    icon: CheckCircle2,
    color: 'text-emerald-500 bg-emerald-500/10',
  },
  'reconciliation.deleted': {
    label: 'Conciliação removida',
    icon: Trash2,
    color: 'text-orange-500 bg-orange-500/10',
  },
  'reconciliation.linked': {
    label: 'Vínculo criado',
    icon: Link2,
    color: 'text-blue-500 bg-blue-500/10',
  },
  'transaction.created': {
    label: 'Lançamento criado',
    icon: Plus,
    color: 'text-violet-500 bg-violet-500/10',
  },
  'transaction.synced': {
    label: 'Transação sincronizada',
    icon: RefreshCw,
    color: 'text-cyan-500 bg-cyan-500/10',
  },
}

function AuditLogDetail({ action, metadata }: { action: string; metadata: Record<string, unknown> | null }) {
  if (!metadata) return null

  if (action === 'transaction.deleted') {
    const desc = metadata.description as string | undefined
    const amount = metadata.amount as number | undefined
    if (desc && amount !== undefined) {
      return (
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {desc} · {formatCurrency(amount)}
        </p>
      )
    }
    return null
  }

  if (action === 'reconciliation.confirmed') {
    const pluggyDesc = metadata.pluggyDescription as string | undefined
    const pluggyAmount = metadata.pluggyAmount as number | undefined
    const pluggyDate = metadata.pluggyDate as string | undefined
    const pluggyPayer = metadata.pluggyPayerName as string | undefined
    const advboxDesc = metadata.advboxDescription as string | undefined
    const advboxAmount = metadata.advboxAmount as number | undefined
    const advboxCustomer = metadata.advboxCustomerName as string | undefined
    const score = metadata.matchScore as number | undefined

    const hasRichData = pluggyDesc || advboxDesc

    if (!hasRichData) {
      const advboxId = metadata.advboxTransactionId
      return (
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          Advbox #{advboxId} · Score: {score}pts
        </p>
      )
    }

    return (
      <div className="mt-2 space-y-2">
        <div className="rounded-md border border-blue-200/60 bg-blue-50/30 dark:border-blue-800/30 dark:bg-blue-950/20 p-2 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-blue-700 dark:text-blue-400">
            <Building2 className="h-3 w-3" />
            Transação Bancária
          </div>
          {pluggyDesc && (
            <p className="text-xs text-foreground truncate">{pluggyDesc}</p>
          )}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {pluggyAmount !== undefined && (
              <span className="font-semibold text-foreground">{formatCurrency(pluggyAmount)}</span>
            )}
            {pluggyDate && <span>{formatDateShort(pluggyDate)}</span>}
          </div>
          {pluggyPayer && (
            <p className="text-[11px] text-muted-foreground">
              <User className="inline h-3 w-3 mr-0.5" />
              Pagador: <span className="font-medium text-foreground">{pluggyPayer}</span>
            </p>
          )}
        </div>

        <div className="flex items-center justify-center">
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
        </div>

        <div className="rounded-md border border-violet-200/60 bg-violet-50/30 dark:border-violet-800/30 dark:bg-violet-950/20 p-2 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-violet-700 dark:text-violet-400">
            <FileText className="h-3 w-3" />
            Lançamento Advbox
          </div>
          {advboxDesc && (
            <p className="text-xs text-foreground truncate">{advboxDesc}</p>
          )}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {advboxAmount !== undefined && (
              <span className="font-semibold text-foreground">{formatCurrency(advboxAmount)}</span>
            )}
            {advboxCustomer && (
              <span>
                <User className="inline h-3 w-3 mr-0.5" />
                {advboxCustomer}
              </span>
            )}
          </div>
        </div>

        {score !== undefined && (
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] gap-1">
              Score: {score}pts
            </Badge>
          </div>
        )}
      </div>
    )
  }

  if (action === 'reconciliation.linked') {
    const customerName = metadata.advboxCustomerName as string | undefined
    const txDesc = metadata.transactionDescription as string | undefined
    const txAmount = metadata.transactionAmount as number | undefined
    const txDate = metadata.transactionDate as string | undefined
    const payerName = metadata.payerName as string | undefined
    const payerCpf = metadata.payerCpf as string | undefined

    const hasRichData = txDesc || payerName

    if (!hasRichData) {
      return customerName ? (
        <p className="text-xs text-muted-foreground truncate mt-0.5">{customerName}</p>
      ) : null
    }

    return (
      <div className="mt-2 space-y-2">
        {txDesc && (
          <div className="rounded-md border border-blue-200/60 bg-blue-50/30 dark:border-blue-800/30 dark:bg-blue-950/20 p-2 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-blue-700 dark:text-blue-400">
              <Building2 className="h-3 w-3" />
              Transação Bancária
            </div>
            <p className="text-xs text-foreground truncate">{txDesc}</p>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {txAmount !== undefined && (
                <span className="font-semibold text-foreground">{formatCurrency(txAmount)}</span>
              )}
              {txDate && <span>{formatDateShort(txDate)}</span>}
            </div>
            {payerName && (
              <p className="text-[11px] text-muted-foreground">
                <User className="inline h-3 w-3 mr-0.5" />
                Pagador: <span className="font-medium text-foreground">{payerName}</span>
              </p>
            )}
            {payerCpf && (
              <p className="text-[11px] text-muted-foreground">
                <CreditCard className="inline h-3 w-3 mr-0.5" />
                CPF: <span className="font-mono">{payerCpf}</span>
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-center">
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
        </div>

        {customerName && (
          <div className="rounded-md border border-violet-200/60 bg-violet-50/30 dark:border-violet-800/30 dark:bg-violet-950/20 p-2 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-violet-700 dark:text-violet-400">
              <User className="h-3 w-3" />
              Cliente Advbox Vinculado
            </div>
            <p className="text-xs font-medium text-foreground">{customerName}</p>
          </div>
        )}
      </div>
    )
  }

  if (action === 'reconciliation.deleted') {
    const advboxId = metadata.advboxTransactionId
    const score = metadata.matchScore as number | undefined
    if (advboxId) {
      return (
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          Advbox #{advboxId}{score !== undefined ? ` · Score: ${score}pts` : ''}
        </p>
      )
    }
  }

  return null
}

function AuditLogItem({ log }: { log: AuditLog }) {
  const config = ACTION_CONFIG[log.action] ?? {
    label: log.action,
    icon: History,
    color: 'text-muted-foreground bg-muted',
  }
  const Icon = config.icon

  return (
    <div className="flex gap-3 py-3 px-1">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${config.color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{config.label}</p>
        <AuditLogDetail action={log.action} metadata={log.metadata} />
        <div className="flex items-center gap-2 mt-1.5">
          {log.userName && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <User className="h-3 w-3" />
              {log.userName}
            </span>
          )}
          <span className="text-[11px] text-muted-foreground">
            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: ptBR })}
          </span>
        </div>
      </div>
    </div>
  )
}

interface AuditHistoryProps {
  entityType?: string
  entityId?: string
  trigger?: React.ReactNode
  limit?: number
}

export function AuditHistory({ entityType, entityId, trigger, limit = 50 }: AuditHistoryProps) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: String(limit) })
      if (entityType) params.set('entityType', entityType)
      if (entityId) params.set('entityId', entityId)
      const res = await fetch(`/api/audit-logs?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs ?? [])
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err)
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId, limit])

  useEffect(() => {
    if (open) fetchLogs()
  }, [open, fetchLogs])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-2">
            <History className="h-4 w-4" />
            Histórico
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[440px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Alterações
          </SheetTitle>
          <SheetDescription>
            Registro de todas as ações realizadas nesta seção.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <History className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-180px)]">
              <div className="divide-y">
                {logs.map((log) => (
                  <AuditLogItem key={log.id} log={log} />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
