export async function hashSecret(secret: string): Promise<string> {
  const data = new TextEncoder().encode(`mellow-lock:${secret}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(digest)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export async function sameSecret(secret: string, hash: string): Promise<boolean> {
  if (!hash) return false
  return (await hashSecret(secret)) === hash
}
