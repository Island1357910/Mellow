/** 18 种面包类型对应的预设图片 URL，用于面包图形展示 */
export const BREAD_TYPE_IMAGES = {
  圆面包: 'https://drive.mujian.me/f/6qDca/retouch_2026032322385951.png',
  碱水包: 'https://drive.mujian.me/f/j5NH9/retouch_2026032413434156.png',
  可颂: 'https://drive.mujian.me/f/y0gu5/retouch_2026032322131627.png',
  吐司面包: 'https://drive.mujian.me/f/MyBTo/retouch_2026032322125130.png',
  德国结: 'https://drive.mujian.me/f/ZMAiO/retouch_2026032413455518.png',
  盐面包: 'https://drive.mujian.me/f/AOytm/retouch_2026032413435809.png',
  长面包: 'https://drive.mujian.me/f/8PQhv/retouch_2026032413442796.png',
  和风面包: 'https://drive.mujian.me/f/oXaf6/retouch_2026032413441366.png',
  玛芬面包: 'https://drive.mujian.me/f/EgYcG/retouch_2026032413444439.png',
  肉桂卷: 'https://drive.mujian.me/f/m4kFg/retouch_2026032413451314.png',
  三角面包: 'https://drive.mujian.me/f/QDQhl/retouch_2026032413445874.png',
  法棍: 'https://drive.mujian.me/f/BmqSv/retouch_2026032413452784.png',
  贝果: 'https://drive.mujian.me/f/DkjIw/retouch_2026032413454089.png',
  花圈面包: 'https://drive.mujian.me/f/NM8tG/retouch_2026032413461019.png',
  乡村面包: 'https://drive.mujian.me/f/RD4Il/retouch_2026032413521040.png',
  大鼓面包: 'https://drive.mujian.me/f/OKPux/retouch_2026032413513227.png',
  欧包: 'https://drive.mujian.me/f/ZM6fO/retouch_2026032413515171.png',
  佛卡夏面包: 'https://drive.mujian.me/f/AO6hm/retouch_2026032413504863.png',
};

/** 模具 breadType 或名称到图片的映射（兼容多种称呼） */
const BREAD_TYPE_ALIASES = {
  软欧: '圆面包', 圆包: '圆面包', 圆形: '圆面包',
  吐司: '吐司面包', loaf: '吐司面包',
  法棍: '法棍', baguette: '法棍',
  德国结: '德国结', 碱水包: '碱水包', pretzel: '德国结',
  可颂: '可颂', 牛角: '可颂', croissant: '可颂',
  盐面包: '盐面包', 盐可颂: '盐面包',
  长面包: '长面包', longloaf: '长面包',
  和风面包: '和风面包', 和风: '和风面包', wafu: '和风面包',
  玛芬: '玛芬面包', 玛芬面包: '玛芬面包', muffin: '玛芬面包',
  肉桂卷: '肉桂卷', cinnamon: '肉桂卷',
  三角面包: '三角面包', 三角: '三角面包', triangle: '三角面包',
  贝果: '贝果', bagel: '贝果',
  花圈面包: '花圈面包', 编花: '花圈面包', braided: '花圈面包',
  乡村面包: '乡村面包', 恰巴塔: '乡村面包', ciabatta: '乡村面包',
  大鼓面包: '大鼓面包', 大鼓: '大鼓面包',
  欧包: '欧包', 软欧包: '欧包',
  佛卡夏: '佛卡夏面包', 佛卡夏面包: '佛卡夏面包', focaccia: '佛卡夏面包',
  小餐包: '圆面包', bun: '圆面包',
  环形包: '花圈面包', ring: '花圈面包',
};

/**
 * 根据配方获取面包类型对应的图片 URL
 * @param {object} recipe - 配方对象，含 bakeMeta.breadType、bakeMeta.moldId、模具、baseName 等
 * @returns {string|null} 图片 URL 或 null
 */
export function getBreadImageUrl(recipe) {
  const bm = recipe?.bakeMeta;
  const moldId = bm?.moldId;
  const breadType = bm?.breadType || recipe?.模具;
  const baseName = recipe?.baseName || recipe?.name;

  const candidates = [
    breadType?.split('/')[0]?.trim(),
    breadType?.split('/')[1]?.trim(),
    moldId,
    baseName,
  ].filter(Boolean);

  for (const c of candidates) {
    const key = BREAD_TYPE_ALIASES[c] || c;
    const url = BREAD_TYPE_IMAGES[key];
    if (url) return url;
  }

  return BREAD_TYPE_IMAGES['圆面包'] || null;
}

/** 原料名 → 主色调色相偏移（HSL hue 0-360），用于根据面包特性着色 */
const INGREDIENT_HUE = {
  抹茶粉: 120, 可可粉: 25, 薰衣草: 280, 玫瑰露: 340, 黑麦粉: 30, 全麦粉: 45,
  蓝莓酱: 260, 红豆沙: 0, 焦糖酱: 35, 芒果慕斯: 40, 椰奶: 45, 蜂蜜水: 42,
  伯爵茶: 30, 香草精: 50, 肉桂粉: 25, 巧克力熔岩: 25,
  桂花: 48, 芋泥肉松: 290,
};

/** 从配方中提取主导风味原料，用于决定色调 */
function getDominantFlavorHue(recipe) {
  const fill = recipe?.ingredientsMulti?.馅料;
  const fillName = fill?.name ?? (typeof fill === 'object' ? null : fill);
  const ings = [
    ...(recipe?.ingredientsMulti?.风味 || []).map((x) => x?.name),
    ...(recipe?.ingredientsMulti?.面粉 || []).map((x) => x?.name),
    ...(fillName ? [fillName] : []),
    ...(recipe?.ingredientsMulti?.液体 || []).map((x) => x?.name),
  ].filter(Boolean);
  for (const n of ings) {
    const hue = INGREDIENT_HUE[n];
    if (hue != null) return hue;
  }
  return null;
}

/** 特效滤镜：根据面包特性（原料、属性、稀有度）生成颜色、饱和度、亮度、点缀等 */
export function getBreadImageFilter(recipe) {
  const stats = recipe?.stats || {};
  const rarity = recipe?.rarity || 'common';
  const filters = [];
  const baseHue = 30; // 默认面包色
  const domHue = getDominantFlavorHue(recipe);
  const hueShift = domHue != null ? domHue - baseHue : 0;
  const sat = 35 + (stats.香气 || 0) * 3;
  const bright = 92 + (stats.甜度 || 0) * 0.6;
  const contrast = 98 + (stats.复杂度 || 0) * 1.5;
  if (hueShift !== 0) {
    filters.push(`hue-rotate(${hueShift}deg)`);
  }
  filters.push(`saturate(${Math.max(85, Math.min(150, sat))}%)`);
  filters.push(`brightness(${Math.max(88, Math.min(112, bright))}%)`);
  filters.push(`contrast(${Math.max(96, Math.min(118, contrast))}%)`);
  if (rarity === 'legendary') {
    filters.push('drop-shadow(0 0 12px rgba(255,215,0,0.6))');
    filters.push('drop-shadow(0 0 4px rgba(255,200,100,0.4))');
  } else if (rarity === 'rare') {
    filters.push('drop-shadow(0 0 8px rgba(255,215,0,0.45))');
  }
  if ((stats.甜度 || 0) >= 12) {
    filters.push('drop-shadow(0 -2px 4px rgba(255,220,180,0.3))');
  }
  return filters.join(' ');
}
