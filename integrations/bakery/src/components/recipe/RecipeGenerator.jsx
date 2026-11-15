import { useState, useRef, useEffect, useMemo } from 'react';
import { useGame } from '../../context/GameContext';
import { useUI } from '../../context/UIContext';
import { useBaking } from '../../context/BakingContext';
import { ingredients } from '../../data/ingredients';
import { procurementItems } from '../../data/procurementCatalog';
import { buildInventoryRequirementsFromAdvanced, generateRecipeAdvanced, calculateBatchWeight } from '../../systems/recipeEngine';
import { analyzeRecipeRatios, computeIdealWeightHints } from '../../systems/recipeQuality';
import { bakeSnapshotsMatch, getExpectedSnapshotForRecipe, snapshotBakeOpts, recipeExistsWithSameBakeIdentity } from '../../systems/recipeBakeIdentity';
import { tryConsume, totalQtyForSku } from '../../systems/inventorySystem';
import { fillingGramsPerBread } from '../../systems/bakeFilling';
import { bakeTechniques } from '../../data/techniques';
import { breadMolds } from '../../data/molds';
import { classicRecipes } from '../../data/classicRecipes';
import { chatComplete } from '../../services/aiService';
import { AI_GENERATION_GOLD_COST } from '../../constants/aiEconomy';
import { aiDesignDoughRecipeCore, getObtainableSkuSets } from '../../systems/aiDoughDesigner';
import AIRecipePreviewModal from './AIRecipePreviewModal';
import IngredientThumb from '../IngredientThumb';

function ToggleChip({ label, thumbName, on, disabled, onClick }) {
  return (
    <button type="button" className={`chip-btn${on ? ' on' : ''}`} disabled={disabled} onClick={onClick}>
      {thumbName ? <IngredientThumb name={thumbName} size="sm" /> : null}
      <span>{label}</span>
    </button>
  );
}

