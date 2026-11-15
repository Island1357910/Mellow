import { useGame } from '../context/GameContext';
import { useUI, PAGE_IDS } from '../context/UIContext';
import { resetHubOnboarding } from '../systems/onboardingStorage';

/** 顶栏：主页、保存 + 玩家信息 */
export default function TopBar() {
  const { state, save, notify } = useGame();
  const { navigateTo } = useUI();

  const replayHubTutorial = () => {
    resetHubOnboarding();
    navigateTo(PAGE_IDS.hub);
    notify('新手引导已重新开启：请看地图上的高亮标签。', 'info');
  };

  return (
    <header className="bakery-header bakery-header-minimal">
      <div className="bar-left">
        <div className="header-nav-col">
          <button type="button" className="btn btn-tiny btn-secondary header-nav-btn" onClick={() => navigateTo(PAGE_IDS.hub)} title="返回像素主地图">
            🏠 主页
          </button>
          <button
            type="button"
            className="btn btn-tiny btn-secondary header-nav-btn header-tutorial-btn"
            onClick={replayHubTutorial}
            title="从第一步重新播放主地图新手引导"
          >
            📖 新手引导
          </button>
        </div>
        <button type="button" className="icon-btn icon-btn-save" onClick={() => save()} title="保存游戏">💾</button>
        <div className="header-player-block">
          <div className="header-day-recipe-row" role="group" aria-label="天数与配方">
            <span className="day-badge">第 {state.day} 天</span>
            <span className="stat-item" title="已存配方">📜{state.recipes?.length ?? 0}</span>
          </div>
          <div className="header-stats-row" role="group" aria-label="金币与声望">
            <span className="stat-item" title="金币">💰{state.gold}</span>
            <span className="stat-item" title="声望">⭐{state.reputation}</span>
          </div>
        </div>
      </div>
      <div className="bar-right" />
    </header>
  );
}
