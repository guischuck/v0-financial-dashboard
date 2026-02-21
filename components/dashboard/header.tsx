"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import {
  Bell, Search, Settings, User, LogOut, AlertCircle,
  LayoutDashboard, ArrowLeftRight, ArrowUpDown, Landmark,
  FileBarChart, Building2, HelpCircle, X, Loader2,
  CheckCheck, ArrowRight, BellOff, Clock, CircleDollarSign,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useClerk, useUser } from "@clerk/nextjs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useSharedAccounts, useSharedSettings } from "@/lib/use-shared-data"
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/lib/hooks/use-notifications"

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard", description: "Visão geral financeira" },
  { icon: ArrowUpDown, label: "Transações", href: "/transacoes", description: "Extrato bancário" },
  { icon: ArrowLeftRight, label: "Conciliação", href: "/conciliacao", description: "Conciliar lançamentos" },
  { icon: Landmark, label: "Contas Bancárias", href: "/contas", description: "Contas conectadas" },
  { icon: Building2, label: "Advbox", href: "/advbox", description: "Lançamentos do Advbox" },
  { icon: FileBarChart, label: "Relatórios", href: "/relatorios", description: "Relatórios financeiros" },
  { icon: Settings, label: "Configurações", href: "/configuracoes", description: "Ajustes do sistema" },
  { icon: HelpCircle, label: "Ajuda", href: "/ajuda", description: "Suporte e documentação" },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000
const NOTIFICATION_POLL_MS = 60_000

type NotificationItem = {
  id: string
  type: "RECONCILIATION" | "DUE_TRANSACTION" | "MISC"
  title: string
  message: string
  read: boolean
  metadata?: Record<string, unknown> | null
  createdAt: string
}

const NOTIFICATION_ICON: Record<NotificationItem["type"], typeof ArrowLeftRight> = {
  RECONCILIATION: ArrowLeftRight,
  DUE_TRANSACTION: CircleDollarSign,
  MISC: Bell,
}

