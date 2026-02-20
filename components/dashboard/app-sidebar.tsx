"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { useClerk, useUser } from "@clerk/nextjs"
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
  LogOut,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: ArrowLeftRight, label: "Conciliação", href: "/conciliacao" },
  { icon: Receipt, label: "Lançamentos", href: "/lancamentos" },
  { icon: Landmark, label: "Contas Bancárias", href: "/contas" },
  { icon: Link2, label: "Pluggy", href: "/pluggy" },
  { icon: Building2, label: "Advbox", href: "/advbox" },
  { icon: FileBarChart, label: "Relatórios", href: "/relatorios" },
]

const bottomItems = [
  { icon: Settings, label: "Configurações", href: "/configuracoes" },
  { icon: HelpCircle, label: "Ajuda", href: "/ajuda" },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { signOut } = useClerk()
  const { user } = useUser()
  const [collapsed, setCollapsed] = useState(true)

  // Only the item whose href exactly matches or is a prefix of the current path is active
  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/"
    return pathname === href || pathname.startsWith(href + "/")
  }

  function NavItem({ item }: { item: (typeof navItems)[0] }) {
    const active = isActive(item.href)
    const button = (
      <Link
        href={item.href}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
          active
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    )

    if (collapsed) {
      return (
        <Tooltip key={item.label}>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
        </Tooltip>
      )
    }
    return button
  }

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
              <span className="text-sm font-bold text-primary-foreground">HP</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <span className="text-sm font-bold text-primary-foreground">HP</span>
              </div>
              <span className="text-sm font-semibold text-foreground">HonoráriosPay</span>
            </div>
          )}
        </div>

        {/* Main nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
          {navItems.map((item) => (
            <NavItem key={item.label} item={item} />
          ))}
        </nav>

        {/* Bottom nav */}
        <div className="space-y-1 border-t border-border px-2 py-3">
          {bottomItems.map((item) => (
            <NavItem key={item.label} item={item} />
          ))}

          {/* User info (only expanded) */}
          {!collapsed && user && (
            <div className="mt-2 flex items-center gap-2 rounded-md px-3 py-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                {user.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt={user.firstName ?? ""}
                    className="h-7 w-7 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{user.fullName}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {user.primaryEmailAddress?.emailAddress}
                </p>
              </div>
            </div>
          )}

          {/* Logout */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => signOut({ redirectUrl: "/login" })}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="h-5 w-5 shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">Sair da conta</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={() => signOut({ redirectUrl: "/login" })}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              <span>Sair da conta</span>
            </button>
          )}

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
