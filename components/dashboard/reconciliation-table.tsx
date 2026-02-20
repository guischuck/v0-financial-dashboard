"use client"

import { useState } from "react"
import {
  Search,
  Filter,
  ArrowUpDown,
  Download,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Link2,
  ExternalLink,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type ReconciliationStatus = "conciliado" | "pendente" | "divergente" | "nao_encontrado"

interface Transaction {
  id: string
  vencimento: string
  pagamento: string
  competencia: string
  descricaoAdvbox: string
  descricaoPluggy: string
  categoria: string
  valorAdvbox: number
  valorPluggy: number
  status: ReconciliationStatus
}

const transactions: Transaction[] = [
  {
    id: "1",
    vencimento: "10/02/2026",
    pagamento: "10/02/2026",
    competencia: "02/2026",
    descricaoAdvbox: "GUILHERME SCHUCK DOS SANTOS (064...)",
    descricaoPluggy: "PIX GUILHERME S SANTOS",
    categoria: "1. Honorarios Finais",
    valorAdvbox: 70.0,
    valorPluggy: 70.0,
    status: "conciliado",
  },
  {
    id: "2",
    vencimento: "10/02/2026",
    pagamento: "10/02/2026",
    competencia: "02/2026",
    descricaoAdvbox: "GUILHERME SCHUCK DOS SANTOS (064...)",
    descricaoPluggy: "PIX GUILHERME S SANTOS",
    categoria: "1. Honorarios Iniciais",
    valorAdvbox: 12.0,
    valorPluggy: 12.0,
    status: "conciliado",
  },
  {
    id: "3",
    vencimento: "15/02/2026",
    pagamento: "15/02/2026",
    competencia: "02/2026",
    descricaoAdvbox: "TESTE HONORARIOS INICIAIS VIA API",
    descricaoPluggy: "TED 15/02 TESTE HONORARIOS",
    categoria: "1. Honorarios Iniciais",
    valorAdvbox: 10000.0,
    valorPluggy: 10000.0,
    status: "conciliado",
  },
  {
    id: "4",
    vencimento: "18/02/2026",
    pagamento: "",
    competencia: "02/2026",
    descricaoAdvbox: "Honorarios Cliente X",
    descricaoPluggy: "",
    categoria: "1. Honorarios Iniciais",
    valorAdvbox: 3000.0,
    valorPluggy: 0,
    status: "nao_encontrado",
  },
  {
    id: "5",
    vencimento: "25/02/2026",
    pagamento: "25/02/2026",
    competencia: "02/2026",
    descricaoAdvbox: "Consultoria Juridica - Empresa Y",
    descricaoPluggy: "PIX EMPRESA Y LTDA",
    categoria: "1. Honorarios Iniciais",
    valorAdvbox: 100.0,
    valorPluggy: 150.0,
    status: "divergente",
  },
  {
    id: "6",
    vencimento: "25/02/2026",
    pagamento: "25/02/2026",
    competencia: "02/2026",
    descricaoAdvbox: "Taxa Processual",
    descricaoPluggy: "DEB TAXA PROCESSUAL TJ/RS",
    categoria: "2. Custas Processuais",
    valorAdvbox: 1.0,
    valorPluggy: 1.0,
    status: "conciliado",
  },
  {
    id: "7",
    vencimento: "25/02/2026",
    pagamento: "",
    competencia: "02/2026",
    descricaoAdvbox: "Parcela Acordo - Maria Silva",
    descricaoPluggy: "",
    categoria: "1. Honorarios Iniciais",
    valorAdvbox: 100.0,
    valorPluggy: 0,
    status: "pendente",
  },
  {
    id: "8",
    vencimento: "25/02/2026",
    pagamento: "25/02/2026",
    competencia: "02/2026",
    descricaoAdvbox: "Reembolso Material",
    descricaoPluggy: "PIX REEMBOLSO MATERIAL",
    categoria: "3. Outros",
    valorAdvbox: 100.0,
    valorPluggy: 100.0,
    status: "conciliado",
  },
  {
    id: "9",
    vencimento: "27/02/2026",
    pagamento: "27/02/2026",
    competencia: "02/2026",
    descricaoAdvbox: "",
    descricaoPluggy: "PIX RECEBIDO JOAO PEREIRA",
    categoria: "",
    valorAdvbox: 0,
    valorPluggy: 500.0,
    status: "pendente",
  },
  {
    id: "10",
    vencimento: "28/02/2026",
    pagamento: "28/02/2026",
    competencia: "02/2026",
    descricaoAdvbox: "Honorarios Dr. Costa",
    descricaoPluggy: "TED HONORARIOS COSTA ADV",
    categoria: "1. Honorarios Iniciais",
    valorAdvbox: 2500.0,
    valorPluggy: 2500.0,
    status: "conciliado",
  },
]

const statusConfig: Record<ReconciliationStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  conciliado: {
    label: "Conciliado",
    icon: CheckCircle2,
    className: "bg-success/10 text-success border-success/20",
  },
  pendente: {
    label: "Pendente",
    icon: Clock,
    className: "bg-warning/10 text-warning border-warning/20",
  },
  divergente: {
    label: "Divergente",
    icon: AlertTriangle,
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  nao_encontrado: {
    label: "Nao encontrado",
    icon: XCircle,
    className: "bg-muted text-muted-foreground border-border",
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
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())

  const filteredTransactions =
    selectedFilter === "todos"
      ? transactions
      : transactions.filter((t) => t.status === selectedFilter)

  const toggleRow = (id: string) => {
    const newSelected = new Set(selectedRows)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedRows(newSelected)
  }

  const toggleAll = () => {
    if (selectedRows.size === filteredTransactions.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(filteredTransactions.map((t) => t.id)))
    }
  }

  const totalPeriodo = filteredTransactions.reduce((acc, t) => acc + t.valorAdvbox, 0)
  const totalPluggy = filteredTransactions.reduce((acc, t) => acc + t.valorPluggy, 0)

  return (
    <Card className="shadow-sm border-border/60 overflow-hidden">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-foreground">
            Conciliacao Bancaria
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter by status */}
            <Select value={selectedFilter} onValueChange={setSelectedFilter}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="conciliado">Conciliados</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="divergente">Divergentes</SelectItem>
                <SelectItem value="nao_encontrado">Nao encontrado</SelectItem>
              </SelectContent>
            </Select>

            {/* Filter by account */}
            <Select defaultValue="todas">
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Filtrar conta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as contas</SelectItem>
                <SelectItem value="principal">Conta Principal</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
              </SelectContent>
            </Select>

            {/* Month navigation */}
            <div className="flex items-center gap-1 rounded-md border border-input px-1">
              <button className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="px-2 text-xs font-medium text-foreground">Fevereiro 2026</span>
              <button className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <button className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <Search className="h-3.5 w-3.5" />
              Buscar
            </button>
            <button className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <Filter className="h-3.5 w-3.5" />
              Filtrar
            </button>
            <button className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <ArrowUpDown className="h-3.5 w-3.5" />
              Ordenar
            </button>
            <button className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <Download className="h-3.5 w-3.5" />
              Exportar
            </button>
          </div>
        </div>

        {/* Bulk actions */}
        {selectedRows.size > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {selectedRows.size} selecionado(s)
            </span>
            <Button size="sm" variant="outline" className="h-7 text-xs">
              <Link2 className="mr-1 h-3 w-3" />
              Conciliar selecionados
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs">
              <ExternalLink className="mr-1 h-3 w-3" />
              Abrir no Advbox
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="w-10 px-3 py-2.5">
                <Checkbox
                  checked={
                    filteredTransactions.length > 0 &&
                    selectedRows.size === filteredTransactions.length
                  }
                  onCheckedChange={toggleAll}
                />
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Vencimento
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Competencia
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Lancamento (Advbox)
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Extrato (Pluggy)
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Categoria
              </th>
              <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Advbox
              </th>
              <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Pluggy
              </th>
              <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Summary row */}
            <tr className="border-b border-border bg-muted/20">
              <td colSpan={6} className="px-3 py-2.5 text-right">
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-xs text-muted-foreground">total do periodo filtrado</span>
                  <span className="text-xs text-muted-foreground">saldo</span>
                  <span className="text-xs text-muted-foreground">diferenca</span>
                </div>
              </td>
              <td className="px-3 py-2.5 text-right">
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-xs font-semibold text-foreground">{formatCurrency(totalPeriodo)}</span>
                  <span className="text-xs font-semibold text-success">R$ 70.112,00</span>
                  <span className="text-xs font-semibold text-foreground">{formatCurrency(totalPeriodo)}</span>
                </div>
              </td>
              <td className="px-3 py-2.5 text-right">
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-xs font-semibold text-foreground">{formatCurrency(totalPluggy)}</span>
                  <span className="text-xs font-semibold text-success">R$ 70.112,00</span>
                  <span className="text-xs font-semibold text-foreground">{formatCurrency(totalPluggy)}</span>
                </div>
              </td>
              <td className="px-3 py-2.5 text-center">
                <span className="text-[10px] font-medium text-muted-foreground">
                  {filteredTransactions.filter((t) => t.status === "conciliado").length}/{filteredTransactions.length}
                </span>
              </td>
            </tr>

            {/* Transaction rows */}
            {filteredTransactions.map((tx) => {
              const statusInfo = statusConfig[tx.status]
              const StatusIcon = statusInfo.icon
              const hasDifference = tx.valorAdvbox !== tx.valorPluggy && tx.valorPluggy > 0

              return (
                <tr
                  key={tx.id}
                  className="border-b border-border transition-colors hover:bg-accent/30"
                >
                  <td className="px-3 py-2.5">
                    <Checkbox
                      checked={selectedRows.has(tx.id)}
                      onCheckedChange={() => toggleRow(tx.id)}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`text-sm ${
                        tx.pagamento ? "font-medium text-primary cursor-pointer hover:underline" : "text-foreground"
                      }`}
                    >
                      {tx.vencimento}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-sm text-muted-foreground">
                    {tx.competencia}
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2.5 text-sm font-medium text-foreground">
                    {tx.descricaoAdvbox || (
                      <span className="italic text-muted-foreground/50">Sem registro</span>
                    )}
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2.5 text-sm text-muted-foreground">
                    {tx.descricaoPluggy || (
                      <span className="italic text-muted-foreground/50">Sem registro</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-muted-foreground">
                    {tx.categoria || "-"}
                  </td>
                  <td className={`px-3 py-2.5 text-right text-sm font-medium ${hasDifference ? "text-destructive" : "text-foreground"}`}>
                    {formatCurrency(tx.valorAdvbox)}
                  </td>
                  <td className={`px-3 py-2.5 text-right text-sm font-medium ${hasDifference ? "text-destructive" : "text-foreground"}`}>
                    {formatCurrency(tx.valorPluggy)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Badge
                      variant="outline"
                      className={`gap-1 text-[10px] font-medium ${statusInfo.className}`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {statusInfo.label}
                    </Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
