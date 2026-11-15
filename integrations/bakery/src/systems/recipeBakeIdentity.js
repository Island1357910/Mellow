/**
 * 烘焙表单与配方身份对照：用于「按配方完全一致出炉则保留配方名与数值」
 */
import { ingredients } from '../data/ingredients';
import { bakeTechniques } from '../data/techniques';
import { breadMolds } from '../data/molds';

const TECH_BY_NAME = Object.fromEntries(bakeTechniques.map((t) => [t.name, t.id]));
const MOLD_BY_LABEL = (() => {
  const m = {};
  for (const mold of breadMolds) {
    m[mold.name] = mold.id;
  }
  m.法棍 = 'baguette';
  m.吐司 = 'loaf';
  m.圆形 = 'round';
  m.椭圆形 = 'loaf';
  m.卷形 = 'braided';
  m.牛角 = 'croissant';
  m.玛芬 = 'muffin';
  m.恰巴塔 = 'ciabatta';
  m.佛卡夏 = 'focaccia';
  m.三角 = 'triangle';
  m.编花 = 'braided';
  m.贝果 = 'bagel';
  m.德国结 = 'pretzel';
  m.盐面包 = 'salt';
  m.长面包 = 'longloaf';
  m.和风 = 'wafu';
  m.大鼓 = 'drum';
  m.欧包 = 'euro';
  return m;
})();

function round1(x) {
  return Math.round(Number(x) * 10) / 10;
}

/** 从玩家 opts 生成可 JSON 持久化的快照（用于比对） */
export function snapshotBakeOpts(opts) {
  if (!opts) return null;
  const acc = [...(opts.accessoryNames || [])].filter((x) => x && x !== '无辅料');
  const flav = [...(opts.flavorNames || [])].filter((x) => x && x !== '无添加');
  const fillCraft = opts.craftedFilling?.id
    ? { id: opts.craftedFilling.id, name: opts.craftedFilling.name }
    : null;
  const fillPreset = opts.fillingIngredient?.name && opts.fillingIngredient.name !== '无馅料'
    ? opts.fillingIngredient.name
    : null;
  return {
    flourNames: [...(opts.flourNames || [])].sort(),
    liquidNames: [...(opts.liquidNames || [])].sort(),
    yeastName: opts.yeastName || '',
    accessoryNames: acc.sort(),
    flavorNames: flav.sort(),
    flourAmounts: { ...(opts.flourAmounts || {}) },
    liquidAmounts: { ...(opts.liquidAmounts || {}) },
    yeastAmounts: { ...(opts.yeastAmounts || {}) },
    accessoryAmounts: { ...(opts.accessoryAmounts || {}) },
    flavorAmounts: { ...(opts.flavorAmounts || {}) },
    techniqueId: opts.techniqueId || 'direct',
    bakeTempC: Number(opts.bakeTempC) || 180,
    moldId: opts.moldId || 'round',
    fillingPreset: fillPreset,
    fillingCraftId: fillCraft?.id || null,
  };
}

function amountsClose(a, b, eps = 0.55) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of keys) {
    const va = round1(a?.[k] ?? 0);
    const vb = round1(b?.[k] ?? 0);
    if (Math.abs(va - vb) > eps) return false;
  }
  return true;
}

export function bakeSnapshotsMatch(current, expected) {
  if (!current || !expected) return false;
  const eqArr = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  if (!eqArr(current.flourNames, expected.flourNames)) return false;
  if (!eqArr(current.liquidNames, expected.liquidNames)) return false;
  if (current.yeastName !== expected.yeastName) return false;
  if (!eqArr(current.accessoryNames, expected.accessoryNames)) return false;
  if (!eqArr(current.flavorNames, expected.flavorNames)) return false;
  if (current.techniqueId !== expected.techniqueId) return false;
  if (Math.round(current.bakeTempC) !== Math.round(expected.bakeTempC)) return false;
  if (current.moldId !== expected.moldId) return false;
  if ((current.fillingPreset || null) !== (expected.fillingPreset || null)) return false;
  if ((current.fillingCraftId || null) !== (expected.fillingCraftId || null)) return false;
  if (!amountsClose(current.flourAmounts, expected.flourAmounts)) return false;
  if (!amountsClose(current.liquidAmounts, expected.liquidAmounts)) return false;
  if (!amountsClose(current.yeastAmounts, expected.yeastAmounts)) return false;
  if (!amountsClose(current.accessoryAmounts, expected.accessoryAmounts)) return false;
  if (!amountsClose(current.flavorAmounts, expected.flavorAmounts)) return false;
  return true;
}

/** 是否已有相同面团身份的快照（用于配方库去重）；须定义在 bakeSnapshotsMatch 之后，避免个别打包器下的引用顺序问题 */
export function recipeExistsWithSameBakeIdentity(recipes, recipe) {
  const snap = recipe?.bakeSourceOpts;
  if (!snap) return false;
  return (recipes || []).some((x) => x.bakeSourceOpts && bakeSnapshotsMatch(x.bakeSourceOpts, snap));
}

