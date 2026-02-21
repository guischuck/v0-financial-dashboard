'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'

export interface TransactionParams {
  accountId?: string | null
  from?: string | null
  to?: string | null
  q?: string | null
  page?: number
  pageSize?: number
}

function buildQueryString(params: TransactionParams): string {
  const sp = new URLSearchParams()
  if (params.accountId) sp.set('accountId', params.accountId)
  if (params.from) sp.set('from', params.from)
  if (params.to) sp.set('to', params.to)
  if (params.q) sp.set('q', params.q)
  if (params.page) sp.set('page', String(params.page))
  if (params.pageSize) sp.set('pageSize', String(params.pageSize))
  return sp.toString()
}

async function fetchTransactions(params: TransactionParams) {
  const qs = buildQueryString(params)
  const res = await fetch(`/api/pluggy/transactions?${qs}`)
  if (!res.ok) throw new Error('Falha ao carregar transações')
  return res.json()
}

export function useTransactions(params: TransactionParams, enabled = true) {
  return useQuery({
    queryKey: ['transactions', params],
    queryFn: () => fetchTransactions(params),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/pluggy/transactions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Falha ao excluir transação')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}

export function useToggleIgnored() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ignored }: { id: string; ignored: boolean }) => {
      const res = await fetch(`/api/pluggy/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ignored }),
      })
      if (!res.ok) throw new Error('Falha ao atualizar transação')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}

export function useInvalidateTransactions() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['transactions'] })
}
