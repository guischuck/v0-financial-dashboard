'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { PlusCircle, Building, Loader2, AlertCircle } from 'lucide-react'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { Header } from '@/components/dashboard/header'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

// Dynamically import PluggyConnect because it relies on window/document to render the iframe
const PluggyConnect = dynamic(
    () => import('react-pluggy-connect').then((mod) => mod.PluggyConnect),
    { ssr: false }
)

export default function PluggyPage() {
    const [connectToken, setConnectToken] = useState<string | null>(null)
    const [loadingToken, setLoadingToken] = useState(false)
    const [errorDetails, setErrorDetails] = useState<string | null>(null)
    const [showConnect, setShowConnect] = useState(false)
    const [items, setItems] = useState<any[]>([])
    const [fetchingItems, setFetchingItems] = useState(true)

    useEffect(() => {
        fetchItems()
    }, [])

    const fetchItems = async () => {
        try {
            setFetchingItems(true)
            const res = await fetch('/api/pluggy/list-items')
            if (res.ok) {
                const data = await res.json()
                setItems(data.items || [])
            }
        } catch (e) {
            console.error(e)
        } finally {
            setFetchingItems(false)
        }
    }

    const handleOpenConnect = async () => {
        setLoadingToken(true)
        setErrorDetails(null)
        try {
            const res = await fetch('/api/pluggy/token', { method: 'POST' })
            const data = await res.json()
            if (data.accessToken) {
                setConnectToken(data.accessToken)
                setShowConnect(true)
            } else {
                setErrorDetails(data.error || 'Failed to generate token')
            }
        } catch (e: any) {
            setErrorDetails(e.message)
        } finally {
            setLoadingToken(false)
        }
    }

    const handleSuccess = async (itemData: { item: { id: string } }) => {
        // Hide the widget so user returns to the UI immediately
        setShowConnect(false)

        try {
            const itemId = itemData.item.id
            const res = await fetch('/api/pluggy/create-item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId }),
            })
            if (res.ok) {
                fetchItems()
            } else {
                const err = await res.json()
                setErrorDetails(err.error || 'Failed to sync item to our system')
            }
        } catch (e: any) {
            setErrorDetails(e.message)
        }
    }

    return (
        <div className="flex min-h-screen bg-background">
            <AppSidebar />
            <div className="flex-1 pl-16">
                <Header />

                <main className="mx-auto max-w-4xl p-6">
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-foreground">Integração Pluggy</h1>
                        <p className="text-sm text-muted-foreground">
                            Vincule as contas bancárias do escritório através do Open Finance da Pluggy.
                        </p>
                    </div>

                    {errorDetails && (
                        <Alert variant="destructive" className="mb-6">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Erro</AlertTitle>
                            <AlertDescription>{errorDetails}</AlertDescription>
                        </Alert>
                    )}

                    <div className="grid gap-6">
                        <div className="rounded-xl border border-border bg-card p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-foreground">Contas Vinculadas</h2>
                                <Button onClick={handleOpenConnect} disabled={loadingToken || showConnect}>
                                    {loadingToken ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <PlusCircle className="mr-2 h-4 w-4" />
                                    )}
                                    {loadingToken ? 'Inicializando...' : 'Nova Conexão'}
                                </Button>
                            </div>

                            {fetchingItems ? (
                                <div className="flex justify-center py-6">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : items.length === 0 ? (
                                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10">
                                    <Building className="h-10 w-10 text-muted-foreground/50 mb-4" />
                                    <p className="text-sm font-medium text-foreground">Nenhuma conexão ativa</p>
                                    <p className="text-xs text-muted-foreground mt-1 max-w-sm text-center">
                                        Clique em Nova Conexão para iniciar a vinculação bancária de forma segura.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {items.map((item) => (
                                        <div
                                            key={item.id}
                                            className="flex items-center justify-between rounded-lg border border-border p-4 bg-muted/10 shadow-sm"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                                                    <Building className="h-5 w-5 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">
                                                        Conector #{item.connectorId}
                                                    </p>
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        {item.status === 'UPDATED' ? (
                                                            <span className="flex h-2 w-2 rounded-full bg-green-500" />
                                                        ) : (
                                                            <span className="flex h-2 w-2 rounded-full bg-yellow-500" />
                                                        )}
                                                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                                                            {item.status}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Render the PluggyConnect widget */}
                        {showConnect && connectToken && (
                            <PluggyConnect
                                connectToken={connectToken}
                                includeSandbox={true}
                                onSuccess={handleSuccess}
                                onError={(error: any) => {
                                    setErrorDetails(error.message)
                                    setShowConnect(false)
                                }}
                                onClose={() => setShowConnect(false)}
                            />
                        )}
                    </div>
                </main>
            </div>
        </div>
    )
}
