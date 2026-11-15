import { useState, useRef, useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useBaking } from '../../context/BakingContext';
import { subscribeBakingPct, getBakingPctSnapshot } from '../../context/bakingPctStore';
import './BakingProgressBar.css';

export default function BakingProgressBar() {
  const { baking } = useBaking();
  const pct = useSyncExternalStore(subscribeBakingPct, getBakingPctSnapshot, () => 0);
  const elRef = useRef(null);
  const [pos, setPos] = useState({ x: 24, y: 100 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  useEffect(() => {
    if (!dragging) return;
    const move = (e) => {
      const cx = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      const cy = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
      const dx = cx - dragStart.current.x;
      const dy = cy - dragStart.current.y;
      dragStart.current = { x: cx, y: cy, posX: dragStart.current.posX + dx, posY: dragStart.current.posY + dy };
      const w = elRef.current?.offsetWidth ?? 220;
      const maxX = typeof window !== 'undefined' ? window.innerWidth - w - 8 : 800 - w;
      setPos({
        x: Math.max(8, Math.min(maxX, dragStart.current.posX)),
        y: Math.max(8, Math.min((typeof window !== 'undefined' ? window.innerHeight : 600) - 80, dragStart.current.posY)),
      });
    };
    const up = () => setDragging(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
  }, [dragging]);

  const startDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const cx = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const cy = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    dragStart.current = { x: cx, y: cy, posX: pos.x, posY: pos.y };
    setDragging(true);
  };

  if (!baking.active) return null;

  const node = (
    <div
      ref={elRef}
      className="baking-progress-global baking-progress-draggable"
      role="status"
      aria-live="polite"
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="baking-progress-drag-handle" onMouseDown={startDrag} onTouchStart={startDrag}>
        ⋮⋮ 拖动
      </div>
      <span className="baking-progress-label">🔥 烘焙中</span>
      <div className="baking-progress-track">
        <div className="baking-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="baking-progress-pct">{Math.round(pct)}%</span>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(node, document.body) : node;
}
