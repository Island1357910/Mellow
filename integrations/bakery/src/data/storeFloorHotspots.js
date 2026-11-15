/** 像素风俯视店面底图（幕间盘） — 主页面导航图 */
export const BAKERY_FLOOR_IMAGE_URL =
  'https://drive.mujian.me/f/vOluo/%E9%9D%A2%E5%8C%85%E6%88%BF.png';

/** 店面营业场景：底层橱窗 / 顶层柜台遮挡 */
export const STORE_WINDOW_IMAGE_URL =
  'https://drive.mujian.me/f/qwZCy/%E5%BA%97%E9%9D%A2%E7%AA%97%E5%8F%A3.png';
export const STORE_COUNTER_OVERLAY_IMAGE_URL =
  'https://drive.mujian.me/f/Z53iO/retouch_2026032518363555.png';

/** 工作室场景（配方 / 剧情类入口集中于此图） */
export const WORKSHOP_IMAGE_URL =
  'https://drive.mujian.me/f/A2qim/retouch_2026032518410398.png';

/** 超市采购场景底图 */
export const PROCUREMENT_MARKET_IMAGE_URL =
  'https://drive.mujian.me/f/8EPiv/retouch_2026032518312187.png';

/** 工坊场景（库存 / 馅料 / 探索） */
export const CRAFT_FLOOR_IMAGE_URL =
  'https://drive.mujian.me/f/ownu6/retouch_2026032519234363.png';

/**
 * 工坊 → 子页面光标（俯视参考图）
 * 库存右上货架 · 馅料中央操作台 · 探索右下器械区
 */
export const CRAFT_FLOOR_NAV_SPOTS = [
  { pageId: 'inventory', label: '库存', leftPct: 65, topPct: 11, labelBg: '#a5d8ff', labelFg: '#0b4a6f', dotBorder: '#1971c2' },
  { pageId: 'filling', label: '馅料', leftPct: 23, topPct: 46, labelBg: '#ffc9c9', labelFg: '#4d1010', dotBorder: '#e03131' },
  { pageId: 'explore', label: '探索', leftPct: 54, topPct: 72, labelBg: '#96f2d7', labelFg: '#0b3d2e', dotBorder: '#0ca678' },
];

/**
 * 工作室 → 子页面光标（与参考俯视图一致）
 * 成就左下矮柜 · 原理左上书架 · 故事中上书架 · 定制左中边柜 · 配方中央书桌 · 主线下方案椅前 · 比赛右下黑板
 */
export const WORKSHOP_NAV_SPOTS = [
  { pageId: 'achievements', label: '成就', leftPct: 12, topPct: 82, labelBg: '#ffe8cc', labelFg: '#5c3d1f', dotBorder: '#e8590c' },
  { pageId: 'principle', label: '原理', leftPct: 14, topPct: 19, labelBg: '#74c0fc', labelFg: '#0b2a4a', dotBorder: '#1864ab' },
  { pageId: 'characters', label: '故事', leftPct: 48, topPct: 19, labelBg: '#faa2c1', labelFg: '#5c0d2e', dotBorder: '#a61e4d' },
  { pageId: 'customOrder', label: '定制', leftPct: 22, topPct: 43, labelBg: '#ffc078', labelFg: '#5c2d04', dotBorder: '#d9480f' },
  { pageId: 'recipes', label: '配方', leftPct: 49, topPct: 46, labelBg: '#63e6be', labelFg: '#06281a', dotBorder: '#0ca678' },
  { pageId: 'story', label: '主线', leftPct: 52, topPct: 61, labelBg: '#d0bfff', labelFg: '#34115e', dotBorder: '#6741d9' },
  { pageId: 'competition', label: '比赛', leftPct: 78, topPct: 71, labelBg: '#ffe066', labelFg: '#4d3200', dotBorder: '#f08c00' },
];

/**
 * 超市采购图上的分区光标（与参考俯视图一致；无「全部」光标点，进入页默认展示全部 SKU）
 * 液体左上 · 面粉右上 · 风味中上 · 酵母左中 · 馅料右中 · 辅料左下 · AI生成中下 · 器械右下 · 前台结账左下
 */
