'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'

async function fetchAccounts() {
  const res = await fetch('/api/pluggy/accounts')
  if (!res.ok) throw new Error('Falha ao carregar contas')
  const data = await res.json()
  return data.accounts ?? []
}

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: fetchAccounts,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

export function useInvalidateAccounts() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['accounts'] })
}
