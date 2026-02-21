'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  PlusCircle,
  Building,
  Building2,
  Loader2,
  AlertCircle,
  RefreshCw,
  Landmark,
  Shield,
  ChevronRight,
  CreditCard,
  Pencil,
  Check,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const PluggyConnect = dynamic(
  () => import('react-pluggy-connect').then((mod) => mod.PluggyConnect),
  { ssr: false }
)

interface PluggyItem {
  id: string
  itemId: string
  connectorName?: string
  connectorLogo?: string
  connectorId: number
  status: string
  lastSyncAt?: string
  createdAt: string
}

interface PluggyAccount {
  id: string
  accountId: string
  name: string
  customName?: string | null
  type: string
  subtype?: string | null
  number?: string | null
  balance: number
  currencyCode: string
  pluggyItem: { itemId: string; connectorName?: string; connectorLogo?: string; status: string }
}

export default function ContasPage() {
  const [connectToken, setConnectToken] = useState<string | null>(null)
  const [loadingToken, setLoadingToken] = useState(false)
  const [errorDetails, setErrorDetails] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showConnect, setShowConnect] = useState(false)
  const [items, setItems] = useState<PluggyItem[]>([])
  const [accounts, setAccounts] = useState<PluggyAccount[]>([])
  const [fetchingItems, setFetchingItems] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [savingName, setSavingName] = useState(false)

  useEffect(() => {
    fetchItems()
    fetchAccounts()
  }, [])

  const fetchItems = async () => {
    try {
      setFetchingItems(true)
      const res = await fetch('/api/pluggy/list-items')
      if (res.ok) {
        const data = await res.json()
        setItems(data.items || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setFetchingItems(false)
    }
  }

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/pluggy/accounts')
      if (res.ok) {
        const data = await res.json()
        setAccounts(data.accounts || [])
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleOpenConnect = async () => {
    setLoadingToken(true)
    setErrorDetails(null)
    try {
      const res = await fetch('/api/pluggy/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const data = await res.json()
      if (data.accessToken) {
        setConnectToken(data.accessToken)
        setShowConnect(true)
      } else {
        setErrorDetails(data.error || 'Falha ao gerar token de conexão')
      }
    } catch (e: unknown) {
      setErrorDetails(e instanceof Error ? e.message : 'Erro ao conectar')
    } finally {
      setLoadingToken(false)
    }
  }

  const handleSuccess = async (itemData: { item: { id: string } }) => {
    setShowConnect(false)
    try {
      const itemId = itemData.item.id
      const res = await fetch('/api/pluggy/create-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      })
      if (res.ok) {
        await fetchItems()
        await handleSync()
        setSuccessMessage('Conta conectada com sucesso. Sincronizando dados…')
        setTimeout(() => setSuccessMessage(null), 5000)
      } else {
        const err = await res.json()
        setErrorDetails(err.error || 'Falha ao salvar conexão')
      }
    } catch (e: unknown) {
      setErrorDetails(e instanceof Error ? e.message : 'Erro ao salvar')
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setErrorDetails(null)
    setSuccessMessage(null)
    try {
      const res = await fetch('/api/pluggy/sync', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setSuccessMessage(`Sincronizado: ${data.totalAccounts} conta(s), ${data.totalTransactions} transação(ões)`)
        await fetchAccounts()
        setTimeout(() => setSuccessMessage(null), 5000)
      } else {
        setErrorDetails(data.error || 'Falha na sincronização')
      }
    } catch (e: unknown) {
      setErrorDetails(e instanceof Error ? e.message : 'Erro ao sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  const getStatusColor = (status: string) => {
    if (status === 'UPDATED') return 'bg-emerald-500'
    if (status === 'ERROR') return 'bg-red-500'
    return 'bg-amber-500'
  }

  const getStatusLabel = (status: string) => {
    if (status === 'UPDATED') return 'Conectado'
    if (status === 'ERROR') return 'Erro'
    return 'Pendente'
  }

  const isCard = (acc: PluggyAccount) =>
    acc.type === 'CREDIT' || (acc.subtype?.toUpperCase?.() ?? '').includes('CREDIT_CARD')

  const bankAccounts = accounts.filter((a) => !isCard(a))
  const cards = accounts.filter(isCard)

  const displayName = (acc: PluggyAccount) => (acc.customName?.trim() || acc.name) || 'Sem nome'

  // Função para renderizar o logo do banco ou ícone como fallback seguindo ICONES.MD
  const renderBankLogo = (logo?: string, connectorName?: string, type?: string, size = 'h-5 w-5', containerSize = 'h-10 w-10') => {
    if (logo) {
      return (
        <div className={`flex ${containerSize} shrink-0 items-center justify-center rounded-full bg-white border border-border overflow-hidden p-1`}>
          <img
            src={logo}
            alt={connectorName || 'Logo do banco'}
            className="h-full w-full object-contain"
          />
        </div>
      )
    }

    const isCredit = type === 'CREDIT' || type?.includes('CARD')

    return (
      <div className={`flex ${containerSize} shrink-0 items-center justify-center rounded-full bg-muted`}>
        {isCredit ? (
          <CreditCard className={`${size} text-purple-500`} />
        ) : (
          <Building2 className={`${size} text-blue-500`} />
        )}
      </div>
    )
  }

  const startEditing = (acc: PluggyAccount) => {
    setEditingId(acc.id)
    setEditingName(displayName(acc))
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditingName('')
  }

  const saveName = async (id: string) => {
    if (editingId !== id) return
    setSavingName(true)
    setErrorDetails(null)
    try {
      const nameToSave = editingName.trim() || null
      const res = await fetch(`/api/pluggy/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameToSave }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setEditingId(null)
        setEditingName('')
        setSuccessMessage('Nome salvo.')
        setTimeout(() => setSuccessMessage(null), 3000)
        await fetchAccounts()
      } else {
        setErrorDetails(data.error || 'Falha ao salvar nome')
      }
    } catch (e) {
      setErrorDetails(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSavingName(false)
    }
  }

  const renderAccountEditableRow = (acc: PluggyAccount) => (
    <div key={acc.id} className="group flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {renderBankLogo(acc.pluggyItem.connectorLogo, acc.pluggyItem.connectorName, acc.type)}
        <div className="min-w-0 flex-1">
          {editingId === acc.id ? (
            <div className="flex items-center gap-2">
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveName(acc.id)
                  if (e.key === 'Escape') cancelEditing()
                }}
                className="h-7 text-sm"
                autoFocus
                disabled={savingName}
              />
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => saveName(acc.id)} disabled={savingName}>
                {savingName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-emerald-600" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={cancelEditing} disabled={savingName}>
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-foreground truncate">{displayName(acc)}</p>
              <button
                type="button"
                onClick={() => startEditing(acc)}
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Alterar nome"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {acc.type}{acc.subtype ? ` · ${acc.subtype}` : ''}{acc.number ? ` · ${acc.number}` : ''}
          </p>
        </div>
      </div>
      <div className="text-right shrink-0 ml-3">
        <p className={`text-sm font-bold ${acc.balance < 0 ? 'text-destructive' : 'text-foreground'}`}>
          {formatCurrency(acc.balance)}
        </p>
        <p className="text-[10px] text-muted-foreground">{acc.currencyCode}</p>
      </div>
    </div>
  )

  return (
    <main className="p-6 space-y-6">
          {/* Header da página */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Contas Bancárias</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Conecte suas contas pelo Open Finance para conciliar lançamentos e acompanhar saldos.
              </p>
            </div>
            <Button onClick={handleOpenConnect} disabled={loadingToken || showConnect} className="shrink-0">
              {loadingToken ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlusCircle className="mr-2 h-4 w-4" />
              )}
              {loadingToken ? 'Abrindo...' : 'Conectar banco'}
            </Button>
          </div>

          {errorDetails && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{errorDetails}</AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950">
              <AlertCircle className="h-4 w-4 text-emerald-600" />
              <AlertTitle className="text-emerald-800 dark:text-emerald-200">Sucesso</AlertTitle>
              <AlertDescription className="text-emerald-700 dark:text-emerald-300">{successMessage}</AlertDescription>
            </Alert>
          )}

          {/* Conexões ativas */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-base">Conexões ativas</CardTitle>
                <CardDescription className="text-xs mt-0.5">Bancos e instituições vinculados</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { fetchItems(); fetchAccounts(); handleSync() }}
                disabled={syncing || items.length === 0}
              >
                {syncing ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
                Sincronizar
              </Button>
            </CardHeader>
            <CardContent>
              {fetchingItems ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10">
                  <Building className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-foreground">Nenhuma conexão</p>
                  <p className="mt-1 max-w-xs text-center text-xs text-muted-foreground">
                    Clique em &quot;Conectar banco&quot; para vincular sua primeira conta.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-muted/10 px-4 py-3 transition-colors hover:bg-muted/20"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {renderBankLogo(item.connectorLogo, item.connectorName, undefined, 'h-4 w-4', 'h-8 w-8')}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {item.connectorName || `Conector #${item.connectorId}`}
                          </p>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <span className={`inline-flex h-1.5 w-1.5 rounded-full ${getStatusColor(item.status)}`} />
                            <span className="text-[11px] text-muted-foreground">{getStatusLabel(item.status)}</span>
                            {item.lastSyncAt && (
                              <span className="text-[10px] text-muted-foreground hidden sm:inline">
                                · {new Date(item.lastSyncAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contas e Cartões em grid lado a lado */}
          {(bankAccounts.length > 0 || cards.length > 0) && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Contas bancárias */}
              {bankAccounts.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                        <Building2 className="h-4 w-4 text-blue-500" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Contas bancárias</CardTitle>
                        <CardDescription className="text-xs mt-0.5">{bankAccounts.length} conta{bankAccounts.length !== 1 ? 's' : ''} conectada{bankAccounts.length !== 1 ? 's' : ''}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    {bankAccounts.map((acc) => renderAccountEditableRow(acc))}
                    <div className="mt-3 flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2.5">
                      <span className="text-xs font-medium text-muted-foreground">Saldo total</span>
                      <span className={`text-sm font-bold ${bankAccounts.reduce((s, a) => s + a.balance, 0) < 0 ? 'text-destructive' : 'text-foreground'}`}>
                        {formatCurrency(bankAccounts.reduce((s, a) => s + a.balance, 0))}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Cartões */}
              {cards.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
                        <CreditCard className="h-4 w-4 text-purple-500" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Cartões de crédito</CardTitle>
                        <CardDescription className="text-xs mt-0.5">{cards.length} cartão{cards.length !== 1 ? 'ões' : ''} conectado{cards.length !== 1 ? 's' : ''}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    {cards.map((acc) => renderAccountEditableRow(acc))}
                    <div className="mt-3 flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2.5">
                      <span className="text-xs font-medium text-muted-foreground">Fatura total</span>
                      <span className="text-sm font-bold text-foreground">
                        {formatCurrency(cards.reduce((s, a) => s + a.balance, 0))}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Segurança */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
            <Shield className="h-3.5 w-3.5" />
            <span>Dados criptografados · Apenas leitura · Via Pluggy Open Finance</span>
          </div>

          {showConnect && connectToken && (
            <PluggyConnect
              connectToken={connectToken}
              includeSandbox={true}
              onSuccess={handleSuccess}
              onError={(error: unknown) => {
                setErrorDetails(error instanceof Error ? error.message : 'Erro na conexão')
                setShowConnect(false)
              }}
              onClose={() => setShowConnect(false)}
            />
          )}
    </main>
  )
}
