import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { Header } from "@/components/dashboard/header"
import { KpiCards, ReconciliationKpi } from "@/components/dashboard/kpi-cards"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { BankAccounts } from "@/components/dashboard/bank-accounts"
import { SyncStatus } from "@/components/dashboard/sync-status"
import { ReconciliationChart } from "@/components/dashboard/reconciliation-chart"
import { ReconciliationTable } from "@/components/dashboard/reconciliation-table"

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <AppSidebar />

      {/* Main content */}
      <div className="flex-1 pl-16">
        <Header />

        <main className="p-6">
          {/* KPI Cards */}
          <section aria-label="Indicadores financeiros">
            <KpiCards />
          </section>

          {/* Charts + Side panels */}
          <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3" aria-label="Graficos e contas">
            {/* Revenue Chart - takes 2 cols */}
            <div className="lg:col-span-2">
              <RevenueChart />
            </div>

            {/* Right panel */}
            <div className="flex flex-col gap-4">
              <BankAccounts />
            </div>
          </section>

          {/* Reconciliation Section */}
          <section className="mt-6" aria-label="Conciliacao bancaria">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Conciliacao Bancaria</h2>
                <p className="text-sm text-muted-foreground">
                  Pluggy x Advbox - Fevereiro 2026
                </p>
              </div>
            </div>

            {/* Reconciliation KPIs */}
            <ReconciliationKpi />
          </section>

          {/* Reconciliation visual overview */}
          <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3" aria-label="Visao geral da conciliacao">
            <div className="lg:col-span-2">
              <SyncStatus />
            </div>
            <ReconciliationChart />
          </section>

          {/* Reconciliation table */}
          <section className="mt-6" aria-label="Tabela de conciliacao">
            <ReconciliationTable />
          </section>
        </main>
      </div>
    </div>
  )
}
