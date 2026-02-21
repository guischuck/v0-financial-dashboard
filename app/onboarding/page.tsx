'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Building2, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function OnboardingPage() {
    const { user } = useUser()
    const router = useRouter()
    const [companyName, setCompanyName] = useState('')
    const [slug, setSlug] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    function handleNameChange(value: string) {
        setCompanyName(value)
        // Auto-generate slug
        setSlug(
            value
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '')
        )
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const res = await fetch('/api/onboarding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyName, slug }),
            })

            const data = await res.json()

            if (!res.ok) {
                setError(data.error || 'Erro ao criar empresa')
                return
            }

            router.push('/dashboard')
        } catch {
            setError('Erro de conexão. Tente novamente.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
            <div className="w-full max-w-lg">
                {/* Progress indicator */}
                <div className="mb-8 flex items-center justify-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <div className="h-px w-12 bg-primary" />
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</div>
                    <div className="h-px w-12 bg-border" />
                    <div className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-xs text-muted-foreground">3</div>
                </div>

                {/* Card */}
                <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
                    <div className="mb-6 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                            <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-foreground">Configure sua empresa</h2>
                            <p className="text-sm text-muted-foreground">
                                Olá, {user?.firstName || 'usuário'}! Vamos criar sua organização.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="company-name">Nome da empresa</Label>
                            <Input
                                id="company-name"
                                placeholder="Ex: Escritório Jurídico Santos"
                                value={companyName}
                                onChange={(e) => handleNameChange(e.target.value)}
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="slug">Identificador único</Label>
                            <div className="flex items-center rounded-md border border-border bg-muted/50 px-3">
                                <span className="text-sm text-muted-foreground">honorariospay.cloud/</span>
                                <Input
                                    id="slug"
                                    className="border-0 bg-transparent px-1 focus-visible:ring-0"
                                    placeholder="minha-empresa"
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                    required
                                    disabled={loading}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Usado para identificar sua empresa. Não poderá ser alterado depois.
                            </p>
                        </div>

                        {error && (
                            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full gap-2" disabled={loading || !companyName || !slug}>
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <>
                                    Continuar
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </Button>
                    </form>
                </div>

                <p className="mt-4 text-center text-xs text-muted-foreground">
                    Você poderá configurar as integrações na próxima etapa.
                </p>
            </div>
        </div>
    )
}
