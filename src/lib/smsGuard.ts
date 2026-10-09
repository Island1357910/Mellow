import { storage } from '../storage/StorageService.ts'
import { useMellow } from '../store/useMellow.ts'

export type ImmersiveApp = 'offline' | 'jiushi'

const PAUSE_MS = 45 * 60_000
const BAG_PREFIX = 'immersive_'

/** 线下 / 旧世进行中时，暂停短信侧的主动消息（含附近的人生活向短信）。 */
export function isSmsProactivePaused(): boolean {
  const state = useMellow.getState()
  if (state.activeApp === 'offline' || state.activeApp === 'jiushi') return true
  if (state.immersiveUntil > Date.now()) return true
  return false
}

export function touchImmersive(app: ImmersiveApp): void {
  useMellow.setState({
    immersiveUntil: Date.now() + PAUSE_MS,
    immersiveApp: app,
  })
  const phone = useMellow.getState().identities.find((item) => item.id === useMellow.getState().activeIdentityId)
  if (phone) {
    void storage.setBag(phone.namespace, `${BAG_PREFIX}${app}`, { at: Date.now() })
  }
}

export async function syncImmersiveFromBag(namespace: string): Promise<void> {
  const [offline, jiushi] = await Promise.all([
    storage.getBag<{ at: number }>(namespace, `${BAG_PREFIX}offline`),
    storage.getBag<{ at: number }>(namespace, `${BAG_PREFIX}jiushi`),
  ])
  const latest = Math.max(offline?.at ?? 0, jiushi?.at ?? 0)
  if (latest <= 0) return
  const until = latest + PAUSE_MS
  if (until > Date.now()) {
    useMellow.setState({
      immersiveUntil: until,
      immersiveApp: (jiushi?.at ?? 0) >= (offline?.at ?? 0) ? 'jiushi' : 'offline',
    })
  }
}
