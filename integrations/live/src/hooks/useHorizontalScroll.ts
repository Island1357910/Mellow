import { useRef, useCallback, useEffect } from 'react';

/**
 * 横向标签滑动：手机触摸原生滚动 + 电脑滚轮/拖拽。
 * 拖拽可从标签按钮上开始；若发生明显位移则抑制随后的 click。
 */
export function useHorizontalScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const dragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    scrollLeft: 0,
    pointerId: -1,
  });

  const onWheel = useCallback((e: React.WheelEvent) => {
    const el = ref.current;
    if (!el) return;
    // 竖向滚轮转横向；已有明显横向滚轮则交给浏览器
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    if (el.scrollWidth <= el.clientWidth) return;
    e.preventDefault();
    el.scrollLeft += e.deltaY;
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.button !== 0) return;
    // 触摸交给原生惯性滚动，避免抢手势
    if (e.pointerType === 'touch') return;
    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      scrollLeft: el.scrollLeft,
      pointerId: e.pointerId,
    };
    el.style.cursor = 'grabbing';
    el.style.userSelect = 'none';
  }, []);

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current.moved) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current.moved = false;
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const state = dragRef.current;
      if (!state.active || !ref.current) return;
      const dx = e.clientX - state.startX;
      if (Math.abs(dx) > 4) state.moved = true;
      if (!state.moved) return;
      e.preventDefault();
      ref.current.scrollLeft = state.scrollLeft - dx;
    };

    const onUp = () => {
      if (!dragRef.current.active) return;
      dragRef.current.active = false;
      if (ref.current) {
        ref.current.style.cursor = '';
        ref.current.style.userSelect = '';
      }
      // moved 保留到 clickCapture 消费
      window.setTimeout(() => {
        dragRef.current.moved = false;
      }, 0);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  return {
    ref,
    onWheel,
    onPointerDown,
    onClickCapture,
    /** @deprecated 兼容旧调用 */
    onMouseDown: onPointerDown as unknown as (e: React.MouseEvent) => void,
  };
}
