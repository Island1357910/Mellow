/**
 * 从面包描述中解析四维目标值（0–20）与品级关键词（传说/稀有/优质等），
 * 用于在配方生成后覆盖 stats、rarity。
 */

const ATTRS = ['甜度', '柔软度', '香气', '复杂度'];

function clampStat(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.max(0, Math.min(20, Math.round(x)));
}

/**
 * @param {string} text
 * @returns {Record<string, number>|null} 若有任一解析结果则返回对象，否则 null
 */
export function parseDescriptionStatTargets(text) {
  if (!text || typeof text !== 'string') return null;

  let uniform = null;
  const uniformRes = [
    /所有数值属性都是(\d{1,2})(?!克)/,
    /所有属性都是(\d{1,2})(?!克)/,
    /数值(?:属性)?都是(\d{1,2})(?!克)/,
    /四维(?:都|均|全)?是(\d{1,2})(?!克)/,
    /四项(?:都|均|全)?是(\d{1,2})(?!克)/,
    /(?:^|[，,；;\s])各(\d{1,2})(?!克)/,
    /全是(\d{1,2})(?!克)/,
    /通通(\d{1,2})(?!克)/,
    /全部(?:都)?是(\d{1,2})(?!克)/,
    /统统(\d{1,2})(?!克)/,
    /(?:目标|锁定)\s*四维\s*[:：=＝]\s*(\d{1,2})/,
    /四维\s*[:：=＝]\s*(\d{1,2})(?!\s*克)/,
  ];
  for (const re of uniformRes) {
    const m = text.match(re);
    if (m) {
      uniform = clampStat(m[1]);
      if (uniform != null) break;
    }
  }

  const per = {};
  const rePer = /(甜度|柔软度|香气|复杂度)\s*[:：]?\s*(\d{1,2})(?!克)/g;
  let mm;
  while ((mm = rePer.exec(text)) !== null) {
    const v = clampStat(mm[2]);
    if (v != null) per[mm[1]] = v;
  }

  if (uniform == null && Object.keys(per).length === 0) return null;

  const out = {};
  if (uniform != null) {
    for (const a of ATTRS) out[a] = uniform;
  }
  Object.assign(out, per);
  return out;
}

/**
 * @param {object} computedStats
 * @param {string} [description]
 * @returns {object} 合并后的 stats（无解析结果时原样返回）
 */
export function mergeStatsFromDescription(computedStats, description) {
  const targets = parseDescriptionStatTargets(description || '');
  if (!targets) return computedStats;
  return { ...computedStats, ...targets };
}

/** 与 rarityConfig / calculateRarity 返回值一致 */
const RARITY_RANK = { common: 0, uncommon: 1, rare: 2, legendary: 3 };

const LABEL_TO_RARITY = {
  传说: 'legendary',
  稀有: 'rare',
  优质: 'uncommon',
  普通: 'common',
};

/**
 * 从描述中解析玩家指定的面包品级；多处出现时取最高一档（传说 > 稀有 > 优质 > 普通）。
 * @param {string} text
 * @returns {'common'|'uncommon'|'rare'|'legendary'|null}
 */
export function parseDescriptionRarity(text) {
  if (!text || typeof text !== 'string') return null;

  let best = null;
  let bestRank = -1;
  const consider = (key) => {
    if (!key || RARITY_RANK[key] === undefined) return;
    if (RARITY_RANK[key] > bestRank) {
      bestRank = RARITY_RANK[key];
      best = key;
    }
  };

  const run = (re, onMatch) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      onMatch(m);
    }
  };

  run(
    /(?:面包)?(?:的)?(?:等级|品级|稀有度|品质)\s*[:：]?\s*(传说|稀有|优质|普通)/g,
    (m) => consider(LABEL_TO_RARITY[m[1]]),
  );

  run(/(传说|稀有|优质|普通)级/g, (m) => consider(LABEL_TO_RARITY[m[1]]));

  run(
    /(?:要|做|来个|来款|锁定|目标)\s*(?:品级|等级)?\s*[:：]?\s*(传说|稀有|优质|普通)(?:级)?/g,
    (m) => consider(LABEL_TO_RARITY[m[1]]),
  );

  run(/(?:^|[，,；;\s])(传说|稀有|优质|普通)(?=[，,；;\s]|面包|吐司|款|$)/g, (m) => {
    const label = m[1];
    if (label === '稀有') {
      const labelStart = m.index + m[0].length - label.length;
      const rest = text.slice(labelStart + label.length);
      if (/^(?:面粉|原料|材料|酵母|液体)/.test(rest)) return;
    }
    consider(LABEL_TO_RARITY[label]);
  });

  return best;
}
