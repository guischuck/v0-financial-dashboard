import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

        const params = await context.params
        const id = params?.id ?? null
        if (!id) return NextResponse.json({ error: 'ID da conta ausente' }, { status: 400 })

        let body: { name?: string; customName?: string } = {}
        try {
            body = await req.json()
        } catch {
            return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
        }
        const nameValue = typeof body.name === 'string' ? body.name.trim() : typeof body.customName === 'string' ? body.customName.trim() : null
        const customName = nameValue === '' ? null : nameValue

        const tenantUser = await prisma.tenantUser.findFirst({
            where: { clerkUserId: userId },
        })
        if (!tenantUser) return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })

        const account = await prisma.pluggyAccount.findFirst({
            where: { id, tenantId: tenantUser.tenantId },
        })
        if (!account) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })

        // Atualiza via raw para não depender do Prisma Client em cache (customName)
        await prisma.$executeRaw`
            UPDATE pluggy_accounts SET custom_name = ${customName}, updated_at = NOW() WHERE id = ${id}
        `

        return NextResponse.json({
            account: { ...account, customName, updatedAt: new Date() },
        })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido'
        console.error('PATCH /api/pluggy/accounts/[id] error:', error)
        return NextResponse.json(
            { error: process.env.NODE_ENV === 'development' ? message : 'Erro ao atualizar nome' },
            { status: 500 }
        )
    }
}
