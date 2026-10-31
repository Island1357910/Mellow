import { Capacitor, registerPlugin } from '@capacitor/core'
import { AccountError, accountAction, cleanCookie, weapi } from './neteaseProtocol.ts'
interface DirectBridge {
  request(options: { path: string; body: string; cookie: string }): Promise<{ status: number; data: Record<string, unknown>; setCookie: string }>
}
const bridge = registerPlugin<DirectBridge>('NeteaseDirect')
export function neteaseDirectAvailable() { return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('NeteaseDirect') }
export async function directAccountAction(action: string, input: Record<string, unknown>, session: string, transport: DirectBridge = bridge) {
  const cookie = session ? cleanCookie(atob(session)) : ''
  return accountAction(action, input, cookie, async (path, data, auth = '') => {
    const body = (await weapi({ ...data, csrf_token: auth.match(/(?:^|;\s*)__csrf=([^;]+)/)?.[1] ?? '' })).toString()
    const result = await transport.request({ path: path.replace(/^\/api\//, '/weapi/'), body, cookie: auth })
    if (result.status < 200 || result.status >= 300) throw new AccountError('网易云暂时无法连接，请稍后重试', 502)
    const pairs: string[] = []
    for (const match of (result.setCookie ?? '').matchAll(/(?:^|,\s*)(MUSIC_U|__csrf|NMTID)=([^;,\r\n]+)/g)) pairs.push(match[1] + '=' + match[2])
    return { data: result.data, cookie: cleanCookie(pairs.join('; ')) }
  })
}
