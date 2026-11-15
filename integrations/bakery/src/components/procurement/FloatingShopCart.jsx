import { useState, useRef, useEffect, useCallback } from 'react';

const MIN_W = 220;
const MIN_H_EXPANDED = 140;
const MAX_W = 520;
/** 购物车整体（含标题栏）最大高度 */
const MAX_CART_TOTAL_H = 420;
const COLLAPSED_H = 44;

/**
 * 可拖动、可拖拽右下角缩放的购物车悬浮窗（采购页专用）
 * 默认收叠为仅标题栏；展开后总高度受限，列表区域独立滚轮滚动
 */
export default function FloatingShopCart({ title = '🛒 购物车', children, className = '' }) {
  const [collapsed, setCollapsed] = useState(true);
  const [pos, setPos] = useState(() => ({
    x: typeof window !== 'undefined' ? Math.max(24, window.innerWidth - 300) : 80,
    y: 120,
  }));
  const [size, setSize] = useState({ w: 260, h: 280 });
  const dragRef = useRef(null);
  const posRef = useRef(pos);
  const sizeRef = useRef(size);
  const collapsedRef = useRef(collapsed);
  posRef.current = pos;
  sizeRef.current = size;
  collapsedRef.current = collapsed;

  const cartHeight = useCallback(() => {
    if (collapsedRef.current) return COLLAPSED_H;
    return Math.min(sizeRef.current.h, MAX_CART_TOTAL_H);
  }, []);

  const onMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d) return;
    const sw = sizeRef.current.w;
    const sh = cartHeight();
    if (d.type === 'move') {
      let nx = d.ox + e.clientX - d.sx;
      let ny = d.oy + e.clientY - d.sy;
      const maxX = window.innerWidth - 48;
      const maxY = window.innerHeight - 48;
      nx = Math.min(Math.max(8, nx), maxX - sw);
      ny = Math.min(Math.max(8, ny), maxY - sh);
      setPos({ x: nx, y: ny });
    } else if (d.type === 'resize') {
      const nw = Math.min(MAX_W, Math.max(MIN_W, d.ow + e.clientX - d.sx));
      const nh = Math.min(MAX_CART_TOTAL_H, Math.max(MIN_H_EXPANDED, d.oh + e.clientY - d.sy));
      setSize({ w: nw, h: nh });
    }
  }, [cartHeight]);

  const onUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [onMove, onUp]);

  const startMove = (e) => {
    const p = posRef.current;
    dragRef.current = { type: 'move', sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y };
    e.preventDefault();
  };

  const startResize = (e) => {
    const s = sizeRef.current;
    dragRef.current = { type: 'resize', sx: e.clientX, sy: e.clientY, ow: s.w, oh: s.h };
    e.preventDefault();
    e.stopPropagation();
  };

  const displayH = collapsed ? undefined : Math.min(size.h, MAX_CART_TOTAL_H);

  return (
    <div
      className={`floating-shop-cart${collapsed ? ' floating-shop-cart--collapsed' : ''} ${className}`.trim()}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: displayH,
        maxHeight: collapsed ? undefined : MAX_CART_TOTAL_H,
        zIndex: 300,
      }}
    >
      <div
        className="floating-shop-cart-head"
        onMouseDown={startMove}
        role="presentation"
      >
        <button
          type="button"
          className="floating-shop-cart-collapse"
          aria-expanded={!collapsed}
          aria-label={collapsed ? '展开购物车' : '折叠购物车'}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setCollapsed((c) => !c);
          }}
        >
          {collapsed ? '▲' : '▼'}
        </button>
        <span className="floating-shop-cart-title">{title}</span>
        <span className="floating-shop-cart-drag-hint" aria-hidden>⠿</span>
      </div>
      {!collapsed && (
        <div className="floating-shop-cart-body">
          {children}
        </div>
      )}
      {!collapsed && (
        <button
          type="button"
          className="floating-shop-cart-resize"
          aria-label="调整大小"
          onMouseDown={startResize}
        />
      )}
    </div>
  );
}
