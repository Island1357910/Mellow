import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AnchorImage from '../Common/AnchorImage';
import { getAllAnchors, getAnchorById } from '../../data/anchors';
import { useAnchorStore } from '../../stores/useAnchorStore';
import { useCustomAnchorStore } from '../../stores/useCustomAnchorStore';
import { useToastStore } from '../../stores/useToastStore';
import { tryEnterLiveRoom } from '../../utils/liveRoomEntry';
import type { AnchorProfile } from '../../types';

/** 位移阈值（手机/电脑统一） */
const SWIPE_DISTANCE = 72;
/** 速度阈值 px/ms，轻甩也能触发 */
const SWIPE_VELOCITY = 0.5;
const TAP_SLOP = 8;

function shuffleIds(ids: string[]): string[] {
  const arr = [...ids];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 推荐 Tab：全屏立绘卡片，左滑跳过 / 右滑关注 / 点击进直播间（触控+鼠标+键盘） */
export default function RecommendSwipeDeck() {
  const runtimeMap = useAnchorStore((s) => s.runtime);
  const followedIds = useAnchorStore((s) => s.followedIds);
  const toggleFollow = useAnchorStore((s) => s.toggleFollow);
  const showToast = useToastStore((s) => s.show);

  const [queue, setQueue] = useState<string[]>([]);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [leaving, setLeaving] = useState<'left' | 'right' | null>(null);
  const [dragging, setDragging] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const leavingRef = useRef(false);
  const queueRef = useRef(queue);
  queueRef.current = queue;

  const dragRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    startT: 0,
    dx: 0,
    dy: 0,
    moved: false,
  });

  const customAnchors = useCustomAnchorStore((s) => s.anchors);
  const onlineIds = useMemo(
    () => getAllAnchors().filter((a) => runtimeMap[a.id]?.isOnline === true).map((a) => a.id),
    [runtimeMap, customAnchors]
  );

  const refill = useCallback(() => {
    setQueue(shuffleIds(onlineIds));
    setDragX(0);
    setDragY(0);
    setLeaving(null);
    leavingRef.current = false;
    setDragging(false);
  }, [onlineIds]);

  useEffect(() => {
    if (queue.length === 0 && onlineIds.length > 0) refill();
  }, [queue.length, onlineIds, refill]);

  useEffect(() => {
    const online = new Set(onlineIds);
    setQueue((prev) => prev.filter((id) => online.has(id)));
  }, [onlineIds]);

  const currentId = queue[0];
  const nextId = queue[1];
  const current = currentId ? getAnchorById(currentId) : undefined;
  const next = nextId ? getAnchorById(nextId) : undefined;

  const advance = useCallback(
    (dir: 'left' | 'right', anchor: AnchorProfile) => {
      if (leavingRef.current) return;
      leavingRef.current = true;
      setLeaving(dir);
      setDragging(false);
      setDragX(dir === 'right' ? 480 : -480);
      setDragY(0);

      if (dir === 'right') {
        const already = useAnchorStore.getState().isFollowed(anchor.id);
        if (!already) {
          toggleFollow(anchor.id);
          showToast(`已关注 ${anchor.stageName}`);
        } else {
          showToast(`已在关注 ${anchor.stageName}`);
        }
      }

      window.setTimeout(() => {
        setQueue((prev) => prev.slice(1));
        setDragX(0);
        setDragY(0);
        setLeaving(null);
        leavingRef.current = false;
        dragRef.current.active = false;
        dragRef.current.dx = 0;
        dragRef.current.dy = 0;
      }, 220);
    },
    [showToast, toggleFollow]
  );

  const finishGesture = useCallback(
    (dx: number, durationMs: number, moved: boolean, anchor: AnchorProfile) => {
      if (!moved) {
        tryEnterLiveRoom(anchor.id);
        setDragX(0);
        setDragY(0);
        setDragging(false);
        return;
      }

      const velocity = dx / Math.max(16, durationMs);
      const goRight = dx >= SWIPE_DISTANCE || velocity >= SWIPE_VELOCITY;
      const goLeft = dx <= -SWIPE_DISTANCE || velocity <= -SWIPE_VELOCITY;

      if (goRight) {
        advance('right', anchor);
        return;
      }
      if (goLeft) {
        advance('left', anchor);
        return;
      }
      setDragX(0);
      setDragY(0);
      setDragging(false);
    },
    [advance]
  );

  const endDrag = useCallback(
    (pointerId?: number) => {
      const state = dragRef.current;
      if (!state.active) return;
      if (pointerId != null && state.pointerId !== -1 && state.pointerId !== pointerId) return;

      state.active = false;
      setDragging(false);

      const el = cardRef.current;
      if (el && state.pointerId !== -1) {
        try {
          el.releasePointerCapture(state.pointerId);
        } catch {
          /* ignore */
        }
      }

      const anchorId = queueRef.current[0];
      const anchor = anchorId ? getAnchorById(anchorId) : undefined;
      if (!anchor || leavingRef.current) {
        setDragX(0);
        setDragY(0);
        return;
      }

      const durationMs = performance.now() - state.startT;
      finishGesture(state.dx, durationMs, state.moved, anchor);
    },
    [finishGesture]
  );

  // 窗口级监听：鼠标拖出卡片仍可跟手；触控/鼠标统一 Pointer Events
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const state = dragRef.current;
      if (!state.active || leavingRef.current) return;
      if (state.pointerId !== -1 && e.pointerId !== state.pointerId) return;

      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      if (Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP) state.moved = true;

      state.dx = dx;
      state.dy = dy;
      setDragX(dx);
      setDragY(dy * 0.12);

      if (state.moved) e.preventDefault();
    };

    const onUp = (e: PointerEvent) => {
      if (!dragRef.current.active) return;
      endDrag(e.pointerId);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [endDrag]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!current || leavingRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    e.preventDefault();
    const el = e.currentTarget as HTMLDivElement;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    const now = performance.now();
    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startT: now,
      dx: 0,
      dy: 0,
      moved: false,
    };
    setDragging(true);
  };

  // 电脑键盘：← 跳过 / → 关注 / Enter 进房
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (leavingRef.current) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const anchorId = queueRef.current[0];
      const anchor = anchorId ? getAnchorById(anchorId) : undefined;
      if (!anchor) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        advance('left', anchor);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        advance('right', anchor);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        tryEnterLiveRoom(anchor.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance]);

  if (onlineIds.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <p className="text-[15px] font-bold text-[#0f1419]">暂时没有在播主播</p>
        <p className="text-[13px] text-[#536471]">稍后再来，或切换到「在线」看看列表</p>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <p className="text-[15px] font-bold text-[#0f1419]">本轮推荐看完了</p>
        <p className="text-[13px] text-[#536471]">换一批继续刷，或去其它 Tab 逛逛</p>
        <button
          type="button"
          onClick={refill}
          className="rounded-full bg-[#1d9bf0] px-4 py-2 text-[13px] font-bold text-white"
        >
          再来一批
        </button>
      </div>
    );
  }

  const runtime = runtimeMap[current.id];
  const isFollowed = followedIds.includes(current.id);
  const rotate = dragX * 0.04;
  const likeOpacity = Math.min(1, Math.max(0, dragX / SWIPE_DISTANCE));
  const nopeOpacity = Math.min(1, Math.max(0, -dragX / SWIPE_DISTANCE));

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-black select-none">
      <div className="relative min-h-0 flex-1 overflow-hidden" style={{ touchAction: 'none' }}>
        {next && (
          <div className="pointer-events-none absolute inset-3 overflow-hidden rounded-2xl opacity-50">
            <AnchorImage anchor={next} fit="cover" className="h-full w-full" />
          </div>
        )}

        <div
          ref={cardRef}
          role="button"
          tabIndex={0}
          aria-label={`${current.stageName}，点击进入直播间，左滑跳过，右滑关注`}
          className={`absolute inset-3 overflow-hidden rounded-2xl outline-none ${
            dragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{
            transform: `translate3d(${dragX}px, ${dragY}px, 0) rotate(${rotate}deg)`,
            transition: leaving || !dragging ? 'transform 0.22s ease-out' : 'none',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
          onPointerDown={onPointerDown}
          onDragStart={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="pointer-events-none absolute inset-0">
            <AnchorImage anchor={current} fit="cover" className="h-full w-full" />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/30" />

          <div
            className="pointer-events-none absolute left-4 top-5 rounded-lg border-4 border-[#00ba7c] px-3 py-1 text-[22px] font-black tracking-wider text-[#00ba7c]"
            style={{ opacity: likeOpacity, transform: 'rotate(-12deg)' }}
          >
            关注
          </div>
          <div
            className="pointer-events-none absolute right-4 top-5 rounded-lg border-4 border-[#f4212e] px-3 py-1 text-[22px] font-black tracking-wider text-[#f4212e]"
            style={{ opacity: nopeOpacity, transform: 'rotate(12deg)' }}
          >
            跳过
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex items-center gap-1 rounded-full bg-[#f4212e] px-2 py-0.5 text-[10px] font-bold text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                LIVE
              </span>
              <span className="rounded-full bg-black/45 px-2 py-0.5 text-[11px] text-white">
                {formatViewers(runtime?.currentViewers ?? 0)} 观看
              </span>
              {isFollowed && (
                <span className="rounded-full border border-white/50 px-2 py-0.5 text-[11px] text-white">
                  已关注
                </span>
              )}
            </div>
            <p className="text-[22px] font-extrabold leading-7 text-white">{current.stageName}</p>
            <p className="mt-1 text-[13px] text-white/80">
              @{current.realName.replace(/\s+/g, '').toLowerCase()}
              {current.isHuman === false ? ` · ${current.species}` : ''}
              {' · '}
              {current.ageLabel ?? `${current.age}岁`}
            </p>
            <p className="mt-1 text-[14px] font-semibold text-white/95">{current.tag}</p>
            <p className="mt-2 line-clamp-3 text-[13px] leading-5 text-white/85">{current.background}</p>
            {runtime?.activity && (
              <p className="mt-2 text-[12px] text-[#1d9bf0]">
                {runtime.activity.icon} {runtime.activity.label}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[#2f3336] bg-black px-4 py-2.5">
        <button
          type="button"
          onClick={() => advance('left', current)}
          className="rounded-full border border-[#536471] px-3 py-1.5 text-[12px] font-bold text-[#e7e9ea] active:scale-95"
        >
          ← 跳过
        </button>
        <span className="text-center text-[11px] text-[#71767b]">
          触控/拖拽滑动
          <br />
          点击进房
        </span>
        <button
          type="button"
          onClick={() => advance('right', current)}
          className="rounded-full bg-[#00ba7c] px-3 py-1.5 text-[12px] font-bold text-white active:scale-95"
        >
          关注 →
        </button>
      </div>
    </div>
  );
}

function formatViewers(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return `${n}`;
}
