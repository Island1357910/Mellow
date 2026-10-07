/**
 * API Key 只在这台浏览器里加密。
 * 密钥放在 localStorage，密文放在 IndexedDB。清站点数据后两者一起消失。
 * 这是本地混淆，挡的是随手打开数据库，不是换一台电脑后的攻击者。
 * HTTP 等非安全上下文没有 crypto.subtle，会退回到 XOR 混淆。
 */

const DEVICE_KEY = 'mellow_device_key'
const INSECURE_PREFIX = 'insecure:v1:'

function bytesToB64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function b64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function randomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
    return bytes
  }
  for (let i = 0; i < size; i += 1) bytes[i] = (Math.random() * 256) | 0
  return bytes
}

function subtleAvailable(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined'
}

function deviceKeyMaterial(): Uint8Array {
  let stored = localStorage.getItem(DEVICE_KEY)
  if (!stored) {
    stored = bytesToB64(randomBytes(32))
    localStorage.setItem(DEVICE_KEY, stored)
  }
  return b64ToBytes(stored)
}

function xorBytes(data: Uint8Array, key: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length)
  for (let i = 0; i < data.length; i += 1) out[i] = data[i] ^ key[i % key.length]
  return out
}

let keyPromise: Promise<CryptoKey> | null = null

function deviceKey(): Promise<CryptoKey> {
  if (!subtleAvailable()) {
    return Promise.reject(new Error('当前页面不是 HTTPS，无法使用系统加密'))
  }
  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey('raw', deviceKeyMaterial() as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt'])
  }
  return keyPromise
}

export async function encryptSecret(plain: string): Promise<string> {
  const encoded = new TextEncoder().encode(plain)
  if (!subtleAvailable()) {
    return INSECURE_PREFIX + bytesToB64(xorBytes(encoded, deviceKeyMaterial()))
  }
  const iv = randomBytes(12)
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, await deviceKey(), encoded)
  return `${bytesToB64(iv)}.${bytesToB64(new Uint8Array(cipher))}`
}

export async function decryptSecret(payload: string): Promise<string> {
  if (payload.startsWith(INSECURE_PREFIX)) {
    const plain = xorBytes(b64ToBytes(payload.slice(INSECURE_PREFIX.length)), deviceKeyMaterial())
    return new TextDecoder().decode(plain)
  }
  if (!subtleAvailable()) {
    throw new Error('当前页面不是 HTTPS，读不出已保存的密钥，请重新粘贴')
  }
  const [ivPart, dataPart] = payload.split('.')
  if (!ivPart || !dataPart) throw new Error('密钥格式坏了')
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(ivPart) as BufferSource },
    await deviceKey(),
    b64ToBytes(dataPart) as BufferSource,
  )
  return new TextDecoder().decode(plain)
}
