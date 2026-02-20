"use client"

import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, CheckCircle2, AlertTriangle, ChevronDown } from "lucide-react"
import { Card } from "@/components/ui/card"

interface KpiCardProps {
  title: string
  value: string
  subtitle?: string
  trend?: {
    value: string
    direction: "up" | "down"
  }
  variant?: "default" | "success" | "danger" | "warning"
}

function KpiCard({ title, value, subtitle, trend, variant = "default" }: KpiCardProps) {
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
      </div>
      {subtitle && (
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      )}
    </Card>
  )
}

export function KpiCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        title="Saldo"
        value="R$ 70.112,00"
        trend={{ value: "732%", direction: "up" }}
        subtitle="vs mes anterior: R$ 8.422,00"
        variant="default"
      />
      <KpiCard
        title="Receita mensal prevista"
        value="R$ 200.674,14"
        subtitle="vs realizada: R$ 61.690,00"
        variant="default"
      />
      <KpiCard
        title="Despesa mensal prevista"
        value="R$ -190,00"
        subtitle="vs realizada: R$ -0,00"
        variant="danger"
      />
      <KpiCard
        title="Conciliados"
        value="87%"
        trend={{ value: "12%", direction: "up" }}
        subtitle="142 de 163 lancamentos"
        variant="success"
      />
    </div>
  )
}

export function ReconciliationKpi() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="flex items-center gap-3 p-4 shadow-sm border-border/60">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
          <CheckCircle2 className="h-5 w-5 text-success" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">142</p>
          <p className="text-xs text-muted-foreground">Conciliados</p>
        </div>
      </Card>
      <Card className="flex items-center gap-3 p-4 shadow-sm border-border/60">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
          <AlertTriangle className="h-5 w-5 text-warning" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">15</p>
          <p className="text-xs text-muted-foreground">Pendentes</p>
        </div>
      </Card>
      <Card className="flex items-center gap-3 p-4 shadow-sm border-border/60">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
          <TrendingDown className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">6</p>
          <p className="text-xs text-muted-foreground">Divergentes</p>
        </div>
      </Card>
      <Card className="flex items-center gap-3 p-4 shadow-sm border-border/60">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <TrendingUp className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">R$ 1.247,50</p>
          <p className="text-xs text-muted-foreground">Diferenca total</p>
        </div>
      </Card>
    </div>
  )
}
