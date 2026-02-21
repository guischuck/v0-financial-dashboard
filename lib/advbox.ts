import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'

const DEFAULT_BASE_URL = 'https://app.advbox.com.br/api/v1'

export interface AdvboxConfig {
  apiKey: string
  baseUrl: string
  tenantId: string
}

/**
 * Obtém a configuração do Advbox para o tenant do usuário (Clerk userId).
 * Retorna null se não houver chave configurada.
 */
export async function getAdvboxConfig(clerkUserId: string): Promise<AdvboxConfig | null> {
  const tenantUser = await prisma.tenantUser.findFirst({
    where: { clerkUserId: clerkUserId },
    include: { tenant: { include: { settings: true } } },
  })

  const enc = tenantUser?.tenant?.settings?.advboxApiKeyEnc
  if (!enc) return null

  const apiKey = decrypt(enc)
  const baseUrl = tenantUser.tenant.settings?.advboxApiUrl ?? DEFAULT_BASE_URL
  return { apiKey, baseUrl, tenantId: tenantUser.tenantId }
}

export function advboxHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'HonorariosPay/1.0',
  }
}
