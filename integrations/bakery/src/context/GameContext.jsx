import { createContext, useContext, useReducer, useCallback, useRef, useEffect, useMemo } from 'react';
import { getDefaultState, saveGame, loadGame } from '../systems/storage';
import { adjustIncomingGold } from '../systems/economyBalance';
import { ACHIEVEMENT_DEFINITIONS } from '../data/achievements';
import { dailyEvents, milestones } from '../data/events';
import { purgeExpiredLots, addProcurementLots, procurementPrice, tryConsume } from '../systems/inventorySystem';
import { procurementItems, equipmentCatalog } from '../data/procurementCatalog';
import { recipeExistsWithSameBakeIdentity } from '../systems/recipeBakeIdentity';

const GameContext = createContext(null);

/** 开发环境下 Strict Mode 会重复跑 effect，避免同一批成就连弹两次通知 */
let lastNotifiedAchievementSig = '';

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

function mergeExplorationFromRecipe(state, recipe) {
  if (!recipe) return state;
  const syn = Array.isArray(recipe.synergies) ? recipe.synergies : [];
  const mid = recipe.bakeMeta?.moldId;
  const exploredSynergyNames = [...(state.exploredSynergyNames || [])];
  const exploredMoldIds = [...(state.exploredMoldIds || [])];
  let changed = false;
  for (const n of syn) {
    if (n && !exploredSynergyNames.includes(n)) { exploredSynergyNames.push(n); changed = true; }
  }
  if (mid && !exploredMoldIds.includes(mid)) { exploredMoldIds.push(mid); changed = true; }
  if (!changed) return state;
  return { ...state, exploredSynergyNames, exploredMoldIds };
}

