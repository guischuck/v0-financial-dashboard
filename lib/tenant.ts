import { auth } from '@clerk/nextjs/server'
import { prisma } from './prisma'
import type { Tenant, TenantUser } from '@prisma/client'

export type TenantWithUser = Tenant & {
    currentUser: TenantUser
}

/**
 * Returns the current tenant and user role for server components/actions.
 * Throws if not authenticated or not a member of any tenant.
 */
export async function getCurrentTenant(): Promise<TenantWithUser> {
    const { userId } = await auth()
    if (!userId) throw new Error('Not authenticated')

    const tenantUser = await prisma.tenantUser.findFirst({
        where: { clerkUserId: userId },
        include: { tenant: true },
        orderBy: { createdAt: 'asc' },
    })

    if (!tenantUser) throw new Error('No tenant found for this user')

    return {
        ...tenantUser.tenant,
        currentUser: tenantUser,
    }
}

/**
 * Returns all tenants the current user belongs to.
 */
export async function getUserTenants() {
    const { userId } = await auth()
    if (!userId) return []

    return prisma.tenantUser.findMany({
        where: { clerkUserId: userId },
        include: { tenant: true },
        orderBy: { createdAt: 'asc' },
    })
}

/**
 * Checks if user has at least the required role in a tenant.
 */
const ROLE_HIERARCHY = { OWNER: 4, ADMIN: 3, MEMBER: 2, VIEWER: 1 }

export function hasPermission(
    userRole: keyof typeof ROLE_HIERARCHY,
    requiredRole: keyof typeof ROLE_HIERARCHY
): boolean {
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}
