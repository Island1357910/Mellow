import { createStarterInventory } from './inventorySystem';

const SAVE_KEY = 'qianwei_bakery_save';

export function getDefaultState() {
  const day = 1;
  return {
    day,
    gold: 500,
    reputation: 0,
    phase: 'morning',
    recipes: [],
    menuRecipes: [],
    unlockedSpecials: [],
    totalSales: 0,
    totalGuests: 0,
    recipesCreated: 0,
    achievedMilestones: [],
    naturalYeastStreak: 0,
    todayStats: { income: 0, guests: 0, happy: 0, totalSatisfaction: 0 },
    yesterdayStats: { income: 0, guests: 0, rate: '-' },
    currentEvent: null,
    prevReputation: 0,
    inventory: { lots: createStarterInventory(day) },
    equipment: { fridge: false, freezer: false },
    craftedFillings: [],
    customProcurementItems: [],
    storyChoices: {},
    mainStoryCompletedUpTo: -1,
    heroName: '林千穗',
    dayGuests: {},
    pendingCustomOrder: null, // { recipe, customerSnapshot } 现场定制需回面包房制作
    customOrderPool: null, // { day, orders } 定制单每日更新
    completedCompetitionIds: [], // 本周已参与过的比赛，新周自动清空
    exploredSynergyNames: [], // 烘焙中实际触发的协同名称（原料对 + bakeSynergies 跨界规则）
    exploredMoldIds: [], // 使用过的模具 id
    unlockedAchievements: [], // 已解锁成就 id（见 data/achievements.js）
    dayMultiplier: 1.0, // 当日点灯小游戏决定的收益倍率
    dayMultiplierDay: 0, // 倍率对应的游戏日（与 day 不同则今日未游戏）
  };
}

function migrateMenuRecipes(items, day) {
  if (!Array.isArray(items)) return [];
  return items.map((r) => {
    if (r && (r.qty != null) && (r.madeDay != null)) return r;
    return { ...r, qty: r?.qty ?? 1, madeDay: r?.madeDay ?? day };
  });
}

/** 配方库按 id 去重（上架与「保存配方」曾各写一次时会产生重复；无 id 的条目全部保留） */
function dedupeRecipesById(recipes) {
  if (!Array.isArray(recipes)) return [];
  const seen = new Set();
  const out = [];
  for (const r of recipes) {
    const id = r?.id;
    if (id == null || id === '') {
      out.push(r);
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(r);
  }
  return out;
}

function migrateCraftedFillings(saved, base, day) {
  if (!Array.isArray(saved)) return base.craftedFillings;
  return saved
    .filter((f) => !f.expiresOnDay || f.expiresOnDay > day)
    .map((f) => ({
      ...f,
      weightG: f.weightG ?? 100,
      expiresOnDay: f.expiresOnDay ?? day + 7,
    }));
}

/** 旧存档库存为抽象单位，新系统为克。若所有 qty 均 < 200 则视为旧格式，按 ×100 换算为克 */
function migrateInventoryLots(lots) {
  if (!Array.isArray(lots) || lots.length === 0) return lots;
  const maxQty = Math.max(...lots.map((l) => Number(l.qty) || 0));
  if (maxQty >= 200) return lots;
  return lots.map((l) => ({ ...l, qty: Math.round((Number(l.qty) || 0) * 100 * 10) / 10 }));
}

/** 旧存档初始资金为 100，现已改为 500。若存档仍是 100 且几乎未玩过，则升级为 500 */
function migrateGold(gold, saved) {
  const def = getDefaultState().gold;
  if (gold === 100 && def === 500 && (saved.day === 1 || saved.day == null) && (saved.totalSales ?? 0) === 0) {
    return 500;
  }
  return gold;
}

function mergeDeep(base, saved) {
  if (!saved || typeof saved !== 'object') return base;
  const migratedGold = migrateGold(saved.gold ?? base.gold, saved);
  const invLots = saved.inventory?.lots;
  const rawLots = Array.isArray(invLots) && invLots.length > 0 ? invLots : base.inventory.lots;
  const inventory = {
    lots: migrateInventoryLots(rawLots),
  };
  const menuRecipes = migrateMenuRecipes(saved.menuRecipes, saved.day ?? base.day);
  const recipesMerged = Array.isArray(saved.recipes) ? saved.recipes : base.recipes;
  return {
    ...base,
    ...saved,
    gold: migratedGold,
    inventory,
    exploredSynergyNames: Array.isArray(saved.exploredSynergyNames) ? saved.exploredSynergyNames : base.exploredSynergyNames,
    exploredMoldIds: Array.isArray(saved.exploredMoldIds) ? saved.exploredMoldIds : base.exploredMoldIds,
    equipment: { ...base.equipment, ...saved.equipment },
    craftedFillings: migrateCraftedFillings(saved.craftedFillings, base.craftedFillings, saved.day ?? base.day),
    customProcurementItems: Array.isArray(saved.customProcurementItems) ? saved.customProcurementItems : base.customProcurementItems,
    storyChoices: typeof saved.storyChoices === 'object' && saved.storyChoices ? saved.storyChoices : base.storyChoices,
    mainStoryCompletedUpTo:
      typeof saved.mainStoryCompletedUpTo === 'number' ? saved.mainStoryCompletedUpTo : base.mainStoryCompletedUpTo,
    heroName: saved.heroName || base.heroName,
    unlockedAchievements: Array.isArray(saved.unlockedAchievements) ? saved.unlockedAchievements : base.unlockedAchievements,
    recipes: dedupeRecipesById(recipesMerged),
    menuRecipes: menuRecipes.length > 0 ? menuRecipes : base.menuRecipes,
  };
}

export function saveGame(state) {
  try {
    const serializable = { ...state };
    delete serializable.notifications;
    localStorage.setItem(SAVE_KEY, JSON.stringify(serializable));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return mergeDeep(getDefaultState(), parsed);
  } catch {
    return null;
  }
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}
