import { useState, useCallback } from 'react';
import { useGame } from '../../context/GameContext';
import { useUI, PAGE_IDS } from '../../context/UIContext';
import RecipeGenerator from '../recipe/RecipeGenerator';
import MenuGrid from '../recipe/MenuGrid';
import CardBreadDecor from '../CardBreadDecor';

export default function DevelopPhase() {
  const { state, dispatch, notify } = useGame();
  const { navigateTo } = useUI();
  const [bakeryTab, setBakeryTab] = useState('make'); // 'make' | 'menu'

  const hasMenuItems = (state.menuRecipes || []).length > 0;
  const onRemoveFromMenu = useCallback(
    (i) => dispatch({ type: 'REMOVE_FROM_MENU', index: i }),
    [dispatch],
  );
  const startBusiness = () => {
    if (!hasMenuItems) {
      notify('请先至少添加1款面包到菜单后再营业。', 'error');
      return;
    }
    dispatch({ type: 'SET_PHASE', phase: 'business' });
    navigateTo(PAGE_IDS.gameStore);
  };

  return (
    <div className="develop-layout develop-layout-tabs fade-in">
      <div className="phase-back-row develop-top-actions">
        <button type="button" className="btn btn-secondary btn-tiny" onClick={() => dispatch({ type: 'SET_PHASE', phase: 'morning' })}>
          ← 返回早晨
        </button>
        <button type="button" className="btn btn-secondary btn-tiny" onClick={() => navigateTo(PAGE_IDS.principle)} title="查看配比、手法炉温、模具说明">
          📐 烘焙原理
        </button>
        <button type="button" className="btn btn-secondary btn-tiny" onClick={() => navigateTo(PAGE_IDS.craftFloor)}>
          🧰 工坊
        </button>
        <button type="button" className="btn btn-secondary btn-tiny" onClick={() => navigateTo(PAGE_IDS.procurement)}>
          🛒 超市采购
        </button>
      </div>
      <div className="proc-tabs develop-tabs">
        <button
          type="button"
          className={`proc-tab${bakeryTab === 'make' ? ' on' : ''}`}
          onClick={() => setBakeryTab('make')}
        >
          🥖 制作
        </button>
        <button
          type="button"
          className={`proc-tab${bakeryTab === 'menu' ? ' on' : ''}`}
          onClick={() => setBakeryTab('menu')}
        >
          📖 菜单
        </button>
      </div>
      {/* 制作与菜单同时挂载，仅切换显示，避免 RecipeGenerator 卸载后已选原料丢失（与 App 主内容区常驻挂载策略一致） */}
      <div
        className="develop-tab-content develop-tab-make bakery-card-decor-host"
        style={{ display: bakeryTab === 'make' ? undefined : 'none' }}
        aria-hidden={bakeryTab !== 'make'}
      >
        <CardBreadDecor seed="develop-bakery-make" variant="chrome" />
        <RecipeGenerator />
      </div>
      <div
        className="develop-tab-content develop-tab-menu"
        style={{ display: bakeryTab === 'menu' ? undefined : 'none' }}
        aria-hidden={bakeryTab !== 'menu'}
      >
        <MenuGrid
          recipes={state.menuRecipes}
          onRemove={onRemoveFromMenu}
          currentDay={state.day}
        />
        <div className="panel-footer" style={{ background: 'var(--surface)', borderRadius: '0 0 var(--radius-md) var(--radius-md)', borderTop: '1px solid var(--border-light)' }}>
          <button className="btn btn-secondary" onClick={startBusiness}>
            准备好了，开门营业 →
          </button>
        </div>
      </div>
    </div>
  );
}