const NOTIFICATION_COLOR: Record<NotificationItem["type"], string> = {
  RECONCILIATION: "bg-emerald-500/10 text-emerald-600",
  DUE_TRANSACTION: "bg-amber-500/10 text-amber-600",
  MISC: "bg-blue-500/10 text-blue-600",
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "agora"
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

type SearchTransaction = {
  id: string
  description: string
  amount: number
  date: string
  pluggyAccount?: { name: string }
}

type SearchAccount = {
  id: string
  accountId: string
  name: string
  customName?: string | null
  balance: number
  type: string
  pluggyItem?: { connectorName: string }
}

export function Header() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const router = useRouter()

  const sharedAccounts = useSharedAccounts()
  const sharedSettings = useSharedSettings()

  const syncStatusLoading = sharedAccounts.loading || sharedSettings.loading
  const pluggyConnected = !!sharedSettings.data?.pluggyConnected
  const advboxConnected = !!sharedSettings.data?.advboxConnected
  const advboxLastSync = sharedSettings.data?.advboxLastSyncAt ? new Date(sharedSettings.data.advboxLastSyncAt) : null

  const pluggyLastSync: Date | null = useMemo(() => {
    const list = sharedAccounts.data ?? []
    let latest: Date | null = null
    list.forEach((a: { pluggyItem?: { lastSyncAt?: string } }) => {
      const t = a.pluggyItem?.lastSyncAt
      if (t) {
        const d = new Date(t)
        if (!latest || d > latest) latest = d
      }
    })
    return latest
  }, [sharedAccounts.data])

  // Notification state
  const { data: notifData, refetch: refetchNotifications } = useNotifications(false, 20)
  const markReadMutation = useMarkNotificationRead()
  const markAllReadMutation = useMarkAllNotificationsRead()
  const notifications: NotificationItem[] = notifData?.notifications ?? []
  const unreadCount: number = notifData?.unreadCount ?? 0
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  // Search state
  const [query, setQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchTransactions, setSearchTransactions] = useState<SearchTransaction[]>([])
  const [searchAccounts, setSearchAccounts] = useState<SearchAccount[]>([])
  const debouncedQuery = useDebounce(query, 300)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClickOutsideNotif(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutsideNotif)
    return () => document.removeEventListener("mousedown", handleClickOutsideNotif)
  }, [])

  function markAsRead(id: string) {
    markReadMutation.mutate(id)
  }

  function markAllAsRead() {
    markAllReadMutation.mutate()
  }

  // Run search when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSearchTransactions([])
      setSearchAccounts([])
      return
    }
    let cancelled = false
    async function runSearch() {
      setSearchLoading(true)
      try {
        const txRes = await fetch(`/api/pluggy/transactions?q=${encodeURIComponent(debouncedQuery)}&pageSize=5`)
        if (cancelled) return
        if (txRes.ok) {
          const data = await txRes.json()
          setSearchTransactions(data.transactions ?? [])
        }
        const allAccounts = sharedAccounts.data ?? []
        const q = debouncedQuery.toLowerCase()
        const filtered = allAccounts.filter((a: SearchAccount) =>
          (a.customName ?? a.name).toLowerCase().includes(q) ||
          a.pluggyItem?.connectorName?.toLowerCase().includes(q)
        )
        setSearchAccounts(filtered.slice(0, 5))
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setSearchLoading(false)
      }
    }
    runSearch()
    return () => { cancelled = true }
  }, [debouncedQuery, sharedAccounts.data])

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const matchedNavItems = NAV_ITEMS.filter((item) => {
    const q = query.toLowerCase()
    return q.length > 0 && (
      item.label.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
    )
  })

  const hasResults =
    matchedNavItems.length > 0 ||
    searchTransactions.length > 0 ||
    searchAccounts.length > 0

  function handleSelect(href: string) {
    setQuery("")
    setSearchOpen(false)
    router.push(href)
  }

  function clearSearch() {
    setQuery("")
    setSearchTransactions([])
    setSearchAccounts([])
    inputRef.current?.focus()
  }

  const now = Date.now()
  const lastSyncMs = pluggyLastSync ? now - (pluggyLastSync as Date).getTime() : null
  const isSyncedWithin24h = lastSyncMs !== null && lastSyncMs < TWENTY_FOUR_HOURS_MS
  const advboxLastSyncMs = advboxLastSync ? now - (advboxLastSync as Date).getTime() : null
  const isAdvboxSyncedWithin24h = advboxLastSyncMs !== null && advboxLastSyncMs < TWENTY_FOUR_HOURS_MS

  const initials = [user?.firstName?.[0], user?.lastName?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase() || "U"

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card px-6">
      {/* Search */}
      <div ref={searchRef} className="relative">
        <div className={cn(
          "flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm transition-colors",
          searchOpen ? "border-primary/50 ring-1 ring-primary/20" : "border-input text-muted-foreground"
        )}>
          {searchLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              if (!searchOpen) setSearchOpen(true)
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearchOpen(false)
                inputRef.current?.blur()
              }
            }}
            placeholder="Buscar lançamentos, contas..."
            className="w-64 bg-transparent outline-none placeholder:text-muted-foreground/60"
            autoComplete="off"
          />
          {query && (
            <button onClick={clearSearch} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Results dropdown */}
        {searchOpen && query.trim().length > 0 && (
          <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-[420px] overflow-hidden rounded-lg border border-border bg-card shadow-lg">
            {searchLoading && !hasResults ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando...
              </div>
            ) : !hasResults ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nenhum resultado para &quot;{query}&quot;
              </div>
            ) : (
              <div className="max-h-[420px] overflow-y-auto">
                {/* Navigation */}
                {matchedNavItems.length > 0 && (
                  <div>
                    <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Páginas
                    </p>
                    {matchedNavItems.map((item) => (
                      <button
                        key={item.href}
                        onClick={() => handleSelect(item.href)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                          <item.icon className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Accounts */}
                {searchAccounts.length > 0 && (
                  <div>
                    <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Contas Bancárias
                    </p>
                    {searchAccounts.map((account) => (
                      <button
                        key={account.id}
                        onClick={() => handleSelect("/contas")}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-500/10">
                          <Landmark className="h-4 w-4 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {account.customName ?? account.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {account.pluggyItem?.connectorName} · {formatCurrency(account.balance)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Transactions */}
                {searchTransactions.length > 0 && (
                  <div>
                    <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Transações
                    </p>
                    {searchTransactions.map((tx) => (
                      <button
                        key={tx.id}
                        onClick={() => handleSelect("/transacoes")}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent"
                      >
                        <div className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold",
                          tx.amount >= 0
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-red-500/10 text-red-500"
                        )}>
                          {tx.amount >= 0 ? "+" : "−"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{tx.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {tx.pluggyAccount?.name} · {new Date(tx.date).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <span className={cn(
                          "shrink-0 text-sm font-medium",
                          tx.amount >= 0 ? "text-emerald-600" : "text-red-500"
                        )}>
                          {formatCurrency(Math.abs(tx.amount))}
                        </span>
                      </button>
                    ))}

                    <button
                      onClick={() => handleSelect(`/transacoes?q=${encodeURIComponent(query)}`)}
                      className="flex w-full items-center justify-center gap-1 border-t border-border px-3 py-2.5 text-xs font-medium text-primary transition-colors hover:bg-accent"
                    >
                      Ver todos os resultados para &quot;{query}&quot;
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-4">
        {/* Sync status */}
        {!syncStatusLoading && (pluggyConnected || advboxConnected) && (
          <div className="flex flex-col gap-1">
            {pluggyConnected && (
              <div className="flex items-center gap-2">
                {isSyncedWithin24h ? (
                  <>
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-xs text-muted-foreground">Pluggy sincronizado</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                    <span className="text-xs font-medium text-destructive">Pluggy: mais de 24h</span>
                  </>
                )}
              </div>
            )}
            {advboxConnected && (
              <div className="flex items-center gap-2">
                {isAdvboxSyncedWithin24h ? (
                  <>
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-xs text-muted-foreground">Advbox sincronizado</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                    <span className="text-xs font-medium text-destructive">Advbox: mais de 24h</span>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => {
              setNotifOpen(prev => !prev)
              if (!notifOpen) refetchNotifications()
            }}
            className="relative rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-primary-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[380px] overflow-hidden rounded-lg border border-border bg-card shadow-lg">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Marcar todas como lidas
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                  <BellOff className="h-8 w-8 opacity-40" />
                  <p className="text-sm">Nenhuma notificação</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <div className="divide-y divide-border">
                    {notifications.map((n) => {
                      const Icon = NOTIFICATION_ICON[n.type]
                      return (
                        <button
                          key={n.id}
                          onClick={() => { if (!n.read) markAsRead(n.id) }}
                          className={cn(
                            "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent",
                            !n.read && "bg-primary/[0.03]"
                          )}
                        >
                          <div className={cn(
                            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                            NOTIFICATION_COLOR[n.type]
                          )}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className={cn(
                                "truncate text-sm",
                                n.read ? "text-muted-foreground" : "font-medium text-foreground"
                              )}>
                                {n.title}
                              </p>
                              {!n.read && (
                                <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                              )}
                            </div>
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {n.message}
                            </p>
                            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground/60">
                              <Clock className="h-3 w-3" />
                              {timeAgo(n.createdAt)}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}

              <div className="border-t border-border">
                <button
                  onClick={() => {
                    setNotifOpen(false)
                    router.push("/configuracoes")
                  }}
                  className="flex w-full items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Gerenciar preferências de notificação
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-accent">
              <Avatar className="h-7 w-7">
                {user?.imageUrl && <AvatarImage src={user.imageUrl} alt={user.fullName ?? ""} />}
                <AvatarFallback className="bg-primary/10 text-xs text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium text-foreground md:inline">
                {user?.firstName ?? "Usuário"}
              </span>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-foreground">{user?.fullName}</p>
                <p className="text-xs text-muted-foreground">
                  {user?.primaryEmailAddress?.emailAddress}
                </p>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="cursor-pointer gap-2"
              onClick={() => router.push("/perfil")}
            >
              <User className="h-4 w-4" />
              Meu Perfil
            </DropdownMenuItem>

            <DropdownMenuItem
              className="cursor-pointer gap-2"
              onClick={() => router.push("/configuracoes")}
            >
              <Settings className="h-4 w-4" />
              Configurações
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="cursor-pointer gap-2 text-destructive focus:text-destructive"
              onClick={() => signOut({ redirectUrl: "/login" })}
            >
              <LogOut className="h-4 w-4" />
              Sair da conta
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
