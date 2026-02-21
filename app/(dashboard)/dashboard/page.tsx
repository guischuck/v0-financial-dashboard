import { KpiCards } from "@/components/dashboard/kpi-cards"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { BankAccounts } from "@/components/dashboard/bank-accounts"
import { ReconciliationTable } from "@/components/dashboard/reconciliation-table"

export default function DashboardPage() {
    return (
        <main className="p-6">
            <section aria-label="Indicadores financeiros">
                <KpiCards />
            </section>

            <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3" aria-label="Graficos e contas">
                <div className="lg:col-span-2">
                    <RevenueChart />
                </div>

                <div className="flex flex-col gap-4">
                    <BankAccounts />
                </div>
            </section>

            <section className="mt-6" aria-label="Tabela de conciliacao">
                <ReconciliationTable />
            </section>
        </main>
    )
}
