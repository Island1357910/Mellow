/** 成就定义（仅用当前存档可读字段判断） */

import {
  CROSS_SYNERGY_NAMES,
  MOLD_TECH_SYNERGY_NAMES,
  synergyDefinitionHasNegative,
} from './bakeSynergies';

function exploredSynergyNames(s) {
  return s.exploredSynergyNames || [];
}

function exploredSynTotal(s) {
  return exploredSynergyNames(s).length;
}

function exploredCrossSynCount(s) {
  return exploredSynergyNames(s).filter((n) => CROSS_SYNERGY_NAMES.has(n)).length;
}

function exploredMoldTechSynCount(s) {
  return exploredSynergyNames(s).filter((n) => MOLD_TECH_SYNERGY_NAMES.has(n)).length;
}

function exploredHasNegativeSyn(s) {
  return exploredSynergyNames(s).some((n) => synergyDefinitionHasNegative(n));
}

function exploredSynNamed(s, name) {
  return exploredSynergyNames(s).includes(name);
}

function invSkuCount(s) {
  return new Set((s.inventory?.lots || []).map((l) => l.sku).filter(Boolean)).size;
}

function compWins(s) {
  return (s.completedCompetitionIds || []).length;
}

/** 成就分类（顺序即标签栏顺序） */
export const ACHIEVEMENT_CATEGORY_ORDER = [
  { id: 'retail', label: '店面经营' },
  { id: 'days', label: '日积月累' },
  { id: 'recipe', label: '配方研发' },
  { id: 'assets', label: '资产仓储' },
  { id: 'depth', label: '馅料与协同' },
  { id: 'story', label: '剧情赛事' },
];

const ACHIEVEMENT_CATEGORY_PREFIXES = [
  [['sales_', 'guests_', 'rep_', 'menu_', 'yesterday_'], 'retail'],
  [['day_', 'yeast_'], 'days'],
  [['lib_', 'craft_'], 'recipe'],
  [['gold_', 'eq_', 'sku_'], 'assets'],
  [['fill_', 'syn_', 'mold_'], 'depth'],
  [['story_', 'comp_'], 'story'],
];

/** @param {string} achievementId */
export function getAchievementCategory(achievementId) {
  for (const [prefixes, catId] of ACHIEVEMENT_CATEGORY_PREFIXES) {
    if (prefixes.some((p) => achievementId.startsWith(p))) return catId;
  }
  return 'retail';
}

