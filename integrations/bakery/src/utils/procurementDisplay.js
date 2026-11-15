import { ingredientNameFromLine } from '../data/ingredientImages';

const AI_PROC_IMAGE_CATS = new Set(['面粉', '液体', '酵母', '辅料', '风味', '馅料']);

/** 配方原料行文案 → AI 采购品变色大类（与库存、卖场一致） */
export function aiTintCategoryForIngredientLine(customProcurementItems, line) {
  const name = ingredientNameFromLine(String(line || ''));
  const key = (name || String(line || '')).trim();
  if (!key) return null;
  return aiTintCategoryForSku(customProcurementItems, key);
}

/** 库存/购物车等待：按 sku 解析是否 AI 采购品及用于变色滤镜的大类 */
export function aiTintCategoryForSku(customProcurementItems, sku) {
  const c = customProcurementItems?.find((x) => x.sku === sku && x.aiGenerated);
  return c?.category && AI_PROC_IMAGE_CATS.has(c.category) ? c.category : null;
}

/** 采购卡片行：直接读条目上的 aiGenerated */
export function aiTintCategoryForProcRow(item) {
  if (!item?.aiGenerated || !item.category) return null;
  return AI_PROC_IMAGE_CATS.has(item.category) ? item.category : null;
}

/** AI 采购品立绘色相变体（同批 0/1/2），无则 undefined */
export function aiTintVariantForSku(customProcurementItems, sku) {
  const c = customProcurementItems?.find((x) => x.sku === sku && x.aiGenerated);
  const v = c?.aiVisualVariant;
  return v === 0 || v === 1 || v === 2 ? v : undefined;
}

export function aiTintVariantForIngredientLine(customProcurementItems, line) {
  const name = ingredientNameFromLine(String(line || ''));
  const key = (name || String(line || '')).trim();
  if (!key) return undefined;
  return aiTintVariantForSku(customProcurementItems, key);
}

export function aiTintVariantForProcRow(item) {
  if (!item?.aiGenerated) return undefined;
  const v = item.aiVisualVariant;
  return v === 0 || v === 1 || v === 2 ? v : undefined;
}
