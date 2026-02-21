"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { RefreshCw, CheckCircle2, XCircle, Landmark, Building2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

function formatLastSync(date: Date | string | null): string {
  if (!date) return "—"
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  })
}

export function SyncStatus() {
  const [loading, setLoading] = useState(true)
  const [pluggyConnected, setPluggyConnected] = useState(false)
  const [advboxConnected, setAdvboxConnected] = useState(false)
  const [pluggyLastSync, setPluggyLastSync] = useState<Date | null>(null)
  const [advboxLastSync, setAdvboxLastSync] = useState<Date | null>(null)
  const [totalLancamentos, setTotalLancamentos] = useState(0)
  const [conciliados, setConciliados] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function fetchStatus() {
      setLoading(true)
      try {
        const [settingsRes, accountsRes, txRes] = await Promise.all([
          fetch("/api/settings"),
          fetch("/api/pluggy/accounts"),
          (() => {
            const now = new Date()
            const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
            const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
            return fetch(`/api/pluggy/transactions?from=${from}&to=${to}&pageSize=500`)
          })(),
        ])

        if (cancelled) return

        if (settingsRes.ok) {
          const s = await settingsRes.json()
          setPluggyConnected(!!s.pluggyConnected)
          setAdvboxConnected(!!s.advboxConnected)
          setAdvboxLastSync(s.advboxLastSyncAt ? new Date(s.advboxLastSyncAt) : null)
        }

        if (accountsRes.ok) {
          const { accounts } = await accountsRes.json()
          const list = accounts || []
          let latest: Date | null = null
          list.forEach((a: { pluggyItem?: { lastSyncAt?: string } }) => {
            const t = a.pluggyItem?.lastSyncAt
            if (t) {
              const d = new Date(t)
              if (!latest || d > latest) latest = d
            }
          })
          setPluggyLastSync(latest)
        }

        if (txRes.ok) {
          const { transactions } = await txRes.json()
          const list = transactions || []
          setTotalLancamentos(list.length)
          setConciliados(0)
        }
      } catch (e) {
        setPluggyConnected(false)
        setAdvboxConnected(false)
        setPluggyLastSync(null)
        setAdvboxLastSync(null)
        setTotalLancamentos(0)
        setConciliados(0)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchStatus()
    return () => { cancelled = true }
  }, [])

  const percentConciliado = totalLancamentos > 0 ? Math.round((conciliados / totalLancamentos) * 100) : 0
  const pendentes = totalLancamentos - conciliados

  if (loading) {
    return (
      <Card className="p-4 shadow-sm border-border/60">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Status da Sincronização</h3>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-4 shadow-sm border-border/60">
      <h3 className="mb-3 text-sm font-semibold text-foreground">Status da Sincronização</h3>

      <div className="mb-4 rounded-lg border p-3" style={{ borderColor: pluggyConnected ? "var(--success)" : "var(--border)", backgroundColor: pluggyConnected ? "var(--success)/5" : "var(--muted)/20" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
              <Landmark className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Pluggy</p>
              <p className="text-[10px] text-muted-foreground">Dados bancários</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {pluggyConnected ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                <span className="text-[10px] font-medium text-success">Conectado</span>
              </>
            ) : (
              <>
                <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground">Não conectado</span>
              </>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            Última sincronização: {formatLastSync(pluggyLastSync)}
          </span>
        </div>
      </div>

      <div className="mb-4 rounded-lg border p-3" style={{ borderColor: advboxConnected ? "var(--primary)" : "var(--border)", backgroundColor: advboxConnected ? "var(--primary)/5" : "var(--muted)/20" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Advbox</p>
              <p className="text-[10px] text-muted-foreground">Lançamentos financeiros</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {advboxConnected ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                <span className="text-[10px] font-medium text-success">Conectado</span>
              </>
            ) : (
              <>
                <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground">Não conectado</span>
              </>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            Última sincronização: {formatLastSync(advboxLastSync)}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-border p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">Progresso da Conciliação</span>
          <span className="text-xs font-bold text-primary">
            {totalLancamentos === 0 ? "—" : `${percentConciliado}%`}
          </span>
        </div>
        <Progress value={totalLancamentos === 0 ? 0 : percentConciliado} className="h-2" />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-success" />
            <span className="text-[10px] text-muted-foreground">{conciliados} conciliados</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-warning" />
            <span className="text-[10px] text-muted-foreground">{pendentes} pendentes</span>
          </div>
        </div>
      </div>
    </Card>
  )
}
