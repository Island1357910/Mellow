import { BUILD_ID } from './buildInfo.ts'

const STORED_BUILD_KEY = 'mellow_build_id'
const RELOAD_ONCE_KEY = 'mellow_reload_once'

function versionUrl(): string {
  const base = import.meta.env.BASE_URL || '/'
  const root = base.endsWith('/') ? base : `${base}/`
  return `${root}version.json`
}

/** 手机浏览器可能缓存旧 JS；对照线上 version.json，不一致就自动刷新一次。 */
export async function ensureFreshClient(): Promise<void> {
  if (sessionStorage.getItem(RELOAD_ONCE_KEY)) {
    sessionStorage.removeItem(RELOAD_ONCE_KEY)
    return
  }

  try {
    const response = await fetch(`${versionUrl()}?t=${Date.now()}`, { cache: 'no-store' })
    if (!response.ok) return
    const remote = (await response.json()) as { buildId?: string }
    if (!remote.buildId || remote.buildId === BUILD_ID) return
    sessionStorage.setItem(RELOAD_ONCE_KEY, '1')
    window.location.reload()
    await new Promise<void>(() => undefined)
  } catch {
    // 离线或本地开发没有 version.json 时跳过
  }
}

export function storedBuildId(): string | null {
  try {
    return localStorage.getItem(STORED_BUILD_KEY)
  } catch {
    return null
  }
}

export function markBuildCurrent(): void {
  try {
    localStorage.setItem(STORED_BUILD_KEY, BUILD_ID)
  } catch {
    // localStorage 被禁用时跳过
  }
}

export function needsDataUpgrade(): boolean {
  return storedBuildId() !== BUILD_ID
}

/** 从后台切回时再看一眼有没有新版本。 */
export function watchForRemoteUpgrade(): () => void {
  const onVisible = () => {
    if (document.visibilityState === 'visible') void ensureFreshClient()
  }
  document.addEventListener('visibilitychange', onVisible)
  return () => document.removeEventListener('visibilitychange', onVisible)
}
