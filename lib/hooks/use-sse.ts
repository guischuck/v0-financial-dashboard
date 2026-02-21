'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

interface SSEEvent {
  type: string
  [key: string]: unknown
}

const QUERY_INVALIDATION_MAP: Record<string, string[][]> = {
  sync_complete: [['accounts'], ['transactions'], ['reconciliation']],
  reconciliation_ready: [['reconciliation']],
  sync: [['accounts'], ['transactions']],
  notification: [['notifications']],
}

export function useSSE() {
  const queryClient = useQueryClient()
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = useRef(0)

  useEffect(() => {
    function connect() {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }

      const es = new EventSource('/api/events')
      eventSourceRef.current = es

      es.onopen = () => {
        retryCountRef.current = 0
      }

      es.onmessage = (event) => {
        try {
          const data: SSEEvent = JSON.parse(event.data)

          if (data.type === 'connected') return

          const queryKeys = QUERY_INVALIDATION_MAP[data.type]
          if (queryKeys) {
            for (const key of queryKeys) {
              queryClient.invalidateQueries({ queryKey: key })
            }
          }
        } catch {
          // ignore parse errors
        }
      }

      es.onerror = () => {
        es.close()
        eventSourceRef.current = null

        const delay = Math.min(1000 * 2 ** retryCountRef.current, 30_000)
        retryCountRef.current++

        reconnectTimeoutRef.current = setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }
  }, [queryClient])
}
