import type { Identity } from '../types/index.ts'

/**
 * App 内手动选择 > 该 App 的默认身份 > 这台手机的总身份。
 * 手动选择写在当前总身份的 perAppOverride 上，不把整台手机换掉。
 */
export function resolveIdentityId(phone: Identity, appId: string, identities: Identity[]): string {
  const manual = phone.perAppOverride[appId]
  if (manual && identities.some((item) => item.id === manual)) return manual
  const fallback = phone.defaultForApps[appId]
  if (fallback && identities.some((item) => item.id === fallback)) return fallback
  return phone.id
}

export function findIdentity(identities: Identity[], id: string): Identity {
  const found = identities.find((item) => item.id === id)
  if (!found) throw new Error('身份不在这台手机上')
  return found
}
