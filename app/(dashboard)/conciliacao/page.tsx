'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import { format, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
    ArrowLeftRight,
    ArrowRight,
    CheckCircle2,
    AlertTriangle,
    HelpCircle,
    Loader2,
    Search,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    Filter,
    FileText,
    Building2,
    User,
    Mail,
    CreditCard,
    TrendingUp,
    XCircle,
    Link2,
    Check,
    CheckCheck,
    UserSearch,
    Ban,
    Trash2,
} from 'lucide-react'
import { AuditHistory } from '@/components/audit-history'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

// ─── Types ──────────────────────────────────────────────────────────

interface PayerInfo {
    cpf: string | null
    name: string | null
    email: string | null
    pixKey: string | null
    nameFromDescription: string | null
}

interface MatchReason {
    field: string
    weight: number
    matched: boolean
    details: string
}

interface PluggyTx {
    id: string
    transactionId: string
    description: string
    descriptionRaw: string | null
    amount: number
    date: string
    type: string
    category: string | null
    accountName: string | null
    payerInfo: PayerInfo
}

interface AdvboxTx {
    id: number
    type: string
    entry_type: string
    date_due: string
    date_payment: string | null
    amount: number
    description: string
    customer_name: string | null
    identification: string | null
    name: string | null
    category: string | null
    process_number: string | null
    responsible: string | null
}

interface BestMatch {
    advboxTransaction: AdvboxTx
    score: number
    confidence: 'high' | 'medium' | 'low'
    matchReasons: MatchReason[]
}

interface LinkedCustomer {
    id: number
    name: string | null
    identification: string | null
}

interface AdvboxCustomerFound {
    id: number
    name: string
    identification: string
}

interface ReconciliationItem {
    pluggyTransaction: PluggyTx
    matchStatus: 'none' | 'partial' | 'auto' | 'reconciled'
    bestMatch: BestMatch | null
    linkedCustomer: LinkedCustomer | null
    advboxCustomerFound: AdvboxCustomerFound | null
    reconciliationId: string | null
    advboxTransactionId: number | null
    paidAt: string | null
}

interface Summary {
    totalPluggy: number
    totalAdvbox: number
    none: number
    partial: number
    auto: number
    reconciled: number
    autoMatchAmount: number
}

interface AdvboxCustomer {
    id: number
    name: string
    identification: string
    lawsuits: { lawsuit_id: number; process_number: string }[]
}

// ─── Utilities ──────────────────────────────────────────────────────

function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function maskCpf(cpf: string | null) {
    if (!cpf) return '—'
    if (cpf.length === 11) return `***.***.${cpf.slice(6, 9)}-${cpf.slice(9)}`
    if (cpf.length === 14) return `**.***.***/****-${cpf.slice(12)}`
    return cpf
}

const STATUS_CONFIG = {
    none: {
        label: 'Sem Match',
        color: 'bg-red-500/15 text-red-700 dark:text-red-400',
        icon: Ban,
    },
    partial: {
        label: 'Parcial',
        color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
        icon: AlertTriangle,
    },
    auto: {
        label: 'Automático',
        color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
        icon: CheckCircle2,
    },
    reconciled: {
        label: 'Pago',
        color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
        icon: CheckCheck,
    },
}

// ─── Sub-components ─────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
    const color =
        score >= 70 ? 'bg-emerald-500' : score >= 35 ? 'bg-amber-500' : 'bg-red-500'
    return (
        <div className="flex items-center gap-2">
            <div className="h-2 w-20 rounded-full bg-muted overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all ${color}`}
                    style={{ width: `${Math.min(score, 100)}%` }}
                />
            </div>
            <span className="text-xs font-medium tabular-nums">{score}pts</span>
        </div>
    )
}

