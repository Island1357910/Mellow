/**
 * API Key 只在这台浏览器里加密。
 * 密钥放在 localStorage，密文放在 IndexedDB。清站点数据后两者一起消失。
 * 这是本地混淆，挡的是随手打开数据库，不是换一台电脑后的攻击者。
 */

const DEVICE_KEY = 'mellow_device_key'

function bytesToB64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function b64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

let keyPromise: Promise<CryptoKey> | null = null

function deviceKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    keyPromise = (async () => {
      let stored = localStorage.getItem(DEVICE_KEY)
      if (!stored) {
        stored = bytesToB64(crypto.getRandomValues(new Uint8Array(32)))
        localStorage.setItem(DEVICE_KEY, stored)
      }
      return crypto.subtle.importKey('raw', b64ToBytes(stored), 'AES-GCM', false, ['encrypt', 'decrypt'])
    })()
  }
  return keyPromise
}

export async function encryptSecret(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plain)
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await deviceKey(), encoded)
  return `${bytesToB64(iv)}.${bytesToB64(new Uint8Array(cipher))}`
}

export async function decryptSecret(payload: string): Promise<string> {
  const [ivPart, dataPart] = payload.split('.')
  if (!ivPart || !dataPart) throw new Error('密钥格式坏了')
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(ivPart) },
    await deviceKey(),
    b64ToBytes(dataPart),
  )
  return new TextDecoder().decode(plain)
}
