import { decryptSecret, encryptSecret } from '../storage/crypto.ts'
export const NETEASE_ACCOUNT_API = 'https://mellow-music-cloud-20261031.basicheart1.chatgpt.site/api/account'
export interface NeteaseUser { id: string; name: string }
interface SavedAccount { token: string; user: NeteaseUser }
const key = (namespace: string) => 'mellow_netease_account:' + namespace
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
  const response = await fetch(NETEASE_ACCOUNT_API, {
    method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(35_000),
    headers: { 'Content-Type': 'application/json', ...(account ? { Authorization: 'Bearer ' + account.token } : {}) },
    body: JSON.stringify({ ...input, action }),
  })
  const data = await response.json() as T & { error?: string }
  if (!response.ok) {
    if (response.status === 401 && (await readNeteaseAccount(namespace))?.token === account?.token) forgetNeteaseAccount(namespace)
    throw new NeteaseApiError(data.error || '账号服务暂时无法连接', response.status)
  }
  if (account && (await readNeteaseAccount(namespace))?.token !== account.token) throw Error('账号连接已变化，请重新操作')
  return data
}
export async function resolveNeteaseSong(namespace: string, id: string) {
  return neteaseAccountCall<{ src: string; lyrics: string; trial: boolean }>(namespace, 'song', { id })
}
