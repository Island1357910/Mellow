/**
 * 共享：根据自然语言 + 可用原料调用 AI 设计面团配方（不含馅料），并做酵母占比校正。
 */
import { RECIPE_DISPLAY_NAME_MAX } from '../constants/naming';
import { ingredients } from '../data/ingredients';
import { procurementItems } from '../data/procurementCatalog';
import { generateRecipeAdvanced } from './recipeEngine';
import { clampYeastAmountToIdealRatio } from './recipeQuality';
import { bakeTechniques } from '../data/techniques';
import { breadMolds } from '../data/molds';

export function getObtainableSkuSets(state) {
  const procureSkus = new Set([
    ...(state.customProcurementItems || []).map((p) => p.sku),
    ...procurementItems.map((p) => p.sku),
  ]);
  const flour = ingredients.面粉.filter((x) => procureSkus.has(x.name)).map((x) => x.name);
  const liquid = ingredients.液体.filter((x) => procureSkus.has(x.name)).map((x) => x.name);
  const yeast = ingredients.酵母.filter((x) => procureSkus.has(x.name)).map((x) => x.name);
  const accessory = ingredients.辅料?.filter((x) => x.name !== '无辅料' && procureSkus.has(x.name)).map((x) => x.name) || [];
  const flavor = ingredients.风味.filter((x) => x.name !== '无添加' && procureSkus.has(x.name)).map((x) => x.name);
  return { flour, liquid, yeast, accessory, flavor, procureSkus };
}

/**
 * @param {object} params
 * @param {string} params.userPrompt
 * @param {{ flour:string[], liquid:string[], yeast:string[], accessory:string[], flavor:string[] }} params.av
 * @param {string} [params.excludeHint]
 * @param {(messages:object[], opt:object)=>Promise<string>} params.chatComplete
 */
