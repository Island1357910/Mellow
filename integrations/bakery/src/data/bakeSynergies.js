/**
 * 烘焙协同：跨界规则（原料×模具、原料×手法、模具×手法）
 * 原料两两协同仍主要在 ingredients.js 的 synergies 数组
 */
import { synergies } from './ingredients';

/** @typedef {{ kind: 'ingredient_mold', name: string, ingredient: string, moldId: string, bonus: Record<string, number> } | { kind: 'ingredient_technique', name: string, ingredient: string, techniqueId: string, bonus: Record<string, number> } | { kind: 'mold_technique', name: string, moldId: string, techniqueId: string, bonus: Record<string, number> }} CrossSynergy */

/** @type {CrossSynergy[]} */
export const crossSynergies = [
  { kind: 'ingredient_mold', name: '抹茶玛芬结界', ingredient: '抹茶粉', moldId: 'muffin', bonus: { 复杂度: 2, 香气: 2 } },
  { kind: 'ingredient_mold', name: '螺旋熔岩心', ingredient: '巧克力熔岩', moldId: 'cinnamon', bonus: { 甜度: 2, 香气: 1 } },
  { kind: 'ingredient_mold', name: '森林欧包魂', ingredient: '松露酱', moldId: 'euro', bonus: { 香气: 3, 复杂度: 1 } },
  { kind: 'ingredient_mold', name: '佛卡夏咖喱摊', ingredient: '咖喱鸡肉', moldId: 'focaccia', bonus: { 复杂度: 2, 香气: 1 } },
  { kind: 'ingredient_mold', name: '碱水灵魂盐', ingredient: '海盐', moldId: 'pretzel', bonus: { 香气: 2, 复杂度: 1 } },
  { kind: 'ingredient_mold', name: '烟熏花花世界', ingredient: '培根芝士', moldId: 'ring', bonus: { 香气: 2, 甜度: -1 } },
  { kind: 'ingredient_mold', name: '爆浆小餐包', ingredient: '蓝莓酱', moldId: 'bun', bonus: { 甜度: 2, 柔软度: 1 } },
  { kind: 'ingredient_mold', name: '和风芋泥战争', ingredient: '芋泥肉松', moldId: 'wafu', bonus: { 甜度: 1, 复杂度: 2 } },
  { kind: 'ingredient_mold', name: '法棍柚香洞', ingredient: '柚子蜜', moldId: 'baguette', bonus: { 香气: 2, 甜度: 1 } },
  { kind: 'ingredient_mold', name: '肉桂卷中肉桂', ingredient: '肉桂粉', moldId: 'cinnamon', bonus: { 香气: 3, 甜度: 1 } },

  { kind: 'ingredient_technique', name: '千层黄油魂', ingredient: '黄油', techniqueId: 'laminated', bonus: { 复杂度: 2, 香气: 1 } },
  { kind: 'ingredient_technique', name: '酸种认亲大会', ingredient: '天然酵种', techniqueId: 'sourdough', bonus: { 香气: 3, 复杂度: 2 } },
  { kind: 'ingredient_technique', name: '汤种叠乘术', ingredient: '汤种', techniqueId: 'tangzhong', bonus: { 柔软度: 2, 甜度: 1 } },
  { kind: 'ingredient_technique', name: '折叠云朵感', ingredient: '淡奶油', techniqueId: 'fold', bonus: { 柔软度: 2, 香气: 1 } },
  { kind: 'ingredient_technique', name: '黑麦彻夜谈', ingredient: '黑麦粉', techniqueId: 'overnight', bonus: { 香气: 2, 复杂度: 2 } },
  { kind: 'ingredient_technique', name: '全麦中种拥抱', ingredient: '全麦粉', techniqueId: 'sponge', bonus: { 柔软度: 2, 复杂度: 1 } },
  { kind: 'ingredient_technique', name: '快发直球对决', ingredient: '即发干酵母', techniqueId: 'direct', bonus: { 甜度: 1, 柔软度: -1 } },
  { kind: 'ingredient_technique', name: '液种魂穿夜', ingredient: '淡奶油', techniqueId: 'poolish', bonus: { 柔软度: 1, 香气: 2 } },
  { kind: 'ingredient_technique', name: '开酥橄榄油裔', ingredient: '橄榄油', techniqueId: 'laminated', bonus: { 复杂度: 1, 香气: 2 } },
  { kind: 'ingredient_technique', name: '自解石磨吟', ingredient: '石磨面粉', techniqueId: 'autolyse', bonus: { 香气: 2, 复杂度: 1 } },

  { kind: 'mold_technique', name: '液种法棍联盟', moldId: 'baguette', techniqueId: 'poolish', bonus: { 香气: 2, 复杂度: 2 } },
  { kind: 'mold_technique', name: '可颂正统血统', moldId: 'croissant', techniqueId: 'laminated', bonus: { 复杂度: 3, 香气: 1 } },
  { kind: 'mold_technique', name: '汤种吐司圣域', moldId: 'loaf', techniqueId: 'tangzhong', bonus: { 柔软度: 3, 甜度: 1 } },
  { kind: 'mold_technique', name: '自解乡村密语', moldId: 'ciabatta', techniqueId: 'autolyse', bonus: { 香气: 2, 复杂度: 2 } },
  { kind: 'mold_technique', name: '贝果筋骨操', moldId: 'bagel', techniqueId: 'fold', bonus: { 柔软度: 2, 复杂度: 1 } },
  { kind: 'mold_technique', name: '隔夜佛卡夏梦境', moldId: 'focaccia', techniqueId: 'overnight', bonus: { 香气: 2, 复杂度: 1 } },
  { kind: 'mold_technique', name: '碱水自解仪式', moldId: 'pretzel', techniqueId: 'autolyse', bonus: { 复杂度: 1, 香气: 1 } },
  { kind: 'mold_technique', name: '酸种欧包朝圣', moldId: 'euro', techniqueId: 'sourdough', bonus: { 香气: 2, 复杂度: 3 } },
  { kind: 'mold_technique', name: '玛芬中种奇谈', moldId: 'muffin', techniqueId: 'sponge', bonus: { 柔软度: 1, 甜度: 2 } },
];

