'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    Settings,
    Key,
    Eye,
    EyeOff,
    CheckCircle2,
    XCircle,
    Loader2,
    Save,
    RefreshCw,
    Link2,
    Building2,
    Users,
    AlertTriangle,
} from 'lucide-react'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type ConnectionStatus = 'unknown' | 'connected' | 'error' | 'testing'

interface ApiSettings {
    pluggyApiKey: string
    pluggyClientId: string
    advboxApiKey: string
    advboxApiUrl: string
    // masked values from server
    pluggyApiKeyMasked?: string
    pluggyClientIdMasked?: string
    advboxApiKeyMasked?: string
    pluggyConnected: boolean
    advboxConnected: boolean
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
    if (status === 'testing') return (
        <Badge variant="outline" className="gap-1.5 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Testando...
        </Badge>
    )
    if (status === 'connected') return (
        <Badge variant="outline" className="gap-1.5 border-green-500/30 bg-green-500/10 text-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Conectado
        </Badge>
    )
    if (status === 'error') return (
        <Badge variant="outline" className="gap-1.5 border-red-500/30 bg-red-500/10 text-red-600">
            <XCircle className="h-3 w-3" />
            Erro de conexão
        </Badge>
    )
    return (
        <Badge variant="outline" className="gap-1.5 text-muted-foreground">
            Não configurado
        </Badge>
    )
}

function ApiKeyInput({
    id,
    label,
    maskedValue,
    placeholder,
    onChange,
    showToggle = true,
}: {
    id: string
    label: string
    maskedValue?: string
    placeholder: string
    onChange: (val: string) => void
    showToggle?: boolean
}) {
    const [show, setShow] = useState(false)
    const [value, setValue] = useState('')
    const [editing, setEditing] = useState(false)

    function handleChange(v: string) {
        setValue(v)
        onChange(v)
    }

    return (
        <div className="space-y-2">
            <Label htmlFor={id}>{label}</Label>
            {!editing && maskedValue ? (
                <div className="flex gap-2">
                    <div className="flex flex-1 items-center rounded-md border border-border bg-muted/50 px-3 py-2">
                        <span className="font-mono text-sm text-muted-foreground">{maskedValue}</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                        Alterar
                    </Button>
                </div>
            ) : (
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Input
                            id={id}
                            type={show ? 'text' : 'password'}
                            placeholder={placeholder}
                            value={value}
                            onChange={(e) => handleChange(e.target.value)}
                            className="pr-10 font-mono text-sm"
                        />
                        {showToggle && (
                            <button
                                type="button"
                                onClick={() => setShow(!show)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        )}
                    </div>
                    {editing && (
                        <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setValue(''); onChange('') }}>
                            Cancelar
                        </Button>
                    )}
                </div>
            )}
        </div>
    )
}

