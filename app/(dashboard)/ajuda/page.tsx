'use client'

import { HelpCircle } from 'lucide-react'

export default function AjudaPage() {
    return (
        <main className="p-6">
            <div className="flex flex-col items-center justify-center py-24">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                    <HelpCircle className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-xl font-semibold text-foreground">Ajuda</h1>
                <p className="mt-2 text-sm text-muted-foreground">Em breve: central de ajuda e documentação.</p>
            </div>
        </main>
    )
}
