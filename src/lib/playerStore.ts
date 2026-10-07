import { create } from 'zustand'
import { storage } from '../storage/StorageService.ts'

export type PlayerStyle = 'vinyl' | 'cd' | 'minimal'
export type RepeatMode = 'one' | 'all' | 'shuffle'

export type Track = {
  id: string
  name: string
  artist?: string
  /** http(s) 链接，或 bag:键名 指向本地导入的音频 */
  src?: string
  /** 没有音频时用的合成音高 */
  tone?: number
}

export type PlayerConfig = {
  style: PlayerStyle
  card: string
  disc: string
  tracks: Track[]
  repeatMode: RepeatMode
}

export const BUILTIN_TRACKS: Track[] = [
  { id: 'song-still-water', name: 'Still Water', artist: '半糖', src: 'https://drive-cdn.mujian.me/17/6d10636b-9932-4011-80cd-da0b0bf279a2_Still%20Water.mp3' },
  { id: 'song-late-night', name: 'Late Night Residue', artist: '半糖', src: 'https://drive-cdn.mujian.me/17/2a9136dc-5d60-4512-91a6-1659b520c4ca_Late%20Night%20Residue.mp3' },
  { id: 'song-ledger', name: 'The Ledger', artist: '半糖', src: 'https://drive-cdn.mujian.me/17/ec895dcb-ceee-4967-8e1d-4e1046b9c746_The%20Ledger.mp3' },
  { id: 'song-half-cup', name: 'Half A Cup', artist: '半糖', src: 'https://drive-cdn.mujian.me/17/7d3f328c-0666-479b-8d80-a5e4c5ac5226_Half%20A%20Cup.mp3' },
  { id: 'song-white-jade', name: 'White Jade', artist: '半糖', src: 'https://drive-cdn.mujian.me/17/86220b2f-2002-4195-b638-5150c08ca1ad_White%20Jade.mp3' },
  { id: 'song-one-degree', name: 'One Degree', artist: '半糖', src: 'https://drive-cdn.mujian.me/17/bd45774b-dd0d-4064-913f-98b9e80ba528_One%20Degree.mp3' },
  { id: 'song-room-after', name: 'THE ROOM AFTER', artist: '半糖', src: 'https://drive-cdn.mujian.me/17/1b15eb32-01a8-4b68-b38c-0822eafa065e_THE%20ROOM%20AFTER.mp3' },
  { id: 'song-north-window', name: 'North Window', artist: '半糖', src: 'https://drive-cdn.mujian.me/17/be5d9c29-b768-4690-baf5-bb53bfbf874a_North%20Window.mp3' },
  { id: 'song-sixth-cube', name: 'The Sixth Cube', artist: '半糖', src: 'https://drive-cdn.mujian.me/17/11a07fee-b976-4392-945f-574453aec7c9_The%20Sixth%20Cube.mp3' },
  { id: 'song-proximity', name: 'Proximity Alert', artist: '半糖', src: 'https://drive-cdn.mujian.me/17/c64ac42d-6c32-45a3-8bba-9c693bb7c486_Proximity%20Alert.mp3' },
  { id: 'song-brain-static', name: 'Brain Static', artist: '半糖', src: 'https://drive-cdn.mujian.me/17/f5ecec8b-2e4b-451f-ae15-c6b9a4a2eaa9_Brain%20Static.mp3' },
  { id: 'song-anyway', name: 'Anyway', artist: '半糖', src: 'https://drive-cdn.mujian.me/17/24e0c15f-ffbd-4189-8e1c-fe5ce3209ca2_Anyway.mp3' },
  { id: 'song-sweet-time', name: '甜蜜时光', artist: '半糖', src: 'https://drive-cdn.mujian.me/17/7fb7e699-a8b6-47d4-a16e-9ac3ab77f81b_%E7%94%9C%E8%9C%9C%E6%97%B6%E5%85%89.mp3' },
  { id: 'song-pen-cloud', name: '笔下风云', artist: '半糖', src: 'https://drive-cdn.mujian.me/17/48c95ace-53a5-4d3d-a41c-25c7d22accc8_%E7%AC%94%E4%B8%8B%E9%A3%8E%E4%BA%91.mp3' },
  { id: 'song-tsk', name: 'Tsk, Okay', artist: '半糖', src: 'https://drive-cdn.mujian.me/17/e4165f50-d8a2-4863-9563-452881f99913_Tsk,%20Okay.mp3' },
]

