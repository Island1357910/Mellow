import { memo } from 'react';
import BreadCanvas from '../bread/BreadCanvas';
import CardBreadDecor from '../CardBreadDecor';
import IngredientThumb from '../IngredientThumb';
import { useGame } from '../../context/GameContext';
import { rarityConfig } from '../../data/ingredients';
import { getIngredientLines } from '../../utils/recipePreviewDisplay';
import { aiTintCategoryForIngredientLine, aiTintVariantForIngredientLine } from '../../utils/procurementDisplay';
import { getBreadPrice, getDaysLeft } from '../../systems/breadStock';

const STAT_ICONS = { 甜度: '🍬', 柔软度: '☁️', 香气: '🌸', 复杂度: '🎭' };

function MenuGrid({ recipes, onRemove, maxCount = 8, currentDay = 1 }) {
  const { state } = useGame();
  return (
    <div className="panel">
      <div className="panel-header">
        <h2>📖 我的面包菜单</h2>
        <span className="panel-hint">{recipes.length} / {maxCount} 款 · 3天未售出将销毁</span>
      </div>
      <div className="menu-grid">
        {recipes.length === 0 ? (
          <div className="empty-hint">
            <p>菜单空空如也</p>
            <p>使用左侧生成器创造你的第一款面包吧！</p>
          </div>
        ) : recipes.map((r, i) => {
          const rc = rarityConfig[r.rarity] || { label: '普通' };
          const menuIngLines = getIngredientLines(r);
          return (
            <div key={`${r.id}-${i}`} className="recipe-card recipe-card-ai menu-menu-card bakery-card-decor-host">
              <CardBreadDecor seed={`menu-${r.id}-${i}`} />
              <div className="recipe-card-thumb">
                <BreadCanvas recipe={r} width={48} height={48} size={12} />
              </div>
              <div className="recipe-card-title-row">
                <h5>{r.name}</h5>
                <span className={`recipe-card-rarity rarity-${r.rarity || 'common'}`}>{rc.label}</span>
              </div>
              {r.stats && (
                <div className="recipe-card-stats">
                  {Object.entries(r.stats).map(([k, v]) => (
                    <span key={k} className="recipe-card-stat">{STAT_ICONS[k] || ''}{v}</span>
                  ))}
                </div>
              )}
              <p className="recipe-card-desc">{r.shortDesc || r.description?.slice(0, 50) || '—'}</p>
              {menuIngLines.length > 0 && (
                <div className="recipe-card-ingredients">
                  {menuIngLines.map((line, j) => (
                    <span key={j} className="recipe-card-ing-line">
                      <IngredientThumb
                        name={line}
                        size="sm"
                        aiTintCategory={aiTintCategoryForIngredientLine(state.customProcurementItems, line)}
                        aiTintVariant={aiTintVariantForIngredientLine(state.customProcurementItems, line)}
                      />
                      <span className="recipe-card-ing-text">{line}</span>
                    </span>
                  ))}
                </div>
              )}
              {r.fillingNote ? (
                <p className="recipe-card-filling-note">{r.fillingNote}</p>
              ) : null}
              <div className="menu-card-footer">
                <span className="menu-card-price">{getBreadPrice(r, currentDay)}💰 ×{r.qty ?? 1}</span>
                <span className="menu-card-meta">剩{getDaysLeft(r, currentDay)}天</span>
              </div>
              <button type="button" className="remove-btn" onClick={() => onRemove(i)}>移除</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(MenuGrid);
