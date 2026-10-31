import { decryptSecret, encryptSecret } from '../storage/crypto.ts'
import { directAccountAction, neteaseDirectAvailable } from './neteaseDirect.ts'
import { AccountError } from './neteaseProtocol.ts'
const originalAccountApi = 'https://mellow-music-cloud-20261031.basicheart1.chatgpt.site/api/account'
const defaultAccountApi = 'https://mellow-account-kkcpvjjpdj.cn-hangzhou.fcapp.run/api/account'
const configuredAccountApi = import.meta.env?.VITE_NETEASE_ACCOUNT_API?.trim()
export const NETEASE_ACCOUNT_API = configuredAccountApi || defaultAccountApi
if (configuredAccountApi) {
  const url = new URL(configuredAccountApi)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw Error('网易云账号接口必须使用不含账号密码、查询参数和片段的 HTTPS 地址')
}
export interface NeteaseUser { id: string; name: string }
interface SavedAccount { token: string; user: NeteaseUser }
// Changing the operator's backend must never forward an existing login session to a different endpoint.
const key = (namespace: string) => 'mellow_netease_account:' + namespace + (getNeteaseRoute(namespace) === 'direct' || NETEASE_ACCOUNT_API === originalAccountApi ? '' : ':' + encodeURIComponent(NETEASE_ACCOUNT_API))
export type NeteaseRoute = 'direct' | 'cloud'
export function getNeteaseRoute(namespace: string): NeteaseRoute {
  const saved = localStorage.getItem('mellow_netease_route:' + namespace)
  return saved === 'direct' || saved === 'cloud' ? saved : neteaseDirectAvailable() ? 'direct' : 'cloud'
}
export function setNeteaseRoute(namespace: string, route: NeteaseRoute) { localStorage.setItem('mellow_netease_route:' + namespace, route) }
export function accountSupported() { return typeof window !== 'undefined' && window.isSecureContext && Boolean(crypto.subtle) }
export async function readNeteaseAccount(namespace: string): Promise<SavedAccount | null> {
  if (!accountSupported()) return null
  const value = localStorage.getItem(key(namespace))
  if (!value) return null
  try {
    const data = JSON.parse(await decryptSecret(value)) as SavedAccount
    return typeof data.token === 'string' && data.user?.id && data.user?.name ? data : null
  } catch { return null }
}
export async function saveNeteaseAccount(namespace: string, account: SavedAccount) {
  if (!accountSupported()) throw Error('账号登录需要 APK 或安全的 HTTPS 页面')
  localStorage.setItem(key(namespace), await encryptSecret(JSON.stringify(account)))
}
export function forgetNeteaseAccount(namespace: string) { localStorage.removeItem(key(namespace)) }
export class NeteaseApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}
export async function neteaseAccountCall<T>(namespace: string, action: string, input: Record<string, unknown> = {}): Promise<T> {
  if (!accountSupported()) throw Error('账号登录请使用 APK 或安全的 HTTPS 页面')
  const requiresSession = !['qr_start', 'qr_check'].includes(action)
  const account = requiresSession ? await readNeteaseAccount(namespace) : null
  if (requiresSession && !account) throw new NeteaseApiError('请先连接网易云账号', 401)
  let data: T
  const route = getNeteaseRoute(namespace)
  try {
    if (route === 'direct') {
      if (!neteaseDirectAvailable()) throw new NeteaseApiError('直连需要新版 Android APK，请更新安装包或手动选择云端连接', 400)
      data = await directAccountAction(action, input, account?.token ?? '') as T
    } else {
      const response = await fetch(NETEASE_ACCOUNT_API, {
    method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(35_000),
    headers: { 'Content-Type': 'application/json', ...(account ? { Authorization: 'Bearer ' + account.token } : {}) },
    body: JSON.stringify({ ...input, action }),
  })
      const result = await response.json() as T & { error?: string }
      if (!response.ok) throw new NeteaseApiError(result.error || '账号服务暂时无法连接', response.status)
      data = result
    }
  } catch (e) {
    const status = e instanceof NeteaseApiError || e instanceof AccountError ? e.status : 502
    if (status === 401 && (await readNeteaseAccount(namespace))?.token === account?.token) forgetNeteaseAccount(namespace)
    if (e instanceof NeteaseApiError || e instanceof AccountError) throw new NeteaseApiError(e.message, status)
    throw new NeteaseApiError(route === 'direct' ? '无法直连网易云，请检查网络或稍后重试' : '无法连接网易云登录接口，请检查网络或稍后重试；网页请使用 HTTPS 地址', status)
  }
  if (account && (await readNeteaseAccount(namespace))?.token !== account.token) throw Error('账号连接已变化，请重新操作')
  return data
}
export async function resolveNeteaseSong(namespace: string, id: string) {
  return neteaseAccountCall<{ src: string; lyrics: string; trial: boolean }>(namespace, 'song', { id })
}