/** @type {Set<string>} */
export const CROSS_SYNERGY_NAMES = new Set(crossSynergies.map((c) => c.name));

/** @type {Set<string>} */
export const MOLD_TECH_SYNERGY_NAMES = new Set(
  crossSynergies.filter((c) => c.kind === 'mold_technique').map((c) => c.name),
);

const pairByName = new Map(synergies.map((s) => [s.name, s]));

/** @param {string} name */
export function getSynergyDefinitionByName(name) {
  if (!name) return null;
  const pair = pairByName.get(name);
  if (pair) {
    return {
      kind: 'pair',
      name: pair.name,
      bonus: pair.bonus,
      combo: pair.combo,
    };
  }
  const cross = crossSynergies.find((c) => c.name === name);
  if (!cross) return null;
  return { ...cross };
}

/** @param {Record<string, number>|undefined|null} bonus */
export function bonusHasNegative(bonus) {
  if (!bonus || typeof bonus !== 'object') return false;
  return Object.values(bonus).some((v) => Number(v) < 0);
}

/** @param {string} name */
export function synergyDefinitionHasNegative(name) {
  const d = getSynergyDefinitionByName(name);
  return d ? bonusHasNegative(d.bonus) : false;
}

/**
 * @param {string[]} ingredientNames 面团中出现的原料名（已排除无添加/无辅料）
 * @param {string} moldId
 * @param {string} techniqueId
 * @returns {CrossSynergy[]}
 */
export function collectCrossSynergies(ingredientNames, moldId, techniqueId) {
  const names = new Set(ingredientNames);
  const mid = moldId || 'round';
  const tid = techniqueId || 'direct';
  return crossSynergies.filter((rule) => {
    if (rule.kind === 'ingredient_mold') {
      return names.has(rule.ingredient) && rule.moldId === mid;
    }
    if (rule.kind === 'ingredient_technique') {
      return names.has(rule.ingredient) && rule.techniqueId === tid;
    }
    return rule.moldId === mid && rule.techniqueId === tid;
  });
}
