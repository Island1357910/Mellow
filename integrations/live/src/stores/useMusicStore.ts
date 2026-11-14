import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbJSONStorage } from '../utils/storage';
import { MUSIC_PRESETS, type MusicTrack } from '../data/musicPresets';
import { createAssetId } from '../utils/fileImport';
import {
  PLAY_MODE_CYCLE,
  buildDefaultPlaylistOrder,
  getTracksFromOrder,
  migrateCurrentTrackId,
  normalizePlayMode,
  resolveNextTrackId,
  resolvePrevTrackId,
  syncPlaylistOrder,
  type PlayMode,
} from '../utils/musicPlayback';

type MusicData = {
  customTracks: MusicTrack[];
  playlistOrder: string[];
  currentTrackId: string | null;
  isPlaying: boolean;
  volume: number;
  playMode: PlayMode;
  playbackCurrent: number;
  playbackDuration: number;
  pendingSeek: number | null;
};

interface MusicState extends MusicData {
  playTrack: (id: string) => void;
  playNext: () => void;
  playPrev: () => void;
  togglePlay: () => void;
  pause: () => void;
  setVolume: (v: number) => void;
  cyclePlayMode: () => void;
  setPlayMode: (mode: PlayMode) => void;
  reorderPlaylist: (fromIndex: number, toIndex: number) => void;
  setPlaybackProgress: (current: number, duration: number) => void;
  seekTo: (seconds: number) => void;
  addTrackFromUrl: (title: string, url: string) => MusicTrack;
  addTrackFromFile: (title: string, dataUrl: string) => MusicTrack;
  removeCustomTrack: (id: string) => void;
}

const initialData: MusicData = {
  customTracks: [],
  playlistOrder: buildDefaultPlaylistOrder([]),
  currentTrackId: MUSIC_PRESETS[0]?.id ?? null,
  isPlaying: false,
  volume: 0.8,
  playMode: 'sequence',
  playbackCurrent: 0,
  playbackDuration: 0,
  pendingSeek: null,
};

export const useMusicStore = create<MusicState>()(
  persist(
    (set, get) => ({
      ...initialData,

      playTrack: (id) => set({ currentTrackId: id, isPlaying: true, playbackCurrent: 0, pendingSeek: 0 }),
      playNext: () => {
        const state = get();
        const tracks = getTracksFromOrder(state.playlistOrder, state.customTracks);
        const nextId = resolveNextTrackId(tracks, state.currentTrackId, state.playMode);
        if (nextId) set({ currentTrackId: nextId, isPlaying: true, playbackCurrent: 0, pendingSeek: 0 });
        else set({ isPlaying: false });
      },
      playPrev: () => {
        const state = get();
        const tracks = getTracksFromOrder(state.playlistOrder, state.customTracks);
        const prevId = resolvePrevTrackId(tracks, state.currentTrackId, state.playMode);
        if (prevId) set({ currentTrackId: prevId, isPlaying: true, playbackCurrent: 0, pendingSeek: 0 });
      },
      togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
      pause: () => set({ isPlaying: false }),
      setVolume: (v) => set({ volume: Math.min(1, Math.max(0, v)) }),
      cyclePlayMode: () =>
        set((s) => {
          const idx = PLAY_MODE_CYCLE.indexOf(s.playMode);
          const next = PLAY_MODE_CYCLE[(idx + 1) % PLAY_MODE_CYCLE.length];
          return { playMode: next };
        }),
      setPlayMode: (mode) => set({ playMode: mode }),
      setPlaybackProgress: (current, duration) =>
        set((s) => (s.pendingSeek != null ? s : { playbackCurrent: current, playbackDuration: duration })),
      seekTo: (seconds) => {
        const duration = get().playbackDuration;
        const clamped = Math.min(Math.max(seconds, 0), duration || seconds);
        set({ pendingSeek: clamped, playbackCurrent: clamped });
      },
      reorderPlaylist: (fromIndex, toIndex) => {
        if (fromIndex === toIndex) return;
        set((s) => {
          const tracks = getTracksFromOrder(s.playlistOrder, s.customTracks);
          const order = tracks.map((t) => t.id);
          const [moved] = order.splice(fromIndex, 1);
          if (!moved) return s;
          order.splice(toIndex, 0, moved);
          return { playlistOrder: order };
        });
      },
      addTrackFromUrl: (title, url) => {
        const track: MusicTrack = {
          id: createAssetId(),
          title: title.trim() || '自定义音乐',
          artist: '导入',
          source: 'url',
          url: url.trim(),
        };
        set((s) => {
          const customTracks = [track, ...s.customTracks];
          return {
            customTracks,
            playlistOrder: syncPlaylistOrder([track.id, ...s.playlistOrder], customTracks),
            currentTrackId: track.id,
            isPlaying: true,
          };
        });
        return track;
      },
      addTrackFromFile: (title, dataUrl) => {
        const track: MusicTrack = {
          id: createAssetId(),
          title: title.trim() || '本地音乐',
          artist: '本地',
          source: 'file',
          url: dataUrl,
        };
        set((s) => {
          const customTracks = [track, ...s.customTracks];
          return {
            customTracks,
            playlistOrder: syncPlaylistOrder([track.id, ...s.playlistOrder], customTracks),
            currentTrackId: track.id,
            isPlaying: true,
          };
        });
        return track;
      },
      removeCustomTrack: (id) => {
        const state = get();
        const nextCustom = state.customTracks.filter((t) => t.id !== id);
        const nextOrder = syncPlaylistOrder(
          state.playlistOrder.filter((tid) => tid !== id),
          nextCustom
        );
        const patch: Partial<MusicData> = {
          customTracks: nextCustom,
          playlistOrder: nextOrder,
        };
        if (state.currentTrackId === id) {
          const tracks = getTracksFromOrder(nextOrder, nextCustom);
          patch.currentTrackId = tracks[0]?.id ?? MUSIC_PRESETS[0]?.id ?? null;
          patch.isPlaying = false;
        }
        set(patch);
      },
    }),
    {
      name: 'shenhao_music',
      storage: idbJSONStorage,
      partialize: (state) => ({
        customTracks: state.customTracks,
        playlistOrder: state.playlistOrder,
        currentTrackId: state.currentTrackId,
        isPlaying: state.isPlaying,
        volume: state.volume,
        playMode: state.playMode,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<MusicData>;
        const customTracks = Array.isArray(saved.customTracks) ? saved.customTracks : current.customTracks;
        const playlistOrder = syncPlaylistOrder(saved.playlistOrder, customTracks);
        return {
          ...current,
          customTracks,
          playlistOrder,
          currentTrackId: migrateCurrentTrackId(saved.currentTrackId, customTracks),
          isPlaying: Boolean(saved.isPlaying),
          volume: typeof saved.volume === 'number' ? saved.volume : current.volume,
          playMode: normalizePlayMode(saved.playMode),
        };
      },
    }
  )
);
