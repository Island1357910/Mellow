import { useRef, useState } from 'react';
import { useMusicStore } from '../../stores/useMusicStore';

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MusicProgressBar() {
  const playbackCurrent = useMusicStore((s) => s.playbackCurrent);
  const playbackDuration = useMusicStore((s) => s.playbackDuration);
  const seekTo = useMusicStore((s) => s.seekTo);

  const [seeking, setSeeking] = useState(false);
  const [dragRatio, setDragRatio] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);

  const ratio =
    seeking && playbackDuration > 0
      ? dragRatio
      : playbackDuration > 0
        ? playbackCurrent / playbackDuration
        : 0;

  const displayCurrent = seeking ? dragRatio * playbackDuration : playbackCurrent;

  const pickRatio = (clientX: number) => {
    const bar = barRef.current;
    if (!bar || playbackDuration <= 0) return 0;
    const rect = bar.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    return x / rect.width;
  };

  const finishSeek = (clientX: number) => {
    const next = pickRatio(clientX);
    setSeeking(false);
    seekTo(next * playbackDuration);
  };

  return (
    <div className="mt-3">
      <div
        ref={barRef}
        className="relative h-1.5 cursor-pointer rounded-full bg-emerald-100"
        onPointerDown={(e) => {
          if (playbackDuration <= 0) return;
          setSeeking(true);
          setDragRatio(pickRatio(e.clientX));
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!seeking) return;
          setDragRatio(pickRatio(e.clientX));
        }}
        onPointerUp={(e) => {
          if (!seeking) return;
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
          finishSeek(e.clientX);
        }}
        onPointerCancel={() => setSeeking(false)}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
          style={{ width: `${Math.min(100, ratio * 100)}%` }}
        />
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-white bg-emerald-500 shadow"
          style={{ left: `calc(${Math.min(100, ratio * 100)}% - 7px)` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-slate-400">
        <span>{formatTime(displayCurrent)}</span>
        <span>{formatTime(playbackDuration)}</span>
      </div>
    </div>
  );
}
