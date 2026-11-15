import { useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { useUI, PAGE_IDS } from '../../context/UIContext';

export default function MorningPhase() {
  const { state, dispatch, rollEvent } = useGame();
  const { navigateTo } = useUI();

  useEffect(() => {
    if (state.currentEvent) return;
    rollEvent();
    // 仅首日历无事件时补滚一次；不把 rollEvent 放入依赖以免重复触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentEvent]);

  const event = state.currentEvent;
  const goToDevelop = () => dispatch({ type: 'SET_PHASE', phase: 'develop' });

  const effectText = (() => {
    if (!event?.effect || !Object.keys(event.effect).length) return null;
    const e = event.effect;
    if (e.demandUp) return `📈 ${e.keyword}相关面包需求 +${Math.round((e.demandUp - 1) * 100)}%`;
    if (e.spawnRate && e.customerType) return `👥 顾客类型：${e.customerType}较多`;
    if (e.costDiscount) return `💰 原料成本 -${Math.round((1 - e.costDiscount) * 100)}%`;
    if (e.guestCount) return `👥 今日客人数量 +${Math.round((e.guestCount - 1) * 100)}%`;
    if (e.repBonus) return `⭐ 声望奖励翻倍`;
    if (e.special === 'full_moon') return `🌕 月圆之夜有特殊事件可能发生...`;
    return null;
  })();

  return (
    <div className="morning-container fade-in">
      <div className="morning-card">
        <div className="morning-top-actions">
          <button type="button" className="btn btn-tiny btn-secondary" onClick={() => navigateTo(PAGE_IDS.craftFloor)}>
            🧰 工坊
          </button>
          <button type="button" className="btn btn-tiny btn-secondary" onClick={() => navigateTo(PAGE_IDS.procurement)}>
            🛒 超市采购
          </button>
        </div>
        <h2>🌅 新的一天开始了</h2>
        {event && (
          <div className="event-card">
            <div className="event-icon">{event.icon}</div>
            <h3>{event.title}</h3>
            <p>{event.desc}</p>
            {effectText && <div className="event-effect">{effectText}</div>}
          </div>
        )}
        <div className="morning-stats">
          <div className="mini-stat"><span>昨日收入</span><strong>{state.yesterdayStats.income} 💰</strong></div>
          <div className="mini-stat"><span>昨日客人</span><strong>{state.yesterdayStats.guests} 人</strong></div>
          <div className="mini-stat"><span>满意度</span><strong>{state.yesterdayStats.rate === '-' ? '-' : `${state.yesterdayStats.rate}%`}</strong></div>
        </div>
        <button className="btn btn-primary btn-large" onClick={goToDevelop}>开始新的一天 →</button>
      </div>
    </div>
  );
}
