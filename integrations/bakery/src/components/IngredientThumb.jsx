import { getIngredientImageUrl, getRandomImageUrlForCategory } from '../data/ingredientImages';
import './IngredientThumb.css';

/**
 * @param {string} name sku 或原料行文案
 * @param {'面粉'|'液体'|'酵母'|'辅料'|'风味'|'馅料'|null|undefined} aiTintCategory — AI 采购品：从该大类随机选图 + 变色滤镜
 * @param {0|1|2|undefined|null} aiTintVariant — 同批次三款备选时区分色相，0/1/2
 */
export default function IngredientThumb({ name, className = '', size = 'md', aiTintCategory = null, aiTintVariant = null }) {
  // AI 原料：用 name（sku）做哈希从该类别全量图片中确定性地选一张
  const presetUrl = aiTintCategory ? getRandomImageUrlForCategory(aiTintCategory, name) : null;
  const src = presetUrl || getIngredientImageUrl(name);
  if (!src) return null;
  const tint = Boolean(presetUrl);
  const v = aiTintVariant === 0 || aiTintVariant === 1 || aiTintVariant === 2 ? aiTintVariant : null;
  return (
    <img
      className={`ingredient-thumb ingredient-thumb--${size}${tint ? ' ingredient-thumb--ai-tint' : ''}${className ? ` ${className}` : ''}`}
      src={src}
      alt=""
      data-ai-cat={tint ? aiTintCategory : undefined}
      data-ai-variant={tint && v != null ? String(v) : undefined}
      draggable={false}
      loading="lazy"
      decoding="async"
    />
  );
}
