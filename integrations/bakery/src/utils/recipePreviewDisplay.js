import { ingredients as ingredientsData } from '../data/ingredients';

const CAT_TO_SLUG = { 面粉: 'flour', 液体: 'liquid', 酵母: 'yeast', 辅料: 'accessory', 风味: 'flavor', 馅料: 'filling' };

const nameToIngCategory = (() => {
  const m = {};
  for (const [cat, list] of Object.entries(ingredientsData || {})) {
    for (const ing of list || []) if (ing?.name) m[ing.name] = CAT_TO_SLUG[cat] || cat;
  }
  return m;
})();

/** 用于 ai-ing-* 样式后缀：flour | liquid | yeast | accessory | flavor | filling | other */
export function getIngredientCapsuleCategory(str) {
  const name = String(str).replace(/\s+\d+(\.\d+)?\s*克?$/, '').trim();
  return nameToIngCategory[name] || 'other';
}

export function getIngredientLines(recipe) {
  if (Array.isArray(recipe?.ingredientList) && recipe.ingredientList.length) return [...recipe.ingredientList];
  if (recipe?.description) {
    const m = recipe.description.match(/原料：([\s\S]*?)(?:。|$)/);
    if (m) return m[1].split('、').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}
