import { ingredients, synergies, rarityConfig } from '../data/ingredients';
import { collectCrossSynergies } from '../data/bakeSynergies';
import { getMoldById } from '../data/molds';
import { bakeTechniques, techniqueQualityFactor } from '../data/techniques';
import { RECIPE_DISPLAY_NAME_MAX, PLAYER_GENERATED_BREAD_NAME_MAX } from '../constants/naming';
import { computeStatsFromWeightedOpts } from './breadStatFormulas';
import { mergeStatsFromDescription, parseDescriptionRarity } from './descriptionStatTargets';
import { snapshotBakeOpts } from './recipeBakeIdentity';
import {
  keywordMap, ingredientKeywords, nameTemplates,
  descriptionTemplates, textureDescs, flavorDescs, fillingDescs, occasionDescs,
} from '../data/templates';

let _idCounter = 0;
const genId = () => 'recipe_' + Date.now() + '_' + (++_idCounter);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

/** 成品全称后缀，如 （红豆沙馅）；名称已以「馅」结尾则不再重复加 */
export function fillingDisplaySuffix(fillingName) {
  if (!fillingName || fillingName === '无馅料') return '';
  const s = String(fillingName).trim().slice(0, 14);
  if (!s) return '';
  const core = /馅$/.test(s) ? s : `${s}馅`;
  return `（${core}）`;
}

function weightedRandom(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}

export function parseKeywords(description) {
  const result = { attrHints: {}, ingredientHints: {} };
  if (!description) return result;
  const text = description.toLowerCase();
  for (const [kw, mapping] of Object.entries(keywordMap)) {
    if (text.includes(kw)) result.attrHints[mapping.attr] = mapping.dir;
  }
  for (const [kw, mapping] of Object.entries(ingredientKeywords)) {
    if (text.includes(kw)) result.ingredientHints[mapping.category] = mapping.name;
  }
  return result;
}

function selectIngredient(category, keywords, manualChoice) {
  if (manualChoice && manualChoice !== 'auto') {
    const found = ingredients[category]?.find(i => i.name === manualChoice);
    if (found) return found;
  }
  const pool = ingredients[category];
  if (!pool?.length) return null;

  if (keywords.ingredientHints[category]) {
    const hinted = pool.find(i => i.name === keywords.ingredientHints[category]);
    if (hinted) return hinted;
  }

  if (Object.keys(keywords.attrHints).length > 0) {
    const scored = pool.map(item => {
      let score = 0;
      for (const [attr, dir] of Object.entries(keywords.attrHints)) {
        const val = item.baseAttr[attr] || 0;
        if (dir === 'high') score += val;
        else if (dir === 'low') score += (10 - val);
        else if (dir === 'medium') score += (10 - Math.abs(val - 5));
      }
      return { item, score: score + (Math.random() - 0.5) * 4 };
    }).sort((a, b) => b.score - a.score);
    return pick(scored.slice(0, Math.min(3, scored.length))).item;
  }

  return weightedRandom(pool, pool.map(i => i.rarity === 'common' ? 3 : i.rarity === 'uncommon' ? 2 : 1));
}

export function findSynergies(ingredientNames) {
  return synergies.filter(syn => syn.combo.every(name => ingredientNames.includes(name)));
}

function calculateStats(selected) {
  const stats = { 甜度: 0, 柔软度: 0, 香气: 0, 复杂度: 0 };
  for (const ing of Object.values(selected)) {
    if (!ing?.baseAttr) continue;
    for (const [attr, val] of Object.entries(ing.baseAttr)) stats[attr] = (stats[attr] || 0) + val;
  }
  const names = Object.values(selected).filter(Boolean).map(i => i.name);
  for (const syn of findSynergies(names)) {
    for (const [attr, val] of Object.entries(syn.bonus)) stats[attr] = (stats[attr] || 0) + val;
  }
  for (const a of Object.keys(stats)) {
    stats[a] = Math.max(0, Math.min(20, Math.round(stats[a] * (1 + (Math.random() * 2 - 1) * 0.15))));
  }
  return stats;
}

function applyQualityToStats(stats, factor) {
  const out = {};
  for (const [k, v] of Object.entries(stats)) {
    out[k] = Math.max(0, Math.min(20, Math.round(v * factor)));
  }
  return out;
}

