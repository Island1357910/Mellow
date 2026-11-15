import { useMemo, useState } from 'react';
import { useGame } from '../context/GameContext';
import {
  ACHIEVEMENT_CATEGORY_ORDER,
  ACHIEVEMENT_DEFINITIONS,
  getAchievementCategory,
} from '../data/achievements';

export default function AchievementsPage() {
  const { state } = useGame();
  const unlocked = useMemo(() => new Set(state.unlockedAchievements || []), [state.unlockedAchievements]);
  const total = ACHIEVEMENT_DEFINITIONS.length;
  const count = unlocked.size;

  const byCategory = useMemo(() => {
    /** @type {Record<string, typeof ACHIEVEMENT_DEFINITIONS>} */
    const map = Object.fromEntries(ACHIEVEMENT_CATEGORY_ORDER.map((c) => [c.id, []]));
    for (const def of ACHIEVEMENT_DEFINITIONS) {
      map[getAchievementCategory(def.id)].push(def);
    }
    return map;
  }, []);

  const [activeCat, setActiveCat] = useState(() => ACHIEVEMENT_CATEGORY_ORDER[0]?.id ?? 'retail');
  const defsInTab = byCategory[activeCat] ?? byCategory.retail ?? [];

  const PANEL_ID = 'achievement-category-panel';

  const onTablistKeyDown = (e) => {
    const order = ACHIEVEMENT_CATEGORY_ORDER;
    const i = order.findIndex((c) => c.id === activeCat);
    if (i < 0) return;
    let next = i;
    if (e.key === 'ArrowRight') next = (i + 1) % order.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + order.length) % order.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = order.length - 1;
    else return;
    e.preventDefault();
    const nextId = order[next].id;
    setActiveCat(nextId);
    queueMicrotask(() => {
      document.getElementById(`achievement-tab-${nextId}`)?.focus();
    });
  };

  return (
    <div className="page-view panel achievements-page">
      <div className="page-view-head">
        <h2>🏅 成就</h2>
        <p className="drawer-hint achievements-progress">
          已解锁 <strong>{count}</strong> / {total}
        </p>
      </div>
      <div className="page-view-body">
        <div
          className="proc-tabs achievements-tabs"
          role="tablist"
          aria-label="成就分类"
          onKeyDown={onTablistKeyDown}
        >
          {ACHIEVEMENT_CATEGORY_ORDER.map((cat) => {
            const list = byCategory[cat.id] ?? [];
            const u = list.filter((d) => unlocked.has(d.id)).length;
            const n = list.length;
            const selected = activeCat === cat.id;
            return (
              <button
                key={cat.id}
                id={`achievement-tab-${cat.id}`}
                type="button"
                role="tab"
                tabIndex={selected ? 0 : -1}
                aria-selected={selected}
                aria-controls={PANEL_ID}
                className={`proc-tab${selected ? ' on' : ''}`}
                onClick={() => setActiveCat(cat.id)}
              >
                <span className="achievements-tab-label">{cat.label}</span>
                <span className="achievements-tab-count">
                  {u}/{n}
                </span>
              </button>
            );
          })}
        </div>
        <div
          id={PANEL_ID}
          className="achievements-grid"
          role="tabpanel"
          aria-labelledby={`achievement-tab-${activeCat}`}
        >
          {defsInTab.map((def) => {
            const ok = unlocked.has(def.id);
            return (
              <article
                key={def.id}
                className={`achievement-card${ok ? ' is-unlocked' : ' is-locked'}`}
                aria-label={ok ? `已解锁：${def.name}` : `未解锁：${def.name}`}
              >
                <span className="achievement-card-icon" aria-hidden>
                  {ok ? def.icon : '🔒'}
                </span>
                <span className="achievement-card-name">{def.name}</span>
                <span className="achievement-card-desc">{def.desc}</span>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
