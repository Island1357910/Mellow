/**
 * 原料配比检查：面粉约55-65%、液体约30-40%、酵母约1-2%
 * 严重偏离为失败品，不可售卖只能丢弃
 */

import { calculateBatchWeight } from './recipeEngine';

/**
 * 将酵母克数限制在面团总重的 1%–2% 内（与 IDEAL_RATIO_BANDS 一致）。
 * AI 常高估酵母克数；等比放大整批用量时也会保持错误占比，故需在解析后强制校正。
 * @param {object} opts 与烘焙表单一致，会就地修改 yeastAmounts
 */
export function clampYeastAmountToIdealRatio(opts) {
  if (!opts?.yeastName) return opts;
  const yn = opts.yeastName;
  let y = Number(opts.yeastAmounts?.[yn]);
  if (!(y > 0)) return opts;
  const lo = 0.01;
  const hi = 0.02;
  const refine = () => {
    const total = calculateBatchWeight(opts);
    if (!(total > 50)) return;
    const pct = y / total;
    if (pct >= lo && pct <= hi + 1e-9) return;
    const targetPct = pct > hi ? hi - 0.001 : Math.max(lo, Math.min(pct, hi));
    const newY = Math.max(0.1, Math.round(total * targetPct * 10) / 10);
    opts.yeastAmounts = { ...(opts.yeastAmounts || {}), [yn]: newY };
    y = newY;
  };
  refine();
  refine();
  return opts;
}

/** 与「烘焙原理」一致的理想占比区间（占面团/批次总重） */
export const IDEAL_RATIO_BANDS = {
  flour: [0.55, 0.65],
  liquid: [0.3, 0.4],
  yeast: [0.01, 0.02],
};

/**
 * 已知某一类原料合计克数时，反推总重区间与其余主料的建议合计范围（理想配比）
 * @param {'flour'|'liquid'|'yeast'} anchorType
 * @param {number} anchorSumG
 * @returns {null | { anchorType, anchorLabel, totalBand, flourSumBand, liquidSumBand, yeastBand }}
 */
export function computeIdealWeightHints(anchorType, anchorSumG) {
  const g = Number(anchorSumG);
  if (!(g > 0) || !IDEAL_RATIO_BANDS[anchorType]) return null;
  const { flour, liquid, yeast } = IDEAL_RATIO_BANDS;
  const labels = { flour: '面粉合计', liquid: '液体合计', yeast: '酵母' };

  let Tlo; let Thi;
  if (anchorType === 'flour') {
    Tlo = g / flour[1];
    Thi = g / flour[0];
  } else if (anchorType === 'liquid') {
    Tlo = g / liquid[1];
    Thi = g / liquid[0];
  } else {
    Tlo = g / yeast[1];
    Thi = g / yeast[0];
  }

  const flourSumBand = [flour[0] * Tlo, flour[1] * Thi];
  const liquidSumBand = [liquid[0] * Tlo, liquid[1] * Thi];
  const yeastBand = [yeast[0] * Tlo, yeast[1] * Thi];

  return {
    anchorType,
    anchorLabel: labels[anchorType],
    totalBand: [Tlo, Thi],
    flourSumBand,
    liquidSumBand,
    yeastBand,
  };
}

function getCategoryTotal(opts, category) {
  const key = category === 'flour' ? 'flourNames' : category === 'liquid' ? 'liquidNames' : 'yeastNames';
  const amtKey = category === 'flour' ? 'flourAmounts' : category === 'liquid' ? 'liquidAmounts' : 'yeastAmounts';
  const names = category === 'yeast' ? (opts.yeastName ? [opts.yeastName] : []) : (opts[key] || []);
  const amounts = opts[amtKey] || {};
  let sum = 0;
  for (const n of names) {
    if (!n) continue;
    sum += Number(amounts[n] ?? 1) || 0;
  }
  return sum;
}

