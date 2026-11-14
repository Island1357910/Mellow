import { useEffect, useState } from 'react';
import type { AnchorProfile } from '../../types';
import AnchorPortrait, { VoiceCallAvatar } from './AnchorPortrait';

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function VoiceCallOverlay({
  anchor,
  statusLine,
  onEnd,
}: {
  anchor: AnchorProfile;
  statusLine?: string;
  onEnd: () => void;
}) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="absolute inset-0 z-[60] flex flex-col bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
        <VoiceCallAvatar anchor={anchor} size={130} />
        <p className="text-sm text-white/70">{statusLine ?? '语音通话中…'}</p>
        <p className="font-mono text-2xl text-white/90">{formatDuration(seconds)}</p>
      </div>
      <div className="flex justify-center pb-12">
        <button
          type="button"
          onClick={onEnd}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-2xl text-white shadow-lg active:scale-95"
        >
          📵
        </button>
      </div>
    </div>
  );
}

export function VideoCallOverlay({
  anchor,
  statusLine,
  onEnd,
}: {
  anchor: AnchorProfile;
  statusLine?: string;
  onEnd: () => void;
}) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="absolute inset-0 z-[60] flex flex-col bg-black">
      <div className="relative min-h-0 flex-1">
        <AnchorPortrait anchor={anchor} className="h-full" />
        <div className="absolute left-0 right-0 top-0 bg-gradient-to-b from-black/60 to-transparent px-4 pb-8 pt-10">
          <p className="text-center text-sm text-white/90">{anchor.stageName}</p>
          <p className="text-center text-xs text-white/60">{statusLine ?? '视频通话中'}</p>
          <p className="mt-1 text-center font-mono text-sm text-white/80">{formatDuration(seconds)}</p>
        </div>
        <div className="absolute bottom-4 right-4 h-20 w-14 overflow-hidden rounded-lg border-2 border-white/40 bg-slate-800">
          <div className="flex h-full items-center justify-center text-2xl">👩</div>
        </div>
      </div>
      <div className="flex shrink-0 justify-center bg-black/80 py-6">
        <button
          type="button"
          onClick={onEnd}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-xl text-white shadow-lg active:scale-95"
        >
          📵
        </button>
      </div>
    </div>
  );
}
