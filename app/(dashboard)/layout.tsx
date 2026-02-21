import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { SharedDataProvider } from '@/lib/use-shared-data'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { Header } from '@/components/dashboard/header'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { userId } = await auth()
    if (!userId) redirect('/login')

    const tenantUser = await prisma.tenantUser.findFirst({
        where: { clerkUserId: userId },
    })
    if (!tenantUser) redirect('/onboarding')

    return (
        <SharedDataProvider>
            <div className="flex min-h-screen bg-background">
                <AppSidebar />
                <div className="flex-1 pl-16">
                    <Header />
                    {children}
                </div>
            </div>
        </SharedDataProvider>
    )
}
