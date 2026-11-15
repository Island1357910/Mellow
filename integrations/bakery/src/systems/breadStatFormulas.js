/**
 * 面团四维属性：按各原料克数占面团总重的比例加权叠加 baseAttr，再算协同与工艺修正。
 * 馅料不参与面团加权；仅在最后按 baseAttr 额外叠加强度较低的加成。
 */
import { ingredients, synergies } from '../data/ingredients';

function findSynergiesForNames(ingredientNames) {
  return synergies.filter((syn) => syn.combo.every((name) => ingredientNames.includes(name)));
}

const ATTRS = ['甜度', '柔软度', '香气', '复杂度'];

function byName(cat, name) {
  return ingredients[cat]?.find((i) => i.name === name) || null;
}

function sumAmounts(names, amounts, skip) {
  let s = 0;
  for (const n of names || []) {
    if (!n || n === skip) continue;
    const v = amounts?.[n];
    if (v != null && Number(v) > 0) s += Number(v);
  }
  return s;
}

/** 面团总重（与 calculateBatchWeight 一致，不含馅料） */
export function doughTotalGrams(opts) {
  let t = 0;
  t += sumAmounts(opts.flourNames, opts.flourAmounts);
  t += sumAmounts(opts.liquidNames, opts.liquidAmounts);
  if (opts.yeastName) {
    const y = opts.yeastAmounts?.[opts.yeastName];
    if (y != null && Number(y) > 0) t += Number(y);
  }
  t += sumAmounts(opts.accessoryNames, opts.accessoryAmounts, '无辅料');
  t += sumAmounts(opts.flavorNames, opts.flavorAmounts, '无添加');
  return Math.max(1, t);
}

/**
 * @param {object} opts 与烘焙表单一致
 * @param {object|null} fillingIng 馅料对象或 null（仅在面团统计结束后叠加）
 * @returns {object} stats 0–20
 */
export function computeStatsFromWeightedOpts(opts, fillingIng) {
  const W = doughTotalGrams(opts);
  const stats = { 甜度: 0, 柔软度: 0, 香气: 0, 复杂度: 0 };
  const SCALE = 2.4;

  const add = (ing, grams) => {
    if (!ing?.baseAttr || !(grams > 0)) return;
    const t = grams / W;
    for (const a of ATTRS) {
      stats[a] += t * (ing.baseAttr[a] || 0) * SCALE;
    }
  };

  for (const n of opts.flourNames || []) add(byName('面粉', n), Number(opts.flourAmounts?.[n]) || 0);
  for (const n of opts.liquidNames || []) add(byName('液体', n), Number(opts.liquidAmounts?.[n]) || 0);
  if (opts.yeastName) add(byName('酵母', opts.yeastName), Number(opts.yeastAmounts?.[opts.yeastName]) || 0);
  for (const n of opts.accessoryNames || []) {
    if (!n || n === '无辅料') continue;
    add(byName('辅料', n), Number(opts.accessoryAmounts?.[n]) || 0);
  }
  for (const n of opts.flavorNames || []) {
    if (!n || n === '无添加') continue;
    add(byName('风味', n), Number(opts.flavorAmounts?.[n]) || 0);
  }

  const nameList = [];
  for (const n of opts.flourNames || []) if (byName('面粉', n)) nameList.push(n);
  for (const n of opts.liquidNames || []) if (byName('液体', n)) nameList.push(n);
  if (opts.yeastName) nameList.push(opts.yeastName);
  for (const n of opts.accessoryNames || []) if (n && n !== '无辅料') nameList.push(n);
  for (const n of opts.flavorNames || []) if (n && n !== '无添加') nameList.push(n);

  for (const syn of findSynergiesForNames(nameList)) {
    for (const [a, v] of Object.entries(syn.bonus || {})) stats[a] = (stats[a] || 0) + v;
  }

  const fill = fillingIng;
  if (fill?.name && fill.name !== '无馅料' && fill.baseAttr) {
    const bump = 0.42;
    for (const a of ATTRS) stats[a] += (fill.baseAttr[a] || 0) * bump;
  }

  for (const a of ATTRS) {
    stats[a] = Math.max(0, Math.min(20, Math.round(stats[a])));
  }
  return stats;
}
