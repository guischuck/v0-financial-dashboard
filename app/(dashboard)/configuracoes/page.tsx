'use client'

import { useState, useEffect, useRef } from 'react'
import {
    Settings,
    Key,
    CheckCircle2,
    XCircle,
    Loader2,
    Save,
    RefreshCw,
    Link2,
    Building2,
    Users,
    AlertTriangle,
    ShieldCheck,
    Cog,
    Plus,
    Trash2,
    Mail,
    UserCircle,
    RotateCcw,
    Bell,
    BellOff,
    Zap,
    Upload,
    ImageIcon,
    X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'

type ConnectionStatus = 'unknown' | 'connected' | 'error' | 'testing'

interface ApiSettings {
    pluggyApiKey: string
    pluggyClientId: string
    advboxApiKey: string
    pluggyApiKeyConfigured: boolean
    pluggyClientIdConfigured: boolean
    advboxApiKeyConfigured: boolean
    pluggyConnected: boolean
    advboxConnected: boolean
    autoMarkPaid: boolean
    notifyReconciliation: boolean
    notifyDueTransactions: boolean
    notifyMisc: boolean
}

interface MatchWeights {
    cpf: number
    name: number
    email: number
    amount: number
}

interface ConfidenceThresholds {
    high: number
    medium: number
}

interface Member {
    id: string
    name: string
    email: string
    role: 'admin' | 'operador' | 'visualizador'
    addedAt: string
}

const DEFAULT_WEIGHTS: MatchWeights = { cpf: 40, name: 25, email: 15, amount: 20 }
const DEFAULT_THRESHOLDS: ConfidenceThresholds = { high: 60, medium: 35 }

const ROLE_LABELS: Record<Member['role'], string> = {
    admin: 'Administrador',
    operador: 'Operador',
    visualizador: 'Visualizador',
}

const ROLE_COLORS: Record<Member['role'], string> = {
    admin: 'bg-violet-500/10 text-violet-600 border-violet-500/30',
    operador: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    visualizador: 'bg-zinc-500/10 text-zinc-600 border-zinc-500/30',
}

const MAX_LOGO_SIZE = 512 * 1024

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
    isConfigured,
    placeholder,
    onChange,
}: {
    id: string
    label: string
    isConfigured?: boolean
    placeholder: string
    onChange: (val: string) => void
}) {
    const [value, setValue] = useState('')
    const [editing, setEditing] = useState(false)

    function handleChange(v: string) {
        setValue(v)
        onChange(v)
    }

    return (
        <div className="space-y-2">
            <Label htmlFor={id}>{label}</Label>
            {!editing && isConfigured ? (
                <div className="flex gap-2">
                    <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
                        <ShieldCheck className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-muted-foreground">Chave configurada</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                        Alterar
                    </Button>
                </div>
            ) : (
                <div className="flex gap-2">
                    <Input
                        id={id}
                        type="password"
                        placeholder={placeholder}
                        value={value}
                        onChange={(e) => handleChange(e.target.value)}
                        className="font-mono text-sm"
                        autoComplete="off"
                    />
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
        pluggyApiKeyConfigured: false,
        pluggyClientIdConfigured: false,
        advboxApiKeyConfigured: false,
        pluggyConnected: false,
        advboxConnected: false,
        autoMarkPaid: false,
        notifyReconciliation: true,
        notifyDueTransactions: true,
        notifyMisc: true,
    })
    const [pluggyStatus, setPluggyStatus] = useState<ConnectionStatus>('unknown')
    const [advboxStatus, setAdvboxStatus] = useState<ConnectionStatus>('unknown')
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [activeTab, setActiveTab] = useState<'integracoes' | 'empresa' | 'membros' | 'preferencias'>('integracoes')
    const [prefSaving, setPrefSaving] = useState(false)
    const [prefSaved, setPrefSaved] = useState(false)

    const [weights, setWeights] = useState<MatchWeights>({ ...DEFAULT_WEIGHTS })
    const [thresholds, setThresholds] = useState<ConfidenceThresholds>({ ...DEFAULT_THRESHOLDS })

    const [companyName, setCompanyName] = useState('')
    const [companyLogo, setCompanyLogo] = useState<string | null>(null)
    const [companySaving, setCompanySaving] = useState(false)
    const [companySaved, setCompanySaved] = useState(false)
    const [logoError, setLogoError] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [members, setMembers] = useState<Member[]>([
        { id: '1', name: 'Você', email: 'admin@escritorio.com', role: 'admin', addedAt: '2026-01-15' },
    ])
    const [showAddMember, setShowAddMember] = useState(false)
    const [newMember, setNewMember] = useState({ name: '', email: '', role: 'operador' as Member['role'] })

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
                if (data.companyName) setCompanyName(data.companyName)
                if (data.companyLogo) setCompanyLogo(data.companyLogo)
                if (data.matchWeightCpf !== undefined) {
                    setWeights({
                        cpf: data.matchWeightCpf,
                        name: data.matchWeightName,
                        email: data.matchWeightEmail,
                        amount: data.matchWeightAmount,
                    })
                }
                if (data.confidenceHigh !== undefined) {
                    setThresholds({
                        high: data.confidenceHigh,
                        medium: data.confidenceMedium,
                    })
                }
            }
        } finally {
            setLoading(false)
        }
    }

    async function saveSettings(): Promise<boolean> {
        const body: Record<string, unknown> = {}
        if (settings.pluggyApiKey) body.pluggyApiKey = settings.pluggyApiKey
        if (settings.pluggyClientId) body.pluggyClientId = settings.pluggyClientId
        if (settings.advboxApiKey) body.advboxApiKey = settings.advboxApiKey

        if (Object.keys(body).length === 0) return true

        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })

        if (res.ok) fetchSettings()
        return res.ok
    }

    async function handleSave() {
        setSaving(true)
        setSaveSuccess(false)
        try {
            const ok = await saveSettings()
            if (ok) {
                setSaveSuccess(true)
                setTimeout(() => setSaveSuccess(false), 3000)
            }
        } finally {
            setSaving(false)
        }
    }

    async function handleSaveCompany() {
        setCompanySaving(true)
        setCompanySaved(false)
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyName,
                    companyLogo: companyLogo ?? null,
                }),
            })
            if (res.ok) {
                setCompanySaved(true)
                setTimeout(() => setCompanySaved(false), 3000)
            }
        } finally {
            setCompanySaving(false)
        }
    }

    async function handleSavePreferences() {
        if (!isWeightValid) return
        setPrefSaving(true)
        setPrefSaved(false)
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    autoMarkPaid: settings.autoMarkPaid,
                    notifyReconciliation: settings.notifyReconciliation,
                    notifyDueTransactions: settings.notifyDueTransactions,
                    notifyMisc: settings.notifyMisc,
                    matchWeightCpf: weights.cpf,
                    matchWeightName: weights.name,
                    matchWeightEmail: weights.email,
                    matchWeightAmount: weights.amount,
                    confidenceHigh: thresholds.high,
                    confidenceMedium: thresholds.medium,
                }),
            })
            if (res.ok) {
                setPrefSaved(true)
                setTimeout(() => setPrefSaved(false), 3000)
            }
        } finally {
            setPrefSaving(false)
        }
    }

    async function testPluggy() {
        setPluggyStatus('testing')
        try {
            await saveSettings()
            const res = await fetch('/api/settings/test-pluggy', { method: 'POST' })
            setPluggyStatus(res.ok ? 'connected' : 'error')
        } catch {
            setPluggyStatus('error')
        }
    }

    async function testAdvbox() {
        setAdvboxStatus('testing')
        try {
            await saveSettings()
            const res = await fetch('/api/settings/test-advbox', { method: 'POST' })
            setAdvboxStatus(res.ok ? 'connected' : 'error')
        } catch {
            setAdvboxStatus('error')
        }
    }

    function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
        setLogoError('')
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) {
            setLogoError('O arquivo deve ser uma imagem (PNG, JPG, SVG, etc.)')
            return
        }
        if (file.size > MAX_LOGO_SIZE) {
            setLogoError('O arquivo deve ter no máximo 512 KB.')
            return
        }

        const reader = new FileReader()
        reader.onload = () => {
            setCompanyLogo(reader.result as string)
        }
        reader.readAsDataURL(file)

        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    function handleRemoveLogo() {
        setCompanyLogo(null)
        setLogoError('')
    }

    const totalWeight = weights.cpf + weights.name + weights.email + weights.amount
    const isWeightValid = totalWeight === 100

    function handleAddMember() {
        if (!newMember.name.trim() || !newMember.email.trim()) return
        const member: Member = {
            id: Date.now().toString(),
            name: newMember.name.trim(),
            email: newMember.email.trim(),
            role: newMember.role,
            addedAt: new Date().toISOString().split('T')[0],
        }
        setMembers(prev => [...prev, member])
        setNewMember({ name: '', email: '', role: 'operador' })
        setShowAddMember(false)
    }

    function handleRemoveMember(id: string) {
        setMembers(prev => prev.filter(m => m.id !== id))
    }

    function handleResetWeights() {
        setWeights({ ...DEFAULT_WEIGHTS })
        setThresholds({ ...DEFAULT_THRESHOLDS })
    }

    const tabs = [
        { id: 'integracoes', label: 'Integrações', icon: Link2 },
        { id: 'empresa', label: 'Empresa', icon: Building2 },
        { id: 'membros', label: 'Membros', icon: Users },
        { id: 'preferencias', label: 'Preferências', icon: Cog },
    ] as const

    return (
        <>
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
                        <div className="max-w-5xl space-y-6">
                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                                        isConfigured={settings.pluggyClientIdConfigured}
                                        placeholder="Seu Pluggy Client ID"
                                        onChange={(v) => setSettings(s => ({ ...s, pluggyClientId: v }))}
                                    />
                                    <ApiKeyInput
                                        id="pluggy-api-key"
                                        label="API Key / Client Secret"
                                        isConfigured={settings.pluggyApiKeyConfigured}
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
                                        isConfigured={settings.advboxApiKeyConfigured}
                                        placeholder="Sua Advbox API Key"
                                        onChange={(v) => setSettings(s => ({ ...s, advboxApiKey: v }))}
                                    />
                                </div>

                                <div className="mt-5 flex items-center gap-2">
                                    <Button variant="outline" size="sm" className="gap-2" onClick={testAdvbox} disabled={advboxStatus === 'testing'}>
                                        {advboxStatus === 'testing' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                        Testar conexão
                                    </Button>
                                </div>
                                </div>
                            </div>

                            <div className="flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                                <p className="text-sm text-muted-foreground">
                                    Suas chaves de API são <strong className="text-foreground">criptografadas com AES-256</strong> antes de serem armazenadas. Nunca compartilhe suas chaves com terceiros.
                                </p>
                            </div>

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
                        <div className="max-w-2xl space-y-6">
                            <div className="rounded-xl border border-border bg-card p-6">
                                <h3 className="mb-6 font-semibold text-foreground">Informações da empresa</h3>

                                <div className="space-y-6">
                                    {/* Logotipo */}
                                    <div className="space-y-3">
                                        <Label>Logotipo</Label>
                                        <div className="flex items-center gap-5">
                                            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/30">
                                                {companyLogo ? (
                                                    <>
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={companyLogo}
                                                            alt="Logo da empresa"
                                                            className="h-full w-full object-contain"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={handleRemoveLogo}
                                                            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white shadow-sm transition-transform hover:scale-110"
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-2"
                                                    onClick={() => fileInputRef.current?.click()}
                                                >
                                                    <Upload className="h-3.5 w-3.5" />
                                                    {companyLogo ? 'Alterar logo' : 'Enviar logo'}
                                                </Button>
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                                                    onChange={handleLogoChange}
                                                    className="hidden"
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    PNG, JPG, SVG ou WebP. Máximo 512 KB.
                                                </p>
                                                {logoError && (
                                                    <p className="text-xs text-destructive">{logoError}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <Separator />

                                    {/* Nome da empresa */}
                                    <div className="space-y-2">
                                        <Label htmlFor="company-name">Nome da empresa</Label>
                                        <Input
                                            id="company-name"
                                            placeholder="Ex: Santos & Associados Advocacia"
                                            value={companyName}
                                            onChange={(e) => setCompanyName(e.target.value)}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            O nome será exibido no painel e nos relatórios gerados.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <Button onClick={handleSaveCompany} disabled={companySaving} className="gap-2">
                                    {companySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Salvar empresa
                                </Button>
                                {companySaved && (
                                    <span className="flex items-center gap-1.5 text-sm text-green-600">
                                        <CheckCircle2 className="h-4 w-4" />
                                        Salvo com sucesso!
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* === ABA: MEMBROS === */}
                    {activeTab === 'membros' && (
                        <div className="max-w-3xl space-y-6">
                            <div className="rounded-xl border border-border bg-card p-6">
                                <div className="mb-5 flex items-center justify-between">
                                    <h3 className="font-semibold text-foreground">Membros da equipe</h3>
                                    <Button size="sm" className="gap-2" onClick={() => setShowAddMember(true)}>
                                        <Plus className="h-3.5 w-3.5" />
                                        Adicionar colaborador
                                    </Button>
                                </div>

                                <div className="space-y-3">
                                    {members.map((member) => (
                                        <div
                                            key={member.id}
                                            className="flex items-center justify-between rounded-lg border border-border p-4"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                                                    <UserCircle className="h-5 w-5 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">{member.name}</p>
                                                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                        <Mail className="h-3 w-3" />
                                                        {member.email}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Badge variant="outline" className={ROLE_COLORS[member.role]}>
                                                    {ROLE_LABELS[member.role]}
                                                </Badge>
                                                {member.id !== '1' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                                        onClick={() => handleRemoveMember(member.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>Adicionar colaborador</DialogTitle>
                                        <DialogDescription>
                                            Preencha os dados do novo membro da equipe.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="member-name">Nome completo</Label>
                                            <Input
                                                id="member-name"
                                                placeholder="Ex: Maria Santos"
                                                value={newMember.name}
                                                onChange={(e) => setNewMember(prev => ({ ...prev, name: e.target.value }))}
                                                autoComplete="off"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="member-email">E-mail</Label>
                                            <Input
                                                id="member-email"
                                                type="email"
                                                placeholder="Ex: maria@escritorio.com"
                                                value={newMember.email}
                                                onChange={(e) => setNewMember(prev => ({ ...prev, email: e.target.value }))}
                                                autoComplete="off"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Permissão</Label>
                                            <Select
                                                value={newMember.role}
                                                onValueChange={(v) => setNewMember(prev => ({ ...prev, role: v as Member['role'] }))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="admin">Administrador</SelectItem>
                                                    <SelectItem value="operador">Operador</SelectItem>
                                                    <SelectItem value="visualizador">Visualizador</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <p className="text-xs text-muted-foreground">
                                                {newMember.role === 'admin' && 'Acesso total: configurações, membros e operações.'}
                                                {newMember.role === 'operador' && 'Pode criar e editar transações, mas não gerencia configurações.'}
                                                {newMember.role === 'visualizador' && 'Apenas visualiza dados, sem permissão de edição.'}
                                            </p>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setShowAddMember(false)}>
                                            Cancelar
                                        </Button>
                                        <Button
                                            onClick={handleAddMember}
                                            disabled={!newMember.name.trim() || !newMember.email.trim()}
                                        >
                                            Adicionar
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    )}

                    {/* === ABA: PREFERÊNCIAS === */}
                    {activeTab === 'preferencias' && (
                        <div className="max-w-3xl space-y-6">
                            {/* Conciliação automática */}
                            <div className="rounded-xl border border-border bg-card p-6">
                                <div className="mb-1 flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                                        <Zap className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-foreground">Conciliação automática</h3>
                                        <p className="text-xs text-muted-foreground">Comportamento ao realizar match automático</p>
                                    </div>
                                </div>

                                <Separator className="my-4" />

                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Marcar como pago no match automático</p>
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            Quando ativado, lançamentos com alta confiança de match são marcados como pagos automaticamente no Advbox, sem necessidade de confirmação manual.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={settings.autoMarkPaid}
                                        onCheckedChange={(v) => setSettings(s => ({ ...s, autoMarkPaid: v }))}
                                    />
                                </div>

                                {settings.autoMarkPaid && (
                                    <div className="mt-4 flex gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                                        <p className="text-xs text-muted-foreground">
                                            Com essa opção ativa, lançamentos do Advbox serão marcados como pagos automaticamente. Certifique-se de que os pesos de match estão bem calibrados.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Pesos de Match */}
                            <div className="rounded-xl border border-border bg-card p-6">
                                <div className="mb-1 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10">
                                            <Cog className="h-5 w-5 text-orange-500" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-foreground">Pontuação de Match</h3>
                                            <p className="text-xs text-muted-foreground">Peso de cada critério na conciliação. Total deve somar 100.</p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={handleResetWeights}>
                                        <RotateCcw className="h-3.5 w-3.5" />
                                        Restaurar padrão
                                    </Button>
                                </div>

                                <Separator className="my-4" />

                                <div className="space-y-6">
                                    {([
                                        { key: 'cpf' as const, label: 'CPF / CNPJ', description: 'Comparação exata de documento do pagador com o cliente Advbox.' },
                                        { key: 'name' as const, label: 'Nome', description: 'Correspondência fuzzy entre nome do pagador e nome do cliente.' },
                                        { key: 'email' as const, label: 'E-mail', description: 'Comparação do e-mail do pagador (inclui chave PIX e-mail).' },
                                        { key: 'amount' as const, label: 'Valor', description: 'Comparação do valor da transação com tolerância de 1%.' },
                                    ]).map((item) => (
                                        <div key={item.key} className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <Label className="text-sm font-medium">{item.label}</Label>
                                                    <p className="text-xs text-muted-foreground">{item.description}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        max={100}
                                                        value={weights[item.key]}
                                                        onChange={(e) => setWeights(prev => ({ ...prev, [item.key]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))}
                                                        className="h-8 w-16 text-center text-sm font-mono"
                                                    />
                                                    <span className="text-xs text-muted-foreground">pts</span>
                                                </div>
                                            </div>
                                            <Slider
                                                value={[weights[item.key]]}
                                                onValueChange={([v]) => setWeights(prev => ({ ...prev, [item.key]: v }))}
                                                max={100}
                                                step={5}
                                                className="w-full"
                                            />
                                        </div>
                                    ))}
                                </div>

                                <Separator className="my-6" />

                                <div className="flex items-center justify-between rounded-lg border p-3">
                                    <span className="text-sm font-medium">Total</span>
                                    <div className="flex items-center gap-2">
                                        <span className={cn(
                                            "text-lg font-bold tabular-nums",
                                            isWeightValid ? "text-green-600" : "text-destructive"
                                        )}>
                                            {totalWeight}
                                        </span>
                                        <span className="text-sm text-muted-foreground">/ 100 pts</span>
                                        {isWeightValid ? (
                                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                                        ) : (
                                            <XCircle className="h-4 w-4 text-destructive" />
                                        )}
                                    </div>
                                </div>
                                {!isWeightValid && (
                                    <p className="mt-2 text-xs text-destructive">
                                        A soma dos pesos precisa totalizar exatamente 100 pontos. Atualmente: {totalWeight}.
                                    </p>
                                )}
                            </div>

                            {/* Faixas de confiança */}
                            <div className="rounded-xl border border-border bg-card p-6">
                                <div className="mb-1 flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-foreground">Faixas de Confiança</h3>
                                        <p className="text-xs text-muted-foreground">Score mínimo para cada nível de confiança no matching</p>
                                    </div>
                                </div>

                                <Separator className="my-4" />

                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="h-3 w-3 rounded-full bg-emerald-500" />
                                                <Label className="text-sm font-medium">Alta confiança</Label>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground">≥</span>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    value={thresholds.high}
                                                    onChange={(e) => setThresholds(prev => ({ ...prev, high: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))}
                                                    className="h-8 w-16 text-center text-sm font-mono"
                                                />
                                                <span className="text-xs text-muted-foreground">pts</span>
                                            </div>
                                        </div>
                                        <Slider
                                            value={[thresholds.high]}
                                            onValueChange={([v]) => setThresholds(prev => ({ ...prev, high: Math.max(v, prev.medium + 1) }))}
                                            max={100}
                                            step={5}
                                            className="w-full"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="h-3 w-3 rounded-full bg-amber-500" />
                                                <Label className="text-sm font-medium">Média confiança</Label>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground">≥</span>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    value={thresholds.medium}
                                                    onChange={(e) => setThresholds(prev => ({ ...prev, medium: Math.max(0, Math.min(prev.high - 1, Number(e.target.value) || 0)) }))}
                                                    className="h-8 w-16 text-center text-sm font-mono"
                                                />
                                                <span className="text-xs text-muted-foreground">pts</span>
                                            </div>
                                        </div>
                                        <Slider
                                            value={[thresholds.medium]}
                                            onValueChange={([v]) => setThresholds(prev => ({ ...prev, medium: Math.min(v, prev.high - 1) }))}
                                            max={100}
                                            step={5}
                                            className="w-full"
                                        />
                                    </div>

                                    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
                                        <div className="h-3 w-3 rounded-full bg-red-500" />
                                        <span className="text-sm text-muted-foreground">
                                            Baixa confiança: abaixo de {thresholds.medium} pts
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/20 p-4">
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pré-visualização</h4>
                                    <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full">
                                        <div
                                            className="bg-red-500 transition-all"
                                            style={{ width: `${thresholds.medium}%` }}
                                        />
                                        <div
                                            className="bg-amber-500 transition-all"
                                            style={{ width: `${thresholds.high - thresholds.medium}%` }}
                                        />
                                        <div
                                            className="bg-emerald-500 transition-all"
                                            style={{ width: `${100 - thresholds.high}%` }}
                                        />
                                    </div>
                                    <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                                        <span>0</span>
                                        <span>{thresholds.medium}</span>
                                        <span>{thresholds.high}</span>
                                        <span>100</span>
                                    </div>
                                </div>
                            </div>

                            {/* Notificações */}
                            <div className="rounded-xl border border-border bg-card p-6">
                                <div className="mb-1 flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10">
                                        <Bell className="h-5 w-5 text-violet-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-foreground">Notificações</h3>
                                        <p className="text-xs text-muted-foreground">Controle quais alertas você deseja receber</p>
                                    </div>
                                </div>

                                <Separator className="my-4" />

                                <div className="space-y-5">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">Conciliação efetuada</p>
                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                Receba uma notificação sempre que uma conciliação for confirmada com sucesso.
                                            </p>
                                        </div>
                                        <Switch
                                            checked={settings.notifyReconciliation}
                                            onCheckedChange={(v) => setSettings(s => ({ ...s, notifyReconciliation: v }))}
                                        />
                                    </div>

                                    <Separator />

                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">Receitas e despesas vencendo</p>
                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                Alertas sobre lançamentos financeiros próximos do vencimento ou já vencidos.
                                            </p>
                                        </div>
                                        <Switch
                                            checked={settings.notifyDueTransactions}
                                            onCheckedChange={(v) => setSettings(s => ({ ...s, notifyDueTransactions: v }))}
                                        />
                                    </div>

                                    <Separator />

                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">Notificações diversas</p>
                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                Atualizações do sistema, sincronização de dados, novidades e outros avisos gerais.
                                            </p>
                                        </div>
                                        <Switch
                                            checked={settings.notifyMisc}
                                            onCheckedChange={(v) => setSettings(s => ({ ...s, notifyMisc: v }))}
                                        />
                                    </div>
                                </div>

                                {!settings.notifyReconciliation && !settings.notifyDueTransactions && !settings.notifyMisc && (
                                    <div className="mt-4 flex gap-2.5 rounded-lg border border-zinc-500/20 bg-zinc-500/5 p-3">
                                        <BellOff className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                        <p className="text-xs text-muted-foreground">
                                            Todas as notificações estão desativadas. Você não receberá alertas de nenhuma categoria.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Salvar */}
                            <div className="flex items-center gap-3">
                                <Button onClick={handleSavePreferences} disabled={prefSaving || !isWeightValid} className="gap-2">
                                    {prefSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Salvar preferências
                                </Button>
                                {prefSaved && (
                                    <span className="flex items-center gap-1.5 text-sm text-green-600">
                                        <CheckCircle2 className="h-4 w-4" />
                                        Preferências salvas!
                                    </span>
                                )}
                                {!isWeightValid && (
                                    <span className="text-xs text-destructive">
                                        Corrija a soma dos pesos antes de salvar.
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
        </>
    )
}
