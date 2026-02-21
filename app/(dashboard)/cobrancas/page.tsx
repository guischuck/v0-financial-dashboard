'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Search,
  Phone,
  Mail,
  MessageSquare,
  AlertTriangle,
  Clock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  Megaphone,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface AdvboxTransaction {
  id: number | string
  type: 'income' | 'expense'
  date_due: string
  date_payment: string | null
  amount: number
  description: string
  responsible?: string
  category?: string
  name?: string
  identification?: string
  process_number?: string
}

interface CustomerContact {
  id: number
  name: string
  identification: string
  email: string
  phone: string
}

function normalizeType(raw: unknown): 'income' | 'expense' {
  const s = String(raw ?? '').toLowerCase()
  if (s === 'expense' || s === 'despesa' || s === 'debit' || s === 'débito') return 'expense'
  return 'income'
}

function normalizeTransaction(raw: Record<string, unknown>): AdvboxTransaction {
  return {
    id: raw.id as number | string,
    type: normalizeType(raw.type ?? raw.entry_type),
    date_due: String(raw.date_due ?? ''),
    date_payment: raw.date_payment ? String(raw.date_payment) : null,
    amount: parseFloat(String(raw.amount ?? raw.value ?? 0)) || 0,
    description: String(raw.description ?? ''),
    responsible: raw.responsible ? String(raw.responsible) : undefined,
    category: raw.category ? String(raw.category) : undefined,
    name: String(raw.name ?? raw.customer_name ?? ''),
    identification: raw.identification ? String(raw.identification) : undefined,
    process_number: raw.process_number ? String(raw.process_number) : undefined,
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value)
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('pt-BR')
}

function getDaysUntilDue(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr + 'T00:00:00')
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

type UrgencyLevel = 'overdue' | 'due_today' | 'due_tomorrow' | 'due_soon' | 'upcoming'

function getUrgency(tx: AdvboxTransaction): UrgencyLevel {
  const days = getDaysUntilDue(tx.date_due)
  if (days < 0) return 'overdue'
  if (days === 0) return 'due_today'
  if (days === 1) return 'due_tomorrow'
  if (days <= 3) return 'due_soon'
  return 'upcoming'
}

const urgencyConfig: Record<UrgencyLevel, { label: string; className: string; priority: number }> = {
  overdue: {
    label: 'Vencido',
    className: 'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400',
    priority: 0,
  },
  due_today: {
    label: 'Vence hoje',
    className: 'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400',
    priority: 1,
  },
  due_tomorrow: {
    label: 'Vence amanhã',
    className: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400',
    priority: 2,
  },
  due_soon: {
    label: 'Vence em breve',
    className: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20 dark:text-yellow-400',
    priority: 3,
  },
  upcoming: {
    label: 'Próximo',
    className: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',
    priority: 4,
  },
}

function generateMessage(tx: AdvboxTransaction, companyName?: string): string {
  const days = getDaysUntilDue(tx.date_due)
  const clientName = tx.name || 'Cliente'
  const valor = formatCurrency(tx.amount)
  const vencimento = formatDate(tx.date_due)
  const descricao = tx.description || tx.category || 'cobrança'
  const empresa = companyName || 'nosso escritório'

  if (days < 0) {
    const diasVencido = Math.abs(days)
    return `Prezado(a) ${clientName},

Esperamos que esteja bem. Gostaríamos de informar que identificamos uma pendência financeira referente a ${descricao}, no valor de ${valor}, com vencimento em ${vencimento} (${diasVencido} dia${diasVencido > 1 ? 's' : ''} em atraso).

Solicitamos gentilmente a regularização do pagamento o mais breve possível. Caso já tenha efetuado o pagamento, por favor desconsidere esta mensagem e nos envie o comprovante.

Em caso de dúvidas ou para negociar condições de pagamento, estamos à disposição.

Atenciosamente,
${empresa}`
  }

  if (days === 0) {
    return `Prezado(a) ${clientName},

Gostaríamos de lembrá-lo(a) que o pagamento referente a ${descricao}, no valor de ${valor}, vence hoje (${vencimento}).

Pedimos que, se possível, efetue o pagamento ainda hoje para evitar encargos por atraso.

Caso já tenha realizado o pagamento, por favor desconsidere esta mensagem.

Atenciosamente,
${empresa}`
  }

  return `Prezado(a) ${clientName},

Gostaríamos de lembrá-lo(a) que o pagamento referente a ${descricao}, no valor de ${valor}, tem vencimento em ${vencimento} (daqui a ${days} dia${days > 1 ? 's' : ''}).

Pedimos que providencie o pagamento até a data de vencimento para evitar possíveis encargos.

Caso já tenha efetuado o pagamento, por favor desconsidere esta mensagem.

Atenciosamente,
${empresa}`
}

