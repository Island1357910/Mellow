/** 像素地图入口标签的装饰框（public/images）；每张图一种画框风格 */

export const PIXEL_LABEL_FRAME_URLS = [
  './images/retouch_2026032613211982.png',
  './images/retouch_2026032613215127.png',
  './images/retouch_2026032613213463.png',
  './images/retouch_2026032613224042.png',
  './images/retouch_2026032613230807.png',
  './images/retouch_2026032613232561.png',
  './images/retouch_2026032613234437.png',
];

export function fnv1aHash32(str) {
  const s = String(str ?? '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 同一页内按顺序分配画框：顺序打乱由 pageSeed 决定且稳定；前 N 个（N≤画框种数）互不重复。
 * 热点数超过画框种数时，从第 (种数+1) 个起会开始复用。
 *
 * @param {string} pageSeed 页面唯一标识，如 bakery-hub、procurement-market
 * @param {number} spotCount 该页热点数量
 * @returns {string[]} 与热点顺序一一对应的图片 URL
 */
export function assignPixelLabelFramesForPage(pageSeed, spotCount) {
  const urls = PIXEL_LABEL_FRAME_URLS;
  const m = urls.length;
  const order = Array.from({ length: m }, (_, i) => i);
  const rand = mulberry32(fnv1aHash32(pageSeed) || 1);
  for (let i = m - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const out = [];
  for (let i = 0; i < spotCount; i++) {
    out.push(urls[order[i % m]]);
  }
  return out;
}

/**
 * 按锚点稳定「随机」选用画框（同一点位每次刷新页面结果不变）
 * @param {string} seedKey 如 pageId、spotId、分区 key
 */
export function getPixelLabelFrameUrl(seedKey) {
  const idx = fnv1aHash32(seedKey) % PIXEL_LABEL_FRAME_URLS.length;
  return PIXEL_LABEL_FRAME_URLS[idx];
}
