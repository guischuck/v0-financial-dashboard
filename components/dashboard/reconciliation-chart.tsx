"use client"

import { Card } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"

const data = [
  { name: "Conciliados", value: 142, color: "var(--success)" },
  { name: "Pendentes", value: 15, color: "var(--warning)" },
  { name: "Divergentes", value: 6, color: "var(--destructive)" },
]

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
        <p className="text-xs text-muted-foreground">{payload[0].value} lancamentos</p>
      </div>
    )
  }
  return null
}

export function ReconciliationChart() {
  const total = data.reduce((acc, item) => acc + item.value, 0)

  return (
    <Card className="p-4 shadow-sm border-border/60">
      <h3 className="mb-3 text-sm font-semibold text-foreground">
        Visao Geral da Conciliacao
      </h3>
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