function addStatBonus(stats, bonus) {
  const out = { ...stats };
  for (const [k, v] of Object.entries(bonus || {})) {
    out[k] = Math.max(0, Math.min(20, (out[k] || 0) + v));
  }
  return out;
}

function calculateRarity(stats, ingredientList, synergyCount = null) {
  let score = Object.values(stats).reduce((a, b) => a + b, 0) / 4;
  const rMap = { rare: 3, uncommon: 2, common: 1 };
  const flat = ingredientList.filter(Boolean);
  score += flat.map(i => rMap[i.rarity] || 1).reduce((a, b) => a + b, 0) / Math.max(1, flat.length);
  const names = flat.map(i => i.name);
  const nSyn = synergyCount != null ? synergyCount : findSynergies(names).length;
  score += nSyn * 1.5;
  if (score >= 15) return 'legendary';
  if (score >= 10) return 'rare';
  if (score >= 6) return 'uncommon';
  return 'common';
}

function generateName(keywords, stats, ings) {
  const t = nameTemplates;
  let prefix = pick(t.prefixes);
  const [maxAttr] = Object.entries(stats).sort((a, b) => b[1] - a[1]);
  let modifier = '';
  if (maxAttr) {
    const key = maxAttr[1] >= 10 ? maxAttr[0] + '_high' : maxAttr[1] <= 3 ? maxAttr[0] + '_low' : null;
    if (key && t.modifiers[key]) modifier = pick(t.modifiers[key]);
  }
  if (ings.风味?.name && ings.风味.name !== '无添加') prefix = ings.风味.name.replace(/粉|精|酱|露/g, '');
  const suffix = pick(t.suffixes);
  return modifier ? `${prefix}${modifier}${suffix}` : `${prefix}${suffix}`;
}

/**
 * 玩家烘焙成品面团名称：以原料特征 + 四维突出项 + 模具类型为主；馅料不写入此字符串，另用 fillingDisplaySuffix。
 * @param {number} [maxLen] 总长度上限（含 mold 尾缀），默认可编辑上限
 */
function generateBakeDisplayName(stats, multi, moldBreadType, keywords, selected, maxLen = RECIPE_DISPLAY_NAME_MAX) {
  const chunks = [];
  const flours = multi?.面粉 || [];
  const tight = maxLen <= PLAYER_GENERATED_BREAD_NAME_MAX + 2;
  for (const f of flours) {
    const nm = f?.name;
    if (!nm) continue;
    let raw = nm.replace(/面粉$|粉$/, '');
    if (raw === '高筋' && flours.length > 1) continue;
    const cap = tight ? 2 : 4;
    if (raw) chunks.push(raw.length > cap ? raw.slice(0, cap) : raw);
  }
  if (chunks.length > (tight ? 1 : 2)) chunks.length = tight ? 1 : 2;

  for (const y of multi?.酵母 || []) {
    const n = y?.name;
    if (!n || n === '即发干酵母') continue;
    const raw = n.replace(/酵母$/, '').replace(/酵种$/, '').replace(/种$/, '').trim();
    const ycap = tight ? 2 : 3;
    if (raw && raw !== '即发干') chunks.push(raw.length > ycap ? raw.slice(0, ycap) : raw);
  }

  for (const l of multi?.液体 || []) {
    const n = l?.name;
    if (!n || n === '纯净水' || n === '水') continue;
    if (/椰/.test(n)) { chunks.push('椰'); continue; }
    if (/牛|鲜奶|牛奶/.test(n)) { chunks.push('奶'); continue; }
    if (/蜂蜜|蜜/.test(n)) { chunks.push('蜜'); continue; }
    if (/咖啡/.test(n)) { chunks.push('咖'); continue; }
    chunks.push(n.replace(/水$|液$/, '').slice(0, 2));
    break;
  }

  for (const fl of multi?.风味 || []) {
    const n = fl?.name;
    if (!n || n === '无添加') continue;
    const s = n.replace(/粉|精|酱|露|碎$/g, '');
    const fcap = tight ? 2 : 3;
    if (s.length) chunks.push(s.length > fcap ? s.slice(0, fcap) : s);
    if (tight) break;
  }

  const s0 = stats || {};
  if (!tight) {
    if ((s0.甜度 ?? 0) >= 12) chunks.push('甜');
    if ((s0.香气 ?? 0) >= 12) chunks.push('香');
    if ((s0.柔软度 ?? 0) >= 12) chunks.push('软');
    if ((s0.复杂度 ?? 0) >= 12) chunks.push('醇');
  } else {
    const hi = [s0.甜度, s0.香气, s0.柔软度, s0.复杂度].filter((v) => (v ?? 0) >= 12).length;
    if (hi >= 2) chunks.push('醇');
    else if ((s0.甜度 ?? 0) >= 12) chunks.push('甜');
    else if ((s0.香气 ?? 0) >= 12) chunks.push('香');
  }

  let moldPart = String(moldBreadType || '面包').split('/')[0].replace(/面包$/, '').trim();
  if (!moldPart) moldPart = '包';
  if (tight && moldPart.length > 2) moldPart = moldPart.slice(0, 2);

  let base = chunks.join('');
  const budget = Math.max(2, maxLen - moldPart.length);
  if (base.length > budget) base = base.slice(0, budget);
  let name = `${base}${moldPart}`.slice(0, maxLen);
  if (name.replace(/\s/g, '').length < 2) {
    name = generateName(keywords, stats, selected).slice(0, maxLen);
  }
  return name;
}