function gameReducer(state, action) {
  switch (action.type) {
    case 'SET_PHASE':
      return { ...state, phase: action.phase };

    case 'ADD_RECIPE_TO_MENU': {
      const r = action.recipe;
      const fee = action.menuFee ?? 8;
      const count = Math.max(1, action.count ?? 1);
      if (state.gold < fee) return state;
      const lots = action.newLots ?? state.inventory.lots;
      const nextFillings = action.newCraftedFillings !== undefined
        ? action.newCraftedFillings
        : state.craftedFillings;
      const alreadyInLibrary = r?.id && state.recipes.some((x) => x.id === r.id);
      const menuIdx = r?.id != null
        ? state.menuRecipes.findIndex((m) => m.id === r.id)
        : -1;
      if (menuIdx >= 0) {
        const arr = [...state.menuRecipes];
        const ex = arr[menuIdx];
        const newQty = (ex.qty ?? 1) + count;
        arr[menuIdx] = { ...r, qty: newQty, madeDay: state.day };
        return mergeExplorationFromRecipe({
          ...state,
          gold: state.gold - fee,
          inventory: { lots },
          craftedFillings: nextFillings,
          recipes: alreadyInLibrary ? state.recipes : [...state.recipes, r],
          menuRecipes: arr,
          recipesCreated: state.recipesCreated + 1,
          naturalYeastStreak: r.ingredients?.酵母?.name === '天然酵种'
            ? state.naturalYeastStreak + 1 : state.naturalYeastStreak,
        }, r);
      }
      if (state.menuRecipes.length >= 8) return state;
      const item = { ...r, qty: count, madeDay: state.day };
      return mergeExplorationFromRecipe({
        ...state,
        gold: state.gold - fee,
        inventory: { lots },
        craftedFillings: nextFillings,
        recipes: alreadyInLibrary ? state.recipes : [...state.recipes, r],
        menuRecipes: [...state.menuRecipes, item],
        recipesCreated: state.recipesCreated + 1,
        naturalYeastStreak: r.ingredients?.酵母?.name === '天然酵种'
          ? state.naturalYeastStreak + 1 : state.naturalYeastStreak,
      }, r);
    }

    case 'REMOVE_FROM_MENU':
      return { ...state, menuRecipes: state.menuRecipes.filter((_, i) => i !== action.index) };

    case 'CONSUME_BREAD_STOCK': {
      const { index, qty } = action;
      const arr = [...state.menuRecipes];
      const item = arr[index];
      if (!item || (item.qty ?? 1) < (qty ?? 1)) return state;
      const newQty = Math.max(0, (item.qty ?? 1) - (qty ?? 1));
      if (newQty <= 0) {
        arr.splice(index, 1);
      } else {
        arr[index] = { ...item, qty: newQty };
      }
      return { ...state, menuRecipes: arr };
    }

    case 'COMPLETE_SALE': {
      const { gold, reputation, satisfaction, menuIndex, qtySold = 1 } = action;
      const adjGold = adjustIncomingGold(state, gold, 'sale');
      let nextState = { ...state };
      if (menuIndex != null && menuIndex >= 0 && menuIndex < state.menuRecipes.length) {
        nextState = gameReducer(nextState, { type: 'CONSUME_BREAD_STOCK', index: menuIndex, qty: qtySold });
      }
      const ts = { ...nextState.todayStats };
      ts.income += adjGold;
      ts.totalSatisfaction += satisfaction;
      if (satisfaction >= 70) ts.happy++;
      return {
        ...nextState,
        gold: nextState.gold + adjGold,
        reputation: nextState.reputation + reputation,
        totalSales: nextState.totalSales + 1,
        todayStats: ts,
      };
    }

    case 'COMPLETE_MULTI_SALE': {
      const { items: saleItems, totalGold = 0, maxSat = 0, repMult = 1 } = action;
      const adjTotal = adjustIncomingGold(state, totalGold, 'multi_sale');
      if (!Array.isArray(saleItems) || saleItems.length === 0) return state;
      const sorted = [...saleItems].sort((a, b) => (b.menuIndex ?? -1) - (a.menuIndex ?? -1));
      let arr = [...state.menuRecipes];
      for (const { menuIndex = -1, qtySold = 1 } of sorted) {
        if (menuIndex < 0 || menuIndex >= arr.length) continue;
        const item = arr[menuIndex];
        if (!item || (item.qty ?? 1) < qtySold) continue;
        const newQty = (item.qty ?? 1) - qtySold;
        if (newQty <= 0) arr.splice(menuIndex, 1);
        else arr[menuIndex] = { ...item, qty: newQty };
      }
      const ts = { ...state.todayStats };
      ts.income += adjTotal;
      ts.totalSatisfaction += maxSat;
      if (maxSat >= 70) ts.happy++;
      const rep = maxSat >= 80 ? 3 : maxSat >= 60 ? 1 : -1;
      return {
        ...state,
        menuRecipes: arr,
        gold: state.gold + adjTotal,
        reputation: state.reputation + Math.round(rep * repMult),
        totalSales: state.totalSales + 1,
        todayStats: ts,
      };
    }

    case 'FAIL_SALE':
      return { ...state, reputation: Math.max(0, state.reputation - 1) };

    /** 店面婉拒顾客：扣除声望（不低于 0） */
    case 'REJECT_CUSTOMER': {
      const loss = Math.max(1, Number(action.repCost) || 3);
      return { ...state, reputation: Math.max(0, state.reputation - loss) };
    }

    case 'GUEST_VISITED': {
      const ts = { ...state.todayStats, guests: state.todayStats.guests + 1 };
      return { ...state, totalGuests: state.totalGuests + 1, todayStats: ts };
    }

    case 'ACHIEVE_MILESTONE': {
      if (state.achievedMilestones.includes(action.id)) return state;
      let s = { ...state, achievedMilestones: [...state.achievedMilestones, action.id] };
      if (action.goldReward) s.gold += adjustIncomingGold(state, action.goldReward, 'milestone');
      if (action.repReward) s.reputation += action.repReward;
      return s;
    }

    case 'SET_EVENT':
      return { ...state, currentEvent: action.event };

    case 'NEXT_DAY': {
      const ts = state.todayStats;
      const nextDay = state.day + 1;
      const lots = purgeExpiredLots(state.inventory.lots, nextDay);
      // 卖完或超出保质期的面包自动从菜单清除
      const menuRecipes = (state.menuRecipes || []).filter(
        (r) => (r.qty ?? 1) > 0 && ((r.madeDay ?? state.day) + 3) > nextDay,
      );
      // 过期馅料移除
      const craftedFillings = (state.craftedFillings || []).filter(
        (f) => !f.expiresOnDay || f.expiresOnDay > nextDay,
      );
      // 新的一天清空定制单池，新的一周清空已参赛记录
      const prevWeek = Math.floor(state.day / 7);
      const newWeek = Math.floor(nextDay / 7);
      const completedCompetitionIds = newWeek > prevWeek ? [] : (state.completedCompetitionIds || []);
      return {
        ...state,
        day: nextDay,
        craftedFillings,
        prevReputation: state.reputation,
        inventory: { lots },
        menuRecipes,
        customOrderPool: null,
        completedCompetitionIds,
        yesterdayStats: {
          income: ts.income,
          guests: ts.guests,
          rate: ts.guests > 0 ? Math.round(ts.totalSatisfaction / ts.guests) : '-',
        },
        todayStats: { income: 0, guests: 0, happy: 0, totalSatisfaction: 0 },
        phase: 'morning',
        naturalYeastStreak: menuRecipes.some(r => r.ingredients?.酵母?.name === '天然酵种')
          ? state.naturalYeastStreak : 0,
        dayMultiplier: 1.0,
        dayMultiplierDay: 0,
      };
    }

    case 'PURCHASE_PROCUREMENT': {
      const { sku, batches } = action;
      const custom = state.customProcurementItems || [];
      const price = procurementPrice(sku, batches, custom);
      if (state.gold < price || batches < 1) return state;
      const lots = addProcurementLots(state.inventory.lots, sku, batches, state.day, state.equipment, custom);
      return { ...state, gold: state.gold - price, inventory: { lots } };
    }
    case 'PURCHASE_CART': {
      const { items } = action; // [{ sku, batches }]
      const custom = state.customProcurementItems || [];
      let total = 0;
      for (const { sku, batches } of items) {
        if (batches < 1) continue;
        total += procurementPrice(sku, batches, custom);
      }
      if (state.gold < total) return state;
      let lots = state.inventory.lots;
      for (const { sku, batches } of items) {
        if (batches < 1) continue;
        lots = addProcurementLots(lots, sku, batches, state.day, state.equipment, custom);
      }
      return { ...state, gold: state.gold - total, inventory: { lots } };
    }
    case 'ADD_CUSTOM_PROCUREMENT_ITEM': {
      const item = action.item;
      const goldCost = Math.max(0, Math.floor(Number(action.goldCost) || 0));
      if (!item?.sku || state.customProcurementItems?.some((x) => x.sku === item.sku)) return state;
      if (goldCost > 0 && state.gold < goldCost) return state;
      return {
        ...state,
        gold: goldCost > 0 ? state.gold - goldCost : state.gold,
        customProcurementItems: [...(state.customProcurementItems || []), item],
      };
    }

    case 'ADD_CUSTOM_PROCUREMENT_ITEMS_BATCH': {
      const list = action.items;
      if (!Array.isArray(list) || list.length === 0) return state;
      const baseSkus = new Set(procurementItems.map((p) => p.sku));
      let next = [...(state.customProcurementItems || [])];
      const seen = new Set(next.map((x) => x.sku));
      for (const item of list) {
        if (!item?.sku || baseSkus.has(item.sku) || seen.has(item.sku)) continue;
        next.push(item);
        seen.add(item.sku);
      }
      if (next.length === (state.customProcurementItems || []).length) return state;
      return { ...state, customProcurementItems: next };
    }

    case 'REMOVE_CUSTOM_PROCUREMENT_BY_SKUS': {
      const drop = new Set((action.skus || []).filter(Boolean));
      if (drop.size === 0) return state;
      const prev = state.customProcurementItems || [];
      const next = prev.filter((x) => !drop.has(x.sku));
      if (next.length === prev.length) return state;
      return { ...state, customProcurementItems: next };
    }

    case 'SPEND_GOLD': {
      const amount = Math.max(0, Math.floor(Number(action.amount) || 0));
      if (amount <= 0 || state.gold < amount) return state;
      return { ...state, gold: state.gold - amount };
    }

    case 'BUY_EQUIPMENT': {
      const id = action.id;
      const cat = equipmentCatalog.find((e) => e.id === id);
      if (!cat || state.equipment[id]) return state;
      if (id === 'freezer' && !state.equipment.fridge) return state;
      if (state.gold < cat.price) return state;
      return {
        ...state,
        gold: state.gold - cat.price,
        equipment: { ...state.equipment, [id]: true },
      };
    }

    case 'ADD_CRAFTED_FILLING': {
      const f = action.filling;
      const sourceIng = action.sourceIngredients || f?.sourceIngredients || [];
      const sourceWeights = action.sourceWeights || {};
      if (!f?.id || !f.name) return state;
      if (state.craftedFillings.some((x) => x.id === f.id)) return state;
      const req = {};
      for (const name of sourceIng) if (name) req[name] = (req[name] || 0) + (sourceWeights[name] || 50);
      const nextLots = tryConsume(state.inventory.lots, req);
      if (!nextLots && Object.keys(req).length > 0) return state;
      const weightG = action.weightG ?? 100;
      const expiresOnDay = state.day + 7;
      return {
        ...state,
        craftedFillings: [...state.craftedFillings, { ...f, weightG, expiresOnDay }],
        inventory: nextLots ? { lots: nextLots } : state.inventory,
      };
    }

    case 'SET_STORY_CHOICE': {
      return { ...state, storyChoices: { ...state.storyChoices, ...action.patch } };
    }

    case 'COMPLETE_MAIN_STORY_CHAPTER': {
      const idx = Number(action.chapterIndex);
      if (idx < 0 || idx > 10 || Number.isNaN(idx)) return state;
      const prev = state.mainStoryCompletedUpTo ?? -1;
      if (idx !== prev + 1) return state;
      return { ...state, mainStoryCompletedUpTo: idx };
    }

    case 'SET_HERO_NAME': {
      const name = (action.name || '').trim().slice(0, 12) || '林千穗';
      return { ...state, heroName: name };
    }

    case 'ADD_CUSTOM_RECIPE': {
      const rec = action.recipe;
      if (!rec) return state;
      if (rec.id && state.recipes.some((x) => x.id === rec.id)) return state;
      if (recipeExistsWithSameBakeIdentity(state.recipes, rec)) return state;
      return { ...state, recipes: [...state.recipes, rec] };
    }

    case 'REMOVE_CUSTOM_RECIPES':
      return { ...state, recipes: state.recipes.filter((r) => !action.ids.includes(r.id)) };

    case 'SET_DAY_GUESTS': {
      const { day, guests } = action;
      return { ...state, dayGuests: { ...state.dayGuests, [day]: guests } };
    }

    case 'SET_DAY_MULTIPLIER': {
      return { ...state, dayMultiplier: action.multiplier, dayMultiplierDay: action.day };
    }

    case 'SET_PENDING_CUSTOM_ORDER': {
      return { ...state, pendingCustomOrder: action.order };
    }

    case 'COMPLETE_CUSTOM_ORDER': {
      const { gold, reputation, satisfaction, craftedFillingId, moldVolumeG, newCraftedFillings, explorationRecipe } = action;
      const adjGold = adjustIncomingGold(state, gold, 'custom_order');
      const ts = { ...state.todayStats };
      ts.income += adjGold;
      ts.totalSatisfaction += satisfaction;
      if (satisfaction >= 70) ts.happy++;
      let nextFillings = state.craftedFillings;
      if (newCraftedFillings !== undefined) {
        nextFillings = newCraftedFillings;
      } else if (craftedFillingId && nextFillings?.length > 0) {
        const vol = moldVolumeG ?? 350;
        const consume = Math.max(5, Math.round(vol * 0.12));
        const idx = nextFillings.findIndex((f) => f.id === craftedFillingId);
        if (idx >= 0) {
          const f = nextFillings[idx];
          const avail = f.weightG ?? 100;
          const take = Math.min(consume, avail);
          nextFillings = [...nextFillings];
          if (take >= avail) nextFillings.splice(idx, 1);
          else nextFillings[idx] = { ...f, weightG: avail - take };
        }
      }
      return mergeExplorationFromRecipe({
        ...state,
        pendingCustomOrder: null,
        craftedFillings: nextFillings,
        gold: state.gold + adjGold,
        reputation: state.reputation + reputation,
        totalSales: state.totalSales + 1,
        todayStats: ts,
      }, explorationRecipe);
    }

    case 'SET_CUSTOM_ORDER_POOL': {
      const { day, orders } = action;
      return { ...state, customOrderPool: { day, orders: orders || [] } };
    }

    case 'REMOVE_CUSTOM_ORDER': {
      const { orderId } = action;
      const pool = state.customOrderPool;
      if (!pool) return state;
      const next = pool.orders.filter((o) => o.id !== orderId);
      return { ...state, customOrderPool: { ...pool, orders: next } };
    }

    case 'ADD_COMPLETED_COMPETITION': {
      const { competitionId } = action;
      const ids = state.completedCompetitionIds || [];
      if (ids.includes(competitionId)) return state;
      return {
        ...state,
        completedCompetitionIds: [...ids, competitionId],
      };
    }

    case 'COMPLETE_OFFLINE_CUSTOM_ORDER': {
      const { gold, reputation, satisfaction, menuIndex, incomeKind = 'custom_order' } = action;
      const adjGold = adjustIncomingGold(state, gold, incomeKind);
      let nextState = state;
      if (menuIndex != null && menuIndex >= 0 && menuIndex < state.menuRecipes.length) {
        nextState = gameReducer(nextState, { type: 'CONSUME_BREAD_STOCK', index: menuIndex, qty: 1 });
      }
      const ts = { ...nextState.todayStats };
      ts.income += adjGold;
      ts.totalSatisfaction += satisfaction;
      if (satisfaction >= 70) ts.happy++;
      return {
        ...nextState,
        gold: nextState.gold + adjGold,
        reputation: nextState.reputation + reputation,
        totalSales: nextState.totalSales + 1,
        todayStats: ts,
      };
    }

    case 'UNLOCK_ACHIEVEMENTS': {
      const ids = action.ids || [];
      const set = new Set(state.unlockedAchievements || []);
      let added = false;
      for (const id of ids) {
        if (!set.has(id)) {
          set.add(id);
          added = true;
        }
      }
      if (!added) return state;
      return { ...state, unlockedAchievements: Array.from(set) };
    }

    case 'LOAD_STATE':
      return { ...action.state };

    default:
      return state;
  }
}

