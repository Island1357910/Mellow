import IngredientThumb from './IngredientThumb';
import { resolveIngredientSkuForThumb } from '../data/ingredientImages';
import { useGame } from '../context/GameContext';
import { aiTintCategoryForSku, aiTintVariantForSku } from '../utils/procurementDisplay';

/** 文案旁尽量展示原料小图（辅料/馅料/风味等） */
export default function InlineIngredient({ name, text, size = 'sm', className = '' }) {
  const { state } = useGame();
  const rawName = (name ?? text ?? '').trim();
  const sku = resolveIngredientSkuForThumb(rawName);
  const aiTintCategory = aiTintCategoryForSku(state.customProcurementItems, rawName);
  const aiTintVariant = aiTintVariantForSku(state.customProcurementItems, rawName);
  const label = text ?? name ?? '';
  return (
    <span className={`inline-ingredient${className ? ` ${className}` : ''}`}>
      {(sku || aiTintCategory) ? (
        <IngredientThumb
          name={sku || rawName}
          size={size}
          aiTintCategory={aiTintCategory}
          aiTintVariant={aiTintVariant}
        />
      ) : null}
      <span className="inline-ingredient-text">{label}</span>
    </span>
  );
}
