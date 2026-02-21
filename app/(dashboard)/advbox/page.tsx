'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
    Search,
    Building2,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Loader2,
    TrendingUp,
    TrendingDown,
    Clock,
    CheckCircle2,
    AlertTriangle,
    DollarSign,
    // Trash2,
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

interface AdvboxTransaction {
    id: number | string
    type: 'income' | 'expense'
    date_due: string
    date_payment: string | null
    competence?: string
    amount: number
    description: string
    responsible?: string
    category?: string
    debit_bank?: string
    credit_bank?: string
    cost_center?: string
    name?: string
    identification?: string
    lawsuit_id?: string | number
    process_number?: string
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
        competence: raw.competence ? String(raw.competence) : undefined,
        amount: parseFloat(String(raw.amount ?? raw.value ?? 0)) || 0,
        description: String(raw.description ?? ''),
        responsible: raw.responsible ? String(raw.responsible) : undefined,
        category: raw.category ? String(raw.category) : undefined,
        debit_bank: raw.debit_bank ? String(raw.debit_bank) : undefined,
        credit_bank: raw.credit_bank ? String(raw.credit_bank) : undefined,
        cost_center: raw.cost_center ? String(raw.cost_center) : undefined,
        name: String(raw.name ?? raw.customer_name ?? ''),
        identification: raw.identification ? String(raw.identification) : undefined,
        lawsuit_id: raw.lawsuit_id as string | number | undefined,
        process_number: raw.process_number ? String(raw.process_number) : undefined,
    }
}

type SortField = 'date_due' | 'amount' | 'name'
type SortDir = 'asc' | 'desc'

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

function getPaymentStatus(tx: AdvboxTransaction): 'paid' | 'overdue' | 'pending' {
    if (tx.date_payment) return 'paid'
    const due = new Date(tx.date_due + 'T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return due < today ? 'overdue' : 'pending'
}

const statusConfig = {
    paid: {
        label: 'Pago',
        icon: CheckCircle2,
        className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
    },
    pending: {
        label: 'Pendente',
        icon: Clock,
        className: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400',
    },
    overdue: {
        label: 'Vencido',
        icon: AlertTriangle,
        className: 'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400',
    },
}

function getDefaultDateRange() {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
    }
}

