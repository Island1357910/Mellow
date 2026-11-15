/**
 * 营业收入平衡：随天数与累计销量略降边际，避免金币过快膨胀。
 * kind: sale | multi_sale | custom_order | competition | milestone
 */
export function adjustIncomingGold(state, rawGold, kind = 'sale') {
  const n = Math.max(0, Math.floor(Number(rawGold) || 0));
  if (n <= 0) return 0;

  const day = Math.max(1, state?.day || 1);
  const totalSales = Math.max(0, state?.totalSales || 0);

  if (kind === 'milestone') {
    return Math.max(1, Math.round(n * 0.82));
  }

  let mult = 0.76;
  const salesPressure = Math.min(0.14, totalSales * 0.0001);
  const dayPressure = Math.min(0.1, (day - 1) * 0.0035);
  mult *= 1 - salesPressure - dayPressure;

  if (kind === 'competition') {
    mult = Math.min(1, mult + 0.08);
  }
  if (kind === 'custom_order') {
    mult *= 0.86;
  }

  return Math.max(1, Math.round(n * mult));
}
