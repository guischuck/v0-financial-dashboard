'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

async function fetchNotifications(unread = false, limit = 30) {
  const sp = new URLSearchParams()
  if (unread) sp.set('unread', 'true')
  sp.set('limit', String(limit))
  const res = await fetch(`/api/notifications?${sp}`)
  if (!res.ok) throw new Error('Falha ao carregar notificações')
  return res.json()
}

export function useNotifications(unread = false, limit = 30) {
  return useQuery({
    queryKey: ['notifications', { unread, limit }],
    queryFn: () => fetchNotifications(unread, limit),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('Falha ao marcar como lida')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications/read-all', { method: 'POST' })
      if (!res.ok) throw new Error('Falha ao marcar todas como lidas')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
