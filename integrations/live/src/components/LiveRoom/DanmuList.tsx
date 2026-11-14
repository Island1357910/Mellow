import { useEffect, useRef } from 'react';
import type { DanmuItem } from '../../types';

interface DanmuListProps {
  list: DanmuItem[];
  anchorTyping?: boolean;
  anchorName?: string;
  /** overlay：直播间立绘上的紧凑黑字样式 */
  variant?: 'default' | 'overlay';
}

export default function DanmuList({
  list,
  anchorTyping,
  anchorName,
  variant = 'default',
}: DanmuListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickBottomRef = useRef(true);

  useEffect(() => {
    if (!stickBottomRef.current) return;
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [list.length, anchorTyping]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    stickBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  const overlay = variant === 'overlay';

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`no-scrollbar flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain touch-pan-y ${
        overlay ? 'gap-0.5 px-3 py-1.5' : ''
      }`}
    >
      {list.map((item) => (
        <DanmuRow key={item.id} item={item} overlay={overlay} />
      ))}
      {anchorTyping && (
        <div
          className={`animate-danmu-in text-[12px] ${
            overlay ? 'px-1 py-1 text-[#536471]' : 'border-b border-[#eff3f4] px-4 py-3 text-[13px] text-[#536471]'
          }`}
        >
          {anchorName ?? '主播'} 正在输入…
        </div>
      )}
    </div>
  );
}

function DanmuRow({ item, overlay }: { item: DanmuItem; overlay: boolean }) {
  if (overlay) {
    if (item.type === 'system') {
      return (
        <div className="animate-danmu-in py-0.5 text-center text-[11px] text-[#9b8fb0]">{item.content}</div>
      );
    }
    if (item.type === 'gift') {
      const isVirtual = item.giftKind !== 'physical';
      return (
        <div
          className={`animate-danmu-in my-0.5 rounded-lg px-2 py-1.5 text-[13px] leading-4 shadow-sm ${
            isVirtual
              ? 'bg-gradient-to-r from-amber-200/95 to-amber-100/80 ring-1 ring-amber-400/60'
              : 'bg-gradient-to-r from-orange-200/95 to-orange-100/80 ring-1 ring-orange-400/60'
          }`}
        >
          <span className="mr-1 inline-block rounded bg-[#f4212e] px-1 py-px text-[9px] font-extrabold text-white">
            {isVirtual ? '礼物' : '实体'}
          </span>
          <span className="font-extrabold text-[#b91c1c]">{item.sender}</span>
          <span className="font-semibold text-[#0c0614]"> {item.content}</span>
        </div>
      );
    }
    if (item.type === 'player') {
      return (
        <div className="animate-danmu-in py-0.5 text-[12px] leading-4 text-[#f3eef9]">
          <span className="font-bold text-[#9b5cff]">{item.sender}</span>
          <span>：{item.content}</span>
        </div>
      );
    }
    if (item.type === 'anchor') {
      return (
        <div className="animate-danmu-in py-0.5 text-[12px] leading-4 text-[#f3eef9]">
          <span className="font-bold text-[#c4b5fd]">{item.sender}</span>
          <span>：{item.content}</span>
        </div>
      );
    }
    return (
      <div className="animate-danmu-in py-0.5 text-[12px] leading-4 text-[#f3eef9]">
        <span className="font-semibold text-[#9b8fb0]">{item.sender}</span>
        <span>：{item.content}</span>
      </div>
    );
  }

  if (item.type === 'system') {
    return (
      <div className="animate-danmu-in px-4 py-2 text-center text-[12px] text-[#536471]">
        {item.content}
      </div>
    );
  }

  if (item.type === 'gift') {
    const isVirtual = item.giftKind !== 'physical';
    return (
      <article className="animate-danmu-in border-b border-[#eff3f4] px-4 py-3 hover:bg-black/[0.03]">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eff3f4] text-[14px]">
            {isVirtual ? '✦' : '▣'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold text-[#0f1419]">
              {item.sender}
              <span className="ml-1 font-normal text-[#536471]">
                · {isVirtual ? '虚拟礼物' : '实体礼物'}
              </span>
            </p>
            <p className="mt-0.5 text-[14px] leading-5 text-[#0f1419]">{item.content}</p>
          </div>
        </div>
      </article>
    );
  }

  if (item.type === 'anchor') {
    return (
      <article className="animate-danmu-in border-b border-[#eff3f4] bg-[#e8f5fd]/40 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1d9bf0] text-[12px] font-bold text-white">
            播
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold text-[#0f1419]">
              {item.sender}
              <span className="ml-1 font-normal text-[#1d9bf0]">主播</span>
            </p>
            <p className="mt-0.5 text-[14px] leading-5 text-[#0f1419]">{item.content}</p>
          </div>
        </div>
      </article>
    );
  }

  if (item.type === 'player') {
    return (
      <article className="animate-danmu-in border-b border-[#eff3f4] px-4 py-3 hover:bg-black/[0.03]">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0f1419] text-[12px] font-bold text-white">
            我
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold text-[#0f1419]">
              {item.sender}
              <span className="ml-1 font-normal text-[#536471]">你</span>
            </p>
            <p className="mt-0.5 text-[14px] leading-5 text-[#0f1419]">{item.content}</p>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="animate-danmu-in border-b border-[#eff3f4] px-4 py-3 hover:bg-black/[0.03]">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#cfd9de] text-[12px] font-bold text-[#0f1419]">
          {(item.sender ?? '观').charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-[#0f1419]">
            {item.sender}
            <span className="ml-1 font-normal text-[#536471]">观众</span>
          </p>
          <p className="mt-0.5 text-[14px] leading-5 text-[#0f1419]">{item.content}</p>
        </div>
      </div>
    </article>
  );
}