export function GameProvider({ children }) {
  const saved = loadGame();
  const initial = saved
    ? { ...saved, prevReputation: saved.prevReputation ?? saved.reputation }
    : getDefaultState();
  const [state, dispatch] = useReducer(gameReducer, initial);

  const notificationsRef = useRef([]);
  const notifIdRef = useRef(0);
  const listenersRef = useRef(new Set());

  const notify = useCallback((text, type = 'info') => {
    const id = ++notifIdRef.current;
    const n = { id, text, type };
    notificationsRef.current = [...notificationsRef.current, n];
    listenersRef.current.forEach(fn => fn([...notificationsRef.current]));
    setTimeout(() => {
      notificationsRef.current = notificationsRef.current.filter(x => x.id !== id);
      listenersRef.current.forEach(fn => fn([...notificationsRef.current]));
    }, 2800);
  }, []);

  const subscribeNotifications = useCallback((fn) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }, []);

  const save = useCallback((silent = false) => {
    saveGame(state);
    if (!silent) notify('游戏已保存 💾', 'success');
  }, [state, notify]);

  /** 自动保存：状态变化后 2 秒防抖保存 */
  useEffect(() => {
    const t = setTimeout(() => save(true), 2000);
    return () => clearTimeout(t);
  }, [state, save]);

  const rollEvent = useCallback(() => {
    let event;
    if (state.day % 7 === 5) event = dailyEvents.find(e => e.id === 'full_moon');
    else if (state.day % 5 === 0) event = dailyEvents.find(e => e.id === 'weekend');
    else event = pick(dailyEvents);
    dispatch({ type: 'SET_EVENT', event });
    return event;
  }, [state.day]);

  const checkMilestones = useCallback(() => {
    for (const ms of milestones) {
      if (state.achievedMilestones.includes(ms.id)) continue;
      if (!ms.condition(state)) continue;
      if (ms.reward.startsWith('gold_')) {
        const rawGold = parseInt(ms.reward.split('_')[1], 10);
        dispatch({ type: 'ACHIEVE_MILESTONE', id: ms.id, goldReward: rawGold });
        const showGold = adjustIncomingGold(state, rawGold, 'milestone');
        notify(`🏆 里程碑：${ms.name}！+${showGold}💰`, 'success');
      } else if (ms.reward.startsWith('reputation_')) {
        dispatch({ type: 'ACHIEVE_MILESTONE', id: ms.id, repReward: parseInt(ms.reward.split('_')[1], 10) });
        notify(`🏆 里程碑：${ms.name}！+${ms.reward.split('_')[1]}⭐`, 'success');
      } else {
        dispatch({ type: 'ACHIEVE_MILESTONE', id: ms.id });
      }
    }
  }, [state, notify]);

  useEffect(() => {
    const unlocked = new Set(state.unlockedAchievements || []);
    const newly = ACHIEVEMENT_DEFINITIONS.filter(
      (d) => !unlocked.has(d.id) && d.check(state),
    ).map((d) => d.id);
    if (newly.length === 0) return;
    dispatch({ type: 'UNLOCK_ACHIEVEMENTS', ids: newly });
    const sig = `${state.day}|${newly.sort().join(',')}`;
    if (sig === lastNotifiedAchievementSig) return;
    lastNotifiedAchievementSig = sig;
    const defs = newly
      .map((id) => ACHIEVEMENT_DEFINITIONS.find((d) => d.id === id))
      .filter(Boolean);
    if (defs.length === 1) {
      notify(`🏅 成就解锁：${defs[0].icon} ${defs[0].name}`, 'success');
    } else {
      notify(`🏅 解锁 ${defs.length} 项成就`, 'success');
    }
  }, [state, notify]);

  const contextValue = useMemo(
    () => ({
      state,
      dispatch,
      notify,
      save,
      rollEvent,
      checkMilestones,
      subscribeNotifications,
    }),
    [state, dispatch, notify, save, rollEvent, checkMilestones, subscribeNotifications],
  );

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be inside GameProvider');
  return ctx;
}