export async function aiDesignDoughRecipeCore({ userPrompt, av, excludeHint = '', chatComplete }) {
  if (av.flour.length < 1 || av.liquid.length < 1 || av.yeast.length < 1) {
    throw new Error('采购目录中需有面粉、液体、酵母各至少一种');
  }
  const allTechniqueIds = bakeTechniques.map((t) => t.id).join('|');
  const allMoldIds = breadMolds.map((m) => m.id).join('|');
  const text = await chatComplete(
    [
      {
        role: 'system',
        content: `你是烘焙师。根据描述和可用原料设计「面团」配方（不要写馅料；玩家自行包馅）。只输出纯 JSON，不要 markdown。${excludeHint}
格式：{"baseName":"基底中文名，建议简洁","flourNames":["面粉名"],"liquidNames":["液体名"],"yeastName":"酵母名","accessoryNames":["辅料名"]或[],"flavorNames":["风味名"]或[],"techniqueId":"${allTechniqueIds}","bakeTempC":160-220,"moldId":"${allMoldIds}","shortDesc":"50字内介绍，不要列原料","flourAmounts":{},"liquidAmounts":{},"yeastAmounts":{},"accessoryAmounts":{},"flavorAmounts":{}}
原料仅限：面粉${av.flour.join('、')}；液体${av.liquid.join('、')}；酵母${av.yeast.join('、')}；辅料${av.accessory?.length ? av.accessory.join('、') : '无辅料'}；风味${av.flavor.join('、') || '无添加'}。
【四维】甜度/柔软度/香气/复杂度由原料与克数比例决定；请按描述反推搭配。酵母必须占面团总重严格1%-2%，用总重×0.01～0.02估算克数。
【比例】面粉约55%-65%、液体约30%-40%。面团总重至少2100克（约6只以上）。`,
      },
      { role: 'user', content: `需求：${userPrompt || '好吃即可'}。请设计。` },
    ],
    { temperature: 0.7, max_tokens: 500 },
  );
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('无法解析 JSON');
  const data = JSON.parse(m[0]);

  const nFlours = (data.flourNames || []).filter((n) => av.flour.includes(n));
  const nLiquids = (data.liquidNames || []).filter((n) => av.liquid.includes(n));
  const nYeast = data.yeastName && av.yeast.includes(data.yeastName) ? data.yeastName : av.yeast[0];
  const nAccessories = Array.isArray(data.accessoryNames) ? data.accessoryNames.filter((n) => (av.accessory || []).includes(n)) : [];
  const nFlavors = Array.isArray(data.flavorNames) ? data.flavorNames.filter((n) => av.flavor.includes(n)) : [];

  const moldId = breadMolds.some((x) => x.id === data.moldId) ? data.moldId : 'round';
  const mold = breadMolds.find((x) => x.id === moldId);
  const minTotalG = 6 * (mold?.volumeG || 350);

  let flourAmts = data.flourAmounts && typeof data.flourAmounts === 'object' ? data.flourAmounts : {};
  let liquidAmts = data.liquidAmounts && typeof data.liquidAmounts === 'object' ? data.liquidAmounts : {};
  let yeastAmts = data.yeastAmounts && typeof data.yeastAmounts === 'object' ? data.yeastAmounts : {};
  let accessoryAmts = data.accessoryAmounts && typeof data.accessoryAmounts === 'object' ? data.accessoryAmounts : {};
  let flavorAmts = data.flavorAmounts && typeof data.flavorAmounts === 'object' ? data.flavorAmounts : {};

  const sumAmt = (obj) => Object.values(obj || {}).reduce((s, v) => s + (Number(v) || 0), 0);
  let total = sumAmt(flourAmts) + sumAmt(liquidAmts) + sumAmt(yeastAmts) + sumAmt(accessoryAmts) + sumAmt(flavorAmts);
  if (total < minTotalG && total > 0) {
    const scale = minTotalG / total;
    const scaleObj = (o) => {
      const r = {};
      for (const [k, v] of Object.entries(o || {})) r[k] = Math.round((Number(v) || 0) * scale * 10) / 10;
      return r;
    };
    flourAmts = scaleObj(flourAmts);
    liquidAmts = scaleObj(liquidAmts);
    yeastAmts = scaleObj(yeastAmts);
    accessoryAmts = scaleObj(accessoryAmts);
    flavorAmts = scaleObj(flavorAmts);
  } else if (total <= 0) {
    const fn = nFlours.length ? nFlours : [av.flour[0]];
    const ln = nLiquids.length ? nLiquids : [av.liquid[0]];
    flourAmts = Object.fromEntries(fn.map((n) => [n, Math.round((minTotalG * 0.6 / fn.length) * 10) / 10]));
    liquidAmts = Object.fromEntries(ln.map((n) => [n, Math.round((minTotalG * 0.35 / ln.length) * 10) / 10]));
    yeastAmts = { [nYeast]: Math.round(minTotalG * 0.015 * 10) / 10 };
  }

  const opts = {
    description: userPrompt || '定制',
    flourNames: nFlours.length ? nFlours : [av.flour[0]],
    liquidNames: nLiquids.length ? nLiquids : [av.liquid[0]],
    yeastName: nYeast,
    accessoryNames: nAccessories,
    flavorNames: nFlavors,
    fillingIngredient: null,
    craftedFilling: null,
    techniqueId: bakeTechniques.some((t) => t.id === data.techniqueId) ? data.techniqueId : 'direct',
    bakeTempC: data.bakeTempC >= 140 && data.bakeTempC <= 250 ? data.bakeTempC : 180,
    moldId,
    flourAmounts: flourAmts,
    liquidAmounts: liquidAmts,
    yeastAmounts: yeastAmts,
    accessoryAmounts: accessoryAmts,
    flavorAmounts: flavorAmts,
    fillingAmounts: {},
    shortDesc: typeof data.shortDesc === 'string' ? data.shortDesc.slice(0, 100) : undefined,
  };
  clampYeastAmountToIdealRatio(opts);
  const baseNameRaw = (data.baseName || data.name || '').toString().trim().slice(0, RECIPE_DISPLAY_NAME_MAX);
  if (baseNameRaw) opts.baseName = baseNameRaw;
  const recipe = generateRecipeAdvanced(opts);
  const baseName = baseNameRaw || recipe.name?.slice(0, RECIPE_DISPLAY_NAME_MAX) || '定制';
  recipe.name = baseName;
  recipe.baseName = baseName;
  recipe.fillingTag = null;
  if (typeof data.shortDesc === 'string') {
    recipe.shortDesc = String(data.shortDesc).slice(0, 100);
    recipe.description = recipe.shortDesc;
  }
  return { recipe, opts };
}
