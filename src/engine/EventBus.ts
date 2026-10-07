import { uid } from '../lib/id.ts'
import type { PlayerEvent, PlayerEventType } from '../types/index.ts'

type EventInput = {
  type: PlayerEventType
  app: string
  identityId: string
  query?: string
  duration?: number
  meta?: PlayerEvent['meta']
}

type Listener = (event: PlayerEvent) => void

const listeners = new Set<Listener>()

/** 所有玩家操作从这里过。存储订阅它，界面不直接写事件表。 */
export const eventBus = {
  emit(input: EventInput): PlayerEvent {
    const event: PlayerEvent = {
      id: uid('evt'),
      time: Date.now(),
      type: input.type,
      app: input.app,
      identityId: input.identityId,
      query: input.query,
      duration: input.duration,
      meta: input.meta,
    }
    for (const listener of listeners) listener(event)
    return event
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}
