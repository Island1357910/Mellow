import { useState, useRef, useEffect, useCallback } from 'react';
import { useGame } from '../../context/GameContext';
import { useUI } from '../../context/UIContext';
import { bakeTechniques } from '../../data/techniques';
import { breadMolds } from '../../data/molds';
import { ingredients } from '../../data/ingredients';
import IngredientThumb from '../IngredientThumb';
import { aiTintCategoryForIngredientLine, aiTintVariantForIngredientLine } from '../../utils/procurementDisplay';
import './RecipeFloatingPin.css';

const techniqueName = (id) => bakeTechniques.find((t) => t.id === id)?.name || '直接法';
const moldName = (id) => breadMolds.find((m) => m.id === id)?.name || '圆模';

const PIN_MIN_W = 200;
const PIN_MIN_H = 160;
const PIN_MAX_W = 560;
const PIN_MAX_H = 720;

/** 原料名 → 类别（面粉/液体/酵母/风味/馅料/辅料） */
const nameToCategory = (() => {
  const map = {};
  for (const [cat, list] of Object.entries(ingredients)) {
    for (const ing of list || []) if (ing?.name) map[ing.name] = cat;
  }
  return map;
})();

const getIngredientName = (s) => {
  const m = String(s).match(/^([^\s]+)/);
  return m ? m[1] : s;
};

export default function RecipeFloatingPin() {
  const { state } = useGame();
  const { pinnedRecipe, unpinRecipe, pinPosition, setPinPosition } = useUI();
  const [isDragging, setIsDragging] = useState(false);
  const [size, setSize] = useState({ w: 260, h: 340 });
  const dragRef = useRef({ startX: 0, startY: 0, startPos: { x: 0, y: 0 } });
  const resizeRef = useRef(null);
  const sizeRef = useRef(size);
  sizeRef.current = size;

  useEffect(() => {
    if (!isDragging) return;
    const move = (e) => {
      const cx = e.clientX ?? e.touches?.[0]?.clientX;
      const cy = e.clientY ?? e.touches?.[0]?.clientY;
      const dx = cx - dragRef.current.startX;
      const dy = cy - dragRef.current.startY;
      setPinPosition({
        x: Math.max(0, dragRef.current.startPos.x + dx),
        y: Math.max(0, dragRef.current.startPos.y + dy),
      });
    };
    const up = () => setIsDragging(false);
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
  }, [isDragging, setPinPosition]);

  const onResizeMove = useCallback((e) => {
    const d = resizeRef.current;
    if (!d) return;
    const nw = Math.min(PIN_MAX_W, Math.max(PIN_MIN_W, d.ow + e.clientX - d.sx));
    const nh = Math.min(PIN_MAX_H, Math.max(PIN_MIN_H, d.oh + e.clientY - d.sy));
    setSize({ w: nw, h: nh });
  }, []);

  const onResizeUp = useCallback(() => {
    resizeRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onResizeMove);
    window.addEventListener('mouseup', onResizeUp);
    return () => {
      window.removeEventListener('mousemove', onResizeMove);
      window.removeEventListener('mouseup', onResizeUp);
    };
  }, [onResizeMove, onResizeUp]);

  const startDrag = (e) => {
    const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const y = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    dragRef.current = { startX: x, startY: y, startPos: { ...pinPosition } };
    setIsDragging(true);
  };

  const startResize = (e) => {
    const s = sizeRef.current;
    resizeRef.current = { sx: e.clientX, sy: e.clientY, ow: s.w, oh: s.h };
    e.preventDefault();
    e.stopPropagation();
  };

  if (!pinnedRecipe) return null;

  const r = pinnedRecipe;
  const isClassic = r.id?.startsWith('cls_');
  const stats = r.stats || {};
  const ingBlock = r.ingredients || (isClassic ? {
    面粉: r.面粉, 液体: r.液体, 酵母: r.酵母, 风味: r.风味, 馅料: r.馅料,
  } : null);

  return (
    <div
      className="recipe-floating-pin"
      style={{
        left: pinPosition.x,
        top: pinPosition.y,
        width: size.w,
        height: size.h,
        maxWidth: 'min(560px, calc(100vw - 32px))',
        maxHeight: 'min(720px, calc(100vh - 24px))',
      }}
    >
      <div
        className="recipe-pin-header"
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        role="presentation"
      >
        <h4>📜 {r.name}</h4>
        <button
          type="button"
          className="recipe-pin-close"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); unpinRecipe(); }}
        >
          ×
        </button>
      </div>
      <div className="recipe-pin-body">
        {(r.shortDesc || r.description) && <p className="recipe-pin-desc">{r.shortDesc || r.description}</p>}
        {r.ingredientList?.length > 0 ? (
          <div className="recipe-pin-ingredients recipe-pin-capsules">
            {r.ingredientList.map((s, i) => {
              const name = getIngredientName(s);
              const cat = nameToCategory[name] || 'other';
              return (
                <span key={i} className={`recipe-pin-tag recipe-pin-tag--${cat}`}>
                  <IngredientThumb
                    name={s}
                    size="sm"
                    aiTintCategory={aiTintCategoryForIngredientLine(state.customProcurementItems, s)}
                    aiTintVariant={aiTintVariantForIngredientLine(state.customProcurementItems, s)}
                  />
                  {s}
                </span>
              );
            })}
          </div>
        ) : ingBlock && (
          <div className="recipe-pin-ingredients">
            {Object.entries(ingBlock).map(([cat, v]) => {
              const val = v?.name ?? v;
              if (!val) return null;
              const nm = typeof val === 'string' ? val : val?.name;
              return (
                <span key={cat} className={`recipe-pin-tag recipe-pin-tag--${cat}`}>
                  {typeof nm === 'string' ? (
                    <IngredientThumb
                      name={nm}
                      size="sm"
                      aiTintCategory={aiTintCategoryForIngredientLine(state.customProcurementItems, nm)}
                      aiTintVariant={aiTintVariantForIngredientLine(state.customProcurementItems, nm)}
                    />
                  ) : null}
                  {cat}: {nm}
                </span>
              );
            })}
          </div>
        )}
        <div className="recipe-pin-stats">
          <span>甜度 {stats.甜度 ?? 0}</span>
          <span>柔软度 {stats.柔软度 ?? 0}</span>
          <span>香气 {stats.香气 ?? 0}</span>
          <span>复杂度 {stats.复杂度 ?? 0}</span>
        </div>
        {isClassic && (r.手法 || r.炉温 || r.模具) && (
          <div className="recipe-pin-meta">
            {r.手法 && <span>{r.手法}</span>}
            {r.炉温 && <span>{r.炉温}°C</span>}
            {r.模具 && <span>{r.模具}</span>}
          </div>
        )}
        {!isClassic && r.bakeMeta && (
          <div className="recipe-pin-meta">
            <span>手法 {techniqueName(r.bakeMeta.techniqueId)}</span>
            <span>炉温 {r.bakeMeta.bakeTempC ?? 180}℃</span>
            <span>模具 {moldName(r.bakeMeta.moldId)}</span>
          </div>
        )}
      </div>
      <button
        type="button"
        className="recipe-pin-resize"
        aria-label="调整悬浮窗大小"
        onMouseDown={startResize}
      />
    </div>
  );
}
