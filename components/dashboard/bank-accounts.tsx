"use client"

import { ChevronDown, DollarSign, Plus, Minus, ArrowLeftRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const accounts = [
  { name: "Conta Principal", balance: "R$ 70.112,00", type: "checking" },
  { name: "Dinheiro", balance: "R$ 0,00", type: "cash" },
  { name: "Investimentos", balance: "R$ 0,00", type: "investment" },
]

export function BankAccounts() {
  return (
    <Card className="p-4 shadow-sm border-border/60">
      {/* Action buttons */}
      <div className="mb-4 flex items-center gap-2">
        <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90">
          <Plus className="mr-1 h-3.5 w-3.5" />
          Nova receita
        </Button>
        <Button size="sm" variant="destructive" className="px-3">
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="outline" className="px-3">
          <ArrowLeftRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Bank accounts list */}
      <h3 className="mb-3 text-sm font-semibold text-foreground">Contas bancarias</h3>
      <div className="space-y-2">
        {accounts.map((account) => (
          <button
            key={account.name}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-accent"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-foreground">{account.name}</p>
                <p className="text-xs text-muted-foreground">{account.balance}</p>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    </Card>
  )
}