export default function AdvboxPage() {
    const [transactions, setTransactions] = useState<AdvboxTransaction[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [totalCount, setTotalCount] = useState(0)

    const [typeFilter, setTypeFilter] = useState<string>('all')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [dateRange, setDateRange] = useState(getDefaultDateRange)
    const [sortBy, setSortBy] = useState<SortField>('date_due')
    const [sortDir, setSortDir] = useState<SortDir>('desc')

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
            const params = new URLSearchParams()
            params.set('limit', String(limit))
            params.set('offset', String(offset))
            if (dateRange.start) params.set('date_due_start', dateRange.start)
            if (dateRange.end) params.set('date_due_end', dateRange.end)
            if (debouncedSearch.trim()) params.set('customer_name', debouncedSearch.trim())

            const res = await fetch(`/api/advbox/transactions?${params.toString()}`)
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || 'Erro ao buscar lançamentos')
            }

            const data = await res.json()
            const rawList: Record<string, unknown>[] = data.data ?? []
            setTransactions(rawList.map(normalizeTransaction))
            setTotalCount(data.totalCount ?? 0)
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Erro desconhecido'
            setError(msg)
            setTransactions([])
            setTotalCount(0)
        } finally {
            setLoading(false)
        }
    }, [limit, offset, dateRange, debouncedSearch])

    useEffect(() => {
        fetchTransactions()
    }, [fetchTransactions])

    useEffect(() => {
        setOffset(0)
    }, [typeFilter, statusFilter, debouncedSearch, dateRange])

    const filtered = transactions.filter((tx) => {
        if (typeFilter !== 'all' && tx.type !== typeFilter) return false
        if (statusFilter !== 'all' && getPaymentStatus(tx) !== statusFilter) return false
        return true
    })

    const sorted = [...filtered].sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1
        if (sortBy === 'date_due') return (a.date_due > b.date_due ? 1 : -1) * dir
        if (sortBy === 'amount') return (a.amount - b.amount) * dir
        if (sortBy === 'name') return ((a.name ?? '') > (b.name ?? '') ? 1 : -1) * dir
        return 0
    })

    const toggleSort = (field: SortField) => {
        if (sortBy === field) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        } else {
            setSortBy(field)
            setSortDir('asc')
        }
    }

    const totalPages = Math.ceil(totalCount / limit)
    const currentPage = Math.floor(offset / limit) + 1

    const incomeTotal = filtered
        .filter((tx) => tx.type === 'income')
        .reduce((acc, tx) => acc + tx.amount, 0)
    const expenseTotal = filtered
        .filter((tx) => tx.type === 'expense')
        .reduce((acc, tx) => acc + tx.amount, 0)
    const paidCount = filtered.filter((tx) => getPaymentStatus(tx) === 'paid').length
    const overdueCount = filtered.filter((tx) => getPaymentStatus(tx) === 'overdue').length
    const pendingCount = filtered.filter((tx) => getPaymentStatus(tx) === 'pending').length

    const [markPaidTarget, setMarkPaidTarget] = useState<AdvboxTransaction | null>(null)
    const [markingPaid, setMarkingPaid] = useState(false)

    async function handleMarkAsPaid() {
        if (!markPaidTarget) return
        const target = markPaidTarget
        setMarkingPaid(true)
        try {
            const today = new Date().toISOString().split('T')[0]
            const res = await fetch(`/api/advbox/transactions/${target.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date_payment: today,
                    _description: target.description,
                    _amount: target.amount,
                }),
            })
            if (res.ok) {
                setTransactions((prev) =>
                    prev.map((tx) =>
                        tx.id === target.id ? { ...tx, date_payment: today } : tx
                    )
                )
                setMarkPaidTarget(null)
                toast.success('Transação marcada como paga')
            } else {
                const data = await res.json().catch(() => ({}))
                toast.error(data.error ?? 'Erro ao marcar como pago')
            }
        } catch {
            toast.error('Erro de conexão ao atualizar transação')
        } finally {
            setMarkingPaid(false)
        }
    }

    // TODO: Descomentar quando a rota DELETE /api/advbox/transactions/:id estiver disponível
    // const [deleteTarget, setDeleteTarget] = useState<AdvboxTransaction | null>(null)
    // const [deleting, setDeleting] = useState(false)
    //
    // async function handleDelete() {
    //     if (!deleteTarget) return
    //     const target = deleteTarget
    //     setDeleting(true)
    //     try {
    //         const params = new URLSearchParams()
    //         if (target.description) params.set('description', target.description)
    //         if (target.amount) params.set('amount', String(target.amount))
    //
    //         const res = await fetch(`/api/advbox/transactions/${target.id}?${params}`, {
    //             method: 'DELETE',
    //         })
    //         if (res.ok) {
    //             setTransactions((prev) => prev.filter((tx) => tx.id !== target.id))
    //             setTotalCount((prev) => prev - 1)
    //             setDeleteTarget(null)
    //             toast.success('Lançamento excluído do Advbox')
    //         } else {
    //             const data = await res.json().catch(() => ({}))
    //             toast.error(data.error ?? 'Erro ao excluir lançamento')
    //         }
    //     } catch {
    //         toast.error('Erro de conexão ao excluir lançamento')
    //     } finally {
    //         setDeleting(false)
    //     }
    // }

    const goToPrevMonth = () => {
        setDateRange((prev) => {
            const start = new Date(prev.start + 'T00:00:00')
            start.setMonth(start.getMonth() - 1)
            const end = new Date(start.getFullYear(), start.getMonth() + 1, 0)
            return {
                start: start.toISOString().split('T')[0],
                end: end.toISOString().split('T')[0],
            }
        })
    }

    const goToNextMonth = () => {
        setDateRange((prev) => {
            const start = new Date(prev.start + 'T00:00:00')
            start.setMonth(start.getMonth() + 1)
            const end = new Date(start.getFullYear(), start.getMonth() + 1, 0)
            return {
                start: start.toISOString().split('T')[0],
                end: end.toISOString().split('T')[0],
            }
        })
    }

    const monthLabel = (() => {
        const d = new Date(dateRange.start + 'T00:00:00')
        return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    })()

    return (
        <>
            <main className="p-6 space-y-6">
                    {/* Page Title */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                                <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-lg font-semibold text-foreground">Lançamentos Advbox</h1>
                                <p className="text-xs text-muted-foreground">
                                    {totalCount > 0
                                        ? `${totalCount} lançamentos encontrados`
                                        : 'Visualize os lançamentos financeiros da Advbox'}
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
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        <Card className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                                    <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Receitas</p>
                                    {loading ? (
                                        <Skeleton className="mt-1 h-5 w-24" />
                                    ) : (
                                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                            {formatCurrency(incomeTotal)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </Card>
                        <Card className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10">
                                    <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Despesas</p>
                                    {loading ? (
                                        <Skeleton className="mt-1 h-5 w-24" />
                                    ) : (
                                        <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                                            {formatCurrency(expenseTotal)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </Card>
                        <Card className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                                    <DollarSign className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Saldo</p>
                                    {loading ? (
                                        <Skeleton className="mt-1 h-5 w-24" />
                                    ) : (
                                        <p className="text-sm font-semibold text-foreground">
                                            {formatCurrency(incomeTotal - expenseTotal)}
                                        </p>
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
                                    <p className="text-xs text-muted-foreground">Status</p>
                                    {loading ? (
                                        <Skeleton className="mt-1 h-5 w-32" />
                                    ) : (
                                        <div className="flex items-center gap-2 text-xs font-medium">
                                            <span className="text-emerald-600 dark:text-emerald-400">{paidCount} pagos</span>
                                            <span className="text-muted-foreground">·</span>
                                            <span className="text-amber-600 dark:text-amber-400">{pendingCount} pendentes</span>
                                            <span className="text-muted-foreground">·</span>
                                            <span className="text-red-600 dark:text-red-400">{overdueCount} vencidos</span>
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

                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger className="h-8 w-32 text-xs">
                                            <SelectValue placeholder="Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos</SelectItem>
                                            <SelectItem value="paid">Pagos</SelectItem>
                                            <SelectItem value="pending">Pendentes</SelectItem>
                                            <SelectItem value="overdue">Vencidos</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    <div className="flex items-center gap-1 rounded-md border border-input px-1">
                                        <button
                                            onClick={goToPrevMonth}
                                            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                                        >
                                            <ChevronLeft className="h-3.5 w-3.5" />
                                        </button>
                                        <span className="px-2 text-xs font-medium text-foreground capitalize">
                                            {monthLabel}
                                        </span>
                                        <button
                                            onClick={goToNextMonth}
                                            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                                        >
                                            <ChevronRight className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[900px]">
                                <thead>
                                    <tr className="border-b border-border bg-muted/30">
                                        <th
                                            className="cursor-pointer px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                                            onClick={() => toggleSort('date_due')}
                                        >
                                            <span className="inline-flex items-center gap-1">
                                                Vencimento
                                                {sortBy === 'date_due' && (
                                                    <ArrowUpDown className="h-3 w-3" />
                                                )}
                                            </span>
                                        </th>
                                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                            Pagamento
                                        </th>
                                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                            Tipo
                                        </th>
                                        <th
                                            className="cursor-pointer px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                                            onClick={() => toggleSort('name')}
                                        >
                                            <span className="inline-flex items-center gap-1">
                                                Cliente
                                                {sortBy === 'name' && (
                                                    <ArrowUpDown className="h-3 w-3" />
                                                )}
                                            </span>
                                        </th>
                                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                            Descrição
                                        </th>
                                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                            Categoria
                                        </th>
                                        <th
                                            className="cursor-pointer px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                                            onClick={() => toggleSort('amount')}
                                        >
                                            <span className="inline-flex items-center justify-end gap-1">
                                                Valor
                                                {sortBy === 'amount' && (
                                                    <ArrowUpDown className="h-3 w-3" />
                                                )}
                                            </span>
                                        </th>
                                        <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                            Status
                                        </th>
                                        {/* TODO: Descomentar coluna de ações quando rota DELETE estiver disponível */}
                                        {/* <th className="w-[50px] px-3 py-2.5"></th> */}
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading &&
                                        Array.from({ length: 8 }).map((_, i) => (
                                            <tr key={i} className="border-b border-border">
                                                <td className="px-3 py-2.5"><Skeleton className="h-4 w-20" /></td>
                                                <td className="px-3 py-2.5"><Skeleton className="h-4 w-20" /></td>
                                                <td className="px-3 py-2.5"><Skeleton className="h-5 w-16" /></td>
                                                <td className="px-3 py-2.5"><Skeleton className="h-4 w-32" /></td>
                                                <td className="px-3 py-2.5"><Skeleton className="h-4 w-40" /></td>
                                                <td className="px-3 py-2.5"><Skeleton className="h-4 w-24" /></td>
                                                <td className="px-3 py-2.5"><Skeleton className="h-4 w-20 ml-auto" /></td>
                                                <td className="px-3 py-2.5"><Skeleton className="h-5 w-20 mx-auto" /></td>
                                                <td className="px-3 py-2.5"><Skeleton className="h-4 w-4 mx-auto" /></td>
                                            </tr>
                                        ))}

                                    {!loading && error && (
                                        <tr>
                                            <td colSpan={9} className="py-12 text-center">
                                                <div className="flex flex-col items-center gap-2">
                                                    <AlertTriangle className="h-6 w-6 text-destructive/60" />
                                                    <span className="text-sm text-destructive">{error}</span>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={fetchTransactions}
                                                        className="mt-2"
                                                    >
                                                        Tentar novamente
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}

                                    {!loading && !error && sorted.length === 0 && (
                                        <tr>
                                            <td colSpan={9} className="py-12 text-center">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Building2 className="h-6 w-6 text-muted-foreground/50" />
                                                    <span className="text-sm text-muted-foreground">
                                                        Nenhum lançamento encontrado
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        Ajuste os filtros ou altere o período
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}

                                    {!loading &&
                                        !error &&
                                        sorted.map((tx) => {
                                            const status = getPaymentStatus(tx)
                                            const statusInfo = statusConfig[status]
                                            const StatusIcon = statusInfo.icon
                                            const isIncome = tx.type === 'income'

                                            return (
                                                <tr
                                                    key={tx.id}
                                                    className="group border-b border-border transition-colors hover:bg-accent/30"
                                                >
                                                    <td className="px-3 py-2.5 text-sm text-foreground">
                                                        {formatDate(tx.date_due)}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-sm text-muted-foreground">
                                                        {formatDate(tx.date_payment)}
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <Badge
                                                            variant="outline"
                                                            className={
                                                                isIncome
                                                                    ? 'text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400'
                                                                    : 'text-[10px] bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400'
                                                            }
                                                        >
                                                            {isIncome ? 'Receita' : 'Despesa'}
                                                        </Badge>
                                                    </td>
                                                    <td className="max-w-[180px] truncate px-3 py-2.5 text-sm font-medium text-foreground">
                                                        {tx.name || (
                                                            <span className="italic text-muted-foreground/50">
                                                                —
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="max-w-[200px] truncate px-3 py-2.5 text-sm text-muted-foreground">
                                                        {tx.description || '-'}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-sm text-muted-foreground">
                                                        {tx.category || '-'}
                                                    </td>
                                                    <td
                                                        className={`px-3 py-2.5 text-right text-sm font-medium ${
                                                            isIncome
                                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                                : 'text-red-600 dark:text-red-400'
                                                        }`}
                                                    >
                                                        {isIncome ? '+' : '-'}{' '}
                                                        {formatCurrency(tx.amount)}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center">
                                                        {status === 'paid' ? (
                                                            <Badge
                                                                variant="outline"
                                                                className={`gap-1 text-[10px] font-medium ${statusInfo.className}`}
                                                            >
                                                                <StatusIcon className="h-3 w-3" />
                                                                {statusInfo.label}
                                                            </Badge>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => setMarkPaidTarget(tx)}
                                                                className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium transition-all hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/30 cursor-pointer group/status"
                                                            >
                                                                <span className={`inline-flex items-center gap-1 ${statusInfo.className} bg-transparent border-0 group-hover/status:hidden`}>
                                                                    <StatusIcon className="h-3 w-3" />
                                                                    {statusInfo.label}
                                                                </span>
                                                                <span className="hidden items-center gap-1 text-emerald-600 dark:text-emerald-400 group-hover/status:inline-flex">
                                                                    <CheckCircle2 className="h-3 w-3" />
                                                                    Marcar pago
                                                                </span>
                                                            </button>
                                                        )}
                                                    </td>
                                                    {/* TODO: Descomentar botão de excluir quando rota DELETE estiver disponível */}
                                                    {/* <td className="px-3 py-2.5 text-center">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon-sm"
                                                            className="text-muted-foreground hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={() => setDeleteTarget(tx)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </td> */}
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
                                    Mostrando {offset + 1}–{Math.min(offset + limit, totalCount)} de{' '}
                                    {totalCount}
                                </span>
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
                            </div>
                        )}
                    </Card>
                </main>

            <AlertDialog open={!!markPaidTarget} onOpenChange={(open) => !open && setMarkPaidTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Marcar como pago</AlertDialogTitle>
                        <AlertDialogDescription>
                            Confirma que deseja marcar esta transação como paga com a data de hoje?
                            {markPaidTarget && (
                                <span className="block mt-3 space-y-1">
                                    <span className="block text-sm font-medium text-foreground">
                                        {markPaidTarget.description || markPaidTarget.name || 'Sem descrição'}
                                    </span>
                                    <span className="block text-sm text-foreground">
                                        {formatCurrency(markPaidTarget.amount)} · Venc. {formatDate(markPaidTarget.date_due)}
                                    </span>
                                </span>
                            )}
                            <span className="block mt-2 text-xs">
                                A data de pagamento será registrada como {new Date().toLocaleDateString('pt-BR')} no Advbox.
                            </span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={markingPaid}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault()
                                handleMarkAsPaid()
                            }}
                            disabled={markingPaid}
                            className="!bg-emerald-600 !text-white hover:!bg-emerald-700"
                        >
                            {markingPaid ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                            )}
                            Confirmar pagamento
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* TODO: Descomentar dialog de exclusão quando rota DELETE estiver disponível */}
            {/* <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir lançamento</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir este lançamento do Advbox?
                            {deleteTarget && (
                                <span className="block mt-3 space-y-1">
                                    <span className="block text-sm font-medium text-foreground">
                                        {deleteTarget.description || deleteTarget.name || 'Sem descrição'}
                                    </span>
                                    <span className="block text-sm text-foreground">
                                        {formatCurrency(deleteTarget.amount)} · Venc. {formatDate(deleteTarget.date_due)}
                                    </span>
                                </span>
                            )}
                            <span className="block mt-2 text-xs">
                                Esta ação não pode ser desfeita. O lançamento será removido permanentemente do Advbox.
                            </span>
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
                            className="!bg-red-600 !text-white hover:!bg-red-700"
                        >
                            {deleting ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Trash2 className="h-4 w-4 mr-2" />
                            )}
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog> */}
        </>
    )
}
