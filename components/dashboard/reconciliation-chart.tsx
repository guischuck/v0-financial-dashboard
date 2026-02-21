"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { Loader2 } from "lucide-react"

const COLORS = {
  conciliados: "var(--success)",
  pendentes: "var(--warning)",
  divergentes: "var(--destructive)",
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: { color: string } }>
}) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-card p-2 shadow-lg">
        <p className="text-xs font-medium text-foreground">{payload[0].name}</p>
        <p className="text-xs text-muted-foreground">{payload[0].value} lançamentos</p>
      </div>
    )
  }
  return null
}

export function ReconciliationChart() {
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState({ conciliados: 0, pendentes: 0, divergentes: 0 })

  useEffect(() => {
    let cancelled = false

    async function fetchCounts() {
      setLoading(true)
      try {
        const now = new Date()
        const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
        const res = await fetch(`/api/pluggy/transactions?from=${from}&to=${to}&pageSize=500`)
        if (res.ok && !cancelled) {
          const { transactions } = await res.json()
          const list = transactions || []
          setCounts({
            conciliados: 0,
            pendentes: list.length,
            divergentes: 0,
          })
        }
      } catch (e) {
        if (!cancelled) setCounts({ conciliados: 0, pendentes: 0, divergentes: 0 })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchCounts()
    return () => { cancelled = true }
  }, [])

  const data = [
    { name: "Conciliados", value: counts.conciliados, color: COLORS.conciliados },
    { name: "Pendentes", value: counts.pendentes, color: COLORS.pendentes },
    { name: "Divergentes", value: counts.divergentes, color: COLORS.divergentes },
  ].filter((d) => d.value > 0)

  const total = data.reduce((acc, item) => acc + item.value, 0)

  if (loading) {
    return (
      <Card className="p-4 shadow-sm border-border/60">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Visão Geral da Conciliação</h3>
        <div className="flex h-[180px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    )
  }

  if (total === 0) {
    return (
      <Card className="p-4 shadow-sm border-border/60">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Visão Geral da Conciliação</h3>
        <div className="flex h-[180px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <span>Nenhum lançamento no mês.</span>
          <span className="text-xs">Sincronize transações na Pluggy.</span>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-4 shadow-sm border-border/60">
      <h3 className="mb-3 text-sm font-semibold text-foreground">Visão Geral da Conciliação</h3>
      <div className="relative flex items-center justify-center">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={75}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute flex flex-col items-center">
          <span className="text-2xl font-bold text-foreground">{total}</span>
          <span className="text-[10px] text-muted-foreground">Total</span>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {data.map((item) => (
          <div key={item.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs text-muted-foreground">{item.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-foreground">{item.value}</span>
              <span className="text-[10px] text-muted-foreground">
                ({((item.value / total) * 100).toFixed(0)}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