function MatchReasonsList({ reasons }: { reasons: MatchReason[] }) {
    const iconMap: Record<string, React.ReactNode> = {
        CPF: <CreditCard className="h-3.5 w-3.5" />,
        Vínculo: <Link2 className="h-3.5 w-3.5" />,
        Nome: <User className="h-3.5 w-3.5" />,
        Email: <Mail className="h-3.5 w-3.5" />,
        Valor: <TrendingUp className="h-3.5 w-3.5" />,
    }
    return (
        <div className="space-y-1.5">
            {reasons.map((reason) => (
                <div
                    key={reason.field}
                    className={`flex items-start gap-2 rounded-md border p-2 text-xs ${
                        reason.matched
                            ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-950/20'
                            : 'border-muted bg-muted/30'
                    }`}
                >
                    {reason.matched ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                        <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                            {iconMap[reason.field]}
                            <span className="font-medium">{reason.field}</span>
                            <span className="text-muted-foreground">({reason.weight}pts)</span>
                        </div>
                        <p className="text-muted-foreground mt-0.5 break-all">{reason.details}</p>
                    </div>
                </div>
            ))}
        </div>
    )
}

// ─── Match Detail Dialog ────────────────────────────────────────────

function MatchDetailDialog({
    item,
    open,
    onClose,
    onConfirm,
    confirming,
}: {
    item: ReconciliationItem | null
    open: boolean
    onClose: () => void
    onConfirm: (item: ReconciliationItem) => void
    confirming: boolean
}) {
    if (!item || !item.bestMatch) return null
    const ptx = item.pluggyTransaction
    const atx = item.bestMatch.advboxTransaction
    const statusConf = STATUS_CONFIG[item.matchStatus as keyof typeof STATUS_CONFIG]
    const StatusIcon = statusConf?.icon ?? HelpCircle

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ArrowLeftRight className="h-5 w-5" />
                        Detalhes do Match
                    </DialogTitle>
                    <DialogDescription>
                        Análise detalhada da correspondência entre transações.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center justify-center gap-3 py-3">
                    <Badge className={`${statusConf.color} gap-1`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusConf.label}
                    </Badge>
                    <ScoreBar score={item.bestMatch.score} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Card className="gap-3 py-4">
                        <CardHeader className="pb-0 pt-0 px-4">
                            <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-blue-500" />
                                <CardTitle className="text-sm">Pluggy (Banco)</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="px-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Descrição</span>
                                <span className="text-right max-w-[180px] truncate font-medium">
                                    {ptx.description}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Valor</span>
                                <span className="font-semibold">{formatCurrency(Math.abs(ptx.amount))}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Data</span>
                                <span>{format(new Date(ptx.date), 'dd/MM/yyyy', { locale: ptBR })}</span>
                            </div>
                            {(ptx.payerInfo.name ?? ptx.payerInfo.nameFromDescription) && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Pagador</span>
                                    <div className="text-right max-w-[180px]">
                                        <span className="truncate block">{ptx.payerInfo.name ?? ptx.payerInfo.nameFromDescription}</span>
                                        {!ptx.payerInfo.name && ptx.payerInfo.nameFromDescription && (
                                            <span className="text-[10px] text-muted-foreground">(via descrição)</span>
                                        )}
                                    </div>
                                </div>
                            )}
                            {ptx.payerInfo.cpf && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">CPF</span>
                                    <span className="font-mono text-xs">{maskCpf(ptx.payerInfo.cpf)}</span>
                                </div>
                            )}
                            {ptx.payerInfo.pixKey && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Chave PIX</span>
                                    <span className="font-mono text-xs truncate max-w-[180px]">{ptx.payerInfo.pixKey}</span>
                                </div>
                            )}
                            {ptx.payerInfo.email && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Email</span>
                                    <span className="text-xs truncate max-w-[180px]">{ptx.payerInfo.email}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="gap-3 py-4">
                        <CardHeader className="pb-0 pt-0 px-4">
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-violet-500" />
                                <CardTitle className="text-sm">Advbox (Lançamento)</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="px-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Descrição</span>
                                <span className="text-right max-w-[180px] truncate font-medium">
                                    {atx.description}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Valor</span>
                                <span className="font-semibold">{formatCurrency(Math.abs(atx.amount))}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Vencimento</span>
                                <span>
                                    {atx.date_due
                                        ? format(new Date(atx.date_due), 'dd/MM/yyyy', { locale: ptBR })
                                        : '—'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Cliente</span>
                                <span className="text-right max-w-[180px] truncate">
                                    {atx.customer_name ?? atx.name ?? '—'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">CPF/ID</span>
                                <span className="font-mono text-xs">{maskCpf(atx.identification)}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="mt-2">
                    <h4 className="text-sm font-semibold mb-3">Critérios de Matching</h4>
                    <MatchReasonsList reasons={item.bestMatch.matchReasons} />
                </div>

                {item.matchStatus !== 'reconciled' && (
                    <DialogFooter>
                        <Button variant="outline" onClick={onClose}>Cancelar</Button>
                        <Button
                            onClick={() => onConfirm(item)}
                            disabled={confirming}
                            className="gap-2"
                        >
                            {confirming ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Check className="h-4 w-4" />
                            )}
                            Confirmar e Marcar como Pago
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    )
}

// ─── Link Customer Dialog ───────────────────────────────────────────

function LinkCustomerDialog({
    open,
    onClose,
    pluggyTx,
    onLink,
}: {
    open: boolean
    onClose: () => void
    pluggyTx: PluggyTx | null
    onLink: (customer: AdvboxCustomer) => void
}) {
    const [searchTerm, setSearchTerm] = useState('')
    const [customers, setCustomers] = useState<AdvboxCustomer[]>([])
    const [loading, setLoading] = useState(false)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const searchCustomers = useCallback(async (q: string) => {
        if (q.length < 2) {
            setCustomers([])
            return
        }
        setLoading(true)
        try {
            const res = await fetch(`/api/advbox/customers?name=${encodeURIComponent(q)}&limit=20`)
            const data = await res.json()
            setCustomers(data.data ?? [])
        } finally {
            setLoading(false)
        }
    }, [])

    const handleSearch = (value: string) => {
        setSearchTerm(value)
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => searchCustomers(value), 400)
    }

    useEffect(() => {
        if (!open) {
            setSearchTerm('')
            setCustomers([])
        }
    }, [open])

    if (!pluggyTx) return null

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserSearch className="h-5 w-5" />
                        Vincular Cliente
                    </DialogTitle>
                    <DialogDescription>
                        Selecione o cliente do Advbox correspondente a esta transação.
                        O vínculo será salvo para futuras conciliações automáticas.
                    </DialogDescription>
                </DialogHeader>

                <div className="rounded-lg border p-3 bg-muted/30 space-y-1 text-sm">
                    <p className="font-medium">{pluggyTx.description}</p>
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{format(new Date(pluggyTx.date), 'dd/MM/yyyy', { locale: ptBR })}</span>
                        <span className="font-semibold text-foreground">
                            {formatCurrency(Math.abs(pluggyTx.amount))}
                        </span>
                    </div>
                    {pluggyTx.payerInfo.name && (
                        <p className="text-xs">Pagador: <span className="font-medium">{pluggyTx.payerInfo.name}</span></p>
                    )}
                    {pluggyTx.payerInfo.cpf && (
                        <p className="text-xs">CPF: <span className="font-mono">{maskCpf(pluggyTx.payerInfo.cpf)}</span></p>
                    )}
                    {pluggyTx.payerInfo.pixKey && (
                        <p className="text-xs">PIX: <span className="font-mono">{pluggyTx.payerInfo.pixKey}</span></p>
                    )}
                    {pluggyTx.payerInfo.email && (
                        <p className="text-xs">Email: <span>{pluggyTx.payerInfo.email}</span></p>
                    )}
                </div>

                <div className="space-y-3">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar cliente no Advbox por nome..."
                            value={searchTerm}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="pl-9"
                            autoFocus
                        />
                    </div>

                    {loading && (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    )}

                    {!loading && searchTerm.length >= 2 && customers.length === 0 && (
                        <p className="text-center text-sm text-muted-foreground py-6">
                            Nenhum cliente encontrado.
                        </p>
                    )}

                    {customers.length > 0 && (
                        <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                            {customers.map((customer) => (
                                <button
                                    key={customer.id}
                                    className="w-full text-left p-3 hover:bg-muted/50 transition-colors flex items-center justify-between gap-3"
                                    onClick={() => onLink(customer)}
                                >
                                    <div className="min-w-0">
                                        <p className="font-medium text-sm truncate">{customer.name}</p>
                                        <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                                            {customer.identification && (
                                                <span className="font-mono">
                                                    CPF: {maskCpf(customer.identification)}
                                                </span>
                                            )}
                                            {customer.lawsuits.length > 0 && (
                                                <span>{customer.lawsuits.length} processo(s)</span>
                                            )}
                                        </div>
                                    </div>
                                    <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

// ─── Action Buttons ─────────────────────────────────────────────────

function ActionButtons({
    item,
    ptx,
    onLink,
    onDetail,
    onConfirm,
    confirming,
}: {
    item: ReconciliationItem
    ptx: PluggyTx
    onLink: () => void
    onDetail: () => void
    onConfirm: () => void
    confirming: boolean
}) {
    const canLink = !!(ptx.payerInfo.cpf || ptx.payerInfo.pixKey)
    const hasLink = !!item.linkedCustomer
    const hasMatch = !!item.bestMatch

    if (item.matchStatus === 'reconciled') {
        return (
            <Badge variant="outline" className="text-[10px] gap-1">
                <CheckCheck className="h-3 w-3 text-blue-600" />
                Conciliado
            </Badge>
        )
    }

    if (item.matchStatus === 'auto' && hasMatch) {
        return (
            <div className="flex items-center gap-1">
                <Button
                    variant="default"
                    size="sm"
                    className="gap-1 h-7 text-xs"
                    onClick={onDetail}
                    disabled={confirming}
                >
                    <Check className="h-3 w-3" />
                    Pagar
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onDetail}>
                    <Search className="h-3.5 w-3.5" />
                </Button>
            </div>
        )
    }

    if (item.matchStatus === 'partial') {
        return (
            <div className="flex items-center gap-1">
                {hasMatch && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 h-7 text-xs"
                        onClick={onDetail}
                    >
                        <Check className="h-3 w-3" />
                        Confirmar
                    </Button>
                )}
                {/* Show "Vincular" only if NOT already linked */}
                {!hasLink && canLink && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1 h-7 text-xs"
                                    onClick={onLink}
                                >
                                    <Link2 className="h-3 w-3" />
                                    Vincular
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Vincular a um cliente do Advbox</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
                {/* If already linked, show a "Trocar vínculo" ghost option */}
                {hasLink && canLink && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-muted-foreground"
                                    onClick={onLink}
                                >
                                    <Link2 className="h-3.5 w-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Trocar vínculo</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>
        )
    }

    // matchStatus === 'none'
    if (canLink) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 h-7 text-xs"
                            onClick={onLink}
                        >
                            <Link2 className="h-3 w-3" />
                            Vincular
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Vincular a um cliente do Advbox</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        )
    }

    return null
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function ConciliacaoPage() {
    const [items, setItems] = useState<ReconciliationItem[]>([])
    const [summary, setSummary] = useState<Summary | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 90), 'yyyy-MM-dd'))
    const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [entryType, setEntryType] = useState<'income' | 'expense'>('income')
    const [activeTab, setActiveTab] = useState('none')

    // Dialogs
    const [detailItem, setDetailItem] = useState<ReconciliationItem | null>(null)
    const [linkPluggyTx, setLinkPluggyTx] = useState<PluggyTx | null>(null)
    const [confirming, setConfirming] = useState(false)
    const [confirmingAll, setConfirmingAll] = useState(false)
    const [expandedRow, setExpandedRow] = useState<string | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<ReconciliationItem | null>(null)
    const [deleting, setDeleting] = useState(false)

    const handleDeleteTransaction = async () => {
        if (!deleteTarget) return
        setDeleting(true)
        try {
            const res = await fetch(`/api/pluggy/transactions/${deleteTarget.pluggyTransaction.id}`, {
                method: 'DELETE',
            })
            if (res.ok) {
                setDeleteTarget(null)
                fetchReconciliation()
            }
        } catch (err) {
            console.error('Delete error:', err)
        } finally {
            setDeleting(false)
        }
    }

    const fetchReconciliation = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const params = new URLSearchParams()
            if (dateFrom) params.set('from', dateFrom)
            if (dateTo) params.set('to', dateTo)
            params.set('entryType', entryType)
            const res = await fetch(`/api/reconciliation?${params.toString()}`)
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error ?? 'Falha ao buscar dados')
            }
            const data = await res.json()
            setItems(data.items ?? [])
            setSummary(data.summary ?? null)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [dateFrom, dateTo, entryType])

    useEffect(() => {
        fetchReconciliation()
    }, [fetchReconciliation])

    // ─── Actions ────────────────────────────────────────────────────

    const handleLinkCustomer = async (customer: AdvboxCustomer) => {
        if (!linkPluggyTx) return
        const payerCpf = linkPluggyTx.payerInfo.cpf
            ?? linkPluggyTx.payerInfo.pixKey?.replace(/[^0-9]/g, '')
            ?? null
        if (!payerCpf) return
        try {
            const res = await fetch('/api/reconciliation/link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payerCpf,
                    advboxCustomerId: customer.id,
                    advboxCustomerName: customer.name,
                    advboxCustomerIdentification: customer.identification,
                    transactionDescription: linkPluggyTx.description,
                    transactionAmount: linkPluggyTx.amount,
                    transactionDate: linkPluggyTx.date,
                    payerName: linkPluggyTx.payerInfo.name ?? linkPluggyTx.payerInfo.nameFromDescription ?? null,
                }),
            })
            if (res.ok) {
                setLinkPluggyTx(null)
                fetchReconciliation()
            }
        } catch (err) {
            console.error('Link error:', err)
        }
    }

    const handleConfirm = async (item: ReconciliationItem) => {
        if (!item.bestMatch) return
        setConfirming(true)
        try {
            const ptx = item.pluggyTransaction
            const atx = item.bestMatch.advboxTransaction
            const res = await fetch('/api/reconciliation/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pluggyTransactionDbId: ptx.id,
                    advboxTransactionId: atx.id,
                    matchScore: item.bestMatch.score,
                    advboxCustomerId: item.linkedCustomer?.id ?? null,
                    pluggyDescription: ptx.description,
                    pluggyAmount: ptx.amount,
                    pluggyDate: ptx.date,
                    pluggyPayerName: ptx.payerInfo.name ?? ptx.payerInfo.nameFromDescription ?? null,
                    advboxDescription: atx.description,
                    advboxAmount: atx.amount,
                    advboxCustomerName: atx.customer_name ?? atx.name ?? null,
                }),
            })
            if (res.ok) {
                setDetailItem(null)
                fetchReconciliation()
            }
        } catch (err) {
            console.error('Confirm error:', err)
        } finally {
            setConfirming(false)
        }
    }

    const handleConfirmAll = async () => {
        const autoItems = items.filter(i => i.matchStatus === 'auto' && i.bestMatch)
        if (autoItems.length === 0) return

        setConfirmingAll(true)
        try {
            for (const item of autoItems) {
                const ptx = item.pluggyTransaction
                const atx = item.bestMatch!.advboxTransaction
                await fetch('/api/reconciliation/confirm', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pluggyTransactionDbId: ptx.id,
                        advboxTransactionId: atx.id,
                        matchScore: item.bestMatch!.score,
                        advboxCustomerId: item.linkedCustomer?.id ?? null,
                        pluggyDescription: ptx.description,
                        pluggyAmount: ptx.amount,
                        pluggyDate: ptx.date,
                        pluggyPayerName: ptx.payerInfo.name ?? ptx.payerInfo.nameFromDescription ?? null,
                        advboxDescription: atx.description,
                        advboxAmount: atx.amount,
                        advboxCustomerName: atx.customer_name ?? atx.name ?? null,
                    }),
                })
            }
            fetchReconciliation()
        } catch (err) {
            console.error('Confirm all error:', err)
        } finally {
            setConfirmingAll(false)
        }
    }

    // ─── Filtering ──────────────────────────────────────────────────

    const filteredItems = items.filter((i) => {
        if (activeTab !== 'all' && i.matchStatus !== activeTab) return false
        if (searchTerm) {
            const q = searchTerm.toLowerCase()
            const ptx = i.pluggyTransaction
            return (
                ptx.description.toLowerCase().includes(q) ||
                (ptx.payerInfo.name?.toLowerCase().includes(q) ?? false) ||
                (ptx.payerInfo.nameFromDescription?.toLowerCase().includes(q) ?? false) ||
                (ptx.payerInfo.cpf?.includes(q) ?? false) ||
                (i.bestMatch?.advboxTransaction.customer_name?.toLowerCase().includes(q) ?? false) ||
                (i.bestMatch?.advboxTransaction.description.toLowerCase().includes(q) ?? false)
            )
        }
        return true
    })

    const matchRate = summary
        ? summary.totalPluggy > 0
            ? Math.round(((summary.auto + summary.reconciled) / summary.totalPluggy) * 100)
            : 0
        : 0

    // ─── Render ─────────────────────────────────────────────────────

    return (
        <>
            <main className="p-6 space-y-6">
                    {/* Page Title */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Conciliação</h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                Vincule transações bancárias (Pluggy) com lançamentos do Advbox
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <AuditHistory />
                            <Button onClick={fetchReconciliation} disabled={loading} className="gap-2">
                                {loading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="h-4 w-4" />
                                )}
                                {loading ? 'Processando...' : 'Reconciliar'}
                            </Button>
                        </div>
                    </div>

                    {/* Filters */}
                    <Card className="py-4">
                        <CardContent className="flex flex-wrap items-end gap-4 px-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-muted-foreground">De</label>
                                <Input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="w-40 h-9"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Até</label>
                                <Input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="w-40 h-9"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                                <Select value={entryType} onValueChange={(v) => setEntryType(v as 'income' | 'expense')}>
                                    <SelectTrigger className="w-36 h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="income">Receitas</SelectItem>
                                        <SelectItem value="expense">Despesas</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                                <label className="text-xs font-medium text-muted-foreground">Buscar</label>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        placeholder="Nome, CPF, descrição..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-8 h-9"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* KPI Cards */}
                    {summary && (
                        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                            <Card className="py-4">
                                <CardContent className="px-4">
                                    <p className="text-xs font-medium text-muted-foreground">Taxa de Match</p>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <span className="text-2xl font-bold">{matchRate}%</span>
                                    </div>
                                    <Progress value={matchRate} className="mt-2 h-1.5" />
                                </CardContent>
                            </Card>
                            <Card className="py-4">
                                <CardContent className="px-4">
                                    <p className="text-xs font-medium text-muted-foreground">Sem Match</p>
                                    <p className="text-2xl font-bold mt-1 text-red-600">{summary.none}</p>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        precisam de vínculo manual
                                    </p>
                                </CardContent>
                            </Card>
                            <Card className="py-4">
                                <CardContent className="px-4">
                                    <p className="text-xs font-medium text-muted-foreground">Match Parcial</p>
                                    <p className="text-2xl font-bold mt-1 text-amber-600">{summary.partial}</p>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        precisam de revisão
                                    </p>
                                </CardContent>
                            </Card>
                            <Card className="py-4">
                                <CardContent className="px-4">
                                    <p className="text-xs font-medium text-muted-foreground">Match Automático</p>
                                    <p className="text-2xl font-bold mt-1 text-emerald-600">{summary.auto}</p>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        {formatCurrency(summary.autoMatchAmount)}
                                    </p>
                                </CardContent>
                            </Card>
                            <Card className="py-4">
                                <CardContent className="px-4">
                                    <p className="text-xs font-medium text-muted-foreground">Já Pagos</p>
                                    <p className="text-2xl font-bold mt-1 text-blue-600">{summary.reconciled}</p>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        conciliados e pagos
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <Card className="border-destructive/50 bg-destructive/5 py-4">
                            <CardContent className="px-4 flex items-center gap-3 text-sm text-destructive">
                                <XCircle className="h-5 w-5 shrink-0" />
                                {error}
                            </CardContent>
                        </Card>
                    )}

                    {/* Loading */}
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-16 gap-4">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <div className="text-center">
                                <p className="text-sm font-medium">Processando conciliação...</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Buscando transações e calculando correspondências
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Results */}
                    {!loading && summary && (
                        <Card>
                            <CardHeader className="flex-row items-center justify-between space-y-0">
                                <div>
                                    <CardTitle className="text-lg">Transações</CardTitle>
                                    <CardDescription>
                                        {summary.totalPluggy} transações bancárias encontradas
                                    </CardDescription>
                                </div>
                                {summary.auto > 0 && activeTab === 'auto' && (
                                    <Button
                                        onClick={handleConfirmAll}
                                        disabled={confirmingAll}
                                        className="gap-2"
                                        size="sm"
                                    >
                                        {confirmingAll ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <CheckCheck className="h-4 w-4" />
                                        )}
                                        Confirmar Todos ({summary.auto})
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent className="px-0">
                                <Tabs value={activeTab} onValueChange={setActiveTab}>
                                    <div className="px-6 mb-4">
                                        <TabsList>
                                            <TabsTrigger value="all">
                                                Todos ({items.length})
                                            </TabsTrigger>
                                            <TabsTrigger value="none">
                                                <Ban className="h-3.5 w-3.5 mr-1 text-red-600" />
                                                Sem Match ({summary.none})
                                            </TabsTrigger>
                                            <TabsTrigger value="partial">
                                                <AlertTriangle className="h-3.5 w-3.5 mr-1 text-amber-600" />
                                                Parcial ({summary.partial})
                                            </TabsTrigger>
                                            <TabsTrigger value="auto">
                                                <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                                                Automático ({summary.auto})
                                            </TabsTrigger>
                                            <TabsTrigger value="reconciled">
                                                <CheckCheck className="h-3.5 w-3.5 mr-1 text-blue-600" />
                                                Pagos ({summary.reconciled})
                                            </TabsTrigger>
                                        </TabsList>
                                    </div>

                                    <TabsContent value={activeTab} className="mt-0">
                                        {filteredItems.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                                <ArrowLeftRight className="h-10 w-10 text-muted-foreground/40 mb-3" />
                                                <p className="text-sm text-muted-foreground">
                                                    Nenhuma transação encontrada nesta categoria.
                                                </p>
                                            </div>
                                        ) : (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-8"></TableHead>
                                                        <TableHead>Status</TableHead>
                                                        <TableHead>Transação Bancária</TableHead>
                                                        <TableHead className="text-right">Valor</TableHead>
                                                        <TableHead>Match Advbox</TableHead>
                                                        <TableHead className="w-32 text-right">Ações</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {filteredItems.map((item) => {
                                                        const ptx = item.pluggyTransaction
                                                        const statusConf = STATUS_CONFIG[item.matchStatus]
                                                        const StatusIcon = statusConf.icon
                                                        const isExpanded = expandedRow === ptx.id
                                                        const matchCustomerName = item.bestMatch?.advboxTransaction.customer_name ?? item.bestMatch?.advboxTransaction.name ?? null
                                                        const matchAmountsEqual = item.bestMatch ? Math.abs(ptx.amount) === Math.abs(item.bestMatch.advboxTransaction.amount) : false

                                                        return (
                                                            <TableRow
                                                                key={ptx.id}
                                                                className="group"
                                                            >
                                                                <TableCell>
                                                                    {item.bestMatch && (
                                                                        <button
                                                                            onClick={() => setExpandedRow(isExpanded ? null : ptx.id)}
                                                                            className="p-0.5"
                                                                        >
                                                                            {isExpanded ? (
                                                                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                                                            ) : (
                                                                                <ChevronDown className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                            )}
                                                                        </button>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex flex-col gap-1.5">
                                                                        <Badge className={`${statusConf.color} gap-1 text-[10px] w-fit`}>
                                                                            <StatusIcon className="h-3 w-3" />
                                                                            {statusConf.label}
                                                                        </Badge>
                                                                        {item.bestMatch && (
                                                                            <ScoreBar score={item.bestMatch.score} />
                                                                        )}
                                                                        {item.linkedCustomer && (
                                                                            <TooltipProvider>
                                                                                <Tooltip>
                                                                                    <TooltipTrigger>
                                                                                        <Badge variant="outline" className="text-[10px] gap-1 w-fit">
                                                                                            <Link2 className="h-2.5 w-2.5" />
                                                                                            Vinculado
                                                                                        </Badge>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent>
                                                                                        Vinculado a: {item.linkedCustomer.name}
                                                                                    </TooltipContent>
                                                                                </Tooltip>
                                                                            </TooltipProvider>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="space-y-0.5">
                                                                        <p className="font-medium text-sm truncate max-w-[250px]">
                                                                            {ptx.description}
                                                                        </p>
                                                                        <p className="text-xs text-muted-foreground">
                                                                            {format(new Date(ptx.date), 'dd/MM/yyyy', { locale: ptBR })}
                                                                            {ptx.accountName && ` · ${ptx.accountName}`}
                                                                        </p>
                                                                        {(ptx.payerInfo.name ?? ptx.payerInfo.nameFromDescription) && (
                                                                            <p className="text-xs text-muted-foreground">
                                                                                <User className="inline h-3 w-3 mr-0.5" />
                                                                                {ptx.payerInfo.name ?? ptx.payerInfo.nameFromDescription}
                                                                                {ptx.payerInfo.cpf && (
                                                                                    <span className="font-mono ml-2">{maskCpf(ptx.payerInfo.cpf)}</span>
                                                                                )}
                                                                                {!ptx.payerInfo.name && ptx.payerInfo.nameFromDescription && (
                                                                                    <span className="ml-1 opacity-60">(descrição)</span>
                                                                                )}
                                                                            </p>
                                                                        )}
                                                                        {ptx.payerInfo.pixKey && !ptx.payerInfo.cpf && (
                                                                            <p className="text-xs text-muted-foreground font-mono">
                                                                                PIX: {ptx.payerInfo.pixKey}
                                                                            </p>
                                                                        )}
                                                                        {item.advboxCustomerFound && !item.linkedCustomer && item.matchStatus === 'none' && (
                                                                            <p className="text-xs text-amber-600 dark:text-amber-400">
                                                                                <User className="inline h-3 w-3 mr-0.5" />
                                                                                Advbox: {item.advboxCustomerFound.name}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right font-mono text-sm font-semibold">
                                                                    {formatCurrency(Math.abs(ptx.amount))}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {item.bestMatch ? (
                                                                        <div className="space-y-0.5">
                                                                            {matchCustomerName && (
                                                                                <p className="font-semibold text-sm truncate max-w-[200px]">
                                                                                    {matchCustomerName}
                                                                                </p>
                                                                            )}
                                                                            <p className="text-xs text-muted-foreground">
                                                                                {item.bestMatch.advboxTransaction.date_due
                                                                                    ? format(new Date(item.bestMatch.advboxTransaction.date_due), 'dd/MM/yyyy', { locale: ptBR })
                                                                                    : '—'}
                                                                                {' · '}
                                                                                <span className="font-mono">{formatCurrency(Math.abs(item.bestMatch.advboxTransaction.amount))}</span>
                                                                            </p>
                                                                            {matchAmountsEqual ? (
                                                                                <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                                                                                    <CheckCircle2 className="inline h-3 w-3 mr-0.5" />
                                                                                    Cliente encontrado e lançamento com Match
                                                                                </p>
                                                                            ) : (
                                                                                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                                                                                    <AlertTriangle className="inline h-3 w-3 mr-0.5" />
                                                                                    Cliente encontrado, lançamento com valor diverso
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    ) : item.matchStatus === 'reconciled' ? (
                                                                        <p className="text-xs text-muted-foreground">
                                                                            Pago em {item.paidAt ? format(new Date(item.paidAt), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                                                                        </p>
                                                                    ) : item.matchStatus === 'partial' && (item.advboxCustomerFound ?? item.linkedCustomer) ? (
                                                                        <div className="space-y-0.5">
                                                                            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                                                                <CheckCircle2 className="inline h-3 w-3 mr-0.5" />
                                                                                {(item.linkedCustomer ?? item.advboxCustomerFound)?.name}
                                                                            </p>
                                                                            <p className="text-xs text-muted-foreground italic">
                                                                                Cliente encontrado, lançamento com valor diverso
                                                                            </p>
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-xs text-muted-foreground italic">
                                                                            Nenhuma correspondência
                                                                        </p>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <ActionButtons
                                                                            item={item}
                                                                            ptx={ptx}
                                                                            onLink={() => setLinkPluggyTx(ptx)}
                                                                            onDetail={() => setDetailItem(item)}
                                                                            onConfirm={() => handleConfirm(item)}
                                                                            confirming={confirming}
                                                                        />
                                                                        <TooltipProvider>
                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="sm"
                                                                                        className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                        onClick={() => setDeleteTarget(item)}
                                                                                    >
                                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                                    </Button>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent>Excluir transação</TooltipContent>
                                                                            </Tooltip>
                                                                        </TooltipProvider>
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        )
                                                    })}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </TabsContent>
                                </Tabs>
                            </CardContent>
                        </Card>
                    )}

                    {/* Empty state */}
                    {!loading && !summary && !error && (
                        <div className="flex flex-col items-center justify-center py-24">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                                <ArrowLeftRight className="h-8 w-8 text-primary" />
                            </div>
                            <h2 className="text-xl font-semibold text-foreground">Conciliação Bancária</h2>
                            <p className="mt-2 text-sm text-muted-foreground max-w-md text-center">
                                Clique em &quot;Reconciliar&quot; para iniciar o match automático entre
                                as transações bancárias e os lançamentos do Advbox.
                            </p>
                        </div>
                    )}
                </main>

            {/* Dialogs */}
            <MatchDetailDialog
                item={detailItem}
                open={!!detailItem}
                onClose={() => setDetailItem(null)}
                onConfirm={handleConfirm}
                confirming={confirming}
            />
            <LinkCustomerDialog
                open={!!linkPluggyTx}
                onClose={() => setLinkPluggyTx(null)}
                pluggyTx={linkPluggyTx}
                onLink={handleLinkCustomer}
            />

            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir transação</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir esta transação bancária?
                            {deleteTarget && (
                                <span className="block mt-2 font-medium text-foreground">
                                    {deleteTarget.pluggyTransaction.description} · {formatCurrency(Math.abs(deleteTarget.pluggyTransaction.amount))}
                                </span>
                            )}
                            {deleteTarget?.reconciliationId && (
                                <span className="block mt-1 text-amber-600">
                                    A conciliação associada também será removida.
                                </span>
                            )}
                            <span className="block mt-1">Esta ação não pode ser desfeita.</span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteTransaction}
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
