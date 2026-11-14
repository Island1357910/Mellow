import { useEffect, useRef, useState } from 'react';
import type { GiftFeedItem } from '../../types';

const MAX_VISIBLE = 3;
const ITEM_LIFE_MS = 4200;

/** 礼物飘条：每条独立计时消失，避免连刷时旧提示残留 */
export default function GiftFeedStrip({ items }: { items: GiftFeedItem[] }) {
  const [visible, setVisible] = useState<GiftFeedItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (items.length === 0) return;
    const latest = items[items.length - 1];
    if (!latest || seenRef.current.has(latest.id)) return;
    seenRef.current.add(latest.id);

    setVisible((prev) => {
      const merged = [...prev.filter((v) => v.id !== latest.id), latest];
      return merged.slice(-MAX_VISIBLE);
    });

    const timer = setTimeout(() => {
      setVisible((prev) => prev.filter((v) => v.id !== latest.id));
      timersRef.current.delete(latest.id);
    }, ITEM_LIFE_MS);
    timersRef.current.set(latest.id, timer);
  }, [items]);

  useEffect(
    () => () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    },
    []
  );

  if (visible.length === 0) return null;

  return (
    <div className="pointer-events-none flex flex-col items-start gap-1.5">
      {visible.map((item) => (
        <div
          key={item.id}
          className={`flex max-w-[200px] items-center gap-2 rounded-2xl px-2.5 py-1.5 shadow-lg animate-[slideInLeft_0.35s_ease-out] ${
            item.isPlayer
              ? 'bg-[#9b5cff] ring-2 ring-white/90'
              : 'bg-gradient-to-r from-[#f4212e] to-[#ff7a00] ring-2 ring-amber-200/90'
          }`}
        >
          <span className="text-xl drop-shadow">{item.giftIcon}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-extrabold text-white">{item.sender}</p>
            <p className="truncate text-[10px] font-semibold text-white">
              送出 {item.giftName}
              {item.count > 1 ? ` x${item.count}` : ''}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