export const PROCUREMENT_SHELF_HOTSPOTS = [
  { kind: 'category', categoryId: '液体', label: '液体', leftPct: 12, topPct: 16, labelBg: '#a5d8ff', labelFg: '#0b4a6f', dotBorder: '#1971c2' },
  { kind: 'category', categoryId: '面粉', label: '面粉', leftPct: 86, topPct: 14, labelBg: '#ffe8cc', labelFg: '#5c3d1f', dotBorder: '#e8590c' },
  { kind: 'category', categoryId: '风味', label: '风味', leftPct: 50, topPct: 30, labelBg: '#e599f7', labelFg: '#3b0a5e', dotBorder: '#9c36b5' },
  { kind: 'category', categoryId: '酵母', label: '酵母', leftPct: 18, topPct: 42, labelBg: '#b2f2bb', labelFg: '#123821', dotBorder: '#2f9e44' },
  { kind: 'category', categoryId: '馅料', label: '馅料', leftPct: 82, topPct: 42, labelBg: '#ffc9c9', labelFg: '#4d1010', dotBorder: '#e03131' },
  { kind: 'category', categoryId: '辅料', label: '辅料', leftPct: 24, topPct: 58, labelBg: '#d8f5a2', labelFg: '#2b3b08', dotBorder: '#5c940d' },
  { kind: 'category', categoryId: 'ai', label: 'AI生成', leftPct: 50, topPct: 58, labelBg: '#e7f5ff', labelFg: '#1864ab', dotBorder: '#339af0' },
  { kind: 'category', categoryId: '器械', label: '器械', leftPct: 78, topPct: 63, labelBg: '#ced4da', labelFg: '#212529', dotBorder: '#495057' },
  { kind: 'checkout', label: '前台结账', leftPct: 12, topPct: 82, labelBg: '#8ce99a', labelFg: '#0d3b14', dotBorder: '#2f9e44' },
];

/**
 * 主页面：俯视面包房地图导航（与参考图一致；彩色标签非黑底）
 * 库存 / 馅料 / 探索 由「工坊」场景进入
 */
/** 经营链顺序：采购 → 工坊 → 面包房 → 店面；工作室为新品研发链（标签坐标仍贴合底图） */
export const HUB_NAV_SPOTS = [
  { pageId: 'procurement', label: '采购', leftPct: 26, topPct: 88, labelBg: '#e599f7', labelFg: '#3b0a5e', dotBorder: '#9c36b5' },
  { pageId: 'craftFloor', label: '工坊', leftPct: 17, topPct: 30, labelBg: '#ffe066', labelFg: '#4d3200', dotBorder: '#f08c00' },
  { pageId: 'gameBakery', label: '面包房', leftPct: 15, topPct: 68, labelBg: '#a5d8ff', labelFg: '#0b2a4a', dotBorder: '#1971c2' },
  { pageId: 'gameStore', label: '店面', leftPct: 62, topPct: 78, labelBg: '#ff8787', labelFg: '#5c0d27', dotBorder: '#e03131' },
  { pageId: 'workshop', label: '工作室', leftPct: 72, topPct: 51, labelBg: '#d0bfff', labelFg: '#34115e', dotBorder: '#6741d9' },
  { pageId: 'settings', label: '设置', leftPct: 64, topPct: 18, labelBg: '#ced4da', labelFg: '#212529', dotBorder: '#495057' },
];

/**
 * 营业中：像素图上的三个光标；实际交互在弹窗内完成。
 * navigateTo：与 PAGE_IDS 一致的页面 id，仅非营业导览使用。
 */
export const STORE_FLOOR_SPOTS_BUSINESS = [
  {
    id: 'cabinet',
    label: '面包柜台',
    leftPct: 14,
    topPct: 38,
    title: '面包柜台',
    description:
      '打开光标后，在弹窗中查看今日上架面包、价格与剩余天数；鼠标移到某款上点「推荐」，向当前客人介绍并尝试成交。',
  },
  {
    id: 'guest',
    label: '来客接待',
    leftPct: 50,
    topPct: 86,
    title: '来客接待',
    description:
      '在弹窗中迎接客人、对话、查看满意度；可打开「面包柜台」光标选面包推荐，或使用「现场定制」生成 AI 面团后回面包房制作。',
  },
  {
    id: 'log',
    label: '今日记录',
    leftPct: 80,
    topPct: 48,
    title: '今日记录',
    description:
      '在弹窗中查看本日收入、接待人数、满意次数与成交日志；全部接待完毕后可在来客或此处结束营业。',
  },
];

export const STORE_FLOOR_SPOTS_EXTENDED = [
  {
    id: 'inventory',
    label: '库存',
    leftPct: 72,
    topPct: 22,
    title: '库存',
    description:
      '从侧栏打开「库存」页可查看面粉、液体、酵母与各类原料克数；研发与上架前建议先确认库存。',
    navigateTo: 'inventory',
  },
  {
    id: 'procurement',
    label: '采购',
    leftPct: 22,
    topPct: 70,
    title: '采购',
    description:
      '从侧栏「采购」补货；新解锁的 SKU 可在面包房配方中使用。',
    navigateTo: 'procurement',
  },
  {
    id: 'recipes',
    label: '配方',
    leftPct: 56,
    topPct: 72,
    title: '配方库',
    description:
      '侧栏「配方」中有经典配方与已保存 AI 配方，可固定为悬浮钉便于对照制作。',
    navigateTo: 'recipes',
  },
];

/** @param {'business' | 'full'} mode */
export function getStoreFloorSpots(mode) {
  if (mode === 'business') return STORE_FLOOR_SPOTS_BUSINESS;
  return [...STORE_FLOOR_SPOTS_BUSINESS, ...STORE_FLOOR_SPOTS_EXTENDED];
}
