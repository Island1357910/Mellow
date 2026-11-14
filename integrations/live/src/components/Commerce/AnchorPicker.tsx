import { useEffect, useRef, useState } from 'react';
import Avatar from '../Common/Avatar';
import { anchorAvatarProps } from '../Common/AnchorImage';
import type { AnchorProfile } from '../../types';

interface AnchorPickerProps {
  anchors: AnchorProfile[];
  value: string;
  onChange: (anchorId: string) => void;
  accentClass?: string;
  borderClass?: string;
}

/** 应用内主播选择器（避免原生 select 下拉超出屏幕） */
export default function AnchorPicker({
  anchors,
  value,
  onChange,
  accentClass = 'bg-orange-500',
  borderClass = 'border-orange-100',
}: AnchorPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = anchors.find((a) => a.id === value) ?? anchors[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!selected) return null;

  return (
    <div ref={rootRef} className="relative">
      <label className="text-[11px] text-slate-500">送给</label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`mt-1 flex w-full items-center gap-2 rounded-lg border ${borderClass} bg-white px-3 py-2 text-left text-sm text-slate-700`}
      >
        <Avatar {...anchorAvatarProps(selected)} size={28} />
        <span className="min-w-0 flex-1 truncate font-medium">{selected.stageName}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-y-auto rounded-xl border ${borderClass} bg-white py-1 shadow-lg`}
        >
          {anchors.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                onChange(a.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm active:bg-slate-50 ${
                a.id === value ? 'bg-slate-50' : ''
              }`}
            >
              <Avatar {...anchorAvatarProps(a)} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-800">{a.stageName}</p>
                <p className="truncate text-[10px] text-slate-400">{a.tag}</p>
              </div>
              {a.id === value && (
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold text-white ${accentClass}`}>
                  已选
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
