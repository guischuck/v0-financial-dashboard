"use client"

import { Card } from "@/components/ui/card"
import { RefreshCw } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

const data = [
  { month: "Fev", receita: 200174.14, despesa: 190.0 },
  { month: "Mar", receita: 2339.91, despesa: 20175.0 },
  { month: "Abr", receita: 0.01, despesa: 0.0 },
  { month: "Mai", receita: 0.01, despesa: 0.0 },
  { month: "Jun", receita: 0.01, despesa: 0.0 },
]

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
  return (
    <Card className="p-5 shadow-sm border-border/60">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Receitas x Despesas
          </h3>
          <p className="text-xs text-muted-foreground">com base no vencimento</p>
        </div>
        <button className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <RefreshCw className="h-4 w-4" />
        </button>
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
    </Card>
  )
}
