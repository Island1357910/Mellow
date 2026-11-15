import { createContext, useContext, useState, useCallback } from 'react';

/** 主内容区页面（店面与面包房拆成两个子页面） */
export const PAGE_IDS = {
  hub: 'hub',               // 像素面包房主地图导航
  gameStore: 'gameStore',   // 店面（营业）
  gameBakery: 'gameBakery', // 面包房（早晨/研发/夜晚）
  inventory: 'inventory',
  procurement: 'procurement',
  filling: 'filling',
  recipes: 'recipes',
  customOrder: 'customOrder',   // 定制单
  competition: 'competition',   // 比赛
  principle: 'principle',   // 烘焙原理
  explore: 'explore',       // 探索（已发现的协同与模具）
  story: 'story',
  characters: 'characters',
  settings: 'settings',
  workshop: 'workshop',     // 工作室（像素场景内进入配方/剧情等）
  craftFloor: 'craftFloor', // 工坊（库存 / 馅料 / 探索）
  achievements: 'achievements', // 成就（工作室地图内嵌；抽屉可直达）
};

const UIContext = createContext(null);

export function UIProvider({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activePage, setActivePage] = useState(PAGE_IDS.hub);
  const [pinnedRecipe, setPinnedRecipe] = useState(null);
  const [pinPosition, setPinPosition] = useState({ x: 24, y: 120 });

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const navigateTo = useCallback((pageId) => {
    setActivePage(pageId);
    setDrawerOpen(false);
  }, []);

  const pinRecipe = useCallback((recipe) => setPinnedRecipe(recipe || null), []);
  const unpinRecipe = useCallback(() => setPinnedRecipe(null), []);

  return (
    <UIContext.Provider value={{
      drawerOpen,
      setDrawerOpen,
      activePage,
      setActivePage,
      openDrawer,
      closeDrawer,
      navigateTo,
      pinnedRecipe,
      pinRecipe,
      unpinRecipe,
      pinPosition,
      setPinPosition,
    }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be inside UIProvider');
  return ctx;
}
