'use client'

import { useAccounts, useInvalidateAccounts } from '@/lib/hooks/use-accounts'
import { useSettings, useInvalidateSettings } from '@/lib/hooks/use-settings'
import { QueryProvider } from '@/lib/query-provider'

/**
 * Compatibility wrapper: delegates to React Query hooks internally.
 * Maintains the same API as the original SharedDataProvider for gradual migration.
 */
export function SharedDataProvider({ children }: { children: React.ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>
}

export function useSharedAccounts() {
  const { data, isLoading, error } = useAccounts()
  return {
    data: data ?? null,
    loading: isLoading,
    error: error?.message ?? null,
  }
}

export function useSharedSettings() {
  const { data, isLoading, error } = useSettings()
  return {
    data: data ?? null,
    loading: isLoading,
    error: error?.message ?? null,
  }
}

export function useRefreshSharedData() {
  const invalidateAccounts = useInvalidateAccounts()
  const invalidateSettings = useInvalidateSettings()
  return {
    refreshAccounts: invalidateAccounts,
    refreshSettings: invalidateSettings,
  }
}

export function deduplicatedFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, init)
}
