import { totalQtyForSku, consumeSkuGrams } from './inventorySystem';
import { rebakeDisplayNameWithoutFilling, recipeBakeDisplayNameMax } from './recipeEngine';

/** 单只面包馅料用量（克），随模具容积变化，与上架/定制单逻辑一致 */
export function fillingGramsPerBread(volumeG) {
  const v = Number(volumeG) || 350;
  return Math.max(5, Math.round(v * 0.12));
}

function consumeCraftedFillingGrams(craftedFillings, fillingId, gramsExact) {
  const arr = Array.isArray(craftedFillings) ? [...craftedFillings] : [];
  const idx = arr.findIndex((f) => f.id === fillingId);
  if (idx < 0 || !(gramsExact > 0)) return { craftedFillings: arr, taken: 0 };
  const f = arr[idx];
  const avail = Number(f.weightG) || 0;
  const take = Math.min(avail, Math.round(Number(gramsExact) * 10) / 10);
  if (take <= 0) return { craftedFillings: arr, taken: 0 };
  if (take >= avail) arr.splice(idx, 1);
  else arr[idx] = { ...f, weightG: Math.round((avail - take) * 10) / 10 };
  return { craftedFillings: arr, taken: take };
}

/**
 * 面团消耗后的库存上，再扣馅料；不足则部分面包无馅。
 * @returns {{ nextLots, nextCraftedFillings, withFillingCount, withoutFillingCount, perBreadG, gramsConsumed, fillName }}
 */
export function resolveBakeFillingConsumption(opts, breadCount, volumeG, lotsAfterDough, craftedFillings) {
  const perG = fillingGramsPerBread(volumeG);
  const fill = opts.fillingIngredient || opts.craftedFilling;
  const n = Math.max(0, Math.floor(Number(breadCount) || 0));
  if (!fill?.name || fill.name === '无馅料' || n < 1) {
    return {
      nextLots: lotsAfterDough,
      nextCraftedFillings: [...(craftedFillings || [])],
      withFillingCount: 0,
      withoutFillingCount: n,
      perBreadG: perG,
      gramsConsumed: 0,
      fillName: null,
    };
  }
  const fillName = fill.name;
  const craftedId = opts.craftedFilling?.id;

  if (craftedId) {
    const arr = [...(craftedFillings || [])];
    const idx = arr.findIndex((f) => f.id === craftedId);
    if (idx < 0) {
      return {
        nextLots: lotsAfterDough,
        nextCraftedFillings: arr,
        withFillingCount: 0,
        withoutFillingCount: n,
        perBreadG: perG,
        gramsConsumed: 0,
        fillName,
      };
    }
    const avail = Number(arr[idx].weightG) || 0;
    const maxCan = Math.floor(avail / perG);
    const withFilling = Math.min(n, maxCan);
    const grams = withFilling * perG;
    const { craftedFillings: nextCf, taken } = consumeCraftedFillingGrams(arr, craftedId, grams);
    return {
      nextLots: lotsAfterDough,
      nextCraftedFillings: nextCf,
      withFillingCount: withFilling,
      withoutFillingCount: n - withFilling,
      perBreadG: perG,
      gramsConsumed: taken,
      fillName,
    };
  }

  const avail = totalQtyForSku(lotsAfterDough || [], fillName);
  const maxCan = Math.floor(avail / perG);
  const withFilling = Math.min(n, maxCan);
  const grams = withFilling * perG;
  const { lots: nextLots, taken } = consumeSkuGrams(lotsAfterDough || [], fillName, grams);
  return {
    nextLots,
    nextCraftedFillings: [...(craftedFillings || [])],
    withFillingCount: withFilling,
    withoutFillingCount: n - withFilling,
    perBreadG: perG,
    gramsConsumed: taken,
    fillName,
  };
}

/**
 * 根据出炉馅料分配结果调整展示名（部分无馅时不使用「基底(馅)」括号后缀）
 */
export function applyFillingAllocationToRecipe(recipe, alloc) {
  if (!recipe || !alloc) return recipe;
  if (recipe.identityLocked) return recipe;
  const { withFillingCount, withoutFillingCount, perBreadG, gramsConsumed, fillName } = alloc;
  const total = (withFillingCount || 0) + (withoutFillingCount || 0);
  if (!total || !fillName) return recipe;
  recipe.fillingPartial = {
    totalCount: total,
    withFillingCount,
    withoutFillingCount,
    perBreadG,
    gramsConsumed,
    fillName,
  };
  if (withoutFillingCount > 0) {
    recipe.fillingTag = null;
    const nameMax = recipeBakeDisplayNameMax(recipe);
    if (withFillingCount === 0) {
      const nm = rebakeDisplayNameWithoutFilling(recipe);
      recipe.name = nm.slice(0, nameMax);
      recipe.baseName = recipe.name;
    } else {
      const rawBase = recipe.baseName || String(recipe.name || '').replace(/\([^)]+\)\s*$/, '').trim();
      const base = (rawBase || recipe.name || '面包').slice(0, nameMax);
      recipe.baseName = base;
      recipe.name = base.slice(0, nameMax);
    }
    recipe.fillingNote = `${withFillingCount} 只含「${fillName}」馅 · ${withoutFillingCount} 只无馅（每只馅约 ${perBreadG}g）`;
    if (Array.isArray(recipe.ingredientList)) {
      const filtered = recipe.ingredientList.filter((line) => {
        const s = String(line);
        return !(s.includes(fillName) && /\d/.test(s) && s.includes('克'));
      });
      filtered.push(`${fillName} 本炉实际用馅 ${gramsConsumed} 克`);
      recipe.ingredientList = filtered;
    }
  } else {
    recipe.fillingNote = null;
    delete recipe.fillingPartial;
  }
  return recipe;
}
