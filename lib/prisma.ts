import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const useAccelerate = !!process.env.PRISMA_ACCELERATE_URL

function createPrismaClient(): PrismaClient {
  if (useAccelerate) {
    const { withAccelerate } = require('@prisma/extension-accelerate')
    return new PrismaClient({
      datasourceUrl: process.env.PRISMA_ACCELERATE_URL,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    }).$extends(withAccelerate()) as unknown as PrismaClient
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export { useAccelerate }
