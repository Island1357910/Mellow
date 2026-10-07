import { AIError } from './AIAdapter.ts'
import type { MinimaxSettings, MinimaxVoice } from '../types/index.ts'

export const MINIMAX_MODELS = [
  'speech-2.8-hd',
  'speech-2.8-turbo',
  'speech-2.6-hd',
  'speech-2.6-turbo',
  'speech-02-hd',
  'speech-02-turbo',
  'speech-01-hd',
  'speech-01-turbo',
]

/** 未拉取平台音色时的兜底名单 */
export const BUILTIN_VOICES: MinimaxVoice[] = [
  { id: 'female-shaonv', name: '少女' },
  { id: 'female-yujie', name: '御姐' },
  { id: 'female-chengshu', name: '成熟女性' },
  { id: 'female-tianmei', name: '甜美女性' },
  { id: 'male-qn-qingse', name: '青涩青年' },
  { id: 'male-qn-jingying', name: '精英青年' },
  { id: 'male-qn-badao', name: '霸道青年' },
  { id: 'male-qn-daxuesheng', name: '青年大学生' },
  { id: 'presenter_male', name: '男性主持人' },
  { id: 'presenter_female', name: '女性主持人' },
  { id: 'Chinese (Mandarin)_Reliable_Executive', name: '沉稳高管' },
]

export const MINIMAX_VOICES = BUILTIN_VOICES.map((item) => item.id)

/** 平台系统音色通常 300+；低于此数多半是旧版内置名单误存进缓存 */
export const TRUSTED_VOICE_MIN = 50

