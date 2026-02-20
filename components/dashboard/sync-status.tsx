"use client"

import { Card } from "@/components/ui/card"
import { RefreshCw, CheckCircle2, Clock, Landmark, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

export function SyncStatus() {
  return (
    <Card className="p-4 shadow-sm border-border/60">
      <h3 className="mb-3 text-sm font-semibold text-foreground">Status da Sincronizacao</h3>

      {/* Pluggy status */}
      <div className="mb-4 rounded-lg bg-success/5 border border-success/15 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-success/10">
              <Landmark className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Pluggy</p>
              <p className="text-[10px] text-muted-foreground">Dados bancarios</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            <span className="text-[10px] font-medium text-success">Conectado</span>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            Ultima sincronizacao: 18/02/2026 09:30
          </span>
          <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[10px]">
            <RefreshCw className="h-3 w-3" />
            Sincronizar
          </Button>
        </div>
      </div>

      {/* Advbox status */}
      <div className="mb-4 rounded-lg bg-primary/5 border border-primary/15 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Advbox</p>
              <p className="text-[10px] text-muted-foreground">Lancamentos financeiros</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            <span className="text-[10px] font-medium text-success">Conectado</span>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            Ultima sincronizacao: 18/02/2026 09:28
          </span>
          <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[10px]">
            <RefreshCw className="h-3 w-3" />
            Sincronizar
          </Button>
        </div>
      </div>

      {/* Reconciliation progress */}
      <div className="rounded-lg border border-border p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-foreground">Progresso da Conciliacao</span>
          <span className="text-xs font-bold text-primary">87%</span>
        </div>
        <Progress value={87} className="h-2" />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-success" />
            <span className="text-[10px] text-muted-foreground">142 conciliados</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-warning" />
            <span className="text-[10px] text-muted-foreground">15 pendentes</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-destructive" />
            <span className="text-[10px] text-muted-foreground">6 divergentes</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-2 w-2 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">0 em analise</span>
          </div>
        </div>
      </div>
    </Card>
  )
}
