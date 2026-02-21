type EventCallback = (event: SSEEvent) => void

export interface SSEEvent {
  type: string
  [key: string]: unknown
}

const subscribers = new Map<string, Set<EventCallback>>()

export function subscribe(tenantId: string, callback: EventCallback): () => void {
  if (!subscribers.has(tenantId)) {
    subscribers.set(tenantId, new Set())
  }
  subscribers.get(tenantId)!.add(callback)

  return () => {
    const subs = subscribers.get(tenantId)
    if (subs) {
      subs.delete(callback)
      if (subs.size === 0) subscribers.delete(tenantId)
    }
  }
}

export function publishEvent(tenantId: string, event: SSEEvent): void {
  const subs = subscribers.get(tenantId)
  if (subs) {
    for (const cb of subs) {
      try { cb(event) } catch {}
    }
  }
}