/** 出炉展示名长度预算：预设/AI 基底用长上限，玩家自助拼名用短上限。旧存档无标记时按 baseName 长度推断 */
export function recipeBakeDisplayNameMax(recipe) {
  if (!recipe) return RECIPE_DISPLAY_NAME_MAX;
  if (recipe.bakeNameFromPresetBase === true) return RECIPE_DISPLAY_NAME_MAX;
  if (recipe.bakeNameFromPresetBase === false) return PLAYER_GENERATED_BREAD_NAME_MAX;
  const bn = recipe.baseName != null ? String(recipe.baseName).trim() : '';
  return bn.length > PLAYER_GENERATED_BREAD_NAME_MAX
    ? RECIPE_DISPLAY_NAME_MAX
    : PLAYER_GENERATED_BREAD_NAME_MAX;
}

/** 出炉时若馅料完全未包进任何一只，用不含馅料关键词的名称 */
export function rebakeDisplayNameWithoutFilling(recipe) {
  if (!recipe?.stats || !recipe.bakeMeta) return recipe?.name || '';
  const multi = recipe.ingredientsMulti || {};
  const moldBreadType = recipe.bakeMeta.breadType || '面包';
  const kw = parseKeywords('');
  const maxLen = recipeBakeDisplayNameMax(recipe);
  return generateBakeDisplayName(
    recipe.stats,
    {
      面粉: multi.面粉 || [],
      液体: multi.液体 || [],
      酵母: multi.酵母 ? [multi.酵母] : [],
      风味: multi.风味 || [],
    },
    moldBreadType,
    kw,
    recipe.ingredients || {},
    maxLen,
  );
}

function generateDescription(stats, ings, foundSynergies) {
  let tpl = pick(descriptionTemplates);
  let flavorDesc = '';
  if (ings.风味?.name && ings.风味.name !== '无添加')
    flavorDesc = pick(flavorDescs).replace('{flavor}', ings.风味.name);
  let fillingDesc = '';
  if (ings.馅料?.name && ings.馅料.name !== '无馅料')
    fillingDesc = pick(fillingDescs).replace('{filling}', ings.馅料.name);
  const level = stats.柔软度 >= 12 ? 'high' : stats.柔软度 >= 5 ? 'medium' : 'low';
  const tex = pick(textureDescs['柔软度_' + level]);
  const occ = pick(occasionDescs);
  let r = tpl
    .replace('{flour}', ings.面粉?.name || '面粉').replace('{liquid}', ings.液体?.name || '水')
    .replace('{yeast}', ings.酵母?.name || '酵母').replace('{flavor_desc}', flavorDesc)
    .replace('{filling_desc}', fillingDesc).replace('{texture_desc}', tex)
    .replace('{occasion}', occ).replace('{occasion_desc}', `最适合在${occ}时享用。`);
  if (foundSynergies.length) r += ` 特殊组合"${foundSynergies[0].name}"带来了额外的风味加成！`;
  return r;
}

export function calculatePrice(stats, rarity) {
  const base = Object.values(stats).reduce((a, b) => a + b, 0) * 0.5;
  return Math.max(5, Math.round(base * (rarityConfig[rarity]?.priceMultiplier || 1)));
}

