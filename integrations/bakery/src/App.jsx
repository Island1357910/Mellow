import { useState } from 'react';
import { useGame } from './context/GameContext';
import { UIProvider, PAGE_IDS, useUI } from './context/UIContext';
import { BakingProvider } from './context/BakingContext';
import { BgmProvider } from './context/BgmContext';
import LayoutShell from './components/LayoutShell';
import TopBar from './components/TopBar';
import BakeryHubMap from './components/store/BakeryHubMap';
import StoreCounterScene from './components/store/StoreCounterScene';
import NotificationStack from './components/common/Notification';
import MorningPhase from './components/phases/MorningPhase';
import DevelopPhase from './components/phases/DevelopPhase';
import BusinessPhase from './components/phases/BusinessPhase';
import NightPhase from './components/phases/NightPhase';
import {
  InventoryPage,
  ProcurementPage,
  FillingLabPage,
  RecipesPage,
  StoryPage,
  CharactersPage,
  SettingsPage,
  ExplorationPage,
} from './pages/menuPages';
import WorkshopMap from './components/workshop/WorkshopMap';
import CraftFloorMap from './components/craftFloor/CraftFloorMap';
import CustomOrderPage from './pages/CustomOrderPage';
import CompetitionPage from './pages/CompetitionPage';
import PrinciplePage from './pages/PrinciplePage';
import AchievementsPage from './pages/AchievementsPage';
import RecipeFloatingPin from './components/recipe/RecipeFloatingPin';
import BakingProgressBar from './components/recipe/BakingProgressBar';
import BakingResultModal from './components/recipe/BakingResultModal';
import IntroSequence from './components/IntroSequence';
const bakeryPhases = { morning: MorningPhase, develop: DevelopPhase, night: NightPhase };

/** 所有页面常驻挂载，仅用 display 切换显示，切换页面时内容不刷新 */
function MainContent() {
  const { state } = useGame();
  const { activePage } = useUI();

  const hide = (id) => (activePage !== id ? { display: 'none' } : {});

  return (
    <div className="main-content-pages">
      <div style={hide(PAGE_IDS.hub)}>
        <div className="page-view panel hub-page-view">
          <div className="page-view-body">
            <BakeryHubMap />
          </div>
        </div>
      </div>
      <div style={hide(PAGE_IDS.gameStore)}>
        {state.phase === 'business' ? (
          <BusinessPhase key="business" />
        ) : (
          <div className="page-view panel store-page-placeholder">
            <div className="page-view-head"><h2>🏪 店面</h2></div>
            <div className="page-view-body">
              <StoreCounterScene portraitUrl={null} className="store-counter-scene--placeholder" />
              <p className="store-placeholder-hint drawer-hint" style={{ marginTop: 16 }}>
                当前阶段：{state.phase === 'morning' ? '早晨' : state.phase === 'develop' ? '研发' : '夜晚'}。
                请先到 <strong>面包房</strong> 完成研发并开门营业后，再来店面接待客人。可从左上角「主页」返回导航地图。
              </p>
            </div>
          </div>
        )}
      </div>
      <div style={hide(PAGE_IDS.gameBakery)}>
        {(function () {
          const Phase = bakeryPhases[state.phase] || DevelopPhase;
          return <Phase key={state.phase} />;
        })()}
      </div>
      <div style={hide(PAGE_IDS.inventory)}><InventoryPage /></div>
      <div style={hide(PAGE_IDS.workshop)}>
        <div className="page-view panel workshop-page-view">
          <div className="page-view-body">
            <WorkshopMap />
          </div>
        </div>
      </div>
      <div style={hide(PAGE_IDS.craftFloor)}>
        <div className="page-view panel workshop-page-view craft-floor-page-view">
          <div className="page-view-body">
            <CraftFloorMap />
          </div>
        </div>
      </div>
      <div style={hide(PAGE_IDS.procurement)}><ProcurementPage /></div>
      <div style={hide(PAGE_IDS.filling)}><FillingLabPage /></div>
      <div style={hide(PAGE_IDS.recipes)}><RecipesPage /></div>
      <div style={hide(PAGE_IDS.customOrder)}><CustomOrderPage /></div>
      <div style={hide(PAGE_IDS.competition)}><CompetitionPage /></div>
      <div style={hide(PAGE_IDS.principle)}><PrinciplePage /></div>
      <div style={hide(PAGE_IDS.explore)}><ExplorationPage /></div>
      <div style={hide(PAGE_IDS.story)}><StoryPage /></div>
      <div style={hide(PAGE_IDS.characters)}><CharactersPage /></div>
      <div style={hide(PAGE_IDS.achievements)}><AchievementsPage /></div>
      <div style={hide(PAGE_IDS.settings)}><SettingsPage /></div>
    </div>
  );
}

function GameShell() {
  const { activePage } = useUI();

  return (
    <LayoutShell>
      <TopBar />
      <main className={`layout-main fade-in${(activePage === PAGE_IDS.hub || activePage === PAGE_IDS.gameStore || activePage === PAGE_IDS.gameBakery || activePage === PAGE_IDS.workshop || activePage === PAGE_IDS.craftFloor || activePage === PAGE_IDS.procurement) ? '' : ' layout-main--page'}`}>
        <MainContent />
      </main>
      <RecipeFloatingPin />
      <BakingProgressBar />
      <BakingResultModal />
      <NotificationStack />
    </LayoutShell>
  );
}

export default function App() {
  const [introDone, setIntroDone] = useState(false);

  return (
    <UIProvider>
      <BgmProvider audioUnlocked={introDone}>
        <BakingProvider>
          <div inert={!introDone} aria-hidden={introDone ? undefined : true}>
            <GameShell />
          </div>
          {!introDone && <IntroSequence onComplete={() => setIntroDone(true)} />}
        </BakingProvider>
      </BgmProvider>
    </UIProvider>
  );
}
