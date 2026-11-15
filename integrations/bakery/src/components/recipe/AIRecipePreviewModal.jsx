import BreadCanvas from '../bread/BreadCanvas';
import { useGame } from '../../context/GameContext';
import { rarityConfig } from '../../data/ingredients';
import { bakeTechniques } from '../../data/techniques';
import { breadMolds } from '../../data/molds';
import { getIngredientLines, getIngredientCapsuleCategory } from '../../utils/recipePreviewDisplay';
import { aiTintCategoryForIngredientLine, aiTintVariantForIngredientLine } from '../../utils/procurementDisplay';
import IngredientThumb from '../IngredientThumb';

const STAT_ICONS = { 甜度: '🍬', 柔软度: '☁️', 香气: '🌸', 复杂度: '🎭' };
const techniqueName = (id) => bakeTechniques.find((t) => t.id === id)?.name || '直接法';
const moldName = (id) => breadMolds.find((m) => m.id === id)?.name || '圆模';

export default function AIRecipePreviewModal({ recipe, onPin, onSave, onPinAndSave, onClose }) {
  const { state } = useGame();
  if (!recipe) return null;
  const rc = rarityConfig[recipe.rarity] || { label: '' };
  const shortDesc = recipe.shortDesc || recipe.description?.replace(/^原料：[\s\S]*。?$/, '').slice(0, 100) || '一款精心设计的面包。';
  const ingredientList = getIngredientLines(recipe);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>✨ AI 设计配方</h2>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="ai-preview-top">
            <BreadCanvas recipe={recipe} width={96} height={96} size={18} />
            <div className="ai-preview-title">
              <h3>{recipe.name}</h3>
              <span className={`rarity-badge rarity-${recipe.rarity || 'common'}`}>{rc.label}</span>
            </div>
          </div>
          <div className="ai-preview-stats-bar">
            {Object.entries(recipe.stats || {}).map(([k, v]) => (
              <span key={k} className={`ai-preview-stat-capsule ai-stat-${k}`}>{STAT_ICONS[k] || ''}{k} {v}</span>
            ))}
            {recipe.price != null && <span className="ai-preview-stat-capsule ai-stat-price">售价 {recipe.price} 金币</span>}
            {recipe.bakeMeta && (
              <>
                <span className="ai-preview-stat-capsule ai-stat-bake">{techniqueName(recipe.bakeMeta.techniqueId)}</span>
                <span className="ai-preview-stat-capsule ai-stat-bake">{recipe.bakeMeta.bakeTempC ?? 180}℃</span>
                <span className="ai-preview-stat-capsule ai-stat-bake">{moldName(recipe.bakeMeta.moldId)}</span>
              </>
            )}
          </div>
          <div className="ai-preview-middle">
            <p className="ai-preview-desc">{shortDesc}</p>
            <div className="ai-preview-ingredient-capsules">
              {ingredientList.length > 0 ? (
                ingredientList.map((s, i) => (
                  <span key={i} className={`ai-preview-capsule ai-ing-${getIngredientCapsuleCategory(s)}`}>
                    <IngredientThumb
                      name={s}
                      size="sm"
                      aiTintCategory={aiTintCategoryForIngredientLine(state.customProcurementItems, s)}
                      aiTintVariant={aiTintVariantForIngredientLine(state.customProcurementItems, s)}
                    />
                    {s}
                  </span>
                ))
              ) : (
                <span className="ai-preview-capsule ai-ing-other">见配方描述</span>
              )}
            </div>
          </div>
          <div className="ai-preview-actions ai-preview-actions--stacked">
            <div className="ai-preview-actions-row">
              {onSave && <button type="button" className="btn btn-secondary" onClick={onSave}>📜 存入配方库</button>}
              {onPin && <button type="button" className="btn btn-secondary" onClick={onPin}>📌 固定配方</button>}
            </div>
            {(onPin && onSave) && (
              <div className="ai-preview-actions-row ai-preview-actions-row--single">
                <button type="button" className="btn btn-secondary" onClick={onPinAndSave}>📌 固定并存入配方库</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
