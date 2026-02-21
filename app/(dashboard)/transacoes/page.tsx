'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
  EyeOff,
  Eye,
  MoreHorizontal,
  Search,
  Trash2,
  Loader2,
} from 'lucide-react'
import { AuditHistory } from '@/components/audit-history'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { translateCategory } from '@/lib/pluggy-categories'
import { toast } from 'sonner'
import { useAccounts } from '@/lib/hooks/use-accounts'
import { useTransactions, useDeleteTransaction, useToggleIgnored } from '@/lib/hooks/use-transactions'

interface PluggyTransaction {
  id: string
  transactionId: string
  description: string
  descriptionRaw?: string
  amount: number
  type: string
  category?: string
  date: string
  balance?: number
  currencyCode: string
  status?: string
  ignored: boolean
  merchant?: { name?: string; businessName?: string } | null
  pluggyAccount?: {
    accountId: string
    name: string
    type: string
  }
}

interface PluggyAccount {
  id: string
  accountId: string
  name: string
  type: string
}

const PAGE_SIZE = 25

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

export default function TransacoesPage() {
  const searchParams = useSearchParams()
  const { data: accountsData, isLoading: loadingAccounts } = useAccounts()

  const accounts: PluggyAccount[] = (accountsData ?? []).map((a: any) => ({
    id: a.id,
    accountId: a.accountId,
    name: a.customName ?? a.name,
    type: a.type,
  }))

  const [selectedAccount, setSelectedAccount] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 3)
    return d.toISOString().slice(0, 10)
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') ?? '')
  const [page, setPage] = useState(1)

  const { data: txData, isLoading: loading } = useTransactions({
    page,
    pageSize: PAGE_SIZE,
    accountId: selectedAccount !== 'all' ? selectedAccount : null,
    from: dateFrom || null,
    to: dateTo || null,
  })

  const transactions: PluggyTransaction[] = txData?.transactions ?? []
  const total = txData?.total ?? 0
  const totalPages = txData?.totalPages ?? 0
  const totalIncome = txData?.totalIncome ?? 0
  const totalExpenses = txData?.totalExpenses ?? 0

  const filteredTransactions = useMemo(() => {
    let result = transactions

    if (typeFilter === 'receitas') {
      result = result.filter((tx) => tx.amount > 0)
    } else if (typeFilter === 'despesas') {
      result = result.filter((tx) => tx.amount < 0)
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (tx) =>
          tx.description.toLowerCase().includes(term) ||
          tx.category?.toLowerCase().includes(term) ||
          (tx.category ? translateCategory(tx.category).toLowerCase().includes(term) : false) ||
          tx.merchant?.name?.toLowerCase().includes(term) ||
          tx.pluggyAccount?.name.toLowerCase().includes(term)
      )
    }

    return result
  }, [transactions, typeFilter, searchTerm])

  const { income, expenses } = useMemo(() => {
    if (!searchTerm.trim() && typeFilter === 'all') {
      return { income: totalIncome, expenses: totalExpenses }
    }
    if (!searchTerm.trim() && typeFilter === 'receitas') {
      return { income: totalIncome, expenses: 0 }
    }
    if (!searchTerm.trim() && typeFilter === 'despesas') {
      return { income: 0, expenses: totalExpenses }
    }
    let inc = 0
    let exp = 0
    for (const tx of filteredTransactions) {
      if (tx.ignored) continue
      if (tx.amount > 0) inc += tx.amount
      else exp += Math.abs(tx.amount)
    }
    return { income: inc, expenses: exp }
  }, [totalIncome, totalExpenses, typeFilter, searchTerm, filteredTransactions])

  const [deleteTarget, setDeleteTarget] = useState<PluggyTransaction | null>(null)
  const deleteMutation = useDeleteTransaction()
  const toggleMutation = useToggleIgnored()
  const deleting = deleteMutation.isPending

  async function handleDelete() {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null)
        toast.success('Transação excluída com sucesso')
      },
      onError: () => {
        toast.error('Erro ao excluir transação')
      },
    })
  }

  const togglingId = toggleMutation.isPending ? (toggleMutation.variables?.id ?? null) : null

  function toggleIgnored(tx: PluggyTransaction) {
    toggleMutation.mutate(
      { id: tx.id, ignored: !tx.ignored },
      {
        onSuccess: () => {
          toast.success(tx.ignored ? 'Transação reativada' : 'Transação ignorada')
        },
        onError: () => {
          toast.error('Erro ao atualizar transação')
        },
      }
    )
  }

  const hasActiveFilters =
    selectedAccount !== 'all' || typeFilter !== 'all' || searchTerm.trim() !== ''

  function clearFilters() {
    setSelectedAccount('all')
    const d = new Date()
    d.setMonth(d.getMonth() - 3)
    setDateFrom(d.toISOString().slice(0, 10))
    setDateTo(new Date().toISOString().slice(0, 10))
    setTypeFilter('all')
    setSearchTerm('')
    setPage(1)
  }

  function handleAccountChange(value: string) {
    setSelectedAccount(value)
    setPage(1)
  }

  function handleDateFromChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDateFrom(e.target.value)
    setPage(1)
  }

  function handleDateToChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDateTo(e.target.value)
    setPage(1)
  }

  function exportCSV() {
    const header = 'Data,Descrição,Categoria,Conta,Tipo,Valor\n'
    const rows = filteredTransactions
      .map((tx) =>
        [
          formatDate(tx.date),
          `"${tx.description.replace(/"/g, '""')}"`,
          tx.category ? translateCategory(tx.category) : '',
          tx.pluggyAccount?.name ?? '',
          tx.type,
          tx.amount.toFixed(2).replace('.', ','),
        ].join(',')
      )
      .join('\n')

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transacoes-pluggy-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <main className="p-6">
          {/* Page header */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Transações</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Lançamentos recebidos das contas conectadas via Pluggy
              </p>
            </div>
            <div className="flex items-center gap-2">
              <AuditHistory entityType="pluggy_transaction" />
              <Button variant="outline" size="sm" onClick={exportCSV} disabled={filteredTransactions.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Transações na página
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold text-foreground">
                    {filteredTransactions.length}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">de {total}</span>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                  Entradas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-28" />
                ) : (
                  <div className="text-2xl font-bold text-emerald-600">{formatCurrency(income)}</div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <ArrowDownRight className="h-4 w-4 text-red-500" />
                  Saídas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-28" />
                ) : (
                  <div className="text-2xl font-bold text-red-600">{formatCurrency(expenses)}</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Inline filter bar */}
          <div className="mb-6 rounded-lg border bg-card p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">De</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={handleDateFromChange}
                  className="w-[150px]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Até</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={handleDateToChange}
                  className="w-[150px]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1) }}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="receitas">Receitas</SelectItem>
                    <SelectItem value="despesas">Despesas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Conta</label>
                <Select value={selectedAccount} onValueChange={handleAccountChange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Todas as contas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as contas</SelectItem>
                    {loadingAccounts ? (
                      <SelectItem value="_loading" disabled>Carregando...</SelectItem>
                    ) : (
                      accounts.map((acc) => (
                        <SelectItem key={acc.accountId} value={acc.accountId}>
                          {acc.name} ({acc.type})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Nome, CPF, descrição..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Lançamentos</CardTitle>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-muted-foreground">
                  Limpar filtros
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/5" />
                        <Skeleton className="h-3 w-2/5" />
                      </div>
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))}
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-4">
                    <Search className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Nenhuma transação encontrada</p>
                  <p className="mt-1 max-w-xs text-center text-xs text-muted-foreground">
                    {hasActiveFilters || searchTerm
                      ? 'Tente ajustar os filtros ou o termo de busca.'
                      : 'As transações aparecerão aqui após sincronizar suas contas bancárias.'}
                  </p>
                  {(hasActiveFilters || searchTerm) && (
                    <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                      Limpar filtros
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Conta</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.map((tx) => (
                        <TableRow key={tx.id} className={`group ${tx.ignored ? 'opacity-50' : ''}`}>
                          <TableCell className="text-muted-foreground text-xs">
                            {formatDate(tx.date)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                                  tx.ignored
                                    ? 'bg-muted text-muted-foreground'
                                    : tx.amount >= 0
                                      ? 'bg-emerald-500/10 text-emerald-600'
                                      : 'bg-red-500/10 text-red-600'
                                }`}
                              >
                                {tx.ignored ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : tx.amount >= 0 ? (
                                  <ArrowUpRight className="h-4 w-4" />
                                ) : (
                                  <ArrowDownRight className="h-4 w-4" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className={`truncate text-sm font-medium ${tx.ignored ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                                    {tx.description}
                                  </p>
                                  {tx.ignored && (
                                    <TooltipProvider delayDuration={0}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Badge variant="outline" className="text-[10px] shrink-0 text-muted-foreground border-muted-foreground/30">
                                            Ignorada
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Não contabilizada nos totais</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </div>
                                {tx.merchant?.name && (
                                  <p className="truncate text-xs text-muted-foreground">
                                    {tx.merchant.name}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {tx.pluggyAccount?.name ?? '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {tx.category ? (
                              <Badge variant="secondary" className="text-[10px]">
                                {translateCategory(tx.category)}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={`text-sm font-semibold ${
                                tx.ignored
                                  ? 'text-muted-foreground'
                                  : tx.amount >= 0 ? 'text-emerald-600' : 'text-red-600'
                              }`}
                            >
                              {tx.amount >= 0 ? '+' : ''}
                              {formatCurrency(tx.amount)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => toggleIgnored(tx)}
                                  disabled={togglingId === tx.id}
                                >
                                  {tx.ignored ? (
                                    <>
                                      <Eye className="mr-2 h-4 w-4" />
                                      Reativar transação
                                    </>
                                  ) : (
                                    <>
                                      <EyeOff className="mr-2 h-4 w-4" />
                                      Ignorar transação
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setDeleteTarget(tx)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Excluir transação
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between border-t pt-4">
                      <p className="text-xs text-muted-foreground">
                        Página {page} de {totalPages} · {total} transações
                      </p>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon-sm"
                          disabled={page <= 1}
                          onClick={() => setPage((p) => p - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        {buildPageNumbers(page, totalPages).map((p, i) =>
                          p === '...' ? (
                            <span key={`dots-${i}`} className="px-1 text-xs text-muted-foreground">
                              ...
                            </span>
                          ) : (
                            <Button
                              key={p}
                              variant={page === p ? 'default' : 'outline'}
                              size="icon-sm"
                              onClick={() => setPage(p as number)}
                            >
                              {p}
                            </Button>
                          )
                        )}
                        <Button
                          variant="outline"
                          size="icon-sm"
                          disabled={page >= totalPages}
                          onClick={() => setPage((p) => p + 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </main>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta transação?
              {deleteTarget && (
                <span className="block mt-2 font-medium text-foreground">
                  {deleteTarget.description} · {formatCurrency(deleteTarget.amount)}
                </span>
              )}
              <span className="block mt-1">Esta ação não pode ser desfeita.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function buildPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | '...')[] = [1]

  if (current > 3) pages.push('...')

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)

  if (current < total - 2) pages.push('...')
  pages.push(total)

  return pages
}
