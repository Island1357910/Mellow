import { useMemo, useState } from 'react';
import { useBalance } from '../../utils/mellowHost';
import { GIFTS } from '../../data/gifts';
import type { Gift } from '../../types';

interface GiftPanelProps {
  open: boolean;
  onClose: () => void;
  onSelect: (gift: Gift) => void;
}

/** 礼物面板：底部弹出，按价位分组展示 40+ 礼物 */
export default function GiftPanel({ open, onClose, onSelect }: GiftPanelProps) {
  const balance = useBalance();
  const [tab, setTab] = useState<'全部' | '小额' | '中额' | '大额'>('全部');

  const groups = useMemo(() => {
    if (tab === '小额') return GIFTS.filter((g) => g.price <= 52);
    if (tab === '中额') return GIFTS.filter((g) => g.price > 52 && g.price <= 999);
    if (tab === '大额') return GIFTS.filter((g) => g.price >= 1000);
    return GIFTS;
  }, [tab]);

  return (
    <>
      <div
        className={`absolute inset-0 z-40 bg-black/50 transition-opacity ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />
      <div
        className={`absolute inset-x-0 bottom-0 z-50 max-h-[72vh] overflow-y-auto rounded-t-3xl border-t border-blue-100 bg-white px-4 pb-[max(env(safe-area-inset-bottom,0px),2rem)] pt-4 shadow-[0_-10px_30px_rgba(147,197,253,0.25)] transition-transform duration-300 no-scrollbar ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
        <p className="mb-2 text-sm font-semibold text-slate-600">虚拟礼物 · 直播打赏 · 余额 {balance ?? '—'} · 共 {GIFTS.length} 种</p>
        <p className="mb-2 text-[10px] text-slate-400">此处为直播间虚拟币礼物，与淘淘购/美团实体礼不同</p>

        <div className="mb-3 flex gap-2">
          {(['全部', '小额', '中额', '大额'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1 text-[11px] ${
                tab === t ? 'bg-pink-400 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-2.5">
          {groups.map((gift) => (
            <button
              key={gift.id}
              onClick={() => onSelect(gift)}
              className={`flex flex-col items-center gap-0.5 rounded-2xl border py-2.5 transition active:scale-95 ${
                gift.isBig
                  ? 'border-amber-200 bg-gradient-to-b from-amber-50 to-transparent'
                  : 'border-blue-100 bg-slate-50'
              }`}
            >
              <span className="text-2xl">{gift.icon}</span>
              <span className="max-w-full truncate px-1 text-[10px] text-slate-600">{gift.name}</span>
              {gift.meaning && (
                <span className="max-w-full truncate px-1 text-[8px] text-slate-400">{gift.meaning}</span>
              )}
              <span className="text-[10px] font-semibold text-pink-500">{gift.price}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