export function normalizeMinimaxKey(raw: string): string {
  let key = raw.trim()
  if (/^bearer\s+/i.test(key)) key = key.replace(/^bearer\s+/i, '').trim()
  return key.replace(/^['"]|['"]$/g, '')
}

export function isLikelyMinimaxKey(key: string): boolean {
  const normalized = normalizeMinimaxKey(key)
  return normalized.startsWith('eyJ') && normalized.includes('.')
}

export function isTrustedVoiceCache(voices: MinimaxVoice[]): boolean {
  return voices.length >= TRUSTED_VOICE_MIN
}

type VoiceRow = {
  voice_id?: string
  voice_name?: string
  name?: string
  description?: string[] | string
}

type BaseResp = { status_code?: number; status_msg?: string }

function joinUrl(endpoint: string, suffix: string): string {
  const base = endpoint.replace(/\/+$/, '')
  const path = suffix.startsWith('/') ? suffix : `/${suffix}`
  if (base.endsWith(path)) return base
  return `${base}${path}`
}

function apiUrl(endpoint: string, path: string, groupId = ''): string {
  const url = joinUrl(endpoint || 'https://api.minimax.cn', path)
  return groupId.trim() ? `${url}?GroupId=${encodeURIComponent(groupId.trim())}` : url
}

function authHeaders(key: string): Record<string, string> {
  const token = normalizeMinimaxKey(key)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function readMinimaxError(response: Response): Promise<string> {
  const text = await response.text().catch(() => '')
  try {
    const data = JSON.parse(text) as { base_resp?: BaseResp; message?: string }
    if (data.base_resp?.status_msg?.trim()) return data.base_resp.status_msg.trim()
    if (typeof data.message === 'string' && data.message.trim()) return data.message.trim()
  } catch {
    /* 非 JSON */
  }
  return text.trim() || `HTTP ${response.status}`
}

function readBaseResp(data: { base_resp?: BaseResp }): void {
  const code = data.base_resp?.status_code
  if (code !== undefined && code !== 0) {
    throw new AIError(data.base_resp?.status_msg?.trim() || 'MiniMax 接口返回错误。', 'api')
  }
}

function voiceLabelFromRow(row: VoiceRow, prefix?: string): string {
  const raw = row.voice_name ?? row.name
  if (raw?.trim()) return prefix ? `${prefix} · ${raw.trim()}` : raw.trim()
  const desc = Array.isArray(row.description) ? row.description[0] : row.description
  if (typeof desc === 'string' && desc.trim()) {
    const short = desc.trim().slice(0, 28)
    return prefix ? `${prefix} · ${short}` : short
  }
  return row.voice_id ?? ''
}

function parseVoicePayload(data: {
  system_voice?: VoiceRow[]
  voice_cloning?: VoiceRow[]
  voice_generation?: VoiceRow[]
  voices?: VoiceRow[]
  data?: { voices?: VoiceRow[] }
}): MinimaxVoice[] {
  const rows: MinimaxVoice[] = []
  const push = (list: VoiceRow[] | undefined, prefix?: string) => {
    for (const row of list ?? []) {
      const id = row.voice_id?.trim()
      if (!id) continue
      rows.push({ id, name: voiceLabelFromRow(row, prefix) || id })
    }
  }
  push(data.system_voice)
  push(data.voice_cloning, '克隆')
  push(data.voice_generation, '生成')
  push(data.voices)
  push(data.data?.voices)
  const unique = new Map<string, MinimaxVoice>()
  for (const row of rows) unique.set(row.id, row)
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
}

export async function listMinimaxModels(endpoint: string, key: string, groupId = ''): Promise<string[]> {
  if (!key.trim()) throw new AIError('先写 MiniMax 密钥。', 'config')
  try {
    const response = await fetch(apiUrl(endpoint, '/v1/models', groupId), {
      headers: authHeaders(key),
      signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) return MINIMAX_MODELS
    const data = (await response.json()) as { data?: Array<{ id?: string }> }
    const ids = (data.data ?? []).map((row) => row.id).filter((id): id is string => Boolean(id))
    return ids.length > 0 ? ids : MINIMAX_MODELS
  } catch {
    return MINIMAX_MODELS
  }
}

/** 拉取平台音色（官方接口 POST /v1/get_voice，通常 300+ 条系统音色） */
export async function listMinimaxVoices(endpoint: string, key: string, _groupId = ''): Promise<MinimaxVoice[]> {
  const token = normalizeMinimaxKey(key)
  if (!token) throw new AIError('先写 MiniMax 密钥。', 'config')
  if (!isLikelyMinimaxKey(token)) throw new AIError('密钥格式不对，请粘贴 eyJ 开头的 API Key。', 'config')
  const response = await fetch(joinUrl(endpoint || 'https://api.minimax.cn', '/v1/get_voice'), {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ voice_type: 'all' }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new AIError(await readMinimaxError(response), 'api')
  const data = (await response.json()) as Parameters<typeof parseVoicePayload>[0] & { base_resp?: BaseResp }
  readBaseResp(data)
  const voices = parseVoicePayload(data)
  if (voices.length === 0) throw new AIError('接口没有返回音色，请检查密钥是否有效。', 'api')
  return voices
}

export function voiceOptions(settings: MinimaxSettings): MinimaxVoice[] {
  return settings.fetchedVoices.length > 0 ? settings.fetchedVoices : BUILTIN_VOICES
}

export function voiceLabel(voices: MinimaxVoice[], id: string): string {
  return voices.find((item) => item.id === id)?.name ?? id
}

export function resolveCharacterVoiceId(character: { voiceId?: string | null } | undefined, settings: MinimaxSettings): string {
  const picked = character?.voiceId?.trim()
  if (picked) return picked
  return settings.voiceId?.trim() || 'female-shaonv'
}

/** 返回可播放的 object URL。失败时抛出中文错误。 */
export async function minimaxSpeak(settings: MinimaxSettings, key: string, text: string, voiceId?: string): Promise<string> {
  if (!settings.ready || !settings.model) throw new AIError('MiniMax 还没拉取并保存。', 'config')
  const token = normalizeMinimaxKey(key)
  if (!token) throw new AIError('没有 MiniMax 密钥。', 'config')
  if (!isLikelyMinimaxKey(token)) throw new AIError('密钥格式不对，请重新粘贴 eyJ 开头的 API Key。', 'config')
  const body = {
    model: settings.model,
    text: text.slice(0, 400),
    stream: false,
    voice_setting: { voice_id: voiceId || settings.voiceId || 'female-shaonv', speed: 1, vol: 1, pitch: 0 },
    audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1 },
  }
  const response = await fetch(apiUrl(settings.endpoint || 'https://api.minimax.cn', '/v1/t2a_v2', settings.groupId), {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  })
  if (!response.ok) throw new AIError(await readMinimaxError(response), 'api')
  const data = (await response.json()) as { data?: { audio?: string }; base_resp?: BaseResp }
  readBaseResp(data)
  const audio = data.data?.audio ?? ''
  if (!audio) throw new AIError('语音接口没有返回音频。', 'api')
  if (audio.startsWith('http')) return audio
  const bytes = new Uint8Array(audio.length / 2)
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(audio.slice(i * 2, i * 2 + 2), 16)
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }))
}
