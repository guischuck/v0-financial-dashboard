'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

async function fetchSettings() {
  const res = await fetch('/api/settings')
  if (!res.ok) throw new Error('Falha ao carregar configurações')
  return res.json()
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Falha ao salvar configurações')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })
}

export function useInvalidateSettings() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['settings'] })
}
