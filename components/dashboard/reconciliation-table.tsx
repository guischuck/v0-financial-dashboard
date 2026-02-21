"use client"

import { useState, useMemo, useCallback } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
  X,
  Check,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useReconciliation, useConfirmReconciliation } from "@/lib/hooks/use-reconciliation"
import { useAccounts } from "@/lib/hooks/use-accounts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { translateCategory } from "@/lib/pluggy-categories"

type SortField = "date" | "amount" | "status" | "description" | "advboxAmount"
type SortDir = "asc" | "desc"

type MatchStatus = "none" | "partial" | "auto" | "reconciled"

const statusConfig: Record<MatchStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  reconciled: {
    label: "Conciliado",
    icon: CheckCircle2,
    className: "bg-success/10 text-success border-success/20",
  },
  auto: {
    label: "Match",
    icon: Check,
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  },
  partial: {
    label: "Parcial",
    icon: AlertTriangle,
    className: "bg-warning/10 text-warning border-warning/20",
  },
  none: {
    label: "Pendente",
    icon: Clock,
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
}

function formatCurrency(value: number) {
  if (value === 0) return "-"
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value)
}

export function ReconciliationTable() {
  const [selectedFilter, setSelectedFilter] = useState<string>("todos")
  const [accountFilter, setAccountFilter] = useState<string>("todas")
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [sortField, setSortField] = useState<SortField>("date")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [confirmTarget, setConfirmTarget] = useState<any>(null)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return { month: now.getMonth(), year: now.getFullYear() }
  })

  const monthLabel = new Date(currentMonth.year, currentMonth.month).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  })

  const from = format(new Date(currentMonth.year, currentMonth.month, 1), "yyyy-MM-dd")
  const to = format(new Date(currentMonth.year, currentMonth.month + 1, 0), "yyyy-MM-dd")

  const { data: reconData, isLoading: loading, refetch: refetchRecon } = useReconciliation(
    { from, to, entryType: "income" },
    true
  )

  const { data: accounts } = useAccounts()
  const queryClient = useQueryClient()
  const confirmMutation = useConfirmReconciliation()

  const items: any[] = reconData?.items ?? []
  const summary = reconData?.summary ?? null

  const syncMutation = useMutation({
    mutationFn: async () => {
      const syncFrom = format(new Date(currentMonth.year, currentMonth.month, 1), "yyyy-MM-dd")
      const syncTo = format(new Date(currentMonth.year, currentMonth.month + 1, 0), "yyyy-MM-dd")
      const [pluggyRes] = await Promise.all([
        fetch("/api/pluggy/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from: syncFrom, to: syncTo }),
        }),
        fetch(`/api/advbox/transactions?date_due_start=${syncFrom}&date_due_end=${syncTo}`),
      ])
      if (!pluggyRes.ok) throw new Error("Falha na sincronização")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliation"] })
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      queryClient.invalidateQueries({ queryKey: ["accounts"] })
    },
  })

  const handleSync = () => syncMutation.mutate()
  const syncing = syncMutation.isPending

  const goToPrevMonth = () => {
    setCurrentMonth((prev) => {
      const d = new Date(prev.year, prev.month - 1)
      return { month: d.getMonth(), year: d.getFullYear() }
    })
  }

  const goToNextMonth = () => {
    setCurrentMonth((prev) => {
      const d = new Date(prev.year, prev.month + 1)
      return { month: d.getMonth(), year: d.getFullYear() }
    })
  }

  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"))
        return prev
      }
      setSortDir("desc")
      return field
    })
  }, [])

  const handleConfirmPay = async (item: any) => {
    if (!item.bestMatch) return
    const ptx = item.pluggyTransaction
    const atx = item.bestMatch.advboxTransaction
    await confirmMutation.mutateAsync({
      pluggyTransactionDbId: ptx.id,
      advboxTransactionId: atx.id,
      matchScore: item.bestMatch.score,
      advboxCustomerId: item.linkedCustomer?.id ?? null,
      pluggyDescription: ptx.description,
      pluggyAmount: ptx.amount,
      pluggyDate: ptx.date,
      pluggyPayerName: ptx.payerInfo?.name ?? ptx.payerInfo?.nameFromDescription ?? null,
      advboxDescription: atx.description,
      advboxAmount: atx.amount,
      advboxCustomerName: atx.customer_name ?? atx.name ?? null,
    })
    setConfirmTarget(null)
  }

  const filteredItems = useMemo(() => {
    let result = items

    if (selectedFilter !== "todos") {
      result = result.filter((i: any) => i.matchStatus === selectedFilter)
    }

    if (accountFilter !== "todas") {
      result = result.filter((i: any) => i.pluggyTransaction.accountName === accountFilter)
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim()
      result = result.filter((i: any) => {
        const ptx = i.pluggyTransaction
        return (
          ptx.description?.toLowerCase().includes(q) ||
          ptx.payerInfo?.name?.toLowerCase().includes(q) ||
          ptx.payerInfo?.nameFromDescription?.toLowerCase().includes(q) ||
          ptx.payerInfo?.cpf?.includes(q) ||
          i.bestMatch?.advboxTransaction?.customer_name?.toLowerCase().includes(q) ||
          i.bestMatch?.advboxTransaction?.description?.toLowerCase().includes(q) ||
          i.bestMatch?.advboxTransaction?.name?.toLowerCase().includes(q)
        )
      })
    }

    result = [...result].sort((a: any, b: any) => {
      const dir = sortDir === "asc" ? 1 : -1
      switch (sortField) {
        case "date":
          return dir * (new Date(a.pluggyTransaction.date).getTime() - new Date(b.pluggyTransaction.date).getTime())
        case "amount":
          return dir * (Math.abs(a.pluggyTransaction.amount) - Math.abs(b.pluggyTransaction.amount))
        case "advboxAmount": {
          const aAmt = a.bestMatch ? Math.abs(a.bestMatch.advboxTransaction.amount) : 0
          const bAmt = b.bestMatch ? Math.abs(b.bestMatch.advboxTransaction.amount) : 0
          return dir * (aAmt - bAmt)
        }
        case "status": {
          const order: Record<string, number> = { none: 0, partial: 1, auto: 2, reconciled: 3 }
          return dir * ((order[a.matchStatus] ?? 0) - (order[b.matchStatus] ?? 0))
        }
        case "description":
          return dir * (a.pluggyTransaction.description ?? "").localeCompare(b.pluggyTransaction.description ?? "")
        default:
          return 0
      }
    })

    return result
  }, [items, selectedFilter, accountFilter, searchTerm, sortField, sortDir])

  const toggleRow = (id: string) => {
    const newSelected = new Set(selectedRows)
    if (newSelected.has(id)) newSelected.delete(id)
    else newSelected.add(id)
    setSelectedRows(newSelected)
  }

  const toggleAll = () => {
    if (selectedRows.size === filteredItems.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(filteredItems.map((i: any) => i.pluggyTransaction.id)))
    }
  }

  const totalAdvbox = filteredItems.reduce(
    (acc: number, i: any) => acc + (i.bestMatch ? Math.abs(i.bestMatch.advboxTransaction.amount) : 0),
    0
  )
  const totalPluggy = filteredItems.reduce(
    (acc: number, i: any) => acc + Math.abs(i.pluggyTransaction.amount),
    0
  )

  const accountNames = useMemo(() => {
    const names = new Set<string>()
    for (const i of items) {
      if (i.pluggyTransaction.accountName) names.add(i.pluggyTransaction.accountName)
    }
    return Array.from(names)
  }, [items])

  const handleExport = useCallback(() => {
    const headers = [
      "Vencimento",
      "Competência",
      "Lançamento (Advbox)",
      "Extrato (Pluggy)",
      "Categoria",
      "Advbox (R$)",
      "Pluggy (R$)",
      "Status",
    ]
    const rows = filteredItems.map((item: any) => {
      const ptx = item.pluggyTransaction
      const atx = item.bestMatch?.advboxTransaction
      const d = new Date(ptx.date)
      return [
        atx?.date_due ? format(new Date(atx.date_due), "dd/MM/yyyy") : format(d, "dd/MM/yyyy"),
        `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`,
        atx?.description ?? "Sem registro",
        ptx.description ?? "",
        ptx.category ? translateCategory(ptx.category) : "",
        atx ? Math.abs(atx.amount).toFixed(2).replace(".", ",") : "-",
        Math.abs(ptx.amount).toFixed(2).replace(".", ","),
        statusConfig[item.matchStatus as MatchStatus]?.label ?? item.matchStatus,
      ]
    })

    const bom = "\uFEFF"
    const csv = bom + [headers, ...rows].map((r) => r.map((c: string) => `"${c}"`).join(";")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `conciliacao_${from}_${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [filteredItems, from, to])

  function SortableHeader({ field, label, className }: { field: SortField; label: string; className?: string }) {
    const active = sortField === field
    return (
      <th
        className={`px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors ${className ?? ""}`}
        onClick={() => handleSort(field)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {active ? (
            sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-30" />
          )}
        </span>
      </th>
    )
  }

  return (
    <Card className="shadow-sm border-border/60 overflow-hidden">
      <div className="border-b border-border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-foreground">
            Conciliacao Bancaria
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedFilter} onValueChange={setSelectedFilter}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="reconciled">Conciliados</SelectItem>
                <SelectItem value="auto">Match Automático</SelectItem>
                <SelectItem value="partial">Parciais</SelectItem>
                <SelectItem value="none">Pendentes</SelectItem>
              </SelectContent>
            </Select>

            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="Filtrar conta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as contas</SelectItem>
                {accountNames.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1 rounded-md border border-input px-1">
              <button onClick={goToPrevMonth} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="px-2 text-xs font-medium text-foreground capitalize">{monthLabel}</span>
              <button onClick={goToNextMonth} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Sincronizar
            </Button>

            <button
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={() => setShowSearch((v) => !v)}
            >
              <Search className="h-3.5 w-3.5" />
              Buscar
            </button>

            <button
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={handleExport}
            >
              <Download className="h-3.5 w-3.5" />
              Exportar
            </button>
          </div>
        </div>

        {showSearch && (
          <div className="mt-3 relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CPF, descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 pr-8 text-xs"
              autoFocus
            />
            {searchTerm && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchTerm("")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {selectedRows.size > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {selectedRows.size} selecionado(s)
            </span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="w-10 px-3 py-2.5">
                <Checkbox
                  checked={filteredItems.length > 0 && selectedRows.size === filteredItems.length}
                  onCheckedChange={toggleAll}
                />
              </th>
              <SortableHeader field="date" label="Vencimento" />
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Competência
              </th>
              <SortableHeader field="description" label="Lançamento (Advbox)" />
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Extrato (Pluggy)
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Categoria
              </th>
              <SortableHeader field="advboxAmount" label="Advbox" className="text-right" />
              <SortableHeader field="amount" label="Pluggy" className="text-right" />
              <SortableHeader field="status" label="Status" className="text-center" />
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border bg-muted/20">
              <td colSpan={6} className="px-3 py-2.5 text-right">
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-xs text-muted-foreground">total do periodo filtrado</span>
                  <span className="text-xs text-muted-foreground">diferenca (Advbox − Pluggy)</span>
                </div>
              </td>
              <td className="px-3 py-2.5 text-right">
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-xs font-semibold text-foreground">{formatCurrency(totalAdvbox)}</span>
                  <span className="text-xs font-semibold text-foreground">{formatCurrency(totalAdvbox - totalPluggy)}</span>
                </div>
              </td>
              <td className="px-3 py-2.5 text-right">
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-xs font-semibold text-foreground">{formatCurrency(totalPluggy)}</span>
                </div>
              </td>
              <td className="px-3 py-2.5 text-center">
                <span className="text-[10px] font-medium text-muted-foreground">
                  {filteredItems.filter((i: any) => i.matchStatus === "reconciled").length}/{filteredItems.length}
                </span>
              </td>
            </tr>

            {loading && (
              <tr>
                <td colSpan={9} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Carregando conciliação...</span>
                  </div>
                </td>
              </tr>
            )}

            {!loading && filteredItems.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Clock className="h-6 w-6 text-muted-foreground/50" />
                    <span className="text-sm text-muted-foreground">Nenhuma transação encontrada</span>
                    <span className="text-xs text-muted-foreground">Clique em Sincronizar para buscar dados</span>
                  </div>
                </td>
              </tr>
            )}

            {!loading &&
              filteredItems.map((item: any) => {
                const ptx = item.pluggyTransaction
                const atx = item.bestMatch?.advboxTransaction
                const status = item.matchStatus as MatchStatus
                const statusInfo = statusConfig[status] ?? statusConfig.none
                const StatusIcon = statusInfo.icon
                const d = new Date(ptx.date)
                const competencia = `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
                const pluggyAmount = Math.abs(ptx.amount)
                const advboxAmount = atx ? Math.abs(atx.amount) : 0
                const hasDiff = atx && pluggyAmount !== advboxAmount
                const isEntrada = ptx.type === "CREDIT"
                const canPay = (status === "auto" || status === "partial") && !!item.bestMatch

                return (
                  <tr
                    key={ptx.id}
                    className="border-b border-border transition-colors hover:bg-accent/30"
                  >
                    <td className="px-3 py-2.5">
                      <Checkbox
                        checked={selectedRows.has(ptx.id)}
                        onCheckedChange={() => toggleRow(ptx.id)}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-sm font-medium text-primary">
                        {atx?.date_due
                          ? format(new Date(atx.date_due), "dd/MM/yyyy")
                          : format(d, "dd/MM/yyyy")}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-muted-foreground">
                      {competencia}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2.5 text-sm font-medium text-foreground">
                      {atx ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="truncate block">
                                {atx.description || atx.customer_name || atx.name || "Lançamento encontrado"}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs">
                              <div className="space-y-1 text-xs">
                                <p><strong>Descrição:</strong> {atx.description}</p>
                                {atx.customer_name && <p><strong>Cliente:</strong> {atx.customer_name}</p>}
                                {atx.date_due && <p><strong>Vencimento:</strong> {format(new Date(atx.date_due), "dd/MM/yyyy")}</p>}
                                <p><strong>Valor:</strong> {formatCurrency(Math.abs(atx.amount))}</p>
                                {item.bestMatch && <p><strong>Score:</strong> {item.bestMatch.score}pts</p>}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="italic text-muted-foreground/50">Sem registro</span>
                      )}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2.5 text-sm text-muted-foreground">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="truncate block">{ptx.description || "—"}</span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs">
                            <div className="space-y-1 text-xs">
                              <p>{ptx.description}</p>
                              {ptx.payerInfo?.name && <p><strong>Pagador:</strong> {ptx.payerInfo.name}</p>}
                              {!ptx.payerInfo?.name && ptx.payerInfo?.nameFromDescription && (
                                <p><strong>Pagador (descrição):</strong> {ptx.payerInfo.nameFromDescription}</p>
                              )}
                              {ptx.accountName && <p><strong>Conta:</strong> {ptx.accountName}</p>}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-muted-foreground">
                      {ptx.category ? translateCategory(ptx.category) : "-"}
                    </td>
                    <td className={`px-3 py-2.5 text-right text-sm font-medium ${hasDiff ? "text-destructive" : "text-foreground"}`}>
                      {atx ? formatCurrency(advboxAmount) : "-"}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right text-sm font-medium ${
                        isEntrada ? "text-success" : hasDiff ? "text-destructive" : "text-foreground"
                      }`}
                    >
                      {formatCurrency(pluggyAmount)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {canPay ? (
                        <button onClick={() => setConfirmTarget(item)} className="inline-flex">
                          <Badge
                            variant="outline"
                            className={`gap-1 text-[10px] font-medium cursor-pointer hover:opacity-80 transition-opacity ${statusInfo.className}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {statusInfo.label}
                          </Badge>
                        </button>
                      ) : (
                        <Badge
                          variant="outline"
                          className={`gap-1 text-[10px] font-medium ${statusInfo.className}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {statusInfo.label}
                        </Badge>
                      )}
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!confirmTarget} onOpenChange={(open) => !open && setConfirmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar pagamento</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <span>Deseja marcar esta transação como paga no Advbox?</span>
                {confirmTarget && (
                  <span className="block mt-3 space-y-1.5 text-sm">
                    <span className="flex justify-between">
                      <span className="text-muted-foreground">Pluggy:</span>
                      <span className="font-medium">{confirmTarget.pluggyTransaction.description}</span>
                    </span>
                    <span className="flex justify-between">
                      <span className="text-muted-foreground">Valor Pluggy:</span>
                      <span className="font-semibold">{formatCurrency(Math.abs(confirmTarget.pluggyTransaction.amount))}</span>
                    </span>
                    {confirmTarget.bestMatch && (
                      <>
                        <span className="flex justify-between">
                          <span className="text-muted-foreground">Advbox:</span>
                          <span className="font-medium">{confirmTarget.bestMatch.advboxTransaction.description}</span>
                        </span>
                        <span className="flex justify-between">
                          <span className="text-muted-foreground">Valor Advbox:</span>
                          <span className="font-semibold">
                            {formatCurrency(Math.abs(confirmTarget.bestMatch.advboxTransaction.amount))}
                          </span>
                        </span>
                        <span className="flex justify-between">
                          <span className="text-muted-foreground">Score:</span>
                          <span>{confirmTarget.bestMatch.score}pts</span>
                        </span>
                      </>
                    )}
                  </span>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmTarget && handleConfirmPay(confirmTarget)}
              disabled={confirmMutation.isPending}
            >
              {confirmMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Confirmar Pagamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
