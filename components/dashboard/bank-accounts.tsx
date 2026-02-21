"use client"

import { useState, useEffect, useMemo } from "react"
import { ChevronLeft, ChevronRight, Plus, Minus, Loader2, ChevronsUpDown, X } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value)
}

interface Account {
  id: string
  name: string
  account: string
  type: string
  balance: number | null
}

interface FinancialSettings {
  users: { id: number; name: string }[]
  banks: { id: number; name: string; account: string; type: string }[]
  categories: { id: number; name: string; type: string }[]
  cost_centers: { id: number; name: string }[]
}

interface AdvboxCustomer {
  id: number
  name: string
  identification: string
  lawsuits: { lawsuit_id: number; process_number: string }[]
}

interface AdvboxLawsuit {
  id: number
  process_number: string
  type: string
  customers: { customer_id: number; name: string }[]
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function BankAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogDespesaOpen, setDialogDespesaOpen] = useState(false)
  const [settings, setSettings] = useState<FinancialSettings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [customerSearch, setCustomerSearch] = useState("")
  const [customerResults, setCustomerResults] = useState<AdvboxCustomer[]>([])
  const [customerLoading, setCustomerLoading] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<AdvboxCustomer | null>(null)
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false)
  const debouncedCustomerSearch = useDebounce(customerSearch, 350)

  const [lawsuitSearch, setLawsuitSearch] = useState("")
  const [lawsuitResults, setLawsuitResults] = useState<AdvboxLawsuit[]>([])
  const [lawsuitLoading, setLawsuitLoading] = useState(false)
  const [selectedLawsuit, setSelectedLawsuit] = useState<{ id: number; process_number: string } | null>(null)
  const [lawsuitPopoverOpen, setLawsuitPopoverOpen] = useState(false)
  const debouncedLawsuitSearch = useDebounce(lawsuitSearch, 350)

  const [isPaid, setIsPaid] = useState(false)

  // Saldo do mês no Advbox: filtro de mês
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [monthSummary, setMonthSummary] = useState<{
    receitas: number
    despesas: number
    receitasVencidas: number
    loading: boolean
    error: string | null
  }>({ receitas: 0, despesas: 0, receitasVencidas: 0, loading: true, error: null })

  const [form, setForm] = useState({
    users_id: "" as string | number,
    debit_account: "" as string | number,
    categories_id: "" as string | number,
    cost_centers_id: "" as string | number,
    amount: "",
    date_due: "",
    date_payment: "",
    description: "",
  })

  useEffect(() => {
    let cancelled = false

    async function fetchAccounts() {
      setLoading(true)
      try {
        const res = await fetch("/api/advbox/accounts")
        if (res.ok) {
          const data = await res.json()
          const list = (data.accounts || []).map((a: { id?: string; name?: string; account?: string; type?: string; balance?: number | null }) => ({
            id: String(a.id ?? ""),
            name: a.name ?? "Conta sem nome",
            account: a.account ?? "",
            type: a.type ?? "corrente",
            balance: a.balance != null ? Number(a.balance) : null,
          }))
          setAccounts(list)
        } else {
          setAccounts([])
        }
      } catch (e) {
        setAccounts([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAccounts()
    return () => { cancelled = true }
  }, [])

  // Buscar receitas/despesas do mês selecionado (Advbox)
  const monthStart = useMemo(() => {
    const d = new Date(selectedDate.year, selectedDate.month, 1)
    return d.toISOString().slice(0, 10)
  }, [selectedDate.year, selectedDate.month])
  const monthEnd = useMemo(() => {
    const d = new Date(selectedDate.year, selectedDate.month + 1, 0)
    return d.toISOString().slice(0, 10)
  }, [selectedDate.year, selectedDate.month])

  useEffect(() => {
    let cancelled = false
    setMonthSummary((s) => ({ ...s, loading: true, error: null }))
    const params = new URLSearchParams({
      date_due_start: monthStart,
      date_due_end: monthEnd,
      limit: "1000",
    })
    fetch(`/api/advbox/transactions?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const list = data.data ?? []
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        let receitas = 0
        let despesas = 0
        let receitasVencidas = 0
        list.forEach((t: { type?: string; entry_type?: string; amount?: number; date_due?: string; date_payment?: string | null }) => {
          const amt = Number(t.amount) || 0
          const isIncome = t.type === "income" || t.entry_type === "income" || t.entry_type === "revenue"
          if (isIncome) {
            receitas += amt
            if (!t.date_payment && t.date_due) {
              const due = new Date(t.date_due + "T00:00:00")
              if (due < today) receitasVencidas += amt
            }
          } else {
            despesas += amt
          }
        })
        setMonthSummary({ receitas, despesas, receitasVencidas, loading: false, error: data.error ?? null })
      })
      .catch(() => {
        if (!cancelled) setMonthSummary((s) => ({ ...s, receitas: 0, despesas: 0, loading: false, error: "Erro ao carregar" }))
      })
    return () => { cancelled = true }
  }, [monthStart, monthEnd])

  useEffect(() => {
    if (!dialogOpen && !dialogDespesaOpen) return
    let cancelled = false
    setSettingsLoading(true)
    setSubmitError(null)
    fetch("/api/advbox/financial-settings")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setSettings({
            users: data.users ?? [],
            banks: data.banks ?? [],
            categories: data.categories ?? [],
            cost_centers: data.cost_centers ?? [],
          })
          const today = new Date().toISOString().slice(0, 10)
          setForm((f) => ({ ...f, date_due: f.date_due || today }))
        }
      })
      .catch(() => {
        if (!cancelled) setSettings(null)
      })
      .finally(() => {
        if (!cancelled) setSettingsLoading(false)
      })
    return () => { cancelled = true }
  }, [dialogOpen, dialogDespesaOpen])

  useEffect(() => {
    if ((!dialogOpen && !dialogDespesaOpen) || !debouncedCustomerSearch || debouncedCustomerSearch.length < 2) {
      if (!debouncedCustomerSearch) setCustomerResults([])
      return
    }
    let cancelled = false
    setCustomerLoading(true)
    fetch(`/api/advbox/customers?name=${encodeURIComponent(debouncedCustomerSearch)}&limit=15`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setCustomerResults(data.data ?? [])
      })
      .catch(() => {
        if (!cancelled) setCustomerResults([])
      })
      .finally(() => {
        if (!cancelled) setCustomerLoading(false)
      })
    return () => { cancelled = true }
  }, [debouncedCustomerSearch, dialogOpen, dialogDespesaOpen])

  useEffect(() => {
    if ((!dialogOpen && !dialogDespesaOpen) || !debouncedLawsuitSearch || debouncedLawsuitSearch.length < 2) {
      if (!debouncedLawsuitSearch) setLawsuitResults([])
      return
    }
    let cancelled = false
    setLawsuitLoading(true)
    const params = new URLSearchParams({ name: debouncedLawsuitSearch, limit: "15" })
    if (selectedCustomer) params.set("customer_id", String(selectedCustomer.id))
    fetch(`/api/advbox/lawsuits?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setLawsuitResults(data.data ?? [])
      })
      .catch(() => {
        if (!cancelled) setLawsuitResults([])
      })
      .finally(() => {
        if (!cancelled) setLawsuitLoading(false)
      })
    return () => { cancelled = true }
  }, [debouncedLawsuitSearch, dialogOpen, dialogDespesaOpen, selectedCustomer])

  const incomeCategories = settings?.categories.filter(
    (c) => c.type === "CRÉDITO" || c.type === "income" || c.type === "INCOME"
  ) ?? []

  const expenseCategories = settings?.categories.filter(
    (c) => c.type === "DÉBITO" || c.type === "expense" || c.type === "EXPENSE" || c.type === "debit"
  ) ?? []

  async function handleSubmitNovaReceita(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    const users_id = Number(form.users_id)
    const debit_account = Number(form.debit_account)
    const categories_id = Number(form.categories_id)
    const cost_centers_id = Number(form.cost_centers_id)
    const amount = parseFloat(form.amount.replace(",", ".")) || 0
    if (!users_id || !debit_account || !categories_id || !cost_centers_id || amount <= 0 || !form.date_due) {
      setSubmitError("Preencha todos os campos obrigatórios e um valor maior que zero.")
      return
    }
    setSubmitLoading(true)
    try {
      const payload: Record<string, unknown> = {
        users_id,
        entry_type: "income",
        debit_account,
        categories_id,
        cost_centers_id,
        amount,
        date_due: form.date_due,
      }
      if (form.description.trim()) payload.description = form.description.trim()
      if (selectedCustomer) payload.customers_id = selectedCustomer.id
      if (selectedLawsuit) payload.lawsuits_id = selectedLawsuit.id
      if (isPaid && form.date_payment) payload.date_payment = form.date_payment

      const res = await fetch("/api/advbox/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSubmitError(data.error ?? data.message ?? "Falha ao criar receita.")
        return
      }
      setDialogOpen(false)
      setForm({
        users_id: "",
        debit_account: "",
        categories_id: "",
        cost_centers_id: "",
        amount: "",
        date_due: new Date().toISOString().slice(0, 10),
        date_payment: "",
        description: "",
      })
      setSelectedCustomer(null)
      setSelectedLawsuit(null)
      setIsPaid(false)
    } catch (err) {
      setSubmitError("Erro de conexão. Tente novamente.")
    } finally {
      setSubmitLoading(false)
    }
  }

  async function handleSubmitNovaDespesa(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    const users_id = Number(form.users_id)
    const debit_account = Number(form.debit_account)
    const categories_id = Number(form.categories_id)
    const cost_centers_id = Number(form.cost_centers_id)
    const amount = parseFloat(form.amount.replace(",", ".")) || 0
    if (!users_id || !debit_account || !categories_id || !cost_centers_id || amount <= 0 || !form.date_due) {
      setSubmitError("Preencha todos os campos obrigatórios e um valor maior que zero.")
      return
    }
    setSubmitLoading(true)
    try {
      const payload: Record<string, unknown> = {
        users_id,
        entry_type: "expense",
        debit_account,
        categories_id,
        cost_centers_id,
        amount,
        date_due: form.date_due,
      }
      if (form.description.trim()) payload.description = form.description.trim()
      if (selectedCustomer) payload.customers_id = selectedCustomer.id
      if (selectedLawsuit) payload.lawsuits_id = selectedLawsuit.id
      if (isPaid && form.date_payment) payload.date_payment = form.date_payment

      const res = await fetch("/api/advbox/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSubmitError(data.error ?? data.message ?? "Falha ao criar despesa.")
        return
      }
      setDialogDespesaOpen(false)
      setForm({
        users_id: "",
        debit_account: "",
        categories_id: "",
        cost_centers_id: "",
        amount: "",
        date_due: new Date().toISOString().slice(0, 10),
        date_payment: "",
        description: "",
      })
      setSelectedCustomer(null)
      setSelectedLawsuit(null)
      setIsPaid(false)
    } catch (err) {
      setSubmitError("Erro de conexão. Tente novamente.")
    } finally {
      setSubmitLoading(false)
    }
  }

  return (
    <Card className="p-4 shadow-sm border-border/60">
      <div className="mb-4 flex items-center justify-center gap-2">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90">
              <Plus className="mr-1 h-3.5 w-3.5" />
              Nova receita
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova receita</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmitNovaReceita} className="space-y-4">
              {settingsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="users_id">Responsável</Label>
                    <Select
                      value={String(form.users_id)}
                      onValueChange={(v) => setForm((f) => ({ ...f, users_id: v }))}
                      required
                    >
                      <SelectTrigger id="users_id" className="w-full">
                        <SelectValue placeholder="Selecione o responsável" />
                      </SelectTrigger>
                      <SelectContent>
                        {settings?.users.map((u) => (
                          <SelectItem key={u.id} value={String(u.id)}>{u.name || `ID ${u.id}`}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="debit_account">Conta bancária</Label>
                    <Select
                      value={String(form.debit_account)}
                      onValueChange={(v) => setForm((f) => ({ ...f, debit_account: v }))}
                      required
                    >
                      <SelectTrigger id="debit_account" className="w-full">
                        <SelectValue placeholder="Selecione a conta" />
                      </SelectTrigger>
                      <SelectContent>
                        {settings?.banks.map((b) => (
                          <SelectItem key={b.id} value={String(b.id)}>
                            {b.name}{b.account ? ` (${b.account})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="categories_id">Categoria</Label>
                    <Select
                      value={String(form.categories_id)}
                      onValueChange={(v) => setForm((f) => ({ ...f, categories_id: v }))}
                      required
                    >
                      <SelectTrigger id="categories_id" className="w-full">
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {incomeCategories.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cost_centers_id">Centro de custo</Label>
                    <Select
                      value={String(form.cost_centers_id)}
                      onValueChange={(v) => setForm((f) => ({ ...f, cost_centers_id: v }))}
                      required
                    >
                      <SelectTrigger id="cost_centers_id" className="w-full">
                        <SelectValue placeholder="Selecione o centro de custo" />
                      </SelectTrigger>
                      <SelectContent>
                        {settings?.cost_centers.map((cc) => (
                          <SelectItem key={cc.id} value={String(cc.id)}>{cc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Pessoa (cliente) */}
                  <div className="space-y-2">
                    <Label>Pessoa (opcional)</Label>
                    {selectedCustomer ? (
                      <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                        <span className="flex-1 truncate">
                          {selectedCustomer.name}
                          {selectedCustomer.identification && (
                            <span className="ml-1 text-muted-foreground">({selectedCustomer.identification})</span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(null)
                            setSelectedLawsuit(null)
                            setCustomerSearch("")
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between font-normal text-muted-foreground"
                          >
                            Buscar pessoa...
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput
                              placeholder="Digite o nome..."
                              value={customerSearch}
                              onValueChange={setCustomerSearch}
                            />
                            <CommandList>
                              {customerLoading && (
                                <div className="flex items-center justify-center py-4">
                                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                </div>
                              )}
                              {!customerLoading && customerSearch.length >= 2 && customerResults.length === 0 && (
                                <CommandEmpty>Nenhuma pessoa encontrada.</CommandEmpty>
                              )}
                              {!customerLoading && customerSearch.length < 2 && (
                                <div className="py-4 text-center text-sm text-muted-foreground">
                                  Digite ao menos 2 caracteres
                                </div>
                              )}
                              <CommandGroup>
                                {customerResults.map((c) => (
                                  <CommandItem
                                    key={c.id}
                                    value={String(c.id)}
                                    onSelect={() => {
                                      setSelectedCustomer(c)
                                      setSelectedLawsuit(null)
                                      setCustomerPopoverOpen(false)
                                      setCustomerSearch("")
                                    }}
                                  >
                                    <div className="flex flex-col">
                                      <span className="text-sm">{c.name}</span>
                                      {c.identification && (
                                        <span className="text-xs text-muted-foreground">{c.identification}</span>
                                      )}
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>

                  {/* Processo */}
                  <div className="space-y-2">
                    <Label>Processo (opcional)</Label>
                    {selectedCustomer && selectedCustomer.lawsuits.length > 0 ? (
                      <>
                        <Select
                          value={selectedLawsuit ? String(selectedLawsuit.id) : ""}
                          onValueChange={(v) => {
                            if (v === "__clear__") {
                              setSelectedLawsuit(null)
                              return
                            }
                            const found = selectedCustomer.lawsuits.find((l) => String(l.lawsuit_id) === v)
                            if (found) setSelectedLawsuit({ id: found.lawsuit_id, process_number: found.process_number })
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecione o processo" />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedLawsuit && (
                              <SelectItem value="__clear__" className="text-muted-foreground">Nenhum</SelectItem>
                            )}
                            {selectedCustomer.lawsuits.map((l) => (
                              <SelectItem key={l.lawsuit_id} value={String(l.lawsuit_id)}>
                                {l.process_number || `Processo #${l.lawsuit_id}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    ) : selectedLawsuit ? (
                      <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                        <span className="flex-1 truncate">
                          {selectedLawsuit.process_number || `Processo #${selectedLawsuit.id}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedLawsuit(null)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <Popover open={lawsuitPopoverOpen} onOpenChange={setLawsuitPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between font-normal text-muted-foreground"
                          >
                            Buscar processo...
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput
                              placeholder="Nome da parte ou número..."
                              value={lawsuitSearch}
                              onValueChange={setLawsuitSearch}
                            />
                            <CommandList>
                              {lawsuitLoading && (
                                <div className="flex items-center justify-center py-4">
                                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                </div>
                              )}
                              {!lawsuitLoading && lawsuitSearch.length >= 2 && lawsuitResults.length === 0 && (
                                <CommandEmpty>Nenhum processo encontrado.</CommandEmpty>
                              )}
                              {!lawsuitLoading && lawsuitSearch.length < 2 && (
                                <div className="py-4 text-center text-sm text-muted-foreground">
                                  Digite ao menos 2 caracteres
                                </div>
                              )}
                              <CommandGroup>
                                {lawsuitResults.map((l) => (
                                  <CommandItem
                                    key={l.id}
                                    value={String(l.id)}
                                    onSelect={() => {
                                      setSelectedLawsuit({ id: l.id, process_number: l.process_number })
                                      setLawsuitPopoverOpen(false)
                                      setLawsuitSearch("")
                                    }}
                                  >
                                    <div className="flex flex-col">
                                      <span className="text-sm">{l.process_number || `Processo #${l.id}`}</span>
                                      {l.customers.length > 0 && (
                                        <span className="text-xs text-muted-foreground">
                                          {l.customers.map((c) => c.name).join(", ")}
                                        </span>
                                      )}
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amount">Valor (R$)</Label>
                    <Input
                      id="amount"
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={form.amount}
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date_due">Data de vencimento</Label>
                    <Input
                      id="date_due"
                      type="date"
                      value={form.date_due}
                      onChange={(e) => setForm((f) => ({ ...f, date_due: e.target.value }))}
                      required
                    />
                  </div>

                  {/* Marcar como pago */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Switch
                        id="is_paid"
                        checked={isPaid}
                        onCheckedChange={(checked) => {
                          setIsPaid(checked)
                          if (checked && !form.date_payment) {
                            setForm((f) => ({ ...f, date_payment: new Date().toISOString().slice(0, 10) }))
                          }
                        }}
                      />
                      <Label htmlFor="is_paid" className="cursor-pointer">Marcar como pago</Label>
                    </div>
                    {isPaid && (
                      <div className="mt-2">
                        <Label htmlFor="date_payment">Data do pagamento</Label>
                        <Input
                          id="date_payment"
                          type="date"
                          value={form.date_payment}
                          max={new Date().toISOString().slice(0, 10)}
                          onChange={(e) => setForm((f) => ({ ...f, date_payment: e.target.value }))}
                          required
                          className="mt-1"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição (opcional)</Label>
                    <Input
                      id="description"
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Ex.: Honorários de consultoria"
                    />
                  </div>
                </>
              )}
              {submitError && (
                <p className="text-sm text-destructive">{submitError}</p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={submitLoading}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={settingsLoading || submitLoading}>
                  {submitLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar receita
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog
          open={dialogDespesaOpen}
          onOpenChange={(open) => {
            setDialogDespesaOpen(open)
            if (open) setForm((f) => ({ ...f, categories_id: "", date_due: f.date_due || new Date().toISOString().slice(0, 10) }))
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" variant="destructive" className="px-3">
              <Minus className="h-3.5 w-3.5" />
              Nova despesa
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova despesa</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmitNovaDespesa} className="space-y-4">
              {settingsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="despesa_users_id">Responsável</Label>
                    <Select
                      value={String(form.users_id)}
                      onValueChange={(v) => setForm((f) => ({ ...f, users_id: v }))}
                      required
                    >
                      <SelectTrigger id="despesa_users_id" className="w-full">
                        <SelectValue placeholder="Selecione o responsável" />
                      </SelectTrigger>
                      <SelectContent>
                        {settings?.users.map((u) => (
                          <SelectItem key={u.id} value={String(u.id)}>{u.name || `ID ${u.id}`}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="despesa_debit_account">Conta bancária</Label>
                    <Select
                      value={String(form.debit_account)}
                      onValueChange={(v) => setForm((f) => ({ ...f, debit_account: v }))}
                      required
                    >
                      <SelectTrigger id="despesa_debit_account" className="w-full">
                        <SelectValue placeholder="Selecione a conta" />
                      </SelectTrigger>
                      <SelectContent>
                        {settings?.banks.map((b) => (
                          <SelectItem key={b.id} value={String(b.id)}>
                            {b.name}{b.account ? ` (${b.account})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="despesa_categories_id">Categoria</Label>
                    <Select
                      value={String(form.categories_id)}
                      onValueChange={(v) => setForm((f) => ({ ...f, categories_id: v }))}
                      required
                    >
                      <SelectTrigger id="despesa_categories_id" className="w-full">
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {expenseCategories.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="despesa_cost_centers_id">Centro de custo</Label>
                    <Select
                      value={String(form.cost_centers_id)}
                      onValueChange={(v) => setForm((f) => ({ ...f, cost_centers_id: v }))}
                      required
                    >
                      <SelectTrigger id="despesa_cost_centers_id" className="w-full">
                        <SelectValue placeholder="Selecione o centro de custo" />
                      </SelectTrigger>
                      <SelectContent>
                        {settings?.cost_centers.map((cc) => (
                          <SelectItem key={cc.id} value={String(cc.id)}>{cc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Pessoa (opcional)</Label>
                    {selectedCustomer ? (
                      <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                        <span className="flex-1 truncate">
                          {selectedCustomer.name}
                          {selectedCustomer.identification && (
                            <span className="ml-1 text-muted-foreground">({selectedCustomer.identification})</span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(null)
                            setSelectedLawsuit(null)
                            setCustomerSearch("")
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between font-normal text-muted-foreground"
                          >
                            Buscar pessoa...
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput
                              placeholder="Digite o nome..."
                              value={customerSearch}
                              onValueChange={setCustomerSearch}
                            />
                            <CommandList>
                              {customerLoading && (
                                <div className="flex items-center justify-center py-4">
                                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                </div>
                              )}
                              {!customerLoading && customerSearch.length >= 2 && customerResults.length === 0 && (
                                <CommandEmpty>Nenhuma pessoa encontrada.</CommandEmpty>
                              )}
                              {!customerLoading && customerSearch.length < 2 && (
                                <div className="py-4 text-center text-sm text-muted-foreground">
                                  Digite ao menos 2 caracteres
                                </div>
                              )}
                              <CommandGroup>
                                {customerResults.map((c) => (
                                  <CommandItem
                                    key={c.id}
                                    value={String(c.id)}
                                    onSelect={() => {
                                      setSelectedCustomer(c)
                                      setSelectedLawsuit(null)
                                      setCustomerPopoverOpen(false)
                                      setCustomerSearch("")
                                    }}
                                  >
                                    <div className="flex flex-col">
                                      <span className="text-sm">{c.name}</span>
                                      {c.identification && (
                                        <span className="text-xs text-muted-foreground">{c.identification}</span>
                                      )}
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Processo (opcional)</Label>
                    {selectedCustomer && selectedCustomer.lawsuits.length > 0 ? (
                      <>
                        <Select
                          value={selectedLawsuit ? String(selectedLawsuit.id) : ""}
                          onValueChange={(v) => {
                            if (v === "__clear__") {
                              setSelectedLawsuit(null)
                              return
                            }
                            const found = selectedCustomer.lawsuits.find((l) => String(l.lawsuit_id) === v)
                            if (found) setSelectedLawsuit({ id: found.lawsuit_id, process_number: found.process_number })
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecione o processo" />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedLawsuit && (
                              <SelectItem value="__clear__" className="text-muted-foreground">Nenhum</SelectItem>
                            )}
                            {selectedCustomer.lawsuits.map((l) => (
                              <SelectItem key={l.lawsuit_id} value={String(l.lawsuit_id)}>
                                {l.process_number || `Processo #${l.lawsuit_id}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    ) : selectedLawsuit ? (
                      <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                        <span className="flex-1 truncate">
                          {selectedLawsuit.process_number || `Processo #${selectedLawsuit.id}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedLawsuit(null)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <Popover open={lawsuitPopoverOpen} onOpenChange={setLawsuitPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between font-normal text-muted-foreground"
                          >
                            Buscar processo...
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput
                              placeholder="Nome da parte ou número..."
                              value={lawsuitSearch}
                              onValueChange={setLawsuitSearch}
                            />
                            <CommandList>
                              {lawsuitLoading && (
                                <div className="flex items-center justify-center py-4">
                                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                </div>
                              )}
                              {!lawsuitLoading && lawsuitSearch.length >= 2 && lawsuitResults.length === 0 && (
                                <CommandEmpty>Nenhum processo encontrado.</CommandEmpty>
                              )}
                              {!lawsuitLoading && lawsuitSearch.length < 2 && (
                                <div className="py-4 text-center text-sm text-muted-foreground">
                                  Digite ao menos 2 caracteres
                                </div>
                              )}
                              <CommandGroup>
                                {lawsuitResults.map((l) => (
                                  <CommandItem
                                    key={l.id}
                                    value={String(l.id)}
                                    onSelect={() => {
                                      setSelectedLawsuit({ id: l.id, process_number: l.process_number })
                                      setLawsuitPopoverOpen(false)
                                      setLawsuitSearch("")
                                    }}
                                  >
                                    <div className="flex flex-col">
                                      <span className="text-sm">{l.process_number || `Processo #${l.id}`}</span>
                                      {l.customers.length > 0 && (
                                        <span className="text-xs text-muted-foreground">
                                          {l.customers.map((c) => c.name).join(", ")}
                                        </span>
                                      )}
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="despesa_amount">Valor (R$)</Label>
                    <Input
                      id="despesa_amount"
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={form.amount}
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="despesa_date_due">Data de vencimento</Label>
                    <Input
                      id="despesa_date_due"
                      type="date"
                      value={form.date_due}
                      onChange={(e) => setForm((f) => ({ ...f, date_due: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Switch
                        id="despesa_is_paid"
                        checked={isPaid}
                        onCheckedChange={(checked) => {
                          setIsPaid(checked)
                          if (checked && !form.date_payment) {
                            setForm((f) => ({ ...f, date_payment: new Date().toISOString().slice(0, 10) }))
                          }
                        }}
                      />
                      <Label htmlFor="despesa_is_paid" className="cursor-pointer">Marcar como pago</Label>
                    </div>
                    {isPaid && (
                      <div className="mt-2">
                        <Label htmlFor="despesa_date_payment">Data do pagamento</Label>
                        <Input
                          id="despesa_date_payment"
                          type="date"
                          value={form.date_payment}
                          max={new Date().toISOString().slice(0, 10)}
                          onChange={(e) => setForm((f) => ({ ...f, date_payment: e.target.value }))}
                          required
                          className="mt-1"
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="despesa_description">Descrição (opcional)</Label>
                    <Input
                      id="despesa_description"
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Ex.: Despesa com material"
                    />
                  </div>
                </>
              )}
              {submitError && (
                <p className="text-sm text-destructive">{submitError}</p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogDespesaOpen(false)}
                  disabled={submitLoading}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={settingsLoading || submitLoading}>
                  {submitLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar despesa
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <h3 className="mb-3 text-sm font-semibold text-foreground">Saldo do mês no Advbox</h3>

      {/* Filtro de mês */}
      <div className="mb-4 flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
        <button
          type="button"
          onClick={() =>
            setSelectedDate((d) => {
              if (d.month === 0) return { year: d.year - 1, month: 11 }
              return { year: d.year, month: d.month - 1 }
            })
          }
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium capitalize">
          {new Date(selectedDate.year, selectedDate.month, 1).toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
          })}
        </span>
        <button
          type="button"
          onClick={() =>
            setSelectedDate((d) => {
              if (d.month === 11) return { year: d.year + 1, month: 0 }
              return { year: d.year, month: d.month + 1 }
            })
          }
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Próximo mês"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {monthSummary.loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : monthSummary.error ? (
        <p className="py-4 text-xs text-muted-foreground">{monthSummary.error}</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-xs text-muted-foreground">Receitas</span>
            <span className="text-sm font-medium text-foreground">{formatCurrency(monthSummary.receitas)}</span>
          </div>
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-xs text-muted-foreground">Despesas</span>
            <span className="text-sm font-medium text-destructive">{formatCurrency(monthSummary.despesas)}</span>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-medium text-foreground">Saldo</span>
            <span
              className={`text-sm font-semibold ${
                monthSummary.receitas - monthSummary.despesas >= 0 ? "text-success" : "text-destructive"
              }`}
            >
              {formatCurrency(monthSummary.receitas - monthSummary.despesas)}
            </span>
          </div>
          {monthSummary.receitasVencidas > 0 && (
            <div className="flex items-center justify-between border-t pt-2 mt-1">
              <span className="text-xs text-muted-foreground">Receitas vencidas</span>
              <span className="text-sm font-medium text-destructive">
                {formatCurrency(monthSummary.receitasVencidas)}
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
