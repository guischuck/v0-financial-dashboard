"use client"

import { useMemo } from "react"
import { ArrowUpRight, ArrowDownRight, ChevronDown, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { useAccounts } from "@/lib/hooks/use-accounts"
import { useTransactions } from "@/lib/hooks/use-transactions"

interface KpiCardProps {
  title: string
  value: string
  subtitle?: string
  trend?: {
    value: string
    direction: "up" | "down"
  }
  variant?: "default" | "success" | "danger" | "warning"
  loading?: boolean
}

function KpiCard({ title, value, subtitle, trend, variant = "default", loading }: KpiCardProps) {
  const colorMap = {
    default: "text-foreground",
    success: "text-success",
    danger: "text-destructive",
    warning: "text-warning",
  }

  const trendColorMap = {
    up: "text-success",
    down: "text-destructive",
  }

  return (
    <Card className="flex flex-col gap-1 p-4 shadow-sm border-border/60">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground/50" />
      </div>
      <div className="flex items-baseline gap-2">
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <>
            <span className={`text-2xl font-bold tracking-tight ${colorMap[variant]}`}>
              {value}
            </span>
            {trend && (
              <span className={`flex items-center gap-0.5 text-xs font-medium ${trendColorMap[trend.direction]}`}>
                {trend.direction === "up" ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {trend.value}
              </span>
            )}
          </>
        )}
      </div>
      {subtitle && !loading && (
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      )}
    </Card>
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value)
}

export function KpiCards() {
  const { data: accounts, isLoading: accountsLoading } = useAccounts()

  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  const { data: txData, isLoading: txLoading } = useTransactions({ from, to, pageSize: 500 })

  const loading = accountsLoading || txLoading

  const saldo = useMemo(() => {
    if (!accounts) return null
    return accounts.reduce((acc: number, a: { balance?: number }) => acc + (Number(a.balance) || 0), 0)
  }, [accounts])

  const { receitaMes, despesaMes, totalLancamentos } = useMemo(() => {
    const list = txData?.transactions ?? []
    let receita = 0
    let despesa = 0
    for (const t of list) {
      const amt = Number(t.amount)
      if (amt > 0) receita += amt
      else despesa += Math.abs(amt)
    }
    return { receitaMes: receita, despesaMes: despesa, totalLancamentos: list.length }
  }, [txData])

  const conciliados = 0
  const percentConciliado = totalLancamentos > 0 ? Math.round((conciliados / totalLancamentos) * 100) : 0

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        title="Saldo"
        value={saldo !== null ? formatCurrency(saldo) : "—"}
        subtitle={saldo !== null ? "Soma das contas Pluggy" : "Conecte contas na Pluggy"}
        variant="default"
        loading={loading}
      />
      <KpiCard
        title="Receita do mês"
        value={formatCurrency(receitaMes)}
        subtitle="Créditos no período (Pluggy)"
        variant="default"
        loading={loading}
      />
      <KpiCard
        title="Despesa do mês"
        value={formatCurrency(despesaMes)}
        subtitle="Débitos no período (Pluggy)"
        variant="danger"
        loading={loading}
      />
      <KpiCard
        title="Conciliados"
        value={totalLancamentos === 0 ? "—" : `${percentConciliado}%`}
        subtitle={totalLancamentos > 0 ? `${conciliados} de ${totalLancamentos} lançamentos` : "Nenhum lançamento no mês"}
        variant="success"
        loading={loading}
      />
    </div>
  )
}