const INGREDIENT_COLORS = { 抹茶粉: 120, 可可粉: 25, 薰衣草: 280, 玫瑰露: 340, 黑麦粉: 30, 全麦粉: 45 };
function ingredientColorHint(flatList) {
  for (const ing of flatList || []) {
    const n = ing?.name;
    if (INGREDIENT_COLORS[n] != null) return { hueShift: INGREDIENT_COLORS[n] - 30 };
  }
  return null;
}

function generateVisualStyle(stats, rarity, moldShape, ingredientList) {
  let hue = 30 + stats.甜度 * 3 - stats.复杂度 * 2;
  const hint = ingredientColorHint(ingredientList);
  if (hint) hue = (hue + hint.hueShift) % 360;
  const sat = 30 + stats.香气 * 3;
  const light = 55 + stats.柔软度 * 1.5 - stats.复杂度;
  const autoShape = stats.柔软度 > 10 ? 'round' : stats.复杂度 > 10 ? 'braided' : 'loaf';
  return {
    baseColor: `hsl(${hue}, ${sat}%, ${light}%)`,
    topColor: stats.甜度 > 10 ? `hsl(${hue + 10}, ${sat + 10}%, ${light + 10}%)` : null,
    size: 0.7 + stats.柔软度 * 0.03,
    hasGlaze: stats.甜度 > 12,
    hasGlow: stats.香气 > 12,
    hasSprinkles: rarity === 'legendary' && stats.甜度 > 12,
    hasSparkle: rarity === 'legendary' || rarity === 'rare',
    crustDarkness: Math.max(0, 10 - stats.柔软度),
    shape: moldShape || autoShape,
  };
}

export function generateRecipe(description, manualSelections = {}) {
  const keywords = parseKeywords(description);
  const selected = {
    面粉: selectIngredient('面粉', keywords, manualSelections.面粉),
    液体: selectIngredient('液体', keywords, manualSelections.液体),
    酵母: selectIngredient('酵母', keywords, manualSelections.酵母),
    风味: selectIngredient('风味', keywords, manualSelections.风味),
    馅料: selectIngredient('馅料', keywords, manualSelections.馅料),
  };

  const stats = calculateStats(selected);
  const list = Object.values(selected).filter(Boolean);
  const rarity = calculateRarity(stats, list);
  const names = list.map(i => i.name);
  const foundSyn = findSynergies(names);
  return {
    id: genId(),
    name: generateName(keywords, stats, selected),
    ingredients: selected,
    stats,
    rarity,
    synergies: foundSyn.map(s => s.name),
    description: generateDescription(stats, selected, foundSyn),
    price: calculatePrice(stats, rarity),
    cost: list.reduce((s, i) => s + (i.cost || 0), 0),
    visualStyle: generateVisualStyle(stats, rarity, null, list),
    createdAt: Date.now(),
  };
}

function byName(cat, name) {
  return ingredients[cat]?.find((i) => i.name === name) || null;
}

/**
 * @param {object} opts
 * @param {string} opts.description
 * @param {string[]} opts.flourNames
 * @param {string[]} opts.liquidNames
 * @param {string} opts.yeastName
 * @param {string[]} opts.flavorNames
 * @param {object|null} opts.fillingIngredient — 来自 ingredients.馅料 或 null 用 crafted
 * @param {object|null} opts.craftedFilling — { name, baseAttr, description }
 * @param {string} opts.techniqueId
 * @param {number} opts.bakeTempC
 * @param {string} opts.moldId
 */
