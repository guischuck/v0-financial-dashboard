"use client"

import { useState } from "react"
import {
  LayoutDashboard,
  ArrowLeftRight,
  Receipt,
  Landmark,
  FileBarChart,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Building2,
  Link2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: ArrowLeftRight, label: "Conciliacao", active: false },
  { icon: Receipt, label: "Lancamentos", active: false },
  { icon: Landmark, label: "Contas Bancarias", active: false },
  { icon: Link2, label: "Pluggy", active: false },
  { icon: Building2, label: "Advbox", active: false },
  { icon: FileBarChart, label: "Relatorios", active: false },
]

const bottomItems = [
  { icon: Settings, label: "Configuracoes", active: false },
  { icon: HelpCircle, label: "Ajuda", active: false },
]

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(true)
  const [activeItem, setActiveItem] = useState("Dashboard")

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-card transition-all duration-200",
          collapsed ? "w-16" : "w-56"
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center justify-center border-b border-border px-3">
          {collapsed ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">FC</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <span className="text-sm font-bold text-primary-foreground">FC</span>
              </div>
              <span className="text-sm font-semibold text-foreground">FinConcilia</span>
            </div>
          )}
        </div>

        {/* Main nav */}
        <nav className="flex-1 space-y-1 px-2 py-3">
          {navItems.map((item) => {
            const isActive = activeItem === item.label
            const button = (
              <button
                key={item.label}
                onClick={() => setActiveItem(item.label)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            )

            if (collapsed) {
              return (
                <Tooltip key={item.label}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              )
            }
            return button
          })}
        </nav>

        {/* Bottom nav */}
        <div className="space-y-1 border-t border-border px-2 py-3">
          {bottomItems.map((item) => {
            const button = (
              <button
                key={item.label}
                onClick={() => setActiveItem(item.label)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  activeItem === item.label
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            )

            if (collapsed) {
              return (
                <Tooltip key={item.label}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              )
            }
            return button
          })}

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5 shrink-0" />
            ) : (
              <>
                <ChevronLeft className="h-5 w-5 shrink-0" />
                <span>Recolher</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  )
}
