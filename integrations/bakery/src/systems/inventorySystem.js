import { procurementItems } from '../data/procurementCatalog';

let _lotId = 0;

function findProcurementItem(sku, customItems = []) {
  const from = procurementItems.find((p) => p.sku === sku);
  if (from) return from;
  return customItems.find((p) => p.sku === sku) || null;
}

/** 兼容旧数据：batchQty/unitPrice 或 weightPerPack/pricePerPack */
function getWeightAndPrice(item) {
  if (item.weightPerPack != null && item.pricePerPack != null) {
    return { weight: item.weightPerPack, price: item.pricePerPack };
  }
  return { weight: item.batchQty ?? 100, price: item.unitPrice ?? 20 };
}
const genLotId = () => `lot_${Date.now()}_${++_lotId}`;

export function shelfLifeMultiplier(equipment) {
  let m = 1;
  if (equipment?.fridge) m *= 1.5;
  if (equipment?.freezer) m *= 1.67;
  return m;
}

export function createStarterInventory(day) {
  const mult = 1;
  const lots = [
    { id: genLotId(), sku: '高筋面粉', category: '面粉', qty: 800, expiresOnDay: day + Math.floor(45 * mult) },
    { id: genLotId(), sku: '纯净水', category: '液体', qty: 2000, expiresOnDay: day + Math.floor(730 * mult) },
    { id: genLotId(), sku: '全脂牛奶', category: '液体', qty: 500, expiresOnDay: day + Math.floor(7 * mult) },
    { id: genLotId(), sku: '即发干酵母', category: '酵母', qty: 50, expiresOnDay: day + Math.floor(180 * mult) },
    { id: genLotId(), sku: '细砂糖', category: '辅料', qty: 500, expiresOnDay: day + 365 },
  ];
  return lots;
}

export function purgeExpiredLots(lots, currentDay) {
  return lots.filter((l) => l.qty > 0 && l.expiresOnDay >= currentDay);
}

export function totalQtyForSku(lots, sku) {
  return lots.filter((l) => l.sku === sku && l.qty > 0).reduce((s, l) => s + l.qty, 0);
}

/** 从库存中扣除某 sku 至多 maxGrams 克，可不满额；返回新 lots 与实际扣除克数 */
export function consumeSkuGrams(lots, sku, maxGrams) {
  if (!maxGrams || maxGrams <= 0) {
    return { lots: lots.map((l) => ({ ...l, qty: Number(l.qty) })), taken: 0 };
  }
  let left = Math.round(Number(maxGrams) * 10) / 10;
  const copy = lots.map((l) => ({ ...l, qty: Number(l.qty) }));
  for (const l of copy) {
    if (l.sku !== sku || l.qty <= 0) continue;
    const take = Math.min(l.qty, left);
    const nt = Math.round((l.qty - take) * 10) / 10;
    l.qty = nt;
    left = Math.round((left - take) * 10) / 10;
    if (left <= 0) break;
  }
  const taken = Math.round((Number(maxGrams) - Math.max(0, left)) * 10) / 10;
  return { lots: copy.filter((l) => l.qty > 0), taken };
}

/** 按克消耗原料；need 可为小数；不足返回 null */
export function tryConsume(lots, requirements) {
  const reqs = Object.entries(requirements).filter(([, n]) => n > 0);
  const copy = lots.map((l) => ({ ...l, qty: Number(l.qty) }));
  for (const [sku, need] of reqs) {
    const needNum = Math.max(0, Number(need));
    let left = needNum;
    for (const l of copy) {
      if (l.sku !== sku || l.qty <= 0) continue;
      const take = Math.min(l.qty, left);
      l.qty -= take;
      left -= take;
      if (left <= 0) break;
    }
    if (left > 0) return null;
  }
  return copy.filter((l) => l.qty > 0);
}

/** 采购：packCount 为袋数，每袋 weightPerPack 克；qty 存入克 */
export function addProcurementLots(lots, sku, packCount, currentDay, equipment, customItems = []) {
  const item = findProcurementItem(sku, customItems);
  if (!item || packCount < 1) return lots;
  const { weight } = getWeightAndPrice(item);
  const mult = shelfLifeMultiplier(equipment);
  const days = Math.floor(item.shelfLife * mult);
  const newLots = [...lots];
  newLots.push({
    id: genLotId(),
    sku: item.sku,
    category: item.category,
    qty: weight * packCount,
    expiresOnDay: currentDay + days,
  });
  return newLots;
}

export function procurementPrice(sku, packCount, customItems = []) {
  const item = findProcurementItem(sku, customItems);
  if (!item) return 0;
  const { price } = getWeightAndPrice(item);
  return price * packCount;
}

/** 按克采购：直接添加指定克数（用于自定义采购或未来扩展） */
export function addProcurementByWeight(lots, sku, grams, currentDay, equipment, customItems = []) {
  const item = findProcurementItem(sku, customItems);
  if (!item || grams < 0.1) return lots;
  const mult = shelfLifeMultiplier(equipment);
  const days = Math.floor(item.shelfLife * mult);
  const newLots = [...lots];
  newLots.push({
    id: genLotId(),
    sku: item.sku,
    category: item.category,
    qty: Math.round(grams * 10) / 10,
    expiresOnDay: currentDay + days,
  });
  return newLots;
}
