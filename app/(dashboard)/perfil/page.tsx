'use client'

import { useUser, useClerk } from '@clerk/nextjs'
import {
    User,
    Mail,
    Shield,
    Calendar,
    Key,
    LogOut,
    ExternalLink,
    CheckCircle2,
    Settings,
} from 'lucide-react'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { Header } from '@/components/dashboard/header'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

export default function PerfilPage() {
    const { user } = useUser()
    const { signOut, openUserProfile } = useClerk()

    const initials = [user?.firstName?.[0], user?.lastName?.[0]]
        .filter(Boolean)
        .join('')
        .toUpperCase() || 'U'

    const createdAt = user?.createdAt
        ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(user.createdAt))
        : '—'

    const lastSignIn = user?.lastSignInAt
        ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(
            new Date(user.lastSignInAt)
        )
        : '—'

    return (
        <div className="flex min-h-screen bg-background">
            <AppSidebar />

            <div className="flex-1 pl-16">
                <Header />

                <main className="mx-auto max-w-2xl p-6">
                    {/* Page title */}
                    <div className="mb-6 flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                            <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold text-foreground">Meu Perfil</h1>
                            <p className="text-xs text-muted-foreground">Gerencie suas informações pessoais</p>
                        </div>
                    </div>

                    {/* Profile card */}
                    <div className="rounded-xl border border-border bg-card p-6">
                        {/* Avatar + name */}
                        <div className="flex items-center gap-5">
                            <Avatar className="h-20 w-20">
                                {user?.imageUrl && (
                                    <AvatarImage src={user.imageUrl} alt={user.fullName ?? ''} />
                                )}
                                <AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>

                            <div className="flex-1">
                                <h2 className="text-xl font-bold text-foreground">{user?.fullName ?? '—'}</h2>
                                <p className="text-sm text-muted-foreground">
                                    {user?.primaryEmailAddress?.emailAddress ?? '—'}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {user?.primaryEmailAddress?.verification.status === 'verified' && (
                                        <Badge
                                            variant="outline"
                                            className="gap-1 border-green-500/30 bg-green-500/10 text-green-600 text-xs"
                                        >
                                            <CheckCircle2 className="h-3 w-3" />
                                            E-mail verificado
                                        </Badge>
                                    )}
                                    <Badge variant="outline" className="text-xs text-muted-foreground">
                                        Membro ativo
                                    </Badge>
                                </div>
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 shrink-0"
                                onClick={() => openUserProfile()}
                            >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Editar perfil
                            </Button>
                        </div>

                        <Separator className="my-6" />

                        {/* Info grid */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <InfoRow icon={User} label="Nome completo" value={user?.fullName ?? '—'} />
                            <InfoRow icon={Mail} label="E-mail principal" value={user?.primaryEmailAddress?.emailAddress ?? '—'} />
                            <InfoRow icon={Calendar} label="Membro desde" value={createdAt} />
                            <InfoRow icon={Shield} label="Último acesso" value={lastSignIn} />
                            <InfoRow icon={Key} label="ID do usuário" value={(user?.id?.slice(0, 24) ?? '—') + '...'} mono />
                        </div>

                        <Separator className="my-6" />

                        {/* Actions */}
                        <div className="flex flex-wrap gap-3">
                            <Button variant="outline" className="gap-2" onClick={() => openUserProfile()}>
                                <Settings className="h-4 w-4" />
                                Gerenciar conta
                            </Button>
                            <Button
                                variant="outline"
                                className="gap-2 text-destructive hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
                                onClick={() => signOut({ redirectUrl: '/login' })}
                            >
                                <LogOut className="h-4 w-4" />
                                Sair da conta
                            </Button>
                        </div>
                    </div>

                    <p className="mt-4 text-center text-xs text-muted-foreground">
                        Autenticação gerenciada com segurança pelo{' '}
                        <a
                            href="https://clerk.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                        >
                            Clerk
                        </a>
                        . Suas credenciais nunca são armazenadas diretamente.
                    </p>
                </main>
            </div>
        </div>
    )
}

function InfoRow({
    icon: Icon,
    label,
    value,
    mono = false,
}: {
    icon: React.ElementType
    label: string
    value: string
    mono?: boolean
}) {
    return (
        <div className="flex items-start gap-3 rounded-lg bg-muted/40 px-4 py-3">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p
                    className={`mt-0.5 truncate text-sm font-medium text-foreground ${mono ? 'font-mono text-xs' : ''
                        }`}
                >
                    {value}
                </p>
            </div>
        </div>
    )
}