export default function CobrancasPage() {
  const [transactions, setTransactions] = useState<AdvboxTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)

  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('income')

  const [limit] = useState(50)
  const [offset, setOffset] = useState(0)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchQuery), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery])

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const pastDate = new Date(today)
      pastDate.setMonth(pastDate.getMonth() - 6)

      const futureDate = new Date(today)
      futureDate.setDate(futureDate.getDate() + 7)

      const params = new URLSearchParams()
      params.set('limit', String(limit))
      params.set('offset', String(offset))
      params.set('date_due_start', pastDate.toISOString().split('T')[0])
      params.set('date_due_end', futureDate.toISOString().split('T')[0])
      if (debouncedSearch.trim()) params.set('customer_name', debouncedSearch.trim())

      const res = await fetch(`/api/advbox/transactions?${params}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Erro ao buscar lançamentos')
      }

      const data = await res.json()
      const rawList: Record<string, unknown>[] = data.data ?? []
      const normalized = rawList.map(normalizeTransaction)
      const unpaid = normalized.filter((tx) => !tx.date_payment)
      setTransactions(unpaid)
      setTotalCount(data.totalCount ?? 0)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido'
      setError(msg)
      setTransactions([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [limit, offset, debouncedSearch])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  useEffect(() => {
    setOffset(0)
  }, [urgencyFilter, typeFilter, debouncedSearch])

  const filtered = useMemo(() => {
    let result = transactions

    if (typeFilter !== 'all') {
      result = result.filter((tx) => tx.type === typeFilter)
    }

    if (urgencyFilter !== 'all') {
      result = result.filter((tx) => getUrgency(tx) === urgencyFilter)
    }

    return result.sort((a, b) => {
      const ua = urgencyConfig[getUrgency(a)].priority
      const ub = urgencyConfig[getUrgency(b)].priority
      if (ua !== ub) return ua - ub
      return a.date_due.localeCompare(b.date_due)
    })
  }, [transactions, typeFilter, urgencyFilter])

  const stats = useMemo(() => {
    const overdue = transactions.filter((tx) => getUrgency(tx) === 'overdue')
    const dueToday = transactions.filter((tx) => getUrgency(tx) === 'due_today')
    const dueSoon = transactions.filter((tx) => ['due_tomorrow', 'due_soon'].includes(getUrgency(tx)))
    return {
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce((s, tx) => s + tx.amount, 0),
      dueTodayCount: dueToday.length,
      dueTodayAmount: dueToday.reduce((s, tx) => s + tx.amount, 0),
      dueSoonCount: dueSoon.length,
      dueSoonAmount: dueSoon.reduce((s, tx) => s + tx.amount, 0),
      totalAmount: transactions.reduce((s, tx) => s + tx.amount, 0),
    }
  }, [transactions])

  const [contactTarget, setContactTarget] = useState<AdvboxTransaction | null>(null)
  const [contactLoading, setContactLoading] = useState(false)
  const [contactData, setContactData] = useState<CustomerContact | null>(null)
  const [contactNotFound, setContactNotFound] = useState(false)
  const [generatedMessage, setGeneratedMessage] = useState('')
  const [copied, setCopied] = useState(false)

  async function openContactDialog(tx: AdvboxTransaction) {
    setContactTarget(tx)
    setContactLoading(true)
    setContactData(null)
    setContactNotFound(false)
    setGeneratedMessage(generateMessage(tx))
    setCopied(false)

    try {
      const params = new URLSearchParams()
      if (tx.name) params.set('name', tx.name)
      if (tx.identification) params.set('identification', tx.identification)

      const res = await fetch(`/api/advbox/customer-contact?${params}`)
      const data = await res.json()

      if (data.found && data.customer) {
        setContactData(data.customer)
      } else {
        setContactNotFound(true)
      }
    } catch {
      setContactNotFound(true)
    } finally {
      setContactLoading(false)
    }
  }

  function closeContactDialog() {
    setContactTarget(null)
    setContactData(null)
    setContactNotFound(false)
    setGeneratedMessage('')
    setCopied(false)
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(generatedMessage)
      setCopied(true)
      toast.success('Mensagem copiada!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Erro ao copiar mensagem')
    }
  }

  function openWhatsApp(phone: string) {
    const cleaned = phone.replace(/\D/g, '')
    const number = cleaned.startsWith('55') ? cleaned : `55${cleaned}`
    const text = encodeURIComponent(generatedMessage)
    window.open(`https://wa.me/${number}?text=${text}`, '_blank')
  }

  function openEmail(email: string) {
    const subject = encodeURIComponent(
      contactTarget
        ? `Lembrete de pagamento – ${contactTarget.description || contactTarget.category || 'cobrança'}`
        : 'Lembrete de pagamento'
    )
    const body = encodeURIComponent(generatedMessage)
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank')
  }

  const totalPages = Math.ceil(totalCount / limit)
  const currentPage = Math.floor(offset / limit) + 1

  return (
    <>
      <main className="p-6 space-y-6">
          {/* Page Title */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
                <Megaphone className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Cobranças</h1>
                <p className="text-xs text-muted-foreground">
                  Lançamentos vencidos e com vencimento próximo
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={fetchTransactions}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Atualizar
            </Button>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vencidos</p>
                  {loading ? (
                    <Skeleton className="mt-1 h-5 w-24" />
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                        {formatCurrency(stats.overdueAmount)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{stats.overdueCount} lançamento{stats.overdueCount !== 1 ? 's' : ''}</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10">
                  <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vencem hoje</p>
                  {loading ? (
                    <Skeleton className="mt-1 h-5 w-24" />
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                        {formatCurrency(stats.dueTodayAmount)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{stats.dueTodayCount} lançamento{stats.dueTodayCount !== 1 ? 's' : ''}</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vencem em breve</p>
                  {loading ? (
                    <Skeleton className="mt-1 h-5 w-24" />
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                        {formatCurrency(stats.dueSoonAmount)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{stats.dueSoonCount} lançamento{stats.dueSoonCount !== 1 ? 's' : ''}</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <Megaphone className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total pendente</p>
                  {loading ? (
                    <Skeleton className="mt-1 h-5 w-24" />
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {formatCurrency(stats.totalAmount)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{transactions.length} lançamento{transactions.length !== 1 ? 's' : ''}</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Filters + Table */}
          <Card className="shadow-sm border-border/60 overflow-hidden">
            {/* Toolbar */}
            <div className="border-b border-border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por cliente..."
                    className="h-8 pl-8 text-xs"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      <SelectItem value="income">Receitas</SelectItem>
                      <SelectItem value="expense">Despesas</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                    <SelectTrigger className="h-8 w-36 text-xs">
                      <SelectValue placeholder="Urgência" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="overdue">Vencidos</SelectItem>
                      <SelectItem value="due_today">Vence hoje</SelectItem>
                      <SelectItem value="due_tomorrow">Vence amanhã</SelectItem>
                      <SelectItem value="due_soon">Vence em breve</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Urgência
                    </th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Vencimento
                    </th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Cliente
                    </th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Descrição
                    </th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Categoria
                    </th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Valor
                    </th>
                    <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Ação
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading &&
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="px-3 py-2.5"><Skeleton className="h-5 w-20" /></td>
                        <td className="px-3 py-2.5"><Skeleton className="h-4 w-20" /></td>
                        <td className="px-3 py-2.5"><Skeleton className="h-4 w-32" /></td>
                        <td className="px-3 py-2.5"><Skeleton className="h-4 w-40" /></td>
                        <td className="px-3 py-2.5"><Skeleton className="h-4 w-24" /></td>
                        <td className="px-3 py-2.5"><Skeleton className="h-4 w-20 ml-auto" /></td>
                        <td className="px-3 py-2.5"><Skeleton className="h-8 w-24 mx-auto" /></td>
                      </tr>
                    ))}

                  {!loading && error && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <AlertTriangle className="h-6 w-6 text-destructive/60" />
                          <span className="text-sm text-destructive">{error}</span>
                          <Button variant="outline" size="sm" onClick={fetchTransactions} className="mt-2">
                            Tentar novamente
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loading && !error && filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Megaphone className="h-6 w-6 text-muted-foreground/50" />
                          <span className="text-sm text-muted-foreground">
                            Nenhum lançamento pendente de cobrança
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Ajuste os filtros ou atualize os dados
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    !error &&
                    filtered.map((tx) => {
                      const urgency = getUrgency(tx)
                      const urgencyInfo = urgencyConfig[urgency]
                      const days = getDaysUntilDue(tx.date_due)

                      return (
                        <tr
                          key={tx.id}
                          className="group border-b border-border transition-colors hover:bg-accent/30"
                        >
                          <td className="px-3 py-2.5">
                            <Badge variant="outline" className={`gap-1 text-[10px] font-medium ${urgencyInfo.className}`}>
                              {urgency === 'overdue' && <AlertTriangle className="h-3 w-3" />}
                              {urgency !== 'overdue' && <Clock className="h-3 w-3" />}
                              {urgencyInfo.label}
                              {urgency === 'overdue' && (
                                <span className="ml-0.5">({Math.abs(days)}d)</span>
                              )}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 text-sm text-foreground">
                            {formatDate(tx.date_due)}
                          </td>
                          <td className="max-w-[180px] truncate px-3 py-2.5 text-sm font-medium text-foreground">
                            {tx.name || (
                              <span className="italic text-muted-foreground/50">—</span>
                            )}
                          </td>
                          <td className="max-w-[200px] truncate px-3 py-2.5 text-sm text-muted-foreground">
                            {tx.description || '-'}
                          </td>
                          <td className="px-3 py-2.5 text-sm text-muted-foreground">
                            {tx.category || '-'}
                          </td>
                          <td className="px-3 py-2.5 text-right text-sm font-medium text-foreground">
                            {formatCurrency(tx.amount)}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1.5 text-xs"
                              onClick={() => openContactDialog(tx)}
                            >
                              <MessageSquare className="h-3 w-3" />
                              Cobrar
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!loading && totalCount > 0 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <span className="text-xs text-muted-foreground">
                  {filtered.length} lançamento{filtered.length !== 1 ? 's' : ''} exibido{filtered.length !== 1 ? 's' : ''}
                </span>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={offset === 0}
                      onClick={() => setOffset((o) => Math.max(0, o - limit))}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="px-2 text-xs font-medium text-foreground">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={offset + limit >= totalCount}
                      onClick={() => setOffset((o) => o + limit)}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </main>

      {/* Contact Dialog */}
      <Dialog open={!!contactTarget} onOpenChange={(open) => !open && closeContactDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Cobrar cliente
            </DialogTitle>
            <DialogDescription>
              {contactTarget && (
                <span>
                  {contactTarget.name || 'Cliente'} · {formatCurrency(contactTarget.amount)} · Venc. {formatDate(contactTarget.date_due)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Contact Info */}
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dados de contato</p>
              {contactLoading && (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-40" />
                </div>
              )}
              {!contactLoading && contactNotFound && (
                <p className="text-sm text-muted-foreground">
                  Contato não encontrado no Advbox para este cliente.
                </p>
              )}
              {!contactLoading && contactData && (
                <div className="space-y-2">
                  {contactData.phone && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">{contactData.phone}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => openWhatsApp(contactData.phone)}
                      >
                        <ExternalLink className="h-3 w-3" />
                        WhatsApp
                      </Button>
                    </div>
                  )}
                  {contactData.email && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">{contactData.email}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => openEmail(contactData.email)}
                      >
                        <ExternalLink className="h-3 w-3" />
                        E-mail
                      </Button>
                    </div>
                  )}
                  {!contactData.phone && !contactData.email && (
                    <p className="text-sm text-muted-foreground">
                      Nenhum telefone ou e-mail cadastrado para este cliente.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Message */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mensagem de cobrança</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={copyMessage}
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-500" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
              <Textarea
                value={generatedMessage}
                onChange={(e) => setGeneratedMessage(e.target.value)}
                rows={10}
                className="text-sm resize-none"
              />
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2 pt-1">
              {!contactLoading && contactData?.phone && (
                <Button
                  className="flex-1 gap-2"
                  onClick={() => openWhatsApp(contactData.phone)}
                >
                  <Phone className="h-4 w-4" />
                  Enviar via WhatsApp
                </Button>
              )}
              {!contactLoading && contactData?.email && (
                <Button
                  variant={contactData?.phone ? 'outline' : 'default'}
                  className="flex-1 gap-2"
                  onClick={() => openEmail(contactData.email)}
                >
                  <Mail className="h-4 w-4" />
                  Enviar por e-mail
                </Button>
              )}
              {!contactLoading && !contactData?.phone && !contactData?.email && !contactNotFound && (
                <Button variant="outline" className="flex-1" onClick={copyMessage}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar mensagem
                </Button>
              )}
              {contactNotFound && (
                <Button variant="outline" className="flex-1" onClick={copyMessage}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar mensagem
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
