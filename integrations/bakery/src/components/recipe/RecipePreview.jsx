import BreadCanvas from '../bread/BreadCanvas';
import { useGame } from '../../context/GameContext';
import { RECIPE_DISPLAY_NAME_MAX } from '../../constants/naming';
import { rarityConfig } from '../../data/ingredients';
import { bakeTechniques } from '../../data/techniques';
import { breadMolds } from '../../data/molds';
import { getIngredientLines, getIngredientCapsuleCategory } from '../../utils/recipePreviewDisplay';
import { aiTintCategoryForIngredientLine, aiTintVariantForIngredientLine } from '../../utils/procurementDisplay';
import IngredientThumb from '../IngredientThumb';

const STAT_ICONS = { 甜度: '🍬', 柔软度: '☁️', 香气: '🌸', 复杂度: '🎭' };
const techniqueName = (id) => bakeTechniques.find((t) => t.id === id)?.name || '直接法';
const moldName = (id) => breadMolds.find((m) => m.id === id)?.name || '圆模';

export default function RecipePreview({
  recipe,
  onConfirm,
  onReroll,
  onSave,
  onPin,
  onClose,
  bakeCount,
  breadDisplayName,
  onBreadDisplayNameChange,
  nameInputLocked = false,
  hideIngredientCapsules = false,
}) {
  const { state } = useGame();
  const rc = rarityConfig[recipe.rarity] || { label: '普通' };
  const bm = recipe.bakeMeta;
  const afterIng = recipe.description?.replace(/^原料：[\s\S]*?。?\s*/, '').trim() || '';
  const shortDesc = recipe.shortDesc || (afterIng ? afterIng.slice(0, 100) : '') || '一款手工烘焙的面包。';
  const ingredientList = getIngredientLines(recipe);

  const title = nameInputLocked
    ? recipe.name
    : (breadDisplayName != null ? breadDisplayName : recipe.name);
  const showNameEdit = typeof onBreadDisplayNameChange === 'function' && !nameInputLocked;

  return (
    <div className="bake-result-preview">
      <div className="ai-preview-top">
        <BreadCanvas recipe={{ ...recipe, name: title }} width={96} height={96} size={18} />
        <div className="ai-preview-title">
          <h3>{title}</h3>
          <span className={`rarity-badge rarity-${recipe.rarity || 'common'}`}>{rc.label}</span>
        </div>
      </div>
      {showNameEdit && (
        <div className="bake-result-name-field">
          <label htmlFor="bake-result-bread-name">面包名称（默认可用 AI 名，建议用中文）</label>
          <input
            id="bake-result-bread-name"
            type="text"
            lang="zh-CN"
            inputMode="text"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={RECIPE_DISPLAY_NAME_MAX}
            value={breadDisplayName ?? ''}
            onChange={(e) => onBreadDisplayNameChange(e.target.value.slice(0, RECIPE_DISPLAY_NAME_MAX))}
            className="drawer-input"
            style={{ width: '100%', marginTop: 6 }}
          />
        </div>
      )}
      {nameInputLocked && (
        <p className="ai-preview-hint" style={{ marginTop: 0, marginBottom: 8 }}>
          与固定配方完全一致，名称与数值已锁定为配方卡数据。
        </p>
      )}
      <div className="ai-preview-stats-bar">
        {Object.entries(recipe.stats || {}).map(([k, v]) => (
          <span key={k} className={`ai-preview-stat-capsule ai-stat-${k}`}>{STAT_ICONS[k] || ''}{k} {v}</span>
        ))}
        {recipe.price != null && (
          <span className="ai-preview-stat-capsule ai-stat-price">售价 {recipe.price} 金币</span>
        )}
        {bm && (
          <>
            <span className="ai-preview-stat-capsule ai-stat-bake">{techniqueName(bm.techniqueId)}</span>
            <span className="ai-preview-stat-capsule ai-stat-bake">{Math.round(bm.bakeTempC ?? 180)}℃</span>
            <span className="ai-preview-stat-capsule ai-stat-bake">{moldName(bm.moldId)}</span>
            {bm.qualityFactor != null && (
              <span className="ai-preview-stat-capsule ai-stat-bake">品质 {(bm.qualityFactor * 100).toFixed(0)}%</span>
            )}
          </>
        )}
      </div>
      <p className="ai-preview-hint bake-result-batch-hint">
        {bakeCount > 1 ? `本批 ${bakeCount} 个 · ` : ''}上架手续费 5💰
      </p>
      {recipe.isInferior && (
        <div className="preview-inferior bake-result-inferior">
          ⚠️ 劣质品：{recipe.inferiorReason}，价格已降低。
        </div>
      )}
      <div className="ai-preview-middle">
        <p className="ai-preview-desc">{shortDesc}</p>
        {!hideIngredientCapsules && (
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
              <span className="ai-preview-capsule ai-ing-other">原料详见描述</span>
            )}
          </div>
        )}
        {recipe.synergies?.length > 0 && (
          <p className="ai-preview-hint" style={{ marginBottom: 0 }}>🔮 协同：{recipe.synergies.join('、')}</p>
        )}
        {recipe.fillingNote && (
          <p className="ai-preview-hint" style={{ marginBottom: 0 }}>🥯 {recipe.fillingNote}</p>
        )}
      </div>
      <div className="ai-preview-actions">
        <button type="button" className="btn btn-primary" onClick={onConfirm}>✅ 加入菜单</button>
        <button type="button" className="btn btn-secondary" onClick={onReroll}>🎲 再烤一炉</button>
        {onSave && <button type="button" className="btn btn-secondary" onClick={onSave}>📜 保存到配方</button>}
        {onPin && <button type="button" className="btn btn-secondary" onClick={onPin}>📌 固定悬浮窗</button>}
        {onClose && <button type="button" className="btn btn-secondary" onClick={onClose}>关闭</button>}
      </div>
    </div>
  );
}
