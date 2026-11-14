import { MUSIC_PRESETS, REMOVED_PRESET_IDS, type MusicTrack } from '../data/musicPresets';

export type PlayMode = 'sequence' | 'loop_one' | 'loop_all' | 'shuffle';

export const PLAY_MODE_LABELS: Record<PlayMode, string> = {
  sequence: '顺序播放',
  loop_all: '列表循环',
  loop_one: '单曲循环',
  shuffle: '随机播放',
};

export const PLAY_MODE_ICONS: Record<PlayMode, string> = {
  sequence: '▶️',
  loop_all: '🔁',
  loop_one: '🔂',
  shuffle: '🔀',
};

export const PLAY_MODE_CYCLE: PlayMode[] = ['sequence', 'loop_all', 'loop_one', 'shuffle'];

export function normalizePlayMode(mode: unknown): PlayMode {
  if (mode === 'sequence' || mode === 'loop_one' || mode === 'loop_all' || mode === 'shuffle') {
    return mode;
  }
  return 'sequence';
}

export function buildDefaultPlaylistOrder(customTracks: MusicTrack[]): string[] {
  return [...MUSIC_PRESETS.map((t) => t.id), ...customTracks.map((t) => t.id)];
}

export function getTracksFromOrder(order: string[] | undefined, customTracks: MusicTrack[]): MusicTrack[] {
  const synced = syncPlaylistOrder(order, customTracks);
  const map = new Map<string, MusicTrack>([
    ...MUSIC_PRESETS.map((t) => [t.id, t] as const),
    ...customTracks.map((t) => [t.id, t] as const),
  ]);
  return synced.map((id) => map.get(id)).filter((t): t is MusicTrack => Boolean(t));
}

export function syncPlaylistOrder(order: string[] | undefined, customTracks: MusicTrack[]): string[] {
  const allIds = buildDefaultPlaylistOrder(customTracks);
  const valid = new Set(allIds);
  const kept = (order ?? []).filter((id) => valid.has(id) && !REMOVED_PRESET_IDS.includes(id));
  const missing = allIds.filter((id) => !kept.includes(id));
  return [...kept, ...missing];
}

export function migrateCurrentTrackId(currentId: string | null | undefined, customTracks: MusicTrack[]): string | null {
  const tracks = getTracksFromOrder(buildDefaultPlaylistOrder(customTracks), customTracks);
  if (!currentId || REMOVED_PRESET_IDS.includes(currentId)) {
    return tracks[0]?.id ?? null;
  }
  return tracks.some((t) => t.id === currentId) ? currentId : tracks[0]?.id ?? null;
}

export function resolveNextTrackId(
  tracks: MusicTrack[],
  currentId: string | null,
  mode: PlayMode
): string | null {
  if (tracks.length === 0) return null;
  if (mode === 'loop_one' && currentId) return currentId;

  const idx = tracks.findIndex((t) => t.id === currentId);

  if (mode === 'shuffle') {
    if (tracks.length === 1) return tracks[0].id;
    const pool = tracks.filter((t) => t.id !== currentId);
    return pool[Math.floor(Math.random() * pool.length)]?.id ?? tracks[0].id;
  }

  if (idx < 0) return tracks[0].id;
  const nextIdx = idx + 1;
  if (nextIdx < tracks.length) return tracks[nextIdx].id;
  if (mode === 'loop_all') return tracks[0].id;
  return null;
}

export function resolvePrevTrackId(tracks: MusicTrack[], currentId: string | null, mode: PlayMode): string | null {
  if (tracks.length === 0) return null;
  const idx = tracks.findIndex((t) => t.id === currentId);
  if (mode === 'shuffle') {
    if (tracks.length === 1) return tracks[0].id;
    const pool = tracks.filter((t) => t.id !== currentId);
    return pool[Math.floor(Math.random() * pool.length)]?.id ?? tracks[0].id;
  }
  if (idx < 0) return tracks[tracks.length - 1].id;
  const prevIdx = idx - 1;
  if (prevIdx >= 0) return tracks[prevIdx].id;
  if (mode === 'loop_all') return tracks[tracks.length - 1].id;
  return null;
}
