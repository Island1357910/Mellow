import { useEffect, useRef, useState } from 'react';
import type { GiftFeedItem } from '../../types';

const MAX_PER_SIDE = 3;
const ITEM_LIFE_MS = 4200;

interface PKGiftFeedStripProps {
  items: GiftFeedItem[];
}

/** PK 打赏飘条：左右分侧、独立计时，叠在立绘上 */
export default function PKGiftFeedStrip({ items }: PKGiftFeedStripProps) {
  const [visibleA, setVisibleA] = useState<GiftFeedItem[]>([]);
  const [visibleB, setVisibleB] = useState<GiftFeedItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (items.length === 0) return;
    const latest = items[items.length - 1];
    if (!latest?.side || seenRef.current.has(latest.id)) return;
    seenRef.current.add(latest.id);

    const setter = latest.side === 'A' ? setVisibleA : setVisibleB;
    setter((prev) => {
      const merged = [...prev.filter((v) => v.id !== latest.id), latest];
      return merged.slice(-MAX_PER_SIDE);
    });

    const timer = setTimeout(() => {
      setter((prev) => prev.filter((v) => v.id !== latest.id));
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

  if (visibleA.length === 0 && visibleB.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20">
      <SideColumn items={visibleA} align="left" />
      <SideColumn items={visibleB} align="right" />
    </div>
  );
}

function SideColumn({
  items,
  align,
}: {
  items: GiftFeedItem[];
  align: 'left' | 'right';
}) {
  if (items.length === 0) return null;
  const isLeft = align === 'left';

  return (
    <div
      className={`absolute top-0 flex w-[48%] flex-col gap-1.5 ${
        isLeft ? 'left-0 items-start' : 'right-0 items-end'
      }`}
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={`flex max-w-full items-center gap-1.5 rounded-2xl px-2.5 py-1.5 shadow-lg animate-[slideInLeft_0.35s_ease-out] ring-2 ${
            item.isPlayer
              ? isLeft
                ? 'bg-[#9b5cff] ring-white/90'
                : 'bg-[#d946ef] ring-white/90'
              : isLeft
                ? 'bg-gradient-to-r from-[#9b5cff] to-[#0c0614] ring-[#9b5cff]/50'
                : 'bg-gradient-to-r from-[#d946ef] to-[#0c0614] ring-[#d946ef]/50'
          }`}
        >
          <span className="text-lg drop-shadow">{item.giftIcon}</span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-extrabold text-white">
              {item.isPlayer ? '你 · ' : ''}
              {item.sender}
            </p>
            <p className="truncate text-[10px] font-semibold text-white">
              送{item.targetName ? ` ${item.targetName} ` : ' '}
              {item.giftName}
              {item.count > 1 ? ` x${item.count}` : ''}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
