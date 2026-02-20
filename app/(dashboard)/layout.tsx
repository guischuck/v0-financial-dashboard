import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { userId } = await auth()
    if (!userId) redirect('/login')

    // NOTE: Tenant check via Prisma is skipped until DATABASE_URL is configured.
    // Once the database is set up, uncomment the block below:
    //
    // const { prisma } = await import('@/lib/prisma')
    // const tenantUser = await prisma.tenantUser.findFirst({
    //   where: { clerkUserId: userId },
    // })
    // if (!tenantUser) redirect('/onboarding')

    return <>{children}</>
}
