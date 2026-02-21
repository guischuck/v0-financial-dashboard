import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCached, setCached } from '@/lib/redis'

export interface AuthContext {
  userId: string
  tenantId: string
  tenantUserId: string
  role: string
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const { userId } = await auth()
  if (!userId) return null

  const tenantUser = await prisma.tenantUser.findFirst({
    where: { clerkUserId: userId },
    select: { id: true, tenantId: true, role: true },
  })
  if (!tenantUser) return null

  return {
    userId,
    tenantId: tenantUser.tenantId,
    tenantUserId: tenantUser.id,
    role: tenantUser.role,
  }
}

export function unauthorized() {
  return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
}

export function notFound(msg = 'Não encontrado') {
  return NextResponse.json({ error: msg }, { status: 404 })
}

export function serverError(msg = 'Erro interno') {
  return NextResponse.json({ error: msg }, { status: 500 })
}

export function cached(data: unknown, ttl: number, hit: boolean) {
  return NextResponse.json(data, {
    headers: {
      'X-Cache': hit ? 'HIT' : 'MISS',
      'Cache-Control': `private, max-age=${ttl}, stale-while-revalidate=${Math.round(ttl / 2)}`,
    },
  })
}

export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<{ data: T; hit: boolean }> {
  const cachedData = await getCached<T>(key)
  if (cachedData !== null) {
    return { data: cachedData, hit: true }
  }

  const data = await fetcher()
  await setCached(key, data, ttlSeconds)
  return { data, hit: false }
}
