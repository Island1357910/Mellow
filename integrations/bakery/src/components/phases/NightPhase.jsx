import { useMemo } from 'react';
import { useGame } from '../../context/GameContext';

export default function NightPhase() {
  const { state, dispatch, save } = useGame();
  const ts = state.todayStats;
  const avgSat = ts.guests > 0 ? Math.round(ts.totalSatisfaction / ts.guests) : 0;
  const repChange = state.reputation - (state.prevReputation || 0);

  const tips = useMemo(() => {
    const t = [];
    if (ts.guests > 0 && ts.happy / ts.guests < 0.5)
      t.push('💡 试着制作更贴合客人口味偏好的面包。');
    if (state.menuRecipes.length < 4)
      t.push('💡 增加菜单种类可以满足更多类型的客人。');
    return t;
  }, [ts, state.menuRecipes]);

  const nextDay = () => {
    dispatch({ type: 'NEXT_DAY' });
    save();
  };

  return (
    <div className="night-container fade-in">
      <div className="night-card">
        <h2>🌙 今日总结</h2>
        <div className="summary-grid">
          <div className="summary-item">
            <div className="summary-value">{ts.income}</div>
            <div className="summary-label">💰 收入</div>
          </div>
          <div className="summary-item">
            <div className="summary-value">{ts.guests}</div>
            <div className="summary-label">👥 接待客人</div>
          </div>
          <div className="summary-item">
            <div className="summary-value">{avgSat}%</div>
            <div className="summary-label">😊 平均满意度</div>
          </div>
          <div className="summary-item">
            <div className="summary-value">{repChange >= 0 ? '+' : ''}{repChange}</div>
            <div className="summary-label">⭐ 声望变化</div>
          </div>
        </div>

        {tips.length > 0 && (
          <div className="night-tips">{tips.map((t, i) => <div key={i}>{t}</div>)}</div>
        )}

        <button className="btn btn-primary btn-large" onClick={nextDay}>迎接新的一天 🌅</button>
      </div>
    </div>
  );
}
