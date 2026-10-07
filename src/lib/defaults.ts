import { isTrustedVoiceCache } from '../engine/minimax.ts'
import type { AppSettings, BackupSettings, DecorCard, HomeLayout, PresetMode } from '../types/index.ts'

export const MODE_PRESET_DEFAULTS: Record<PresetMode, string> = {
  sms: 'preset_sms_alive',
  offline: 'preset_offline_scene',
  side: 'preset_side',
  create: 'preset_create_standard',
  table: 'preset_table_host',
  star: 'preset_star_life',
  forum: 'preset_forum_board',
}

export function modePresetId(settings: AppSettings, mode: PresetMode): string {
  return settings.modePresets?.[mode] || MODE_PRESET_DEFAULTS[mode]
}

export const DEFAULT_DECORS: DecorCard[] = [
  { id: 'decor-1-wide-top', page: 1, corner: 'tl', image: '', tilt: -4 },
  { id: 'decor-1-square-top', page: 1, corner: 'tr', image: '', tilt: 6 },
  { id: 'decor-1-square-bottom', page: 1, corner: 'bl', image: '', tilt: -5 },
  { id: 'decor-1-wide-bottom', page: 1, corner: 'br', image: '', tilt: 5 },
  { id: 'decor-2-wide', page: 2, corner: 'tl', image: '', tilt: 0 },
  { id: 'decor-2-slim', page: 2, corner: 'tr', image: '', tilt: 0 },
]

function mergeDecors(saved: DecorCard[] | undefined): DecorCard[] {
  const kept = (saved ?? []).filter((item) => DEFAULT_DECORS.some((decor) => decor.id === item.id))
  const defaults = DEFAULT_DECORS.map((item) => ({ ...item }))
  if (!kept.length) return defaults
  const seen = new Set(kept.map((item) => item.id))
  return [...kept, ...defaults.filter((item) => !seen.has(item.id))]
}

export function defaultHome(): HomeLayout {
  return { page3: false, page4: false, decors: DEFAULT_DECORS.map((item) => ({ ...item })) }
}

export function defaultSettings(activeIdentityId = ''): AppSettings {
  return {
    id: 'global',
    activeIdentityId,
    themeId: 'theme_macaron',
    activePresetId: 'preset_daily',
    modePresets: { ...MODE_PRESET_DEFAULTS },
    fourthWall: false,
    proactive: 'off',
    dnd: false,
    quietHours: false,
    dndStart: '23:00',
    dndEnd: '08:00',
    banner: true,
    sound: false,
    vibration: false,
    activeApiId: '',
    installedApps: [],
    appIcons: {},
    privacy: { enabled: false, hash: '', appLocks: {}, appHashes: {} },
    backup: { enabled: true, intervalHours: 168, lastSavedAt: 0, lastRemindedAt: 0 },
    home: defaultHome(),
    minimax: {
      endpoint: 'https://api.minimax.cn',
      groupId: '',
      encryptedKey: '',
      model: 'speech-02-hd',
      voiceId: 'female-shaonv',
      userVoiceId: 'male-qn-qingse',
      fetchedVoices: [],
      ready: false,
    },
  }
}

function normalizeBackup(raw: Partial<BackupSettings & { intervalDays?: number }> | undefined, base: AppSettings['backup']): AppSettings['backup'] {
  const merged = { ...base, ...raw }
  let intervalHours = merged.intervalHours
  if (!intervalHours && typeof raw?.intervalDays === 'number') intervalHours = raw.intervalDays * 24
  intervalHours = Math.max(1, Math.min(8760, intervalHours || base.intervalHours))
  return { enabled: merged.enabled ?? base.enabled, intervalHours, lastSavedAt: merged.lastSavedAt ?? 0, lastRemindedAt: merged.lastRemindedAt ?? 0 }
}

function normalizePrivacy(privacy: AppSettings['privacy']): AppSettings['privacy'] {
  const appHashes = { ...privacy.appHashes }
  for (const [appId, locked] of Object.entries(privacy.appLocks)) {
    if (locked && !appHashes[appId] && privacy.hash) appHashes[appId] = privacy.hash
  }
  return { ...privacy, appHashes }
}

export function normalizeSettings(raw: Partial<AppSettings> | undefined): AppSettings {
  const base = defaultSettings(raw?.activeIdentityId ?? '')
  const home = raw?.home
  const minimax = raw?.minimax
  return {
    ...base,
    ...raw,
    id: 'global',
    activeIdentityId: raw?.activeIdentityId || base.activeIdentityId,
    modePresets: { ...MODE_PRESET_DEFAULTS, ...raw?.modePresets },
    installedApps: raw?.installedApps ?? [],
    appIcons: raw?.appIcons ?? {},
    privacy: normalizePrivacy({ ...base.privacy, ...raw?.privacy, appLocks: raw?.privacy?.appLocks ?? {}, appHashes: raw?.privacy?.appHashes ?? {} }),
    backup: normalizeBackup(raw?.backup, base.backup),
    home: {
      page3: home?.page3 ?? false,
      page4: home?.page4 ?? false,
      decors: mergeDecors(home?.decors),
    },
    minimax: {
      ...base.minimax,
      ...minimax,
      groupId: minimax?.groupId ?? base.minimax.groupId,
      userVoiceId: minimax?.userVoiceId ?? base.minimax.userVoiceId,
      fetchedVoices: isTrustedVoiceCache(minimax?.fetchedVoices ?? []) ? minimax!.fetchedVoices : [],
    },
  }
}