export function generateRecipeAdvanced(opts) {
  const keywords = parseKeywords(opts.description || '');
  const flours = (opts.flourNames || []).map((n) => byName('面粉', n)).filter(Boolean);
  const liquids = (opts.liquidNames || []).map((n) => byName('液体', n)).filter(Boolean);
  const yeast = byName('酵母', opts.yeastName);
  const accessories = (opts.accessoryNames || []).map((n) => byName('辅料', n)).filter((n) => n && n.name !== '无辅料');
  const flavors = (opts.flavorNames || []).map((n) => byName('风味', n)).filter(Boolean);
  let filling = opts.fillingIngredient;
  if (!filling && opts.craftedFilling) {
    filling = {
      name: opts.craftedFilling.name,
      baseAttr: opts.craftedFilling.baseAttr || { 甜度: 0, 柔软度: 0, 香气: 0, 复杂度: 0 },
      rarity: 'uncommon',
      cost: 4,
      description: opts.craftedFilling.description,
    };
  }
  if (!filling) filling = byName('馅料', '无馅料');

  const doughFlatList = [...flours, ...liquids, ...(yeast ? [yeast] : []), ...accessories, ...flavors];
  const names = doughFlatList.map((i) => i.name);

  let stats = computeStatsFromWeightedOpts(opts, filling);
  const q = techniqueQualityFactor(opts.techniqueId || 'direct', Number(opts.bakeTempC) || 180);
  stats = applyQualityToStats(stats, q);
  const mold = getMoldById(opts.moldId);
  stats = addStatBonus(stats, mold.bonus);
  const crossFound = collectCrossSynergies(names, mold.id, opts.techniqueId || 'direct');
  for (const c of crossFound) stats = addStatBonus(stats, c.bonus);
  stats = mergeStatsFromDescription(stats, opts.description);

  const selected = {
    面粉: flours[0] || byName('面粉', '高筋面粉'),
    液体: liquids[0] || byName('液体', '纯净水'),
    酵母: yeast || byName('酵母', '即发干酵母'),
    辅料: accessories[0] || byName('辅料', '无辅料'),
    风味: flavors[0] || byName('风味', '无添加'),
    馅料: filling || byName('馅料', '无馅料'),
  };

  const flatListForCost = [
    ...doughFlatList,
    ...(filling && filling.name !== '无馅料' ? [filling] : []),
  ];
  const pairFound = findSynergies(names);
  const foundSyn = [...pairFound, ...crossFound];
  let rarity = calculateRarity(stats, doughFlatList, foundSyn.length);
  const rarityFromDesc = parseDescriptionRarity(opts.description || '');
  if (rarityFromDesc) rarity = rarityFromDesc;

  const amt = (names, amounts, def = 1) => {
    const parts = [];
    for (const n of names || []) {
      if (!n) continue;
      const v = amounts?.[n] != null ? Number(amounts[n]) : def;
      if (v > 0) parts.push(`${n} ${Math.round(v * 10) / 10}克`);
    }
    return parts;
  };
  const ingLines = [];
  ingLines.push(...amt(opts.flourNames, opts.flourAmounts));
  ingLines.push(...amt(opts.liquidNames, opts.liquidAmounts));
  if (opts.yeastName) {
    const yv = opts.yeastAmounts?.[opts.yeastName] ?? 1;
    ingLines.push(`${opts.yeastName} ${Math.round(yv * 10) / 10}克`);
  }
  ingLines.push(...amt(opts.accessoryNames, opts.accessoryAmounts, 1));
  ingLines.push(...amt(opts.flavorNames, opts.flavorAmounts, 1).filter((x) => !x.startsWith('无添加')));
  const fill = opts.fillingIngredient || opts.craftedFilling;
  if (fill?.name && fill.name !== '无馅料') {
    ingLines.push(`${fill.name}（不入面团总重；出炉按只数×单只用量从库存扣，约模具容积×12% 克/只）`);
  }
  const narrative = opts.shortDesc
    ? String(opts.shortDesc).slice(0, 100)
    : generateDescription(stats, selected, foundSyn);
  const description = narrative;

  const cost = flatListForCost.reduce((s, i) => s + (i.cost || 0), 0);

  const technique = bakeTechniques.find((t) => t.id === opts.techniqueId) || bakeTechniques[0];
  const moldBreadType = mold.breadType || '面包';
  const fillingNameForTag = fill?.name && fill.name !== '无馅料' ? fill.name : null;
  const tagForSuffix = opts.fillingTagForFillingOnly ?? opts.fillingTag ?? fillingNameForTag;

  const hasPresetBase =
    (opts.baseNameForFillingOnly != null && String(opts.baseNameForFillingOnly).trim() !== '')
    || (opts.baseName != null && String(opts.baseName).trim() !== '');
  const playerAutoNameMax = hasPresetBase ? RECIPE_DISPLAY_NAME_MAX : PLAYER_GENERATED_BREAD_NAME_MAX;

  let finalName;
  if (hasPresetBase) {
    const baseTrim = String(opts.baseNameForFillingOnly ?? opts.baseName).trim().replace(/\s+/g, ' ').trim();
    finalName = tagForSuffix
      ? (baseTrim + fillingDisplaySuffix(tagForSuffix)).slice(0, RECIPE_DISPLAY_NAME_MAX)
      : baseTrim.slice(0, RECIPE_DISPLAY_NAME_MAX);
  } else {
    const baseDisplay = generateBakeDisplayName(
      stats,
      { 面粉: flours, 液体: liquids, 酵母: yeast ? [yeast] : [], 风味: flavors },
      moldBreadType,
      keywords,
      selected,
      playerAutoNameMax,
    );
    finalName = tagForSuffix
      ? (baseDisplay + fillingDisplaySuffix(tagForSuffix)).slice(0, playerAutoNameMax)
      : baseDisplay;
  }

  return {
    id: genId(),
    name: finalName,
    ingredients: selected,
    ingredientList: ingLines,
    ingredientsMulti: {
      面粉: flours,
      液体: liquids,
      酵母: yeast,
      辅料: accessories,
      风味: flavors,
      馅料: filling,
    },
    stats,
    rarity,
    synergies: foundSyn.map((s) => s.name),
    description,
    price: calculatePrice(stats, rarity),
    cost,
    visualStyle: generateVisualStyle(stats, rarity, mold.shape, doughFlatList),
    bakeMeta: { techniqueId: opts.techniqueId, techniqueName: technique.name, bakeTempC: opts.bakeTempC, moldId: mold.id, breadType: moldBreadType, qualityFactor: q },
    bakeNameFromPresetBase: hasPresetBase,
    baseName: opts.baseNameForFillingOnly ?? opts.baseName ?? (finalName.replace(/[（(][^）)]+[）)]$/, '').trim() || finalName),
    fillingTag: opts.fillingTagForFillingOnly ?? opts.fillingTag ?? fillingNameForTag,
    shortDesc: narrative.slice(0, 100),
    bakeSourceOpts: snapshotBakeOpts(opts),
    createdAt: Date.now(),
  };
}