/** 简洁模式：滑块 + 整克显示；精确模式：小数输入 */
function IngredientAmountControl({ simple, stockQty, value, onChange, kind }) {
  const num = value === '' || value == null ? NaN : Number(value);
  const has = Number.isFinite(num) && num > 0;
  const maxRaw = Math.floor(Number(stockQty) || 0);
  const hardCap = kind === 'yeast' ? 120 : 2500;
  const minIdeal = kind === 'yeast' ? 2 : 15;
  const step = kind === 'yeast' ? 1 : 5;
  const hasStock = maxRaw > 0;
  // 库存不足理想最小值时，将 min 降到「至多 1 步、至多库存本身」，杜绝强制超出库存
  const min = hasStock && maxRaw < minIdeal
    ? Math.max(1, Math.min(step, maxRaw))
    : minIdeal;
  // 有库存时上限严格等于库存；无库存时给一个展示用范围
  const max = hasStock
    ? Math.max(min, Math.min(maxRaw, hardCap))
    : Math.min(hardCap, minIdeal + step * 4);
  const sliderVal = has ? Math.min(max, Math.max(min, Math.round(num / step) * step)) : min;

  // 简洁模式下，sliderVal 受库存上限截断；若父状态中的 num 与截断后的显示值不一致，
  // 立即将截断值同步回状态，否则 validateBeforeBake 会用未截断的旧值判断库存不足。
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    if (!simple || !has) return;
    if (sliderVal !== num) {
      onChangeRef.current(String(sliderVal));
    }
  }, [simple, has, sliderVal, num]);

  if (!simple) {
    return (
      <input
        type="number"
        min="0.1"
        step="0.1"
        className="amount-input"
        placeholder="克"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  const stockDisp = maxRaw % 1 === 0 ? String(maxRaw) : String(Math.round(maxRaw * 10) / 10);

  return (
    <span className="amount-control-simple">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={sliderVal}
        onChange={(e) => onChange(String(Number(e.target.value)))}
        aria-label="调整克数"
      />
      <span className="amount-slider-readout">
        {`${sliderVal} g`}
        <span className="amount-slider-stock">{` · 库存 ${stockDisp} g`}</span>
      </span>
    </span>
  );
}

/** 馅料选项：原生 select 无法向上展开，用自定义列表 */
function FillingOptionDropUp({ value, options, onChange, placeholder, emptyHint }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (!options?.length) {
    return <span className="drawer-hint">{emptyHint || '暂无可选项'}</span>;
  }

  const cur = options.find((o) => o.value === value);
  return (
    <div className="filling-dropup" ref={ref}>
      <button
        type="button"
        className={`filling-dropup-trigger${open ? ' open' : ''}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        {cur ? cur.label : placeholder}
        <span className="filling-dropup-caret" aria-hidden>▾</span>
      </button>
      {open && (
        <ul className="filling-dropup-menu" role="listbox">
          {options.map((o) => (
            <li key={o.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={`filling-dropup-option${o.value === value ? ' selected' : ''}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function fmtRangeG(lo, hi) {
  const a = Math.round(lo * 10) / 10;
  const b = Math.round(hi * 10) / 10;
  return `${a}–${b} g`;
}

function sumNamedAmounts(amountsMap, names, skipName) {
  let s = 0;
  for (const n of names || []) {
    if (!n || n === skipName) continue;
    const v = amountsMap?.[n];
    if (v != null && Number(v) > 0) s += Number(v);
  }
  return s;
}

function RatioWarningBlock({ analysis }) {
  if (!analysis) return null;
  const { severe, idealIssues } = analysis;
  if (severe?.failed) {
    return (
      <div className="ratio-warn ratio-warn-severe" role="alert">
        ⚠️ 配比严重失调：{severe.reason}
      </div>
    );
  }
  if (!idealIssues?.length) return null;
  return (
    <ul className="ratio-warn ratio-warn-ideal" role="status" aria-live="polite">
      {idealIssues.map((t, i) => (
        <li key={i}>💡 {t}</li>
      ))}
    </ul>
  );
}

export default function RecipeGenerator() {
  const { state, dispatch, notify } = useGame();
  const { pinRecipe, pinnedRecipe } = useUI();
  const [desc, setDesc] = useState('');
  const [flours, setFlours] = useState([]);
  const [liquids, setLiquids] = useState([]);
  const [yeast, setYeast] = useState('');
  const [accessories, setAccessories] = useState([]);
  const [flavors, setFlavors] = useState([]);
  const [fillingMode, setFillingMode] = useState('none');
  const [fillingPreset, setFillingPreset] = useState('红豆沙');
  const [craftedId, setCraftedId] = useState('');
  const [techniqueId, setTechniqueId] = useState('direct');
  const [bakeTemp, setBakeTemp] = useState(180);
  const [moldId, setMoldId] = useState('round');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiPreview, setAiPreview] = useState(null); // { recipe, opts }
  const [amounts, setAmounts] = useState({}); // { flour: { "高筋面粉": 1.5 }, liquid: {}, ... }
  const [ingredientTab, setIngredientTab] = useState('base'); // 'base' | 'flavor' | 'bake'
  /** 默认简洁：滑块 + 整数克 + 可折叠配比提示，减轻数字密集带来的疲劳 */
  const [simpleAmounts, setSimpleAmounts] = useState(true);
  const formRef = useRef(null);

  const resetToInitial = () => {
    setDesc('');
    setFlours([]);
    setLiquids([]);
    setYeast('');
    setAccessories([]);
    setFlavors([]);
    setFillingMode('none');
    setFillingPreset('红豆沙');
    setCraftedId('');
    setAmounts({});
    setAiPreview(null);
  };

  const { baking, startBake: ctxStartBake, registerOnBakeComplete } = useBaking();
  useEffect(() => {
    return registerOnBakeComplete(resetToInitial);
  }, [registerOnBakeComplete]);

  useEffect(() => {
    if (!simpleAmounts) return;
    setAmounts((prev) => {
      const next = {
        flour: { ...(prev.flour || {}) },
        liquid: { ...(prev.liquid || {}) },
        yeast: { ...(prev.yeast || {}) },
        accessory: { ...(prev.accessory || {}) },
        flavor: { ...(prev.flavor || {}) },
      };
      let changed = false;
      const fill = (cat, names, total, minPer) => {
        const arr = (names || []).filter(Boolean);
        if (!arr.length) return;
        const per = Math.max(minPer, Math.round(total / arr.length));
        for (const n of arr) {
          const cur = next[cat][n];
          if (cur == null || !(Number(cur) > 0)) {
            next[cat][n] = per;
            changed = true;
          }
        }
      };
      fill('flour', flours, 480, 80);
      fill('liquid', liquids, 300, 55);
      if (yeast) {
        const y = next.yeast[yeast];
        if (y == null || !(Number(y) > 0)) {
          next.yeast = { ...next.yeast, [yeast]: 12 };
          changed = true;
        }
      }
      for (const n of accessories) {
        if (n === '无辅料') continue;
        const cur = next.accessory[n];
        if (cur == null || !(Number(cur) > 0)) {
          next.accessory[n] = 36;
          changed = true;
        }
      }
      for (const n of flavors) {
        if (n === '无添加') continue;
        const cur = next.flavor[n];
        if (cur == null || !(Number(cur) > 0)) {
          next.flavor[n] = 22;
          changed = true;
        }
      }
      if (!changed) return prev;
      return { ...prev, ...next };
    });
  }, [simpleAmounts, flours, liquids, yeast, accessories, flavors]);

  const lots = state.inventory?.lots || [];

  const qty = (sku) => totalQtyForSku(lots, sku);

  /** 简洁模式芯片上不堆库存克数，减少数字刺激 */
  const ingQtyLabel = (name, simple) =>
    simple ? name : `${name}(${Math.round(qty(name) * 10) / 10}克)`;

  /** 仅展示库存中有的原料；已选中的仍显示以便取消 */
  const showFlour = (x) => qty(x.name) >= 1 || flours.includes(x.name);
  const showLiquid = (x) => qty(x.name) >= 1 || liquids.includes(x.name);
  const showYeast = (x) => qty(x.name) >= 1 || yeast === x.name;
  const showAccessory = (x) => x.name === '无辅料' || qty(x.name) >= 1 || accessories.includes(x.name);
  const showFlavor = (x) => x.name === '无添加' || qty(x.name) >= 1 || flavors.includes(x.name);
  const fillingOptionsPreset = useMemo(
    () => (ingredients.馅料 || []).filter((x) => x.name !== '无馅料' && totalQtyForSku(lots, x.name) >= 1),
    [lots],
  );

  useEffect(() => {
    if (yeast && qty(yeast) < 1) setYeast('');
  }, [lots, yeast]);

  useEffect(() => {
    if (fillingMode === 'preset' && fillingOptionsPreset.length === 0) {
      setFillingMode('none');
      return;
    }
    if (fillingMode !== 'preset' || fillingOptionsPreset.length === 0) return;
    if (!fillingOptionsPreset.some((x) => x.name === fillingPreset)) {
      setFillingPreset(fillingOptionsPreset[0].name);
    }
  }, [fillingMode, fillingPreset, fillingOptionsPreset]);

  const toggleIn = (name, list, setList, max, minKeep = 1) => {
    if (list.includes(name)) {
      if (list.length <= minKeep) return;
      setList(list.filter((x) => x !== name));
    } else if (list.length < max) {
      setList([...list, name]);
    }
  };

  const buildOpts = () => {
    const flavorNames = flavors.length === 0 ? ['无添加'] : flavors;
    const accessoryNames = accessories.length === 0 ? ['无辅料'] : accessories;
    let fillingIngredient = null;
    let craftedFilling = null;
    if (fillingMode === 'preset') {
      fillingIngredient = ingredients.馅料.find((x) => x.name === fillingPreset) || null;
    } else if (fillingMode === 'crafted') {
      craftedFilling = state.craftedFillings?.find((x) => x.id === craftedId) || null;
    }
    return {
      description: desc,
      flourNames: flours,
      liquidNames: liquids,
      yeastName: yeast,
      accessoryNames,
      flavorNames,
      fillingIngredient,
      craftedFilling: craftedFilling
        ? { id: craftedFilling.id, name: craftedFilling.name, description: craftedFilling.description, baseAttr: craftedFilling.baseAttr }
        : null,
      techniqueId,
      bakeTempC: bakeTemp,
      moldId,
      flourAmounts: amounts.flour || {},
      liquidAmounts: amounts.liquid || {},
      yeastAmounts: amounts.yeast || {},
      accessoryAmounts: amounts.accessory || {},
      flavorAmounts: amounts.flavor || {},
      fillingAmounts: {},
    };
  };

  const setAmt = (cat, name, val) => {
    if (val === '' || val == null) {
      setAmounts((a) => { const n = { ...(a[cat] || {}) }; delete n[name]; return { ...a, [cat]: n }; });
      return;
    }
    const v = parseFloat(val);
    if (isNaN(v) || v <= 0) {
      setAmounts((a) => { const n = { ...(a[cat] || {}) }; delete n[name]; return { ...a, [cat]: n }; });
      return;
    }
    setAmounts((a) => ({ ...a, [cat]: { ...(a[cat] || {}), [name]: v } }));
  };
  const getAmt = (cat, name) => {
    const v = amounts[cat]?.[name];
    return v != null && v > 0 ? v : '';
  };

  const hasValidAmt = (cat, name) => {
    const v = amounts[cat]?.[name];
    return v != null && Number(v) > 0;
  };

  const validateBeforeBake = () => {
    if (flours.length < 1 || liquids.length < 1 || !yeast) {
      notify('请至少选择一种面粉、一种液体与酵母', 'error');
      return false;
    }
    if (fillingMode === 'crafted' && !craftedId) {
      notify('请选择自制馅料，或改选「无馅料/经典馅料」', 'error');
      return false;
    }
    const missing = [];
    for (const n of flours) {
      if (!hasValidAmt('flour', n)) missing.push(`面粉：${n}`);
    }
    for (const n of liquids) {
      if (!hasValidAmt('liquid', n)) missing.push(`液体：${n}`);
    }
    if (yeast && !hasValidAmt('yeast', yeast)) missing.push(`酵母：${yeast}`);
    for (const n of accessories) {
      if (n !== '无辅料' && !hasValidAmt('accessory', n)) missing.push(`辅料：${n}`);
    }
    for (const n of flavors) {
      if (n !== '无添加' && !hasValidAmt('flavor', n)) missing.push(`风味：${n}`);
    }
    if (missing.length > 0) {
      notify(`请填写以下原料的用量：${missing.join('、')}`, 'error');
      return false;
    }
    const opts = buildOpts();
    const req = buildInventoryRequirementsFromAdvanced(opts);
    const next = tryConsume(lots, req);
    if (!next) {
      notify('库存不足，请检查采购或调整原料', 'error');
      return false;
    }
    return true;
  };

  const toTechniqueId = (v) => {
    if (!v) return 'direct';
    const t = bakeTechniques.find((x) => x.name === v);
    if (t) return t.id;
    const map = { 隔夜发酵: 'overnight', 开酥法: 'laminated' };
    return map[v] || 'direct';
  };
  const toMoldId = (v) => {
    if (!v) return 'round';
    const m = breadMolds.find((x) => x.name === v || x.name?.includes(v));
    if (m) return m.id;
    const map = { 圆形: 'round', 法棍: 'baguette', 吐司: 'loaf', 卷形: 'braided', 牛角: 'croissant', 椭圆形: 'loaf', 玛芬: 'muffin', 德国结: 'pretzel', 编花: 'braided', 恰巴塔: 'ciabatta', 佛卡夏: 'focaccia', 三角: 'triangle', 和风: 'wafu', 贝果: 'bagel', 碱水包: 'alkaline', 盐面包: 'salt', 长面包: 'longloaf', 乡村面包: 'ciabatta', 大鼓: 'drum', 欧包: 'euro' };
    return map[v] || v;
  };
  const isFillingOnlyChange = (base) => {
    if (!base?.ingredientsMulti && !base?.bakeMeta && !base?.面粉) return false;
    const same = (a, b) => JSON.stringify((a || []).sort?.() ?? a) === JSON.stringify((b || []).sort?.() ?? b);
    const baseFill = base.ingredientsMulti?.馅料 || base.馅料;
    const currFill = fillingMode === 'preset' ? fillingPreset : fillingMode === 'crafted'
      ? state.craftedFillings?.find((f) => f.id === craftedId)?.name : null;
    if ((currFill || '无馅料') === (baseFill?.name ?? baseFill ?? '无馅料')) return false;
    const baseFlours = base.ingredientsMulti?.面粉?.map((x) => x?.name) || (base.面粉 ? [base.面粉] : []);
    const baseLiqs = base.ingredientsMulti?.液体?.map((x) => x?.name) || (base.液体 ? [base.液体] : []);
    const baseYeast = base.ingredientsMulti?.酵母?.name || base.酵母 || '';
    return same(flours, baseFlours) && same(liquids, baseLiqs) && (yeast || '') === (baseYeast || '')
      && techniqueId === toTechniqueId(base.bakeMeta?.techniqueId || base.手法)
      && moldId === toMoldId(base.bakeMeta?.moldId || base.模具);
  };

  const startBake = () => {
    if (!validateBeforeBake()) return;
    const opts = buildOpts();
    const pin = pinnedRecipe;
    if (pin) {
      const exp = getExpectedSnapshotForRecipe(pin);
      const cur = snapshotBakeOpts(opts);
      if (exp && bakeSnapshotsMatch(cur, exp)) {
        opts.identityRecipe = pin;
      }
    }
    if (pinnedRecipe && isFillingOnlyChange(pinnedRecipe)) {
      const newFill = fillingMode === 'preset' ? fillingPreset : fillingMode === 'crafted'
        ? state.craftedFillings?.find((f) => f.id === craftedId)?.name : null;
      const baseName = pinnedRecipe.baseName || pinnedRecipe.name?.replace(/[（(][^）)]+[）)]$/, '')?.trim() || pinnedRecipe.name;
      opts.baseNameForFillingOnly = baseName;
      opts.fillingTagForFillingOnly = newFill || null;
    }
    ctxStartBake(opts, lots);
  };

  /** 可获得原料：采购目录中可买的（非已有库存） */
  const obtainableIng = () => {
    const procureSkus = new Set([...(state.customProcurementItems || []).map((p) => p.sku), ...procurementItems.map((p) => p.sku)]);
    const flour = ingredients.面粉.filter((x) => procureSkus.has(x.name)).map((x) => x.name);
    const liquid = ingredients.液体.filter((x) => procureSkus.has(x.name)).map((x) => x.name);
    const yeast = ingredients.酵母.filter((x) => procureSkus.has(x.name)).map((x) => x.name);
    const accessory = ingredients.辅料?.filter((x) => x.name !== '无辅料' && procureSkus.has(x.name)).map((x) => x.name) || [];
    const flavor = ingredients.风味.filter((x) => x.name !== '无添加' && procureSkus.has(x.name)).map((x) => x.name);
    const filling = ingredients.馅料.filter((x) => x.name !== '无馅料' && procureSkus.has(x.name)).map((x) => x.name);
    const crafted = (state.craftedFillings || []).map((x) => x.name);
    return { flour, liquid, yeast, accessory, flavor, filling: [...filling, ...crafted] };
  };

  /** 以已填主料为锚（面粉优先于液体优先于酵母），实时推算其余主料的理想合计范围 */
  const ratioLiveHints = useMemo(() => {
    const flourSum = sumNamedAmounts(amounts.flour, flours);
    const liquidSum = sumNamedAmounts(amounts.liquid, liquids);
    const yeastSum = yeast && amounts.yeast?.[yeast] != null && Number(amounts.yeast[yeast]) > 0
      ? Number(amounts.yeast[yeast])
      : 0;
    if (flourSum > 0) return { anchorSumG: flourSum, ...computeIdealWeightHints('flour', flourSum) };
    if (liquidSum > 0) return { anchorSumG: liquidSum, ...computeIdealWeightHints('liquid', liquidSum) };
    if (yeastSum > 0) return { anchorSumG: yeastSum, ...computeIdealWeightHints('yeast', yeastSum) };
    return null;
  }, [amounts, flours, liquids, yeast]);

  /** 面粉/液体/酵母均已填克数时，按本批总重分析配比并生成提醒 */
  const ratioAnalysis = (() => {
    if (flours.length < 1 || liquids.length < 1 || !yeast) return null;
    for (const n of flours) {
      if (amounts.flour?.[n] == null || !(Number(amounts.flour[n]) > 0)) return null;
    }
    for (const n of liquids) {
      if (amounts.liquid?.[n] == null || !(Number(amounts.liquid[n]) > 0)) return null;
    }
    if (amounts.yeast?.[yeast] == null || !(Number(amounts.yeast[yeast]) > 0)) return null;
    const opts = buildOpts();
    const totalG = calculateBatchWeight(opts);
    return analyzeRecipeRatios(opts, totalG);
  })();

  const aiDesignRecipe = async () => {
    const { flour, liquid, yeast, accessory, flavor } = getObtainableSkuSets(state);
    const av = { flour, liquid, yeast, accessory, flavor };
    if (av.flour.length < 1 || av.liquid.length < 1 || av.yeast.length < 1) {
      notify('采购目录中需有面粉、液体、酵母各至少一种才可设计', 'error');
      return;
    }
    const existingNames = [
      ...classicRecipes.map((r) => r.name),
      ...(state.recipes || []).map((r) => r.name),
    ];
    if (pinnedRecipe?.name && !existingNames.includes(pinnedRecipe.name)) {
      existingNames.push(pinnedRecipe.name);
    }
    if (state.gold < AI_GENERATION_GOLD_COST) {
      notify(`使用 AI 设计配方需 ${AI_GENERATION_GOLD_COST}💰`, 'error');
      return;
    }
    const excludeHint = existingNames.length > 0
      ? `\n【严禁重复】以下配方已存在，严禁设计与其相同或高度相似的配方：${existingNames.join('、')}。请务必设计一款名称、原料组合、风格均不同的全新配方。`
      : '';
    setAiBusy(true);
    setAiPreview(null);
    try {
      const { recipe, opts } = await aiDesignDoughRecipeCore({
        userPrompt: desc || '随意发挥，好吃就行',
        av,
        excludeHint,
        chatComplete,
      });
      if (existingNames.includes(recipe.name)) {
        recipe.name = `${recipe.name}（新）`;
      }
      setAiPreview({ recipe, opts });
      dispatch({ type: 'SPEND_GOLD', amount: AI_GENERATION_GOLD_COST });
      notify(`AI 已设计配方（已支付 ${AI_GENERATION_GOLD_COST}💰），请选择操作`, 'success');
    } catch (e) {
      notify(e.message || 'AI 设计失败', 'error');
    } finally {
      setAiBusy(false);
    }
  };

  const hasPendingOrder = !!state.pendingCustomOrder;

  return (
    <div className="panel">
      {hasPendingOrder && (
        <div className="pending-order-banner">
          📋 定制订单待制作：{state.pendingCustomOrder.recipe?.name} — 请按配方制作后点击「端给客人」
        </div>
      )}
      <div className="panel-header">
        <span className="panel-hint">AI 设计配方 → 预览固定/入库 → 选料与用量 → 烘焙（默认简洁用量，可按需切换精确克数）</span>
      </div>

      <div className="generator-form" ref={formRef}>
        <div className="simple-input-toggle">
          <label>
            <input
              type="checkbox"
              checked={simpleAmounts}
              onChange={(e) => setSimpleAmounts(e.target.checked)}
            />
            简洁用量（滑块、整克、配比折叠）
          </label>
        </div>
        <div className="input-group">
          <label>面包描述（AI 根据可用原料设计，先展示再选是否使用）</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="如：想要甜软奶香、适合早餐的吐司…"
            rows={2}
            lang="zh-CN"
            inputMode="text"
          />
          <button
            type="button"
            className="btn btn-secondary btn-small"
            disabled={aiBusy || state.gold < AI_GENERATION_GOLD_COST}
            onClick={aiDesignRecipe}
          >
            {aiBusy ? 'AI 设计中…' : `✨ AI 设计配方（${AI_GENERATION_GOLD_COST}💰）`}
          </button>
        </div>

        {aiPreview && (
          <AIRecipePreviewModal
            recipe={aiPreview.recipe}
            onPin={() => { pinRecipe(aiPreview.recipe); setAiPreview(null); notify('已固定配方', 'success'); }}
            onSave={() => {
              if (recipeExistsWithSameBakeIdentity(state.recipes, aiPreview.recipe)) {
                notify('配方库已有相同面团配置，未重复保存', 'info');
                setAiPreview(null);
                return;
              }
              dispatch({ type: 'ADD_CUSTOM_RECIPE', recipe: aiPreview.recipe });
              setAiPreview(null);
              notify('已存入配方库', 'success');
            }}
            onPinAndSave={() => {
              const r = aiPreview.recipe;
              pinRecipe(r);
              const dup = recipeExistsWithSameBakeIdentity(state.recipes, r);
              if (!dup) dispatch({ type: 'ADD_CUSTOM_RECIPE', recipe: r });
              setAiPreview(null);
              notify(dup ? '已固定配方（库中已有相同面团配置）' : '已固定并存入配方库', 'success');
            }}
            onClose={() => setAiPreview(null)}
          />
        )}

        <div className="ingredient-tabs ingredient-tabs-three">
          <button type="button" className={`ingredient-tab${ingredientTab === 'base' ? ' on' : ''}`} onClick={() => setIngredientTab('base')}>
            面粉 / 液体 / 酵母
          </button>
          <button type="button" className={`ingredient-tab${ingredientTab === 'flavor' ? ' on' : ''}`} onClick={() => setIngredientTab('flavor')}>
            辅料 / 风味 / 馅料
          </button>
          <button type="button" className={`ingredient-tab${ingredientTab === 'bake' ? ' on' : ''}`} onClick={() => setIngredientTab('bake')}>
            手法 / 炉温 / 模具
          </button>
        </div>

        {ingredientTab === 'base' && (
          <>
        {ratioLiveHints &&
          (simpleAmounts ? (
            <details className="ratio-live-hint ratio-live-hint-compact">
              <summary>
                配比参考 · 以{ratioLiveHints.anchorLabel}{' '}
                {Math.round(ratioLiveHints.anchorSumG)} g ·{' '}
                总重约 {fmtRangeG(ratioLiveHints.totalBand[0], ratioLiveHints.totalBand[1])}
              </summary>
              <div className="ratio-live-hint-body">
                <div>以「{ratioLiveHints.anchorLabel} {Math.round(ratioLiveHints.anchorSumG * 10) / 10} g」为基准</div>
                <div>本批总重约 {fmtRangeG(ratioLiveHints.totalBand[0], ratioLiveHints.totalBand[1])}</div>
                {ratioLiveHints.anchorType !== 'flour' && (
                  <div>面粉合计约 {fmtRangeG(ratioLiveHints.flourSumBand[0], ratioLiveHints.flourSumBand[1])}</div>
                )}
                {ratioLiveHints.anchorType !== 'liquid' && (
                  <div>液体合计约 {fmtRangeG(ratioLiveHints.liquidSumBand[0], ratioLiveHints.liquidSumBand[1])}</div>
                )}
                {ratioLiveHints.anchorType !== 'yeast' && (
                  <div>酵母约 {fmtRangeG(ratioLiveHints.yeastBand[0], ratioLiveHints.yeastBand[1])}</div>
                )}
              </div>
            </details>
          ) : (
            <div className="ratio-live-hint" role="status" aria-live="polite">
              <div className="ratio-live-hint-body">
                <div>以「{ratioLiveHints.anchorLabel} {Math.round(ratioLiveHints.anchorSumG * 10) / 10} g」为基准</div>
                <div>本批总重约 {fmtRangeG(ratioLiveHints.totalBand[0], ratioLiveHints.totalBand[1])}</div>
                {ratioLiveHints.anchorType !== 'flour' && (
                  <div>面粉合计约 {fmtRangeG(ratioLiveHints.flourSumBand[0], ratioLiveHints.flourSumBand[1])}</div>
                )}
                {ratioLiveHints.anchorType !== 'liquid' && (
                  <div>液体合计约 {fmtRangeG(ratioLiveHints.liquidSumBand[0], ratioLiveHints.liquidSumBand[1])}</div>
                )}
                {ratioLiveHints.anchorType !== 'yeast' && (
                  <div>酵母约 {fmtRangeG(ratioLiveHints.yeastBand[0], ratioLiveHints.yeastBand[1])}</div>
                )}
              </div>
            </div>
          ))}
        <h4 className="form-section-title">面粉（多选{simpleAmounts ? '，拖动定用量' : '，可输入克数'}）</h4>
        {!simpleAmounts && ratioLiveHints && ratioLiveHints.anchorType !== 'flour' && (
          <p className="ratio-hint-inline drawer-hint">面粉合计参考：{fmtRangeG(ratioLiveHints.flourSumBand[0], ratioLiveHints.flourSumBand[1])}</p>
        )}
        <div className="chip-grid">
          {ingredients.面粉.filter(showFlour).length === 0 ? (
            <p className="drawer-hint" style={{ margin: 0 }}>暂无库存中的面粉，请先去采购</p>
          ) : (
            ingredients.面粉.filter(showFlour).map((x) => (
            <span key={x.name} className="chip-with-amount">
              <ToggleChip
                thumbName={x.name}
                label={ingQtyLabel(x.name, simpleAmounts)}
                on={flours.includes(x.name)}
                disabled={!flours.includes(x.name) && qty(x.name) < 1}
                onClick={() => toggleIn(x.name, flours, setFlours, 99, 0)}
              />
              {flours.includes(x.name) && (
                <IngredientAmountControl
                  simple={simpleAmounts}
                  stockQty={qty(x.name)}
                  kind="flour"
                  value={getAmt('flour', x.name)}
                  onChange={(v) => setAmt('flour', x.name, v)}
                />
              )}
            </span>
          )))}
        </div>

        <h4 className="form-section-title">液体（多选{simpleAmounts ? '，拖动定用量' : ''}）</h4>
        {!simpleAmounts && ratioLiveHints && ratioLiveHints.anchorType !== 'liquid' && (
          <p className="ratio-hint-inline drawer-hint">液体合计参考：{fmtRangeG(ratioLiveHints.liquidSumBand[0], ratioLiveHints.liquidSumBand[1])}</p>
        )}
        <div className="chip-grid">
          {ingredients.液体.filter(showLiquid).length === 0 ? (
            <p className="drawer-hint" style={{ margin: 0 }}>暂无库存中的液体，请先去采购</p>
          ) : (
            ingredients.液体.filter(showLiquid).map((x) => (
            <span key={x.name} className="chip-with-amount">
              <ToggleChip
                thumbName={x.name}
                label={ingQtyLabel(x.name, simpleAmounts)}
                on={liquids.includes(x.name)}
                disabled={!liquids.includes(x.name) && qty(x.name) < 1}
                onClick={() => toggleIn(x.name, liquids, setLiquids, 99, 0)}
              />
              {liquids.includes(x.name) && (
                <IngredientAmountControl
                  simple={simpleAmounts}
                  stockQty={qty(x.name)}
                  kind="liquid"
                  value={getAmt('liquid', x.name)}
                  onChange={(v) => setAmt('liquid', x.name, v)}
                />
              )}
            </span>
          )))}
        </div>

        <h4 className="form-section-title">酵母（单选{simpleAmounts ? '，拖动定用量' : ''}）</h4>
        {!simpleAmounts && ratioLiveHints && ratioLiveHints.anchorType !== 'yeast' && (
          <p className="ratio-hint-inline drawer-hint">酵母参考：{fmtRangeG(ratioLiveHints.yeastBand[0], ratioLiveHints.yeastBand[1])}</p>
        )}
        <div className="chip-grid">
          {ingredients.酵母.filter(showYeast).length === 0 ? (
            <p className="drawer-hint" style={{ margin: 0 }}>暂无库存中的酵母，请先去采购</p>
          ) : (
            ingredients.酵母.filter(showYeast).map((x) => (
            <span key={x.name} className="chip-with-amount">
              <ToggleChip thumbName={x.name} label={ingQtyLabel(x.name, simpleAmounts)} on={yeast === x.name} disabled={qty(x.name) < 1}
                onClick={() => { if (qty(x.name) >= 1) setYeast(x.name); }} />
              {yeast === x.name && (
                <IngredientAmountControl
                  simple={simpleAmounts}
                  stockQty={qty(x.name)}
                  kind="yeast"
                  value={getAmt('yeast', x.name)}
                  onChange={(v) => setAmt('yeast', x.name, v)}
                />
              )}
            </span>
          )))}
        </div>

          </>
        )}

        {ingredientTab === 'flavor' && (
          <>
        {ratioLiveHints &&
          (simpleAmounts ? (
            <details className="ratio-live-hint ratio-live-hint-compact" style={{ marginBottom: 10 }}>
              <summary>辅料、风味与馅料如何计重</summary>
              <p className="drawer-hint" style={{ margin: '8px 0 0', fontSize: '.8rem' }}>
                主料配比在「面粉/液体/酵母」页。辅料与风味算进面团总重；馅料不跟面团一起称重，出炉时按每只馅量从馅料库存扣除。
              </p>
            </details>
          ) : (
            <p className="ratio-hint-inline drawer-hint" style={{ marginTop: 0 }}>
              主料配比参考见「面粉/液体/酵母」页；辅料与风味计入面团总重；馅料不计入面团，出炉时按每只约 max(5, 模具容积×12%) 克从库存扣。
            </p>
          ))}
        <h4 className="form-section-title">辅料（多选{simpleAmounts ? '，拖动定用量' : ''}；留空=无辅料）</h4>
        <div className="chip-grid">
          {(ingredients.辅料 || []).filter(showAccessory).map((x) => (
            <span key={x.name} className="chip-with-amount">
              <ToggleChip
                thumbName={x.name !== '无辅料' ? x.name : undefined}
                label={x.name === '无辅料' ? '无辅料' : ingQtyLabel(x.name, simpleAmounts)}
                on={x.name === '无辅料' ? accessories.length === 0 : accessories.includes(x.name)}
                disabled={x.name !== '无辅料' && !accessories.includes(x.name) && qty(x.name) < 1}
                onClick={() => { if (x.name === '无辅料') setAccessories([]); else toggleIn(x.name, accessories, setAccessories, 99, 0); }}
              />
              {x.name !== '无辅料' && accessories.includes(x.name) && (
                <IngredientAmountControl
                  simple={simpleAmounts}
                  stockQty={qty(x.name)}
                  kind="extra"
                  value={getAmt('accessory', x.name)}
                  onChange={(v) => setAmt('accessory', x.name, v)}
                />
              )}
            </span>
          ))}
        </div>

        <h4 className="form-section-title">风味（多选{simpleAmounts ? '，拖动定用量' : ''}；留空=无添加）</h4>
        <div className="chip-grid">
          {ingredients.风味.filter(showFlavor).map((x) => (
            <span key={x.name} className="chip-with-amount">
              <ToggleChip
                thumbName={x.name !== '无添加' ? x.name : undefined}
                label={x.name === '无添加' ? '无添加' : ingQtyLabel(x.name, simpleAmounts)}
                on={x.name === '无添加' ? flavors.length === 0 : flavors.includes(x.name)}
                disabled={x.name !== '无添加' && !flavors.includes(x.name) && qty(x.name) < 1}
                onClick={() => { if (x.name === '无添加') setFlavors([]); else toggleIn(x.name, flavors, setFlavors, 99, 0); }}
              />
              {x.name !== '无添加' && flavors.includes(x.name) && (
                <IngredientAmountControl
                  simple={simpleAmounts}
                  stockQty={qty(x.name)}
                  kind="extra"
                  value={getAmt('flavor', x.name)}
                  onChange={(v) => setAmt('flavor', x.name, v)}
                />
              )}
            </span>
          ))}
        </div>

        <h4 className="form-section-title">馅料</h4>
        <div className="filling-row">
          <FillingOptionDropUp
            value={fillingMode}
            options={[
              { value: 'none', label: '无馅料' },
              { value: 'preset', label: '经典馅料（耗库存）' },
              { value: 'crafted', label: '自制馅料（馅料工坊）' },
            ]}
            onChange={(v) => setFillingMode(v)}
          />
          {fillingMode === 'preset' && (
            <FillingOptionDropUp
              value={fillingPreset}
              placeholder="选择经典馅料"
              emptyHint="暂无可用馅料库存，请采购"
              options={fillingOptionsPreset.map((x) => {
                const q = qty(x.name);
                const qLabel = simpleAmounts ? Math.round(q) : Math.round(q * 10) / 10;
                return {
                  value: x.name,
                  label: simpleAmounts ? `${x.name}（约 ${qLabel} g）` : `${x.name}（${qLabel} 克）`,
                };
              })}
              onChange={(name) => setFillingPreset(name)}
            />
          )}
          {fillingMode === 'crafted' && (
            <FillingOptionDropUp
              value={craftedId}
              placeholder="请选择自制馅料"
              emptyHint="请先在馅料工坊制备"
              options={[
                { value: '', label: '请选择' },
                ...(state.craftedFillings || []).map((f) => ({
                  value: f.id,
                  label: `${f.name}${f.weightG != null ? ` · ${f.weightG}g` : ''}`,
                })),
              ]}
              onChange={(id) => setCraftedId(id)}
            />
          )}
          {fillingMode === 'preset' && fillingPreset && fillingOptionsPreset.length > 0 ? (
            <IngredientThumb name={fillingPreset} size="md" />
          ) : null}
          {((fillingMode === 'preset' && fillingPreset && fillingOptionsPreset.length > 0)
            || (fillingMode === 'crafted' && craftedId)) &&
            (simpleAmounts ? (
              <details className="drawer-hint filling-usage-hint" style={{ marginTop: 4 }}>
                <summary>每只馅用量说明</summary>
                <span style={{ display: 'block', marginTop: 6 }}>
                  每只馅约 {Math.max(5, Math.round((breadMolds.find((m) => m.id === moldId)?.volumeG || 350) * 0.12))} g，按出炉只数扣馅料；不足时部分无馅。
                </span>
              </details>
            ) : (
              <span className="drawer-hint filling-usage-hint">
                每只馅约 {Math.max(5, Math.round((breadMolds.find((m) => m.id === moldId)?.volumeG || 350) * 0.12))}g，出炉按本批只数扣库存；不足时部分面包无馅。
              </span>
            ))}
        </div>
          </>
        )}

        {ingredientTab === 'bake' && (
          <>
        <h4 className="form-section-title">手法与炉温</h4>
        <div className="selector-group">
          <label>手法</label>
          <select value={techniqueId} onChange={(e) => setTechniqueId(e.target.value)}>
            {bakeTechniques.map((t) => (
              <option key={t.id} value={t.id}>{t.name} — {t.desc}</option>
            ))}
          </select>
        </div>
        <div className="param-row-bake">
          <label>炉温 {bakeTemp}°C</label>
          <input
            type="range"
            min={140}
            max={220}
            value={bakeTemp}
            onChange={(e) => setBakeTemp(+e.target.value)}
          />
        </div>

        <h4 className="form-section-title">模具（区域内上下滑动选择）</h4>
        <div className="mold-strip" role="listbox" aria-label="模具">
          {breadMolds.map((m) => (
            <button key={m.id} type="button" role="option" aria-selected={moldId === m.id} className={`mold-btn${moldId === m.id ? ' on' : ''}`} onClick={() => setMoldId(m.id)}>
              <span className="mold-icon">{m.icon}</span>
              {m.name}
            </button>
          ))}
        </div>
          </>
        )}

        {(() => {
          const hasRequired = flours.length >= 1 && liquids.length >= 1 && !!yeast;
          if (!hasRequired) {
            return (
              <div className="batch-info">
                <span className="drawer-hint" style={{ display: 'block', margin: 0 }}>面粉、液体、酵母为必备，请至少各选一种并填写用量</span>
              </div>
            );
          }
          const opts = buildOpts();
          const totalG = calculateBatchWeight(opts);
          const mold = breadMolds.find((m) => m.id === moldId);
          const count = mold ? Math.max(1, Math.floor(totalG / (mold.volumeG || 350))) : 1;
          return (
            <div className="batch-info">
              <span>
                本批约 {simpleAmounts ? Math.round(totalG) : Math.round(totalG * 10) / 10}g → {count} 个
              </span>
              <RatioWarningBlock analysis={ratioAnalysis} />
            </div>
          );
        })()}
        {!baking.pending && (
          <button type="button" className="btn btn-primary btn-large" disabled={baking.active} onClick={startBake}>
            {baking.active ? '烘焙中…' : '🔥 进入烘焙（约 25 秒）'}
          </button>
        )}
      </div>
    </div>
  );
}
