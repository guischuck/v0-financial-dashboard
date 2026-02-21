"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value)
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
}) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
        <p className="mb-1 text-xs font-medium text-foreground">{label}</p>
        {payload.map((item, index) => (
          <p key={index} className="text-xs" style={{ color: item.color }}>
            {item.name === "receita" ? "Receita" : "Despesa"}: {formatCurrency(item.value)}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export function RevenueChart() {
  const [data, setData] = useState<{ month: string; receita: number; despesa: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchChartData() {
      setLoading(true)
      try {
        const now = new Date()
        const globalFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1)
        const globalTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

        const res = await fetch(
          `/api/pluggy/transactions?from=${globalFrom.toISOString()}&to=${globalTo.toISOString()}&pageSize=2000`
        )
        if (cancelled) return

        const { transactions = [] } = res.ok ? await res.json() : { transactions: [] }

        const buckets: Record<string, { receita: number; despesa: number }> = {}
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          const key = `${d.getFullYear()}-${d.getMonth()}`
          buckets[key] = { receita: 0, despesa: 0 }
        }

        for (const t of transactions as { amount: number; date: string }[]) {
          const d = new Date(t.date)
          const key = `${d.getFullYear()}-${d.getMonth()}`
          if (buckets[key]) {
            const amt = Number(t.amount)
            if (amt > 0) buckets[key].receita += amt
            else buckets[key].despesa += Math.abs(amt)
          }
        }

        const chartData: { month: string; receita: number; despesa: number }[] = []
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          const key = `${d.getFullYear()}-${d.getMonth()}`
          chartData.push({
            month: monthNames[d.getMonth()],
            ...buckets[key],
          })
        }

        setData(chartData)
      } catch {
        if (!cancelled) setData([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchChartData()
    return () => { cancelled = true }
  }, [])

  return (
    <Card className="p-5 shadow-sm border-border/60">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Receitas x Despesas
          </h3>
          <p className="text-xs text-muted-foreground">com base no vencimento (Pluggy)</p>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-chart-1" />
          <span className="text-xs text-muted-foreground">Receita</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-chart-3" />
          <span className="text-xs text-muted-foreground">Despesa</span>
        </div>
      </div>

      {loading ? (
        <div className="flex h-[260px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
          Nenhum dado no período. Sincronize transações na Pluggy.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} barGap={4} barSize={28}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickFormatter={(v) =>
                v >= 1000
                  ? `R$ ${(v / 1000).toFixed(0)}k`
                  : `R$ ${v.toFixed(0)}`
              }
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="receita" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="despesa" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}