/** 经典配方 → 与 buildOpts 同结构的期望快照 */
export function classicRecipeToExpectedSnapshot(r) {
  if (!r?.id?.startsWith('cls_')) return null;
  const techniqueId = TECH_BY_NAME[r.手法] || 'direct';
  const moldId = MOLD_BY_LABEL[r.模具] || breadMolds.find((m) => m.name === r.模具)?.id || 'round';
  const accKeys = r.accessoryAmounts ? Object.keys(r.accessoryAmounts).filter((k) => r.accessoryAmounts[k] > 0) : [];
  const accessoryNames = accKeys.length ? accKeys : [];
  const flavorKeys = r.flavorAmounts ? Object.keys(r.flavorAmounts).filter((k) => r.flavorAmounts[k] > 0) : [];
  const flavorNames = flavorKeys.length ? flavorKeys : (r.风味 && r.风味 !== '无添加' ? [r.风味] : []);
  const fillName = r.馅料 && r.馅料 !== '无馅料' ? r.馅料 : null;
  return {
    flourNames: Object.keys(r.flourAmounts || {}).sort(),
    liquidNames: Object.keys(r.liquidAmounts || {}).sort(),
    yeastName: r.酵母 || '',
    accessoryNames: [...accessoryNames].sort(),
    flavorNames: [...flavorNames].sort(),
    flourAmounts: { ...(r.flourAmounts || {}) },
    liquidAmounts: { ...(r.liquidAmounts || {}) },
    yeastAmounts: { ...(r.yeastAmounts || {}) },
    accessoryAmounts: { ...(r.accessoryAmounts || {}) },
    flavorAmounts: { ...(r.flavorAmounts || {}) },
    techniqueId,
    bakeTempC: Number(r.炉温) || 180,
    moldId,
    fillingPreset: fillName,
    fillingCraftId: null,
  };
}

export function getExpectedSnapshotForRecipe(recipe) {
  if (!recipe) return null;
  if (recipe.bakeSourceOpts) return recipe.bakeSourceOpts;
  return classicRecipeToExpectedSnapshot(recipe);
}

/**
 * 在已保存配方、经典配方、当前菜单中查找与出炉快照完全一致的配方（原料克重 / 手法 / 炉温 / 模具 / 馅等）
 * 优先返回配方库中的条目，其次经典配方，最后菜单上的同款。
 */
export function findRecipeMatchingBakeSnapshot({
  snap,
  customRecipes = [],
  classicRecipes = [],
  menuRecipes = [],
}) {
  if (!snap) return null;
  const tryMatch = (list) => {
    for (const r of list || []) {
      if (!r) continue;
      const exp = getExpectedSnapshotForRecipe(r);
      if (exp && bakeSnapshotsMatch(snap, exp)) return r;
    }
    return null;
  };
  const a = tryMatch(customRecipes);
  if (a) return a;
  for (const r of classicRecipes || []) {
    const exp = classicRecipeToExpectedSnapshot(r);
    if (exp && bakeSnapshotsMatch(snap, exp)) return r;
  }
  const b = tryMatch(menuRecipes);
  if (b) return b;
  return null;
}

/** 用已有配方身份覆盖新生成记录（避免「同样配置却变成另一款面包」） */
export function mergeRecipeWithCanonIdentity(generated, canon) {
  if (!generated || !canon) return generated;
  const baseName =
    canon.baseName
    ?? (typeof canon.name === 'string' ? canon.name.replace(/[（(][^）)]+[）)]$/, '').trim() : null)
    ?? canon.name;
  return {
    ...generated,
    id: canon.id,
    name: canon.name,
    baseName: baseName || canon.name,
    stats: { ...(canon.stats || generated.stats) },
    shortDesc:
      canon.shortDesc
      || (canon.description && String(canon.description).slice(0, 100))
      || generated.shortDesc,
    description: canon.description || generated.description,
    price: canon.price ?? generated.price,
    rarity: canon.rarity ?? generated.rarity,
    ingredientList:
      canon.ingredientList?.length > 0 ? canon.ingredientList : generated.ingredientList,
    ingredients: canon.ingredients ?? generated.ingredients,
    ingredientsMulti: canon.ingredientsMulti ?? generated.ingredientsMulti,
    synergies: canon.synergies ?? generated.synergies,
    visualStyle: canon.visualStyle ?? generated.visualStyle,
    bakeSourceOpts: canon.bakeSourceOpts || generated.bakeSourceOpts,
    bakeNameFromPresetBase: canon.bakeNameFromPresetBase ?? generated.bakeNameFromPresetBase,
    cost: canon.cost ?? generated.cost,
    fillingNote: canon.fillingNote ?? generated.fillingNote,
    identityLocked: true,
  };
}

export function byName(cat, name) {
  return ingredients[cat]?.find((i) => i.name === name) || null;
}