const LEGACY_TRACKS = new Set(['builtin-1', 'builtin-2', 'builtin-3'])

function mergeTracks(saved: Track[] | undefined): Track[] {
  if (!saved?.length) return BUILTIN_TRACKS
  const onlyLegacy = saved.every((item) => LEGACY_TRACKS.has(item.id) && !item.src)
  if (onlyLegacy) return BUILTIN_TRACKS
  const ids = new Set(saved.map((item) => item.id))
  return [...saved, ...BUILTIN_TRACKS.filter((item) => !ids.has(item.id))]
}

export const CARD_COLORS = ['#FFFFFF', '#FFF1F5', '#F4FBF7', '#FFF8EC', '#F6F3FC', '#EEF5FC', '#2A2730']
export const DISC_COLORS = ['#1A1A1A', '#5B3A4A', '#2F4A5C', '#E58FA6', '#7CC7AE', '#B9A3E3']

const DEFAULT_CONFIG: PlayerConfig = { style: 'vinyl', card: '#FFFFFF', disc: '#1A1A1A', tracks: BUILTIN_TRACKS, repeatMode: 'one' }

type PlayerState = {
  namespace: string
  config: PlayerConfig
  load: (namespace: string) => void
  patch: (patch: Partial<PlayerConfig>) => void
  addTrack: (track: Omit<Track, 'id'>, audio?: string) => Promise<void>
  removeTrack: (id: string) => void
}

export const usePlayer = create<PlayerState>((set, get) => ({
  namespace: '',
  config: DEFAULT_CONFIG,
  load: (namespace) => {
    if (get().namespace === namespace) return
    set({ namespace, config: DEFAULT_CONFIG })
    void storage.getBag<PlayerConfig>(namespace, 'player').then((row) => {
      if (row && get().namespace === namespace) set({ config: { ...DEFAULT_CONFIG, ...row, tracks: mergeTracks(row.tracks), repeatMode: row.repeatMode ?? DEFAULT_CONFIG.repeatMode } })
    })
  },
  patch: (patch) => {
    const config = { ...get().config, ...patch }
    set({ config })
    void storage.setBag(get().namespace, 'player', config)
  },
  addTrack: async (track, audio) => {
    const id = crypto.randomUUID()
    const namespace = get().namespace
    let src = track.src
    if (audio) {
      await storage.setBag(namespace, `track_${id}`, audio)
      src = `bag:track_${id}`
    }
    get().patch({ tracks: [...get().config.tracks, { ...track, id, src, tone: track.tone ?? 180 + Math.round(Math.random() * 90) }] })
  },
  removeTrack: (id) => {
    const track = get().config.tracks.find((item) => item.id === id)
    if (track?.src?.startsWith('bag:')) void storage.setBag(get().namespace, track.src.slice(4), null)
    get().patch({ tracks: get().config.tracks.filter((item) => item.id !== id) })
  },
}))

export async function resolveTrackSrc(namespace: string, src: string): Promise<string> {
  if (!src.startsWith('bag:')) return src
  return (await storage.getBag<string>(namespace, src.slice(4))) ?? ''
}

export function isDark(color: string) {
  const hex = color.replace('#', '')
  if (hex.length !== 6) return false
  const [r, g, b] = [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16))
  return (r * 299 + g * 587 + b * 114) / 1000 < 110
}
