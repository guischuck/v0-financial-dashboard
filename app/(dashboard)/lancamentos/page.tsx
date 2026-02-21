'use client'

import { Receipt } from 'lucide-react'

export default function LancamentosPage() {
    return (
        <main className="p-6">
            <div className="flex flex-col items-center justify-center py-24">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                    <Receipt className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-xl font-semibold text-foreground">Lançamentos</h1>
                <p className="mt-2 text-sm text-muted-foreground">Em breve: visualização detalhada de lançamentos.</p>
            </div>
        </main>
    )
}
