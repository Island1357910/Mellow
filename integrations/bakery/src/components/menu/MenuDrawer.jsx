import { useUI, PAGE_IDS } from '../../context/UIContext';
import { useGame } from '../../context/GameContext';
import { resetHubOnboarding } from '../../systems/onboardingStorage';

const MENU_ITEMS = [
  { id: PAGE_IDS.gameStore, label: '店面', icon: '🏠' },
  { id: PAGE_IDS.gameBakery, label: '面包房', icon: '🧪' },
  { id: PAGE_IDS.inventory, label: '库存', icon: '📦' },
  { id: PAGE_IDS.procurement, label: '采购', icon: '🛒' },
  { id: PAGE_IDS.filling, label: '馅料', icon: '🥣' },
  { id: PAGE_IDS.recipes, label: '配方', icon: '📜' },
  { id: PAGE_IDS.customOrder, label: '定制', icon: '📋' },
  { id: PAGE_IDS.competition, label: '比赛', icon: '🏅' },
  { id: PAGE_IDS.principle, label: '原理', icon: '📐' },
  { id: PAGE_IDS.explore, label: '探索', icon: '🔭' },
  { id: PAGE_IDS.achievements, label: '成就', icon: '🏅' },
  { id: PAGE_IDS.story, label: '主线', icon: '📖' },
  { id: PAGE_IDS.characters, label: '故事', icon: '👥' },
  { id: PAGE_IDS.settings, label: '设置', icon: '⚙️' },
];

export default function MenuDrawer() {
  const { drawerOpen, closeDrawer, navigateTo, activePage } = useUI();
  const { save, notify } = useGame();

  const replayHubTutorial = () => {
    resetHubOnboarding();
    closeDrawer();
    navigateTo(PAGE_IDS.hub);
    notify('新手引导已重新开启：请看地图上的高亮标签。', 'info');
  };

  return (
    <aside
      className={`bakery-side-drawer${drawerOpen ? ' open' : ''}`}
      aria-hidden={!drawerOpen}
    >
      <div
        className="bakery-side-drawer-backdrop"
        onClick={closeDrawer}
        role="presentation"
      />
      <div className="bakery-side-drawer-panel">
        <div className="bakery-drawer-header-row">
          <h1 className="bakery-drawer-logo">🍞 千味面包房</h1>
          <button type="button" className="icon-btn icon-btn-save" onClick={save} title="保存游戏">💾</button>
        </div>
        <div className="bakery-drawer-title">
          <button type="button" className="bakery-drawer-close" onClick={closeDrawer} aria-label="关闭菜单">×</button>
        </div>
        <div className="bakery-drawer-tutorial-row">
          <button type="button" className="btn btn-secondary btn-small drawer-tutorial-btn" onClick={replayHubTutorial}>
            📖 再看新手引导
          </button>
        </div>
        <nav className="bakery-drawer-nav-grid drawer-nav" aria-label="页面导航">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`drawer-nav-btn${activePage === item.id ? ' is-current-page' : ''}`}
              onClick={() => navigateTo(item.id)}
            >
              <span className="drawer-nav-icon" aria-hidden>{item.icon}</span>
              <span className="drawer-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
}