export default function ConfiguracoesPage() {
    const [settings, setSettings] = useState<ApiSettings>({
        pluggyApiKey: '',
        pluggyClientId: '',
        advboxApiKey: '',
        advboxApiUrl: 'https://api.advbox.com.br',
        pluggyConnected: false,
        advboxConnected: false,
    })
    const [pluggyStatus, setPluggyStatus] = useState<ConnectionStatus>('unknown')
    const [advboxStatus, setAdvboxStatus] = useState<ConnectionStatus>('unknown')
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [activeTab, setActiveTab] = useState<'integracoes' | 'empresa' | 'membros'>('integracoes')

    useEffect(() => {
        fetchSettings()
    }, [])

    async function fetchSettings() {
        try {
            const res = await fetch('/api/settings')
            if (res.ok) {
                const data = await res.json()
                setSettings(prev => ({ ...prev, ...data }))
                if (data.pluggyConnected) setPluggyStatus('connected')
                if (data.advboxConnected) setAdvboxStatus('connected')
            }
        } finally {
            setLoading(false)
        }
    }

    async function handleSave() {
        setSaving(true)
        setSaveSuccess(false)
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pluggyApiKey: settings.pluggyApiKey || undefined,
                    pluggyClientId: settings.pluggyClientId || undefined,
                    advboxApiKey: settings.advboxApiKey || undefined,
                    advboxApiUrl: settings.advboxApiUrl,
                }),
            })

            if (res.ok) {
                setSaveSuccess(true)
                fetchSettings()
                setTimeout(() => setSaveSuccess(false), 3000)
            }
        } finally {
            setSaving(false)
        }
    }

    async function testPluggy() {
        setPluggyStatus('testing')
        try {
            const res = await fetch('/api/settings/test-pluggy', { method: 'POST' })
            setPluggyStatus(res.ok ? 'connected' : 'error')
        } catch {
            setPluggyStatus('error')
        }
    }

    async function testAdvbox() {
        setAdvboxStatus('testing')
        try {
            const res = await fetch('/api/settings/test-advbox', { method: 'POST' })
            setAdvboxStatus(res.ok ? 'connected' : 'error')
        } catch {
            setAdvboxStatus('error')
        }
    }

    const tabs = [
        { id: 'integracoes', label: 'Integrações', icon: Link2 },
        { id: 'empresa', label: 'Empresa', icon: Building2 },
        { id: 'membros', label: 'Membros', icon: Users },
    ] as const

    return (
        <div className="flex min-h-screen bg-background">
            <AppSidebar />

            <div className="flex-1 pl-16">
                {/* Page Header */}
                <div className="border-b border-border bg-card px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                            <Settings className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold text-foreground">Configurações</h1>
                            <p className="text-xs text-muted-foreground">Gerencie integrações, equipe e preferências</p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="mt-4 flex gap-1">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                                    activeTab === tab.id
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                )}
                            >
                                <tab.icon className="h-4 w-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-6">
                    {/* === ABA: INTEGRAÇÕES === */}
                    {activeTab === 'integracoes' && (
                        <div className="max-w-2xl space-y-6">

                            {/* Pluggy */}
                            <div className="rounded-xl border border-border bg-card p-6">
                                <div className="mb-5 flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                                            <Key className="h-5 w-5 text-blue-500" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-foreground">Pluggy</h3>
                                            <p className="text-xs text-muted-foreground">Open Finance e dados bancários</p>
                                        </div>
                                    </div>
                                    <StatusBadge status={pluggyStatus} />
                                </div>

                                <div className="space-y-4">
                                    <ApiKeyInput
                                        id="pluggy-client-id"
                                        label="Client ID"
                                        maskedValue={settings.pluggyClientIdMasked}
                                        placeholder="Seu Pluggy Client ID"
                                        onChange={(v) => setSettings(s => ({ ...s, pluggyClientId: v }))}
                                    />
                                    <ApiKeyInput
                                        id="pluggy-api-key"
                                        label="API Key / Client Secret"
                                        maskedValue={settings.pluggyApiKeyMasked}
                                        placeholder="Seu Pluggy API Secret"
                                        onChange={(v) => setSettings(s => ({ ...s, pluggyApiKey: v }))}
                                    />
                                </div>

                                <div className="mt-5 flex items-center gap-2">
                                    <Button variant="outline" size="sm" className="gap-2" onClick={testPluggy} disabled={pluggyStatus === 'testing'}>
                                        {pluggyStatus === 'testing' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                        Testar conexão
                                    </Button>
                                    <p className="text-xs text-muted-foreground">
                                        Obtenha suas chaves em{' '}
                                        <a href="https://pluggy.ai" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                            pluggy.ai
                                        </a>
                                    </p>
                                </div>
                            </div>

                            {/* Advbox */}
                            <div className="rounded-xl border border-border bg-card p-6">
                                <div className="mb-5 flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
                                            <Building2 className="h-5 w-5 text-purple-500" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-foreground">Advbox</h3>
                                            <p className="text-xs text-muted-foreground">Sistema de gestão jurídica</p>
                                        </div>
                                    </div>
                                    <StatusBadge status={advboxStatus} />
                                </div>

                                <div className="space-y-4">
                                    <ApiKeyInput
                                        id="advbox-api-key"
                                        label="API Key"
                                        maskedValue={settings.advboxApiKeyMasked}
                                        placeholder="Sua Advbox API Key"
                                        onChange={(v) => setSettings(s => ({ ...s, advboxApiKey: v }))}
                                    />
                                    <div className="space-y-2">
                                        <Label htmlFor="advbox-url">URL da API</Label>
                                        <Input
                                            id="advbox-url"
                                            value={settings.advboxApiUrl}
                                            onChange={(e) => setSettings(s => ({ ...s, advboxApiUrl: e.target.value }))}
                                            placeholder="https://api.advbox.com.br"
                                        />
                                    </div>
                                </div>

                                <div className="mt-5 flex items-center gap-2">
                                    <Button variant="outline" size="sm" className="gap-2" onClick={testAdvbox} disabled={advboxStatus === 'testing'}>
                                        {advboxStatus === 'testing' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                        Testar conexão
                                    </Button>
                                </div>
                            </div>

                            {/* Aviso de segurança */}
                            <div className="flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                                <p className="text-sm text-muted-foreground">
                                    Suas chaves de API são <strong className="text-foreground">criptografadas com AES-256</strong> antes de serem armazenadas. Nunca compartilhe suas chaves com terceiros.
                                </p>
                            </div>

                            {/* Save button */}
                            <div className="flex items-center gap-3">
                                <Button onClick={handleSave} disabled={saving} className="gap-2">
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Salvar configurações
                                </Button>
                                {saveSuccess && (
                                    <span className="flex items-center gap-1.5 text-sm text-green-600">
                                        <CheckCircle2 className="h-4 w-4" />
                                        Salvo com sucesso!
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* === ABA: EMPRESA === */}
                    {activeTab === 'empresa' && (
                        <div className="max-w-2xl">
                            <div className="rounded-xl border border-border bg-card p-6">
                                <h3 className="mb-5 font-semibold text-foreground">Informações da empresa</h3>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="company-name">Nome da empresa</Label>
                                        <Input id="company-name" placeholder="Nome da sua empresa" />
                                    </div>
                                    <Separator />
                                    <p className="text-sm text-muted-foreground">
                                        Mais opções em breve: logo, fuso horário, e domínio personalizado.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* === ABA: MEMBROS === */}
                    {activeTab === 'membros' && (
                        <div className="max-w-2xl">
                            <div className="rounded-xl border border-border bg-card p-6">
                                <div className="mb-5 flex items-center justify-between">
                                    <h3 className="font-semibold text-foreground">Membros da equipe</h3>
                                    <Button size="sm">Convidar membro</Button>
                                </div>
                                <div className="flex items-center justify-center py-12 text-center">
                                    <div>
                                        <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                                        <p className="text-sm text-muted-foreground">Gerenciamento de membros em breve.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
