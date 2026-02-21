'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'

export interface ReconciliationParams {
  from?: string | null
  to?: string | null
  entryType?: string | null
}

function buildQueryString(params: ReconciliationParams): string {
  const sp = new URLSearchParams()
  if (params.from) sp.set('from', params.from)
  if (params.to) sp.set('to', params.to)
  if (params.entryType) sp.set('entryType', params.entryType)
  return sp.toString()
}

async function fetchReconciliation(params: ReconciliationParams) {
  const qs = buildQueryString(params)
  const res = await fetch(`/api/reconciliation?${qs}`)
  if (!res.ok) throw new Error('Falha ao carregar conciliação')
  return res.json()
}

export function useReconciliation(params: ReconciliationParams, enabled = true) {
  return useQuery({
    queryKey: ['reconciliation', params],
    queryFn: () => fetchReconciliation(params),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useConfirmReconciliation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/reconciliation/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Falha ao confirmar conciliação')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliation'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}

export function useDeleteReconciliation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/reconciliation/confirm?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Falha ao remover conciliação')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliation'] })
    },
  })
}

export function useLinkCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/reconciliation/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Falha ao vincular cliente')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliation'] })
    },
  })
}

export function usePrecomputeReconciliation() {
  return useMutation({
    mutationFn: async (params: ReconciliationParams) => {
      const res = await fetch('/api/reconciliation/precompute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      if (!res.ok) throw new Error('Falha ao pré-computar')
      return res.json()
    },
  })
}

export function useInvalidateReconciliation() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['reconciliation'] })
}