/** 支持 opts.xxxAmounts: { "名称": 数量 }，数量可为小数，消耗时向上取整 */
/** 根据原料用量计算面团总重量（克），用于每批能做几个 */
export function calculateBatchWeight(opts) {
  let total = 0;
  const add = (names, amounts, skipName) => {
    for (const n of names || []) {
      if (!n || n === skipName) continue;
      const amt = amounts?.[n] != null ? Number(amounts[n]) : 1;
      if (amt > 0) total += amt;
    }
  };
  add(opts.flourNames, opts.flourAmounts);
  add(opts.liquidNames, opts.liquidAmounts);
  if (opts.yeastName) total += opts.yeastAmounts?.[opts.yeastName] ?? 1;
  add(opts.accessoryNames, opts.accessoryAmounts, '无辅料');
  add(opts.flavorNames, opts.flavorAmounts, '无添加');
  /* 馅料不计入面团总重，只用于出炉后包馅消耗 */
  return Math.max(100, total); // 最少 100g
}

export function buildInventoryRequirementsFromAdvanced(opts) {
  const req = {};
  const amt = (name, def = 1) => {
    if (opts.flourAmounts?.[name] != null) return Number(opts.flourAmounts[name]) || 0;
    return def;
  };
  const amtL = (name, def = 1) => opts.liquidAmounts?.[name] != null ? (Number(opts.liquidAmounts[name]) || 0) : def;
  const amtA = (name, def = 1) => opts.accessoryAmounts?.[name] != null ? (Number(opts.accessoryAmounts[name]) || 0) : def;
  const amtF = (name, def = 1) => opts.flavorAmounts?.[name] != null ? (Number(opts.flavorAmounts[name]) || 0) : def;

  for (const n of opts.flourNames || []) {
    const v = amt(n); if (n && v > 0) req[n] = (req[n] || 0) + v;
  }
  for (const n of opts.liquidNames || []) {
    const v = amtL(n); if (n && v > 0) req[n] = (req[n] || 0) + v;
  }
  if (opts.yeastName) {
    const yAmt = opts.yeastAmounts?.[opts.yeastName] != null ? (Number(opts.yeastAmounts[opts.yeastName]) || 0) : 1;
    if (yAmt > 0) req[opts.yeastName] = (req[opts.yeastName] || 0) + yAmt;
  }
  for (const n of opts.accessoryNames || []) {
    const v = amtA(n); if (n && n !== '无辅料' && v > 0) req[n] = (req[n] || 0) + v;
  }
  for (const n of opts.flavorNames || []) {
    const v = amtF(n); if (n && n !== '无添加' && v > 0) req[n] = (req[n] || 0) + v;
  }
  /* 馅料在出炉结算时按只数扣除，不在此一次性扣 */
  return req;
}
