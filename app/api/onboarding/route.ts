import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

        const { companyName, slug } = await req.json()

        if (!companyName || !slug) {
            return NextResponse.json({ error: 'Nome e slug são obrigatórios' }, { status: 400 })
        }

        // Check if slug is already taken
        const existing = await prisma.tenant.findUnique({ where: { slug } })
        if (existing) {
            return NextResponse.json({ error: 'Este identificador já está em uso. Escolha outro.' }, { status: 409 })
        }

        // Check if user already has a tenant
        const existingUser = await prisma.tenantUser.findFirst({ where: { clerkUserId: userId } })
        if (existingUser) {
            return NextResponse.json({ error: 'Você já possui uma empresa cadastrada.' }, { status: 409 })
        }

        // Get user's Clerk email (from the request body or we'll use the userId)
        // Create tenant + owner user in a transaction
        const result = await prisma.$transaction(async (tx) => {
            const tenant = await tx.tenant.create({
                data: {
                    name: companyName,
                    slug,
                    settings: {
                        create: {}, // creates empty settings
                    },
                },
            })

            const tenantUser = await tx.tenantUser.create({
                data: {
                    tenantId: tenant.id,
                    clerkUserId: userId,
                    email: '', // will be updated via webhook
                    role: 'OWNER',
                    joinedAt: new Date(),
                },
            })

            await tx.auditLog.create({
                data: {
                    tenantId: tenant.id,
                    userId,
                    action: 'tenant.created',
                    metadata: { name: companyName, slug },
                },
            })

            return { tenant, tenantUser }
        })

        return NextResponse.json({ success: true, tenantId: result.tenant.id })
    } catch (error) {
        console.error('Onboarding error:', error)
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
    }
}