/** 检查原料配比，返回 { failed, reason }，failed 为 true 表示失败品不可售卖 */
export function checkRecipeRatios(opts, totalG) {
  const flourG = getCategoryTotal(opts, 'flour');
  const liquidG = getCategoryTotal(opts, 'liquid');
  const yeastG = getCategoryTotal(opts, 'yeast');
  const total = totalG ?? (flourG + liquidG + yeastG + 300);
  if (total < 100) return { failed: true, reason: '面团总重过少，无法成型' };
  const flourPct = (flourG / total) * 100;
  const liquidPct = (liquidG / total) * 100;
  const yeastPct = (yeastG / total) * 100;
  if (flourPct > 85) return { failed: true, reason: '面粉过多、液体过少，面团过干无法发酵' };
  if (flourPct < 35) return { failed: true, reason: '面粉过少、液体过多，面团过稀无法成型' };
  if (liquidPct > 55) return { failed: true, reason: '液体比例过高，面团过软无法定型' };
  if (liquidPct < 15 && total > 200) return { failed: true, reason: '液体过少，面团过硬难以发酵' };
  if (yeastPct > 5) return { failed: true, reason: '酵母过多，发酵过度会产生怪味' };
  if (yeastPct < 0.3 && total > 500) return { failed: true, reason: '酵母过少，无法正常发酵' };
  return { failed: false, reason: null };
}

/**
 * 用于界面实时提醒：先判定是否失败品阈值，再列出偏离理想占比（55%–65% / 30%–40% / 1%–2%）的项
 * @param {object} opts 与烘焙表单一致的 options
 * @param {number} totalG calculateBatchWeight(opts)
 */
export function analyzeRecipeRatios(opts, totalG) {
  const severe = checkRecipeRatios(opts, totalG);
  if (severe.failed) {
    return { severe, idealIssues: [] };
  }
  const flourG = getCategoryTotal(opts, 'flour');
  const liquidG = getCategoryTotal(opts, 'liquid');
  const yeastG = getCategoryTotal(opts, 'yeast');
  const total = totalG != null && totalG > 0 ? totalG : (flourG + liquidG + yeastG);
  if (total < 100) {
    return { severe, idealIssues: [] };
  }
  const flourPct = (flourG / total) * 100;
  const liquidPct = (liquidG / total) * 100;
  const yeastPct = (yeastG / total) * 100;
  const { flour, liquid, yeast } = IDEAL_RATIO_BANDS;
  const fpLo = flour[0] * 100;
  const fpHi = flour[1] * 100;
  const lpLo = liquid[0] * 100;
  const lpHi = liquid[1] * 100;
  const ypLo = yeast[0] * 100;
  const ypHi = yeast[1] * 100;
  const idealIssues = [];
  if (flourPct < fpLo - 1e-9 || flourPct > fpHi + 1e-9) {
    idealIssues.push(`面粉约占 ${flourPct.toFixed(1)}%，理想约 ${fpLo}%–${fpHi}%（相对本批总重）`);
  }
  if (liquidPct < lpLo - 1e-9 || liquidPct > lpHi + 1e-9) {
    idealIssues.push(`液体约占 ${liquidPct.toFixed(1)}%，理想约 ${lpLo}%–${lpHi}%（相对本批总重）`);
  }
  if (yeastPct < ypLo - 1e-9 || yeastPct > ypHi + 1e-9) {
    idealIssues.push(`酵母约占 ${yeastPct.toFixed(1)}%，理想约 ${ypLo}%–${ypHi}%（相对本批总重）`);
  }
  return { severe, idealIssues };
}

/** 原料搭配不当判定为劣质品：可售卖但价格大幅降低，并指出问题 */
const INFERIOR_RULES = [
  { check: (r) => r.ingredientsMulti?.面粉?.some(f => f?.name === '低筋面粉') && ['baguette','ciabatta','longloaf','pretzel'].includes(r.bakeMeta?.moldId),
    reason: '低筋面粉筋性不足，不适合做法棍、恰巴塔等需要强韧口感的面包' },
  { check: (r) => (r.ingredientsMulti?.面粉?.filter(f=>f?.name==='黑麦粉')?.length || 0) > 0 && ['croissant','danish','cinnamon'].includes(r.bakeMeta?.moldId),
    reason: '黑麦粉吸水性差、延展性不足，不适合做可颂、肉桂卷等起酥类' },
  { check: (r) => (r.ingredientsMulti?.面粉?.length || 0) >= 4 && !r.synergies?.length,
    reason: '多种面粉混合却无协同，风味杂乱' },
  { check: (r) => r.ingredientsMulti?.液体?.some(l => l?.name === '椰奶') && ['baguette','pretzel'].includes(r.bakeMeta?.moldId),
    reason: '椰奶脂肪含量高，不适合做法棍等追求酥脆外皮的面包' },
];

export function checkRecipeInferior(recipe) {
  for (const rule of INFERIOR_RULES) {
    if (rule.check(recipe)) {
      return { isInferior: true, reason: rule.reason };
    }
  }
  return { isInferior: false, reason: null };
}
