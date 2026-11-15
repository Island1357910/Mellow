/** 面包库存：数量、保质期、价格随天衰减 */
import { getMoldById } from '../data/molds';

/** 获取面包当前售价（越晚越便宜，每天降约 15%，最低 50%） */
export function getBreadPrice(item, currentDay) {
  const base = item.price ?? 20;
  const madeDay = item.madeDay ?? currentDay;
  const daysOld = Math.max(0, currentDay - madeDay);
  const factor = Math.max(0.5, 1 - daysOld * 0.15);
  return Math.max(5, Math.round(base * factor));
}

/** 剩余可售天数（3 天保质期） */
export function getDaysLeft(item, currentDay) {
  const madeDay = item.madeDay ?? currentDay;
  return Math.max(0, madeDay + 3 - currentDay);
}

/**
 * 根据模具容积与当前库存估算顾客单次购买件数。
 * 小模具（多件库存）会一次多买，避免小面包积压；大模具单次上限较低，更符合「按个卖大面包」。
 */
export function getPurchaseQtyBySize(recipe, maxAvail = 99) {
  const volumeG = recipe.bakeMeta?.moldId
    ? (getMoldById(recipe.bakeMeta.moldId)?.volumeG ?? 350)
    : 350;
  const safeVol = Math.max(70, Number(volumeG) || 350);
  const sizeBased = Math.max(1, Math.round(420 / safeVol));
  const varied = Math.max(1, sizeBased + Math.floor(Math.random() * 3) - 1);
  if (maxAvail <= 1) return 1;

  const isLargeUnit = safeVol >= 300;
  const fracLo = isLargeUnit ? 0.12 : 0.26;
  const fracHi = isLargeUnit ? 0.3 : 0.5;
  const bulk = Math.min(
    maxAvail,
    Math.max(varied, Math.ceil(maxAvail * (fracLo + Math.random() * (fracHi - fracLo)))),
  );
  const perVisitCap = isLargeUnit ? Math.min(maxAvail, 8) : Math.min(maxAvail, 40);
  return Math.min(maxAvail, Math.max(1, bulk), perVisitCap);
}
