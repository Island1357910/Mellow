import { useEffect, useRef, useState } from 'react';

interface VolumeControlProps {
  volume: number;
  onChange: (v: number) => void;
}

export default function VolumeControl({ volume, onChange }: VolumeControlProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const icon = volume <= 0 ? '🔇' : volume < 0.35 ? '🔈' : volume < 0.7 ? '🔉' : '🔊';

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="音量"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-lg text-emerald-700 active:scale-95 transition"
      >
        {icon}
      </button>

      {open && (
        <div className="absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 rounded-2xl border border-emerald-100 bg-white/95 px-3 py-3 shadow-lg backdrop-blur">
          <div className="flex h-28 items-center justify-center">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => onChange(Number(e.target.value))}
              className="h-24 w-6 cursor-pointer accent-emerald-500"
              style={{
                WebkitAppearance: 'slider-vertical',
                writingMode: 'vertical-lr',
                direction: 'rtl',
              }}
            />
          </div>
          <p className="mt-1 text-center text-[10px] text-slate-400">{Math.round(volume * 100)}%</p>
        </div>
      )}
    </div>
  );
}