/** @type {{ id: string, name: string, desc: string, icon: string, check: (s: object) => boolean }[]} */
export const ACHIEVEMENT_DEFINITIONS = [
  { id: 'sales_1', name: '第一桶金', desc: '完成首笔销售。', icon: '💵', check: (s) => s.totalSales >= 1 },
  { id: 'sales_12', name: '小本经营', desc: '累计销售达 12 笔。', icon: '🪙', check: (s) => s.totalSales >= 12 },
  { id: 'sales_35', name: '客源稳定', desc: '累计销售达 35 笔。', icon: '💰', check: (s) => s.totalSales >= 35 },
  { id: 'sales_70', name: '货架常空', desc: '累计销售达 70 笔。', icon: '🏪', check: (s) => s.totalSales >= 70 },
  { id: 'sales_130', name: '街坊口碑', desc: '累计销售达 130 笔。', icon: '📣', check: (s) => s.totalSales >= 130 },
  { id: 'sales_220', name: '传奇营业额', desc: '累计销售达 220 笔以上。', icon: '👑', check: (s) => s.totalSales >= 220 },

  { id: 'guests_10', name: '初见人气', desc: '累计接待 10 位顾客。', icon: '🧑', check: (s) => s.totalGuests >= 10 },
  { id: 'guests_35', name: '门庭若市', desc: '累计接待 35 位顾客。', icon: '👥', check: (s) => s.totalGuests >= 35 },
  { id: 'guests_75', name: '熟脸如云', desc: '累计接待 75 位顾客。', icon: '🎭', check: (s) => s.totalGuests >= 75 },
  { id: 'guests_140', name: '远近闻名', desc: '累计接待 140 位顾客。', icon: '🗺️', check: (s) => s.totalGuests >= 140 },
  { id: 'guests_250', name: '千人一面包', desc: '累计接待 250 位顾客。', icon: '🎪', check: (s) => s.totalGuests >= 250 },

  { id: 'rep_8', name: '小有名气', desc: '声望达到 8。', icon: '⭐', check: (s) => s.reputation >= 8 },
  { id: 'rep_28', name: '街区明星', desc: '声望达到 28。', icon: '🌟', check: (s) => s.reputation >= 28 },
  { id: 'rep_55', name: '城市名片', desc: '声望达到 55。', icon: '✨', check: (s) => s.reputation >= 55 },
  { id: 'rep_95', name: '烘焙名士', desc: '声望达到 95。', icon: '💫', check: (s) => s.reputation >= 95 },
  { id: 'rep_140', name: '传说店主', desc: '声望达到 140。', icon: '🏆', check: (s) => s.reputation >= 140 },

  { id: 'day_3', name: '三日坊主？不', desc: '经营至第 3 天。', icon: '📅', check: (s) => s.day >= 3 },
  { id: 'day_7', name: '一周恒心', desc: '经营至第 7 天。', icon: '🗓️', check: (s) => s.day >= 7 },
  { id: 'day_15', name: '半月如一日', desc: '经营至第 15 天。', icon: '📆', check: (s) => s.day >= 15 },
  { id: 'day_28', name: '四季轮回前', desc: '经营至第 28 天。', icon: '🌙', check: (s) => s.day >= 28 },
  { id: 'day_50', name: '半百昼夜', desc: '经营至第 50 天。', icon: '🌈', check: (s) => s.day >= 50 },

  { id: 'lib_2', name: '配方萌芽', desc: '配方库中至少 2 款面包。', icon: '📜', check: (s) => (s.recipes?.length || 0) >= 2 },
  { id: 'lib_5', name: '藏谱渐丰', desc: '配方库中至少 5 款面包。', icon: '📚', check: (s) => (s.recipes?.length || 0) >= 5 },
  { id: 'lib_9', name: '研发狂人', desc: '配方库中至少 9 款面包。', icon: '🧪', check: (s) => (s.recipes?.length || 0) >= 9 },
  { id: 'lib_14', name: '面包百科全书', desc: '配方库中至少 14 款面包。', icon: '📖', check: (s) => (s.recipes?.length || 0) >= 14 },
  { id: 'lib_20', name: '博物馆级收藏', desc: '配方库中至少 20 款面包。', icon: '🏛️', check: (s) => (s.recipes?.length || 0) >= 20 },

  { id: 'craft_2', name: '上新二号', desc: '累计创造 2 款不同配方上架或入库。', icon: '🔰', check: (s) => s.recipesCreated >= 2 },
  { id: 'craft_6', name: '点子不断', desc: '累计创造 6 款配方。', icon: '💡', check: (s) => s.recipesCreated >= 6 },
  { id: 'craft_12', name: '口味实验室', desc: '累计创造 12 款配方。', icon: '⚗️', check: (s) => s.recipesCreated >= 12 },
  { id: 'craft_20', name: '创新流水线', desc: '累计创造 20 款配方。', icon: '🏭', check: (s) => s.recipesCreated >= 20 },
  { id: 'craft_28', name: '三十而立…款', desc: '累计创造 28 款配方。', icon: '🎯', check: (s) => s.recipesCreated >= 28 },

  { id: 'gold_400', name: '腰缠四百', desc: '持有金币达到 400。', icon: '💲', check: (s) => s.gold >= 400 },
  { id: 'gold_1200', name: '小金库', desc: '持有金币达到 1200。', icon: '👛', check: (s) => s.gold >= 1200 },
  { id: 'gold_2800', name: '钱生钱', desc: '持有金币达到 2800。', icon: '💎', check: (s) => s.gold >= 2800 },
  { id: 'gold_5500', name: '大财主', desc: '持有金币达到 5500。', icon: '🏦', check: (s) => s.gold >= 5500 },
  { id: 'gold_9000', name: '九千传说', desc: '持有金币达到 9000。', icon: '🐉', check: (s) => s.gold >= 9000 },

  { id: 'menu_4', name: '四时菜单', desc: '当日菜单至少 4 款在售。', icon: '📋', check: (s) => (s.menuRecipes?.length || 0) >= 4 },
  { id: 'menu_8', name: '满贯上架', desc: '菜单满 8 款面包。', icon: '🎰', check: (s) => (s.menuRecipes?.length || 0) >= 8 },

  { id: 'eq_fridge', name: '冷鲜第一步', desc: '购入冷藏柜。', icon: '❄️', check: (s) => !!s.equipment?.fridge },
  { id: 'eq_freezer', name: '深度冷冻', desc: '购入冷冻柜。', icon: '🧊', check: (s) => !!s.equipment?.freezer },
  { id: 'eq_both', name: '冷链齐全', desc: '同时拥有冷藏与冷冻柜。', icon: '🏔️', check: (s) => !!s.equipment?.fridge && !!s.equipment?.freezer },

  { id: 'fill_1', name: '馅料入门', desc: '首次做出自制馅料。', icon: '🥣', check: (s) => (s.craftedFillings?.length || 0) >= 1 },
  { id: 'fill_5', name: '馅料大师傅', desc: '同时或累计保有 5 种自制馅料（数量按种类）。', icon: '🍯', check: (s) => (s.craftedFillings?.length || 0) >= 5 },

  { id: 'syn_1', name: '协同初体验', desc: '在烘焙中解锁 1 种协同（含跨界）。', icon: '🔗', check: (s) => exploredSynTotal(s) >= 1 },
  { id: 'syn_3', name: 'combo 三连', desc: '解锁 3 种不同协同。', icon: '🎲', check: (s) => exploredSynTotal(s) >= 3 },
  { id: 'syn_6', name: '协同收集家', desc: '解锁 6 种不同协同。', icon: '🧩', check: (s) => exploredSynTotal(s) >= 6 },
  { id: 'syn_10', name: '协同图鉴入门', desc: '解锁 10 种不同协同。', icon: '📇', check: (s) => exploredSynTotal(s) >= 10 },
  { id: 'syn_15', name: '组合魔术师', desc: '解锁 15 种不同协同。', icon: '🪄', check: (s) => exploredSynTotal(s) >= 15 },
  { id: 'syn_20', name: '和面化学家', desc: '解锁 20 种不同协同。', icon: '⚗️', check: (s) => exploredSynTotal(s) >= 20 },
  { id: 'syn_28', name: '全店配方巫师', desc: '解锁 28 种不同协同。', icon: '🔮', check: (s) => exploredSynTotal(s) >= 28 },

  { id: 'syn_x_1', name: '次元破壁', desc: '首次触发原料×模具 / 原料×手法 / 模具×手法类跨界协同。', icon: '🧱', check: (s) => exploredCrossSynCount(s) >= 1 },
  { id: 'syn_x_5', name: '工艺叠罗汉', desc: '累计解锁 5 种跨界协同。', icon: '🪜', check: (s) => exploredCrossSynCount(s) >= 5 },
  { id: 'syn_x_12', name: '模具手法双修', desc: '累计解锁 12 种跨界协同。', icon: '⚔️', check: (s) => exploredCrossSynCount(s) >= 12 },

  { id: 'syn_mt_2', name: '形与法的握手', desc: '解锁 2 种「模具×手法」协同。', icon: '🤝', check: (s) => exploredMoldTechSynCount(s) >= 2 },
  { id: 'syn_mt_4', name: '烤炉几何学', desc: '解锁 4 种「模具×手法」协同。', icon: '📐', check: (s) => exploredMoldTechSynCount(s) >= 4 },

  { id: 'syn_neg_1', name: '翻车也是科研', desc: '至少解锁过 1 种带负面四维加成的协同。', icon: '🤔', check: (s) => exploredHasNegativeSyn(s) },

  { id: 'syn_nm_poolish_baguette', name: '液种长笛手', desc: '解锁协同「液种法棍联盟」。', icon: '🥖', check: (s) => exploredSynNamed(s, '液种法棍联盟') },
  { id: 'syn_nm_croissant_lam', name: '正统可颂魂', desc: '解锁协同「可颂正统血统」。', icon: '🥐', check: (s) => exploredSynNamed(s, '可颂正统血统') },
  { id: 'syn_nm_butter_lam', name: '千层黄油誓约', desc: '解锁协同「千层黄油魂」。', icon: '🧈', check: (s) => exploredSynNamed(s, '千层黄油魂') },
  { id: 'syn_nm_sourdough_twice', name: '酸种双重名分', desc: '解锁协同「酸种认亲大会」。', icon: '🫙', check: (s) => exploredSynNamed(s, '酸种认亲大会') },
  { id: 'syn_nm_tangzhong_loaf', name: '汤种方盒圣地', desc: '解锁协同「汤种吐司圣域」。', icon: '📦', check: (s) => exploredSynNamed(s, '汤种吐司圣域') },
  { id: 'syn_nm_matcha_muffin', name: '袖珍茶园', desc: '解锁协同「抹茶玛芬结界」。', icon: '🍵', check: (s) => exploredSynNamed(s, '抹茶玛芬结界') },
  { id: 'syn_nm_pretzel_salt', name: '盐与扭结', desc: '解锁协同「碱水灵魂盐」。', icon: '🥨', check: (s) => exploredSynNamed(s, '碱水灵魂盐') },
  { id: 'syn_nm_baking_clash', name: '膨松内战目击者', desc: '解锁协同「膨松酸种内战」。', icon: '💥', check: (s) => exploredSynNamed(s, '膨松酸种内战') },
  { id: 'syn_nm_bacon_lavender', name: '花田里的培根', desc: '解锁协同「花田培根雾」。', icon: '🥓', check: (s) => exploredSynNamed(s, '花田培根雾') },
  { id: 'syn_nm_curry_cocoa', name: '咖喱可可悬案', desc: '解锁协同「咖喱可可劫案」。', icon: '🍛', check: (s) => exploredSynNamed(s, '咖喱可可劫案') },
  { id: 'syn_nm_smoky_ring', name: '烟熏花环', desc: '解锁协同「烟熏花花世界」。', icon: '🍩', check: (s) => exploredSynNamed(s, '烟熏花花世界') },
  { id: 'syn_nm_fast_yeast', name: '快发直球王', desc: '解锁协同「快发直球对决」。', icon: '⚡', check: (s) => exploredSynNamed(s, '快发直球对决') },

  { id: 'mold_1', name: '模具有灵', desc: '使用 1 种模具记入探索。', icon: '🫓', check: (s) => (s.exploredMoldIds?.length || 0) >= 1 },
  { id: 'mold_3', name: '花模百出', desc: '使用 3 种不同模具。', icon: '🎨', check: (s) => (s.exploredMoldIds?.length || 0) >= 3 },
  { id: 'mold_5', name: '模塑万象', desc: '使用 5 种不同模具。', icon: '🖼️', check: (s) => (s.exploredMoldIds?.length || 0) >= 5 },

  { id: 'story_0', name: '主线启程', desc: '完成主线序章节点（解锁第一节）。', icon: '📘', check: (s) => (s.mainStoryCompletedUpTo ?? -1) >= 0 },
  { id: 'story_1', name: '剧情深入', desc: '主线推进至第 2 节及以后。', icon: '📗', check: (s) => (s.mainStoryCompletedUpTo ?? -1) >= 1 },
  { id: 'story_3', name: '卷三终章近', desc: '主线推进至第 4 节及以后。', icon: '📙', check: (s) => (s.mainStoryCompletedUpTo ?? -1) >= 3 },
  { id: 'story_5', name: '章节过半', desc: '主线推进至第 6 节及以后。', icon: '📕', check: (s) => (s.mainStoryCompletedUpTo ?? -1) >= 5 },

  { id: 'comp_1', name: '赛场首秀', desc: '完成 1 次烘焙比赛投稿。', icon: '🎪', check: (s) => compWins(s) >= 1 },
  { id: 'comp_2', name: '再试身手', desc: '累计完成 2 次比赛记录。', icon: '🎫', check: (s) => compWins(s) >= 2 },
  { id: 'comp_4', name: '赛坛常客', desc: '累计完成 4 次比赛记录。', icon: '🥇', check: (s) => compWins(s) >= 4 },

  { id: 'sku_5', name: '原料五味', desc: '库存中至少 5 种不同 SKU。', icon: '🌾', check: (s) => invSkuCount(s) >= 5 },
  { id: 'sku_12', name: '仓库琳琅', desc: '库存中至少 12 种不同 SKU。', icon: '📦', check: (s) => invSkuCount(s) >= 12 },
  { id: 'sku_18', name: '百货柜式库存', desc: '库存中至少 18 种不同 SKU。', icon: '🏬', check: (s) => invSkuCount(s) >= 18 },

  { id: 'yeast_2', name: '酵种守候', desc: '天然酵种连胜 streak 达到 2。', icon: '🫧', check: (s) => s.naturalYeastStreak >= 2 },
  { id: 'yeast_5', name: '酵母之友', desc: '天然酵种连胜 streak 达到 5。', icon: '🍞', check: (s) => s.naturalYeastStreak >= 5 },
  { id: 'yeast_8', name: '酵祖青睐', desc: '天然酵种连胜 streak 达到 8。', icon: '🔥', check: (s) => s.naturalYeastStreak >= 8 },

  { id: 'yesterday_250', name: '昨日小丰', desc: '单日昨日统计收入达 250。', icon: '🌅', check: (s) => (s.yesterdayStats?.income || 0) >= 250 },
  { id: 'yesterday_1000', name: '昨日大赚', desc: '单日昨日统计收入达 1000。', icon: '🎆', check: (s) => (s.yesterdayStats?.income || 0) >= 1000 },
];
