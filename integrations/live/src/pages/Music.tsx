import { useMemo, useState } from 'react';
import StatusBar from '../components/Phone/StatusBar';
import ScreenHeader from '../components/Common/ScreenHeader';
import VolumeControl from '../components/Music/VolumeControl';
import MusicProgressBar from '../components/Music/MusicProgressBar';
import { useNavStore } from '../stores/useNavStore';
import { useMusicStore } from '../stores/useMusicStore';
import type { MusicTrack } from '../data/musicPresets';
import {
  MAX_AUDIO_IMPORT_BYTES,
  formatFileSize,
  readFileAsDataUrl,
} from '../utils/fileImport';
import { PLAY_MODE_ICONS, PLAY_MODE_LABELS, getTracksFromOrder } from '../utils/musicPlayback';

export default function Music() {
  const back = useNavStore((s) => s.back);
  const playlistOrder = useMusicStore((s) => s.playlistOrder);
  const customTracks = useMusicStore((s) => s.customTracks);
  const currentTrackId = useMusicStore((s) => s.currentTrackId);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const volume = useMusicStore((s) => s.volume);
  const playMode = useMusicStore((s) => s.playMode);
  const playTrack = useMusicStore((s) => s.playTrack);
  const playNext = useMusicStore((s) => s.playNext);
  const playPrev = useMusicStore((s) => s.playPrev);
  const togglePlay = useMusicStore((s) => s.togglePlay);
  const setVolume = useMusicStore((s) => s.setVolume);
  const cyclePlayMode = useMusicStore((s) => s.cyclePlayMode);
  const reorderPlaylist = useMusicStore((s) => s.reorderPlaylist);
  const addTrackFromUrl = useMusicStore((s) => s.addTrackFromUrl);
  const addTrackFromFile = useMusicStore((s) => s.addTrackFromFile);
  const removeCustomTrack = useMusicStore((s) => s.removeCustomTrack);

  const [urlDraft, setUrlDraft] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [toast, setToast] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const playlistTracks = useMemo(
    () => getTracksFromOrder(playlistOrder, customTracks),
    [playlistOrder, customTracks]
  );
  const current = playlistTracks.find((t) => t.id === currentTrackId) ?? null;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|aac)$/i.test(file.name)) {
      showToast('请选择音频文件');
      return;
    }
    if (file.size > MAX_AUDIO_IMPORT_BYTES) {
      showToast(`文件过大，请小于 ${formatFileSize(MAX_AUDIO_IMPORT_BYTES)}`);
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      addTrackFromFile(titleDraft || file.name.replace(/\.[^.]+$/, ''), dataUrl);
      setTitleDraft('');
      showToast('已导入并加入播放列表');
    } catch {
      showToast('导入失败');
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-gradient-to-b from-emerald-50 via-white to-teal-50">
      <StatusBar />
      <ScreenHeader title="音乐" onBack={back} />

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-8">
        <div className="mb-4 rounded-2xl border border-emerald-100 bg-white/90 p-4 shadow-sm">
          <p className="text-[10px] text-slate-400">正在播放 · 退出本页继续播放</p>
          <p className="mt-1 text-lg font-bold text-slate-800">{current?.title ?? '未选择'}</p>
          <p className="text-xs text-slate-500">{current?.artist ?? '—'}</p>

          <MusicProgressBar />

          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={cyclePlayMode}
              className="flex min-w-0 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-emerald-700 active:scale-95 transition"
              title={PLAY_MODE_LABELS[playMode]}
            >
              <span className="text-lg">{PLAY_MODE_ICONS[playMode]}</span>
              <span className="max-w-[4.5rem] truncate text-[9px]">{PLAY_MODE_LABELS[playMode]}</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={playPrev}
                disabled={!current}
                className="text-xl text-slate-500 disabled:opacity-30"
              >
                ⏮
              </button>
              <button
                type="button"
                onClick={togglePlay}
                disabled={!current}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-2xl text-white shadow-lg disabled:opacity-40"
              >
                {isPlaying ? '⏸' : '▶️'}
              </button>
              <button
                type="button"
                onClick={playNext}
                disabled={!current}
                className="text-xl text-slate-500 disabled:opacity-30"
              >
                ⏭
              </button>
            </div>

            <VolumeControl volume={volume} onChange={setVolume} />
          </div>
        </div>

        <Section title="播放列表（拖动排序）">
          <DraggablePlaylist
            tracks={playlistTracks}
            currentId={currentTrackId}
            dragIndex={dragIndex}
            onDragIndexChange={setDragIndex}
            onReorder={reorderPlaylist}
            onPlay={playTrack}
            onRemove={(id, track) => {
              if (track.source !== 'preset') {
                removeCustomTrack(id);
                showToast('已移除');
              }
            }}
          />
        </Section>

        <Section title="导入音乐">
          <div className="space-y-2 rounded-xl border border-dashed border-emerald-200 bg-white/80 p-3">
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              placeholder="曲名（可选）"
              className="w-full rounded-lg border border-emerald-100 px-2 py-1.5 text-[11px] outline-none"
            />
            <input
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="音乐 URL（mp3 等）"
              className="w-full rounded-lg border border-emerald-100 px-2 py-1.5 text-[11px] outline-none"
            />
            <button
              type="button"
              onClick={() => {
                const url = urlDraft.trim();
                if (!url) {
                  showToast('请输入 URL');
                  return;
                }
                addTrackFromUrl(titleDraft, url);
                setUrlDraft('');
                setTitleDraft('');
                showToast('已添加');
              }}
              className="w-full rounded-lg bg-emerald-500 py-2 text-xs font-bold text-white"
            >
              从 URL 添加
            </button>
            <label className="flex cursor-pointer items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 py-2 text-xs font-medium text-emerald-700">
              从本地文件导入
              <input
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac"
                className="hidden"
                onChange={(e) => void handleImportFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <p className="text-[9px] text-slate-400">
              本地音乐保存在浏览器，开新档不会清除（上限 {formatFileSize(MAX_AUDIO_IMPORT_BYTES)}）
            </p>
          </div>
        </Section>
      </div>

      {toast && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/75 px-4 py-2 text-xs text-white">
          {toast}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 text-xs font-bold text-emerald-500">{title}</h2>
      {children}
    </section>
  );
}

function DraggablePlaylist({
  tracks,
  currentId,
  dragIndex,
  onDragIndexChange,
  onReorder,
  onPlay,
  onRemove,
}: {
  tracks: MusicTrack[];
  currentId: string | null;
  dragIndex: number | null;
  onDragIndexChange: (idx: number | null) => void;
  onReorder: (from: number, to: number) => void;
  onPlay: (id: string) => void;
  onRemove: (id: string, track: MusicTrack) => void;
}) {
  return (
    <div className="space-y-1.5">
      {tracks.map((t, index) => (
        <div
          key={t.id}
          draggable
          onDragStart={() => onDragIndexChange(index)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragIndex == null || dragIndex === index) return;
            onReorder(dragIndex, index);
            onDragIndexChange(null);
          }}
          onDragEnd={() => onDragIndexChange(null)}
          className={`flex items-center gap-2 rounded-xl border px-2 py-2 ${
            currentId === t.id ? 'border-emerald-300 bg-emerald-50' : 'border-slate-100 bg-white'
          } ${dragIndex === index ? 'opacity-60' : ''}`}
        >
          <span className="cursor-grab px-1 text-slate-300 active:cursor-grabbing" title="拖动排序">
            ⠿
          </span>
          <button type="button" onClick={() => onPlay(t.id)} className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-medium text-slate-700">{t.title}</p>
            <p className="text-[10px] text-slate-400">
              {t.artist} · {t.source === 'preset' ? '预设' : t.source === 'file' ? '本地' : 'URL'}
            </p>
          </button>
          {t.source !== 'preset' && (
            <button
              type="button"
              onClick={() => onRemove(t.id, t)}
              className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[10px] text-slate-500"
            >
              删
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
