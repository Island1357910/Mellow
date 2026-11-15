import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../context/GameContext';
import { useUI, PAGE_IDS } from '../context/UIContext';
import FloatingShopCart from '../components/procurement/FloatingShopCart';
import { PROCUREMENT_MARKET_IMAGE_URL, PROCUREMENT_SHELF_HOTSPOTS } from '../data/storeFloorHotspots';
import { assignPixelLabelFramesForPage } from '../data/pixelLabelFrames';
import { PixelMapFramedLabel } from '../components/store/PixelMapLabelKit';
import { procurementItems, equipmentCatalog } from '../data/procurementCatalog';
import { totalQtyForSku } from '../systems/inventorySystem';
import { ingredients, rarityConfig, CATEGORY_KEYS } from '../data/ingredients';
import { getSynergyDefinitionByName, bonusHasNegative } from '../data/bakeSynergies';
import { classicRecipes } from '../data/classicRecipes';
import { breadMolds } from '../data/molds';
import { bakeTechniques } from '../data/techniques';
import BreadCanvas from '../components/bread/BreadCanvas';
import CardBreadDecor from '../components/CardBreadDecor';
import IngredientThumb from '../components/IngredientThumb';
import Modal from '../components/common/Modal';
import { getIngredientLines } from '../utils/recipePreviewDisplay';
import {
  characters,
  computeEndingId,
  endingDescriptions,
  mainStoryChapters,
  MAIN_STORY_BG_BY_CHAPTER,
} from '../data/storyData';
import { isMainStoryChapterUnlocked, getMainStoryChapterBgmTrackId } from '../data/mainStoryChapters';
import { characterArchiveStories, getArchiveStoryForCharacter } from '../data/characterArchiveStories';
import BakeryRPGDialogueView from '../components/story/BakeryRPGDialogueView';
import {
  loadAISettings,
  saveAISettings,
  testAIConnection,
  fetchModels,
  hostedByMellow,
  chatComplete,
} from '../services/aiService';
import { resetHubOnboarding } from '../systems/onboardingStorage';
import BgmPlayerCard from '../components/settings/BgmPlayerCard';
import { useBgm } from '../context/BgmContext';
import { AI_GENERATION_GOLD_COST } from '../constants/aiEconomy';
import {
  aiTintCategoryForSku,
  aiTintCategoryForProcRow,
  aiTintVariantForSku,
  aiTintVariantForProcRow,
} from '../utils/procurementDisplay';

const AI_PROC_CATEGORY_SET = new Set(['面粉', '液体', '酵母', '辅料', '风味', '馅料']);

function isNegatedCategoryMention(desc, cat) {
  return new RegExp(`(?:不要|无需|不用|别要)[^，。\\n]{0,12}?${cat}`).test(desc);
}

/** 描述中若明确指向单一采购大类，则 AI 只生成该类的三款备选 */
function procurementCategoryFromDescription(desc) {
  const d = desc.trim();
  if (!d) return null;
  const rules = [
    ['馅料', /馅料|内馅|夹心馅|包馅|流沙馅|芋泥馅/],
    ['风味', /风味(?!面包)|香料|香草精|抹茶|肉桂粉|伯爵茶|桂花(?!糕)/],
    ['酵母', /酵母|酵种|鲁邦|老面|汤种|波兰种|酵头/],
    ['液体', /液体|牛奶|豆浆|酸奶|椰奶|淡奶油|果汁|柚子蜜|饮用水|纯净水|蜂蜜水|燕麦奶/],
    ['面粉', /面粉|麦粉|高筋|低筋|全麦|黑麦|荞麦|T65|斯佩尔特|rye|bread\s*flour/i],
    ['辅料', /辅料|黄油|鸡蛋|细砂糖|炼乳|奶粉|橄榄油|色拉油|泡打粉|小苏打|玉米淀粉/],
  ];
  for (const [cat, re] of rules) {
    if (!re.test(d)) continue;
    if (isNegatedCategoryMention(d, cat)) continue;
    return cat;
  }
  for (const c of AI_PROC_CATEGORY_SET) {
    const strong = d.includes(`${c}类`) || d.includes(`只要${c}`) || d.includes(`仅${c}`) || d.includes(`就要${c}`) || d.includes(`想买${c}`) || d.includes(`采购${c}`);
    if (strong && !isNegatedCategoryMention(d, c)) return c;
  }
  return null;
}

/** AI 返回的 sku 须为中文简称（含至少一个汉字，避免整段英文商品名） */
function skuMustBeChineseName(s) {
  const t = String(s || '').trim();
  if (!t) return false;
  if (!/[\u4e00-\u9fff]/.test(t)) return false;
  const latin = (t.match(/[a-zA-Z]/g) || []).length;
  if (latin >= 3 && latin / t.length > 0.45) return false;
  return true;
}

/** visualIndex 0–2：同批三款立绘色相区分（写入目录后沿用） */
function normalizeAiProcurementItem(data, forcedCategory, visualIndex = 0) {
  let category = AI_PROC_CATEGORY_SET.has(data.category) ? data.category : '辅料';
  if (forcedCategory && AI_PROC_CATEGORY_SET.has(forcedCategory)) category = forcedCategory;
  const v = ((Number(visualIndex) || 0) % 3 + 3) % 3;
  return {
    sku: String(data.sku || '新原料').slice(0, 20),
    category,
    weightPerPack: Math.max(50, Math.min(2000, Number(data.weightPerPack) || Number(data.batchQty) || 500)),
    pricePerPack: Math.max(5, Math.min(200, Number(data.pricePerPack) || Number(data.unitPrice) || 30)),
    shelfLife: Math.max(1, Math.min(730, Number(data.shelfLife) || 30)),
    needsCold: Boolean(data.needsCold),
    aiGenerated: true,
    aiVisualVariant: v === 0 || v === 1 || v === 2 ? v : 0,
  };
}

const STAT_ICONS = { 甜度: '🍬', 柔软度: '☁️', 香气: '🌸', 复杂度: '🎭' };

function normalizeSearchKw(s) {
  return String(s || '').trim().toLowerCase();
}

/** 采购目录：名称、类别、规格、价格、保质期、冷藏等 */
function procurementItemMatchesKeyword(p, kwNorm) {
  if (!kwNorm) return true;
  const bits = [
    p.sku,
    p.category,
    p.needsCold ? '冷藏' : '',
    String(p.weightPerPack ?? p.batchQty ?? ''),
    String(p.pricePerPack ?? p.unitPrice ?? ''),
    String(p.shelfLife ?? ''),
  ];
  return bits.some((x) => String(x).toLowerCase().includes(kwNorm));
}

function classicRecipeMatchesKeyword(r, kwNorm) {
  if (!kwNorm) return true;
  const bits = [
    r.name,
    r.description,
    r.手法,
    r.模具,
    String(r.炉温 ?? ''),
    ...(r.ingredientList || []),
    ...Object.entries(r.stats || {}).flatMap(([k, v]) => [k, String(v)]),
  ];
  return bits.some((x) => String(x).toLowerCase().includes(kwNorm));
}

function savedRecipeMatchesKeyword(r, kwNorm) {
  if (!kwNorm) return true;
  const lines = getIngredientLines(r);
  const mold = breadMolds.find((m) => m.id === r.bakeMeta?.moldId);
  const tech = bakeTechniques.find((t) => t.id === r.bakeMeta?.techniqueId);
  const bits = [
    r.name,
    r.shortDesc,
    r.description,
    r.bakeMeta?.techniqueName,
    tech?.name,
    r.bakeMeta?.techniqueId,
    mold?.name,
    r.bakeMeta?.moldId,
    String(r.bakeMeta?.bakeTempC ?? ''),
    ...(r.ingredientList || []),
    ...lines,
    ...Object.entries(r.stats || {}).flatMap(([k, v]) => [k, String(v)]),
    r.rarity,
  ];
  return bits.some((x) => x != null && String(x).toLowerCase().includes(kwNorm));
}

function formatStatBonus(bonus) {
  if (!bonus || typeof bonus !== 'object') return '无额外四维加成';
  const parts = Object.entries(bonus).filter(([, v]) => Number(v) !== 0);
  if (parts.length === 0) return '无额外四维加成';
  return parts.map(([k, v]) => {
    const n = Number(v);
    const sign = n > 0 ? '+' : '';
    return `${STAT_ICONS[k] || ''}${k} ${sign}${n}`;
  }).join(' · ');
}

const INVENTORY_SKU_CATEGORY = new Map();
for (const cat of CATEGORY_KEYS) {
  for (const item of ingredients[cat] || []) {
    INVENTORY_SKU_CATEGORY.set(item.name, cat);
  }
}

const INVENTORY_CATEGORY_TABS = [
  { id: 'all', label: '全部' },
  ...CATEGORY_KEYS.map((id) => ({ id, label: id })),
];

function _inventorySkuCategory(sku, customProcurementItems) {
  const row = customProcurementItems?.find((p) => p.sku === sku);
  if (row?.category) return row.category;
  return INVENTORY_SKU_CATEGORY.get(sku) ?? null;
}

function _inventoryCategorySortIndex(cat) {
  if (cat == null) return CATEGORY_KEYS.length + 1;
  const i = CATEGORY_KEYS.indexOf(cat);
  return i >= 0 ? i : CATEGORY_KEYS.length;
}

function _compareInventorySkus(a, b, customProcurementItems) {
  const ia = _inventoryCategorySortIndex(_inventorySkuCategory(a, customProcurementItems));
  const ib = _inventoryCategorySortIndex(_inventorySkuCategory(b, customProcurementItems));
  if (ia !== ib) return ia - ib;
  return String(a).localeCompare(String(b), 'zh-CN');
}

function _buildInventoryTableRows({ skuKeys, grouped, invCategory, state, customProcurementItems }) {
  const rows = [];
  let lastSection = null;
  for (const sku of skuKeys) {
    const cat = _inventorySkuCategory(sku, customProcurementItems);
    const sectionLabel = cat ?? '其他';
    if (invCategory === 'all' && sectionLabel !== lastSection) {
      rows.push(
        <tr key={`inv-section-${sectionLabel}`} className="inv-category-header-row">
          <td colSpan={4}>{sectionLabel}</td>
        </tr>,
      );
      lastSection = sectionLabel;
    }
    const batchList = grouped[sku];
    const totalG = batchList.reduce((s, l) => s + (Number(l.qty) || 0), 0);
    batchList.forEach((l, i) => {
      rows.push(
        <tr key={l.id}>
          <td className="inv-sku-cell">
            {i === 0 ? (
              <span className="inv-sku-inline">
                <IngredientThumb
                  name={sku}
                  size="sm"
                  aiTintCategory={aiTintCategoryForSku(customProcurementItems, sku)}
                  aiTintVariant={aiTintVariantForSku(customProcurementItems, sku)}
                />
                <span>{sku}</span>
              </span>
            ) : (
              ''
            )}
          </td>
          <td>批{i + 1}</td>
          <td>{typeof l.qty === 'number' ? (l.qty % 1 === 0 ? l.qty : l.qty.toFixed(1)) : l.qty}</td>
          <td className={l.expiresOnDay - state.day <= 3 ? 'warn' : ''}>
            {Math.max(0, l.expiresOnDay - state.day)} 天
          </td>
        </tr>,
      );
    });
    if (batchList.length > 1) {
      rows.push(
        <tr key={`${sku}-total`} className="inv-total-row">
          <td colSpan={2}><strong>合计</strong></td>
          <td><strong>{totalG % 1 === 0 ? totalG : totalG.toFixed(1)} 克</strong></td>
          <td />
        </tr>,
      );
    }
  }
  return rows;
}

export function InventoryPage() {
  const { state } = useGame();
  const [invSearch, setInvSearch] = useState('');
  const [invCategory, setInvCategory] = useState('all');
  const lots = [...(state.inventory?.lots || [])].sort((a, b) => a.expiresOnDay - b.expiresOnDay);
  const eq = state.equipment || {};
  const grouped = lots.reduce((acc, l) => {
    const key = l.sku;
    if (!acc[key]) acc[key] = [];
    acc[key].push(l);
    return acc;
  }, {});
  const invKw = normalizeSearchKw(invSearch);
  const customList = state.customProcurementItems || [];
  let skuKeys = Object.keys(grouped).filter((sku) => !invKw || String(sku).toLowerCase().includes(invKw));
  if (invCategory !== 'all') {
    skuKeys = skuKeys.filter((sku) => _inventorySkuCategory(sku, customList) === invCategory);
  }
  skuKeys.sort((a, b) => _compareInventorySkus(a, b, customList));

  const emptyFilterHint = (() => {
    if (skuKeys.length > 0 || lots.length === 0) return null;
    if (invKw) return `未找到匹配「${invSearch.trim()}」的原料`;
    if (invCategory !== 'all') {
      const tab = INVENTORY_CATEGORY_TABS.find((t) => t.id === invCategory);
      return `「${tab?.label ?? invCategory}」下暂无库存`;
    }
    return '暂无匹配项';
  })();

  return (
    <div className="page-view panel">
      <div className="page-view-head">
        <h2>📦 库存</h2>
        <p className="drawer-hint">第 {state.day} 天 · 冷藏柜 {eq.fridge ? '已购' : '未购'} · 冷冻柜 {eq.freezer ? '已购' : '未购'}</p>
      </div>
      <div className="page-view-body bakery-card-decor-host">
        <CardBreadDecor seed="page-inventory" variant="chrome" countMin={3} countMax={5} />
        <div className="proc-header-row inv-inventory-toolbar">
          <div className="proc-tabs" role="tablist" aria-label="按类别筛选库存">
            {INVENTORY_CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={invCategory === tab.id}
                className={`proc-tab${invCategory === tab.id ? ' on' : ''}`}
                onClick={() => setInvCategory(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            className="proc-search drawer-input"
            placeholder="🔍 按原料名称关键词筛选…"
            value={invSearch}
            onChange={(e) => setInvSearch(e.target.value)}
            aria-label="筛选库存原料"
          />
        </div>
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead>
              <tr><th>原料</th><th>批次</th><th>剩余（克）</th><th>保质期剩余</th></tr>
            </thead>
            <tbody>
              {lots.length === 0 && (
                <tr><td colSpan={4} className="empty-cell">暂无库存，请去采购</td></tr>
              )}
              {lots.length > 0 && emptyFilterHint && (
                <tr><td colSpan={4} className="empty-cell">{emptyFilterHint}</td></tr>
              )}
              {lots.length > 0 && skuKeys.length > 0
                && _buildInventoryTableRows({
                  skuKeys,
                  grouped,
                  invCategory,
                  state,
                  customProcurementItems: customList,
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const PROCUREMENT_CATEGORIES = [
  { id: 'all', label: '全部' },
  { id: '面粉', label: '面粉' },
  { id: '液体', label: '液体' },
  { id: '酵母', label: '酵母' },
  { id: '辅料', label: '辅料' },
  { id: '风味', label: '风味' },
  { id: '馅料', label: '馅料' },
  { id: 'ai', label: 'AI生成' },
  { id: '器械', label: '器械' },
];

export function ProcurementPage() {
  const { state, dispatch, notify } = useGame();
  const { navigateTo } = useUI();
  const [cart, setCart] = useState({}); // { sku: batches }
  const [aiDesc, setAiDesc] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiCandidates, setAiCandidates] = useState(null);
  const [aiPickMask, setAiPickMask] = useState([true, true, true]);
  const [category, setCategory] = useState('all');
  const [shelfModalOpen, setShelfModalOpen] = useState(false);
  const procFrameUrls = useMemo(
    () => assignPixelLabelFramesForPage('procurement-market', PROCUREMENT_SHELF_HOTSPOTS.length),
    [],
  );

  const [searchKeyword, setSearchKeyword] = useState('');
  const customList = state.customProcurementItems || [];
  const allItems = [...procurementItems, ...customList];

  const categoryFiltered = useMemo(() => {
    const list = state.customProcurementItems || [];
    if (category === '器械') return [];
    if (category === 'ai') return list.filter((p) => p.aiGenerated);
    if (category === 'all') return [...procurementItems, ...list];
    const base = procurementItems.filter((p) => p.category === category);
    const fromCustom = list.filter(
      (p) => p.category === category && !p.aiGenerated,
    );
    return [...base, ...fromCustom];
  }, [category, state.customProcurementItems]);

  const kw = normalizeSearchKw(searchKeyword);
  const filteredItems = category === '器械' ? [] : (kw ? categoryFiltered.filter((p) => procurementItemMatchesKeyword(p, kw)) : categoryFiltered);

  const addToCart = (sku, batches = 1) => {
    setCart((c) => ({ ...c, [sku]: (c[sku] || 0) + batches }));
  };

  const removeFromCart = (sku) => {
    setCart((c) => {
      const next = { ...c };
      delete next[sku];
      return next;
    });
  };

  const cartEntries = Object.entries(cart).filter(([, n]) => n > 0);
  const totalPrice = cartEntries.reduce((sum, [sku, packs]) => {
    const item = allItems.find((p) => p.sku === sku);
    return sum + (item ? (item.pricePerPack ?? item.unitPrice ?? 20) * packs : 0);
  }, 0);

  const checkout = () => {
    if (cartEntries.length === 0) {
      notify('购物车为空', 'error');
      return;
    }
    if (state.gold < totalPrice) {
      notify('金币不足', 'error');
      return;
    }
    dispatch({
      type: 'PURCHASE_CART',
      items: cartEntries.map(([sku, batches]) => ({ sku, batches })),
    });
    notify(`已结算 ${cartEntries.length} 种原料，共 ${totalPrice}💰`, 'success');
    setCart({});
  };

  const genAiItem = async () => {
    const desc = aiDesc.trim();
    if (!desc) {
      notify('请描述你想采购的物品', 'error');
      return;
    }
    if (state.gold < AI_GENERATION_GOLD_COST) {
      notify(`使用 AI 生成采购物料需 ${AI_GENERATION_GOLD_COST}💰`, 'error');
      return;
    }
    const categoryLock = procurementCategoryFromDescription(desc);
    const lockHint = categoryLock
      ? `【重要】玩家描述指定只要「${categoryLock}」类原料：items 中三个对象的 category 必须全部为「${categoryLock}」，且 sku 与设定须符合该类。`
      : '未指定单一类别时，三件可来自不同大类，但三项 sku 必须互不相同、各有特色、定价合理。';

    setAiLoading(true);
    try {
      const text = await chatComplete(
        [
          {
            role: 'system',
            content:
              '你是面包店采购顾问。根据玩家描述一次生成恰好 3 种可采购的烘焙原料备选，输出纯 JSON，不要 markdown。'
              + '格式：{"items":[{"sku":"简称","category":"面粉|液体|酵母|辅料|风味|馅料","weightPerPack":每袋克数,"pricePerPack":每袋金币,"shelfLife":保质天数,"needsCold":布尔}, 重复结构共3个]}。'
              + 'items 长度必须为 3；三件 sku 互不相同。weightPerPack：面粉约1000、酵母约100、风味料约50 等需合理。'
              + '【语言】三个 sku 字段必须为简短简体中文名称（可含数字），禁止使用英文、拼音、日文、韩文或纯拉丁字母；不要用英文括号里的翻译。',
          },
          { role: 'user', content: `玩家需求：${desc}\n${lockHint}` },
        ],
        { temperature: 0.72, max_tokens: 900 },
      );
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('无法解析');
      const data = JSON.parse(m[0]);
      let rawItems = Array.isArray(data.items) ? data.items : data.sku ? [data] : [];
      if (rawItems.length < 3) throw new Error('AI 返回不足 3 种，请重试');
      rawItems = rawItems.slice(0, 3);
      const items = rawItems.map((row, idx) => normalizeAiProcurementItem(row, categoryLock, idx));
      const skus = items.map((x) => x.sku);
      if (new Set(skus).size !== skus.length) throw new Error('三款名称有重复，请重试');
      for (const it of items) {
        if (!skuMustBeChineseName(it.sku)) throw new Error('商品名称须为中文，请重试');
      }
      dispatch({ type: 'SPEND_GOLD', amount: AI_GENERATION_GOLD_COST });
      setAiCandidates(items);
      setAiPickMask([true, true, true]);
      notify(`已生成 3 款备选（已支付 ${AI_GENERATION_GOLD_COST}💰），勾选后加入采购目录`, 'success');
      setAiDesc('');
    } catch (e) {
      notify(e.message || 'AI 生成失败', 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const commitAiCandidates = () => {
    if (!aiCandidates?.length) return;
    const chosen = aiCandidates.filter((_, i) => aiPickMask[i]);
    if (chosen.length === 0) {
      notify('请至少勾选一项再加入采购目录', 'error');
      return;
    }
    const custom = state.customProcurementItems || [];
    const toAdd = [];
    const skipped = [];
    for (const item of chosen) {
      if (procurementItems.some((p) => p.sku === item.sku) || custom.some((x) => x.sku === item.sku)) {
        skipped.push(item.sku);
      } else {
        toAdd.push(item);
      }
    }
    if (skipped.length > 0) {
      notify(`以下与现有目录重名，已跳过：${skipped.join('、')}`, 'error');
    }
    if (toAdd.length === 0) {
      if (skipped.length === 0) notify('没有可加入的新原料', 'error');
      return;
    }
    dispatch({ type: 'ADD_CUSTOM_PROCUREMENT_ITEMS_BATCH', items: toAdd });
    notify(`已将 ${toAdd.length} 种原料加入采购目录`, 'success');
    setAiCandidates(null);
    setAiPickMask([true, true, true]);
  };

  const dismissAiCandidates = () => {
    setAiCandidates(null);
    setAiPickMask([true, true, true]);
  };

  const activeCategoryLabel = PROCUREMENT_CATEGORIES.find((c) => c.id === category)?.label ?? category;

  const removeAiProcurementSku = (sku) => {
    if (!window.confirm(`从采购目录移除「${sku}」？已有库存仍会保留，但无法再购入该 SKU。`)) return;
    dispatch({ type: 'REMOVE_CUSTOM_PROCUREMENT_BY_SKUS', skus: [sku] });
    removeFromCart(sku);
    notify(`已从目录移除「${sku}」`, 'success');
  };

  return (
    <div className="page-view panel procurement-supermarket-page">
      <div className="page-view-head procurement-market-head">
        <div className="procurement-head-row">
          <h2>🛒 超市采购</h2>
          <div className="procurement-head-actions">
            <button
              type="button"
              className="btn btn-tiny btn-secondary"
              onClick={() => { setCategory('all'); setSearchKeyword(''); setShelfModalOpen(true); }}
            >
              📋 浏览全部
            </button>
            <button type="button" className="btn btn-tiny btn-secondary" onClick={() => navigateTo(PAGE_IDS.gameBakery)}>
              🥖 回面包房
            </button>
            <button type="button" className="btn btn-tiny btn-secondary" onClick={() => navigateTo(PAGE_IDS.hub)}>
              🏠 主页
            </button>
          </div>
        </div>
        <p className="drawer-hint">
          点击卖场图上的分区光标，在弹窗中浏览该加购。「全部」含内置与全部自定义；各常规货架不含 AI 生成品，请用「AI生成」分区查看、加购或删除目录项。上方 AI 一次 3 种备选（每次 {AI_GENERATION_GOLD_COST}💰），勾选后加入目录。购物车可拖动与缩放；点「前台结账」统一结算。
        </p>
      </div>

      <div className="proc-ai-section proc-ai-section--above-market bakery-card-decor-host">
        <CardBreadDecor seed="procurement-ai-gen" variant="chrome" />
        <h4 className="drawer-subtitle">✨ AI 生成新物品（每次 {AI_GENERATION_GOLD_COST}💰，一次 3 种备选）</h4>
        <textarea
          className="drawer-input"
          value={aiDesc}
          onChange={(e) => setAiDesc(e.target.value)}
          placeholder="描述你想要采购的物品；若写明种类（如「高筋面粉」「馅料」）则仅生成该类的三种…"
          rows={2}
          lang="zh-CN"
          inputMode="text"
        />
        <div className="proc-ai-actions-row">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={aiLoading || state.gold < AI_GENERATION_GOLD_COST}
            onClick={genAiItem}
          >
            {aiLoading ? '生成中…' : `生成 3 款备选（${AI_GENERATION_GOLD_COST}💰）`}
          </button>
          {aiCandidates && (
            <button type="button" className="btn btn-tiny btn-secondary" onClick={dismissAiCandidates}>
              放弃本次结果
            </button>
          )}
        </div>
        {aiCandidates && (
          <div className="proc-ai-candidate-panel">
            <p className="drawer-hint" style={{ marginBottom: 10 }}>勾选要加入超市采购目录的项目（可与目录重名的项在确认时会跳过）：</p>
            <ul className="proc-ai-candidate-list">
              {aiCandidates.map((it, i) => {
                const dupBase = procurementItems.some((p) => p.sku === it.sku);
                const dupCustom = (state.customProcurementItems || []).some((x) => x.sku === it.sku);
                return (
                  <li key={`${it.sku}-${i}`} className="proc-ai-candidate-row">
                    <label className="proc-ai-candidate-label">
                      <input
                        type="checkbox"
                        checked={aiPickMask[i]}
                        onChange={(e) => {
                          const next = [...aiPickMask];
                          next[i] = e.target.checked;
                          setAiPickMask(next);
                        }}
                      />
                      <span className="proc-ai-candidate-body">
                        <strong>{it.sku}</strong>
                        <span className="proc-ai-candidate-meta">
                          {it.category} · {it.weightPerPack}g/袋 · {it.pricePerPack}💰 · 保质{it.shelfLife}天
                          {it.needsCold ? ' · 需冷藏' : ''}
                          {(dupBase || dupCustom) ? ' · ⚠ 与目录重名' : ''}
                        </span>
                      </span>
                      <IngredientThumb
                        name={it.sku}
                        size="sm"
                        aiTintCategory={it.category}
                        aiTintVariant={it.aiVisualVariant}
                      />
                    </label>
                  </li>
                );
              })}
            </ul>
            <button type="button" className="btn btn-primary" onClick={commitAiCandidates}>
              将勾选加入采购目录
            </button>
          </div>
        )}
      </div>

      <div className="proc-market-stage-wrap">
        <div className="store-floor-stage proc-market-stage">
          <img
            className="store-floor-bg"
            src={PROCUREMENT_MARKET_IMAGE_URL}
            alt="超市"
            loading="eager"
            decoding="async"
          />
          <div className="store-floor-hotspots">
            {PROCUREMENT_SHELF_HOTSPOTS.map((h, idx) => (
              <button
                key={`${h.kind}-${h.label}-${idx}`}
                type="button"
                className={`store-floor-hotspot pixel-scene-nav-btn proc-market-hotspot${
                  h.kind === 'category' && shelfModalOpen && category === h.categoryId ? ' is-shelf-active' : ''
                }`}
                style={{
                  left: `${h.leftPct}%`,
                  top: `${h.topPct}%`,
                  '--label-bg': h.labelBg,
                  '--label-fg': h.labelFg,
                  '--dot-border': h.dotBorder || '#141414',
                }}
                onClick={() => {
                  if (h.kind === 'checkout') checkout();
                  else {
                    setCategory(h.categoryId);
                    setShelfModalOpen(true);
                  }
                }}
                title={h.kind === 'checkout' ? '统一结算（购物车需有物品）' : `打开${h.label}货架`}
              >
                <PixelMapFramedLabel
                  seedKey={`${h.kind}-${h.label}-${idx}`}
                  frameUrl={procFrameUrls[idx]}
                >
                  {h.label}
                </PixelMapFramedLabel>
              </button>
            ))}
          </div>
        </div>
      </div>

      {shelfModalOpen && (
        <Modal
          wide
          title={`🛒 ${activeCategoryLabel}`}
          onClose={() => setShelfModalOpen(false)}
          footer={(
            <button type="button" className="btn btn-secondary" onClick={() => setShelfModalOpen(false)}>
              关闭返回卖场
            </button>
          )}
        >
          <div className="procurement-shelf-modal-body bakery-card-decor-host">
            <CardBreadDecor seed={`procurement-modal-${category}`} variant="chrome" countMin={1} countMax={2} />
            <div className="proc-header-row proc-market-inline-tools">
              <span className="proc-current-shelf-label">
                在弹窗中加购后，购物车与各处分账同步。
              </span>
              {category !== '器械' && (
                <input
                  type="text"
                  className="proc-search drawer-input"
                  placeholder="🔍 名称、类别、克数、价格、保质期、冷藏…"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                />
              )}
            </div>
            {category === '器械' ? (
              <div className="proc-equipment">
                <h4 className="drawer-subtitle">器械区</h4>
                <ul className="equip-list">
                  {equipmentCatalog.map((e) => (
                    <li key={e.id}>
                      <strong>{e.name}</strong> — {e.desc}
                      <span className="equip-price">{e.price}💰</span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-tiny"
                        disabled={state.gold < e.price || (e.id === 'freezer' && !state.equipment?.fridge) || !!state.equipment?.[e.id]}
                        onClick={() => { dispatch({ type: 'BUY_EQUIPMENT', id: e.id }); notify(`已购买 ${e.name}`, 'success'); }}
                      >
                        {state.equipment?.[e.id] ? '已购' : '购买'}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="proc-grid proc-grid--modal">
                {filteredItems.length === 0 ? (
                  <p className="drawer-hint" style={{ gridColumn: '1/-1' }}>
                    {searchKeyword.trim() ? `未找到匹配「${searchKeyword}」的原料` : '该货架暂无SKU'}
                  </p>
                ) : filteredItems.map((p) => {
                  const w = p.weightPerPack ?? p.batchQty ?? 100;
                  const price = p.pricePerPack ?? p.unitPrice ?? 20;
                  return (
                    <div key={p.sku} className="proc-card bakery-card-decor-host">
                      <CardBreadDecor seed={`proc-${p.sku}`} />
                      <IngredientThumb
                        name={p.sku}
                        size="lg"
                        aiTintCategory={aiTintCategoryForProcRow(p)}
                        aiTintVariant={aiTintVariantForProcRow(p)}
                      />
                      <div className="proc-card-name">{p.sku}</div>
                      <div className="proc-card-meta">
                        {w}克/袋 · {price}💰/袋 · 保质 {p.shelfLife} 天{p.needsCold ? ' · 冷藏' : ''}
                      </div>
                      <div className="proc-card-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-tiny"
                          onClick={() => addToCart(p.sku, 1)}
                        >
                          加购 1 袋
                        </button>
                        {category === 'ai' && p.aiGenerated && (
                          <button
                            type="button"
                            className="btn btn-tiny btn-accent"
                            title="从超市采购目录中移除（不影响已有库存）"
                            onClick={() => removeAiProcurementSku(p.sku)}
                          >
                            删除
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Modal>
      )}

      <FloatingShopCart title="🛒 购物车">
        <CardBreadDecor seed="procurement-cart-float" variant="chrome" countMin={1} countMax={2} />
        {cartEntries.length === 0 ? (
          <p className="drawer-hint floating-cart-empty">点击卖场分区打开弹窗货架后「加购」</p>
        ) : (
          <>
            <ul className="cart-list floating-cart-list">
              {cartEntries.map(([sku, packs]) => {
                const it = allItems.find((p) => p.sku === sku);
                const w = it?.weightPerPack ?? it?.batchQty ?? 100;
                const price = it ? (it.pricePerPack ?? it.unitPrice ?? 20) * packs : 0;
                const totalG = w * packs;
                return (
                  <li key={sku}>
                    <span className="cart-line-main" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <IngredientThumb
                        name={sku}
                        size="sm"
                        aiTintCategory={aiTintCategoryForProcRow(it)}
                        aiTintVariant={aiTintVariantForProcRow(it)}
                      />
                      <span>{sku} ×{packs} 袋 ({totalG}克)</span>
                    </span>
                    <span>{price}💰</span>
                    <button type="button" className="btn btn-tiny" onClick={() => removeFromCart(sku)}>移除</button>
                  </li>
                );
              })}
            </ul>
            <div className="cart-total floating-cart-total">
              <strong>合计 {totalPrice}💰</strong>
              <button
                type="button"
                className="btn btn-primary btn-tiny"
                disabled={state.gold < totalPrice || cartEntries.length === 0}
                onClick={checkout}
                title="与卖场「前台结账」相同"
              >
                前台结账
              </button>
            </div>
          </>
        )}
      </FloatingShopCart>
    </div>
  );
}

export function FillingLabPage() {
  const { state, dispatch, notify } = useGame();
  const lots = state.inventory?.lots || [];
  const qty = (sku) => totalQtyForSku(lots, sku);

  const staticIngredients = [...(ingredients.风味 || []), ...(ingredients.馅料 || [])].filter(
    (x) => x.name && x.name !== '无添加' && x.name !== '无馅料',
  );
  const staticNames = new Set(staticIngredients.map((x) => x.name));
  const aiFillingItems = (state.customProcurementItems || [])
    .filter(
      (item) =>
        (item.category === '风味' || item.category === '馅料') &&
        item.sku &&
        !staticNames.has(item.sku),
    )
    .map((item) => ({
      name: item.sku,
      aiGenerated: true,
      category: item.category,
      aiVisualVariant: item.aiVisualVariant,
    }));
  const pool = [...staticIngredients, ...aiFillingItems];
  const [picked, setPicked] = useState([]);
  const [weights, setWeights] = useState({}); // { "红豆沙": 50 }
  const [method, setMethod] = useState('搅拌混合');
  const [loading, setLoading] = useState(false);

  const toggle = (name) => {
    setPicked((p) => {
      if (p.includes(name)) {
        setWeights((w) => {
          const n = { ...w };
          delete n[name];
          return n;
        });
        return p.filter((x) => x !== name);
      }
      if (p.length >= 5) return p;
      const stock = qty(name);
      const def = Math.min(120, Math.max(1, Math.floor(stock)));
      setWeights((w) => ({ ...w, [name]: w[name] != null && Number(w[name]) > 0 ? w[name] : def }));
      return [...p, name];
    });
  };

  const totalWeight = picked.reduce((s, n) => s + (Number(weights[n]) || 0), 0);

  const craftAI = async () => {
    if (picked.length < 2) {
      notify('至少选 2 种原料', 'error');
      return;
    }
    const missingWeight = picked.filter((n) => !(weights[n] != null && Number(weights[n]) > 0));
    if (missingWeight.length > 0) {
      notify(`请填写以下原料的用量（克）：${missingWeight.join('、')}`, 'error');
      return;
    }
    for (const name of picked) {
      const need = weights[name];
      if (qty(name) < need) {
        notify(`${name} 库存不足（需${need}克），请先去采购`, 'error');
        return;
      }
    }
    setLoading(true);
    try {
      const text = await chatComplete(
        [
          {
            role: 'system',
            content: '你是烘焙馅料研发师，只输出一段合法 JSON，不要 markdown。格式：{"name":"馅料名","description":"50字内风味描述","baseAttr":{"甜度":0-8,"柔软度":0-8,"香气":0-8,"复杂度":0-8}}',
          },
          {
            role: 'user',
            content: `玩家选用原料：${picked.join('、')}。处理方式：${method}。请生成馅料 JSON。`,
          },
        ],
        { temperature: 0.85, max_tokens: 400 },
      );
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('无法解析 JSON');
      const data = JSON.parse(m[0]);
      const id = `fill_${Date.now()}`;
      const baseAttr = {
        甜度: Math.min(8, Math.max(0, Number(data.baseAttr?.甜度) || 3)),
        柔软度: Math.min(8, Math.max(0, Number(data.baseAttr?.柔软度) || 2)),
        香气: Math.min(8, Math.max(0, Number(data.baseAttr?.香气) || 3)),
        复杂度: Math.min(8, Math.max(0, Number(data.baseAttr?.复杂度) || 2)),
      };
      const weightG = Math.max(50, totalWeight);
      dispatch({
        type: 'ADD_CRAFTED_FILLING',
        filling: {
          id,
          name: data.name || '手工馅料',
          description: data.description || '',
          baseAttr,
          sourceIngredients: picked,
          method,
        },
        sourceIngredients: picked,
        sourceWeights: weights,
        weightG,
      });
      notify(`馅料「${data.name}」已保存`, 'success');
    } catch (e) {
      notify(e.message || 'AI 制备失败，请检查设置', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-view panel">
      <div className="page-view-head">
        <h2>🥣 馅料</h2>
        <p className="drawer-hint">从风味与馅料类原料中多选，设定手法后由 AI 生成馅料属性与描述。</p>
      </div>
      <div className="page-view-body bakery-card-decor-host">
        <CardBreadDecor seed="page-filling-lab" variant="chrome" />
        <p className="drawer-hint">馅料原料需采购，可自定义每种克数；总重量由加入物品重量计算；保质期 7 天。</p>
        <div className="chip-grid">
          {pool.map((x) => {
            const stock = qty(x.name);
            const disabled = stock < 1 && !picked.includes(x.name);
            const maxG = Math.max(1, Math.floor(stock));
            const wNum = Number(weights[x.name]);
            const sliderVal = picked.includes(x.name)
              ? Math.min(maxG, Math.max(1, Number.isFinite(wNum) && wNum > 0 ? Math.round(wNum) : Math.min(120, maxG)))
              : 1;
            return (
              <span key={x.name} className="chip-with-amount chip-with-amount-filling-lab">
                <button
                  type="button"
                  className={`chip-btn${picked.includes(x.name) ? ' on' : ''}`}
                  disabled={disabled}
                  onClick={() => !disabled && toggle(x.name)}
                  title={stock < 1 ? '库存不足' : `库存 ${stock}`}
                >
                  <IngredientThumb
                    name={x.name}
                    size="sm"
                    aiTintCategory={x.aiGenerated ? x.category : null}
                    aiTintVariant={x.aiGenerated ? x.aiVisualVariant : undefined}
                  />
                  <span>{x.aiGenerated ? '✨' : ''}{x.name}({stock})</span>
                </button>
                {picked.includes(x.name) && (
                  <span className="filling-lab-slider-wrap">
                    <input
                      type="range"
                      min={1}
                      max={maxG}
                      step={1}
                      value={sliderVal}
                      aria-label={`${x.name} 用量`}
                      onChange={(e) => setWeights((w) => ({ ...w, [x.name]: Number(e.target.value) }))}
                    />
                    <span className="filling-lab-slider-meta">
                      用量 <strong>{sliderVal}</strong> g · 库存 {stock % 1 === 0 ? stock : Math.round(stock * 10) / 10} g
                    </span>
                  </span>
                )}
              </span>
            );
          })}
        </div>
        {picked.length > 0 && <p className="drawer-hint">总重量约 {totalWeight}g</p>}
        <label className="drawer-label">处理方式</label>
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option>搅拌混合</option>
          <option>小火熬煮</option>
          <option>奶油打发折叠</option>
          <option>冷腌静置</option>
        </select>
        <button type="button" className="btn btn-primary" disabled={loading} onClick={craftAI}>
          {loading ? 'AI 制备中…' : '✨ AI 制备馅料'}
        </button>
        {state.craftedFillings?.length > 0 && (
          <div className="crafted-list">
            <h4>已保存馅料</h4>
            <ul>
              {state.craftedFillings
                .filter((f) => !f.expiresOnDay || f.expiresOnDay > state.day)
                .map((f) => (
                  <li key={f.id}>
                    <strong>{f.name}</strong> {f.weightG}g
                    {f.expiresOnDay && ` · 剩${f.expiresOnDay - state.day}天`}
                    — {f.description?.slice(0, 35)}…
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function RecipesPage() {
  const { state, dispatch } = useGame();
  const { pinRecipe, pinnedRecipe } = useUI();
  const savedRecipes = state.recipes || [];
  const [recipeTab, setRecipeTab] = useState('classic');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === savedRecipes.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(savedRecipes.map((r) => r.id)));
  };
  const deleteSelected = () => {
    if (selectedIds.size === 0) return;
    dispatch({ type: 'REMOVE_CUSTOM_RECIPES', ids: [...selectedIds] });
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const enterSelectionMode = () => setSelectionMode(true);
  const exitSelectionMode = () => { setSelectionMode(false); setSelectedIds(new Set()); };

  return (
    <div className="page-view panel">
      <div className="page-view-head">
        <h2>📜 配方</h2>
        <p className="drawer-hint">经典配方与 AI 配方均可固定为悬浮窗，方便制作时参考。</p>
      </div>
      <div className="page-view-body bakery-card-decor-host">
        <CardBreadDecor seed="page-recipes" variant="chrome" />
        <div className="proc-header-row">
          <div className="proc-tabs recipe-tabs">
            <button type="button" className={`proc-tab${recipeTab === 'classic' ? ' on' : ''}`} onClick={() => { setRecipeTab('classic'); setSelectedIds(new Set()); setSelectionMode(false); }}>经典</button>
            <button type="button" className={`proc-tab${recipeTab === 'ai' ? ' on' : ''}`} onClick={() => setRecipeTab('ai')}>AI</button>
          </div>
          <input
            type="text"
            className="proc-search drawer-input"
            placeholder="🔍 名称、原料行、手法、模具、炉温、四维…"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
        </div>
        {recipeTab === 'classic' && (
        <>
        <h4 className="drawer-subtitle">经典配方</h4>
        <div className="recipe-grid">
          {(() => {
            const kwR = normalizeSearchKw(searchKeyword);
            const filtered = classicRecipes.filter((r) => classicRecipeMatchesKeyword(r, kwR));
            if (filtered.length === 0) return <p className="drawer-hint" style={{ gridColumn: '1/-1' }}>未找到匹配的配方</p>;
            return filtered.map((r) => (
            <div key={r.id} className="recipe-card recipe-card-classic bakery-card-decor-host">
              <CardBreadDecor seed={`recipe-classic-${r.id}`} />
              <button
                type="button"
                className={`recipe-card-pin${pinnedRecipe?.id === r.id ? ' pinned' : ''}`}
                onClick={() => pinRecipe(pinnedRecipe?.id === r.id ? null : r)}
                title={pinnedRecipe?.id === r.id ? '取消固定' : '固定配方'}
              >
                📌
              </button>
              <h5>{r.name}</h5>
              {r.stats && (
                <div className="recipe-card-stats">
                  {Object.entries(r.stats).map(([k, v]) => (
                    <span key={k} className="recipe-card-stat">{STAT_ICONS[k] || ''}{v}</span>
                  ))}
                </div>
              )}
              <p className="recipe-card-desc">{r.description}</p>
              {r.ingredientList?.length > 0 && (
                <div className="recipe-card-ingredients">
                  {r.ingredientList.map((line, i) => (
                    <span key={i} className="recipe-card-ing-line">
                      <IngredientThumb name={line} size="sm" />
                      <span className="recipe-card-ing-text">{line}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ));
          })()}
        </div>
        </>
        )}
        {recipeTab === 'ai' && (
        <>
        <h4 className="drawer-subtitle">已保存配方</h4>
        {savedRecipes.length === 0 ? (
          <p className="drawer-hint">通过研发阶段 AI 设计配方后可在此保存。</p>
        ) : (
          <>
          <div className="recipe-library-actions">
            {selectionMode ? (
              <>
                <label className="recipe-select-all">
                  <input type="checkbox" checked={selectedIds.size === savedRecipes.length} onChange={toggleSelectAll} />
                  全选
                </label>
                {selectedIds.size > 0 && (
                  <button type="button" className="btn btn-tiny btn-accent" onClick={deleteSelected}>
                    删除已选 ({selectedIds.size})
                  </button>
                )}
                <button type="button" className="btn btn-tiny btn-secondary" onClick={exitSelectionMode}>
                  取消选择
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-tiny btn-secondary" onClick={enterSelectionMode}>
                选择删除
              </button>
            )}
          </div>
          <div className={`recipe-grid${selectionMode ? ' recipe-grid-selectable' : ''}`}>
            {(() => {
              const kwR = normalizeSearchKw(searchKeyword);
              const filtered = savedRecipes.filter((r) => savedRecipeMatchesKeyword(r, kwR));
              if (filtered.length === 0) return <p className="drawer-hint" style={{ gridColumn: '1/-1' }}>未找到匹配的配方</p>;
              return filtered.map((r) => {
              const rc = rarityConfig[r.rarity] || { label: '普通' };
              const aiIngLines = getIngredientLines(r);
              return (
                <div key={r.id} className={`recipe-card recipe-card-ai bakery-card-decor-host${selectionMode && selectedIds.has(r.id) ? ' selected' : ''}`}>
                  <CardBreadDecor seed={`recipe-ai-${r.id}`} />
                  {selectionMode && (
                    <label className="recipe-card-checkbox">
                      <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} />
                      <span className="recipe-card-checkbox-visual" />
                    </label>
                  )}
                  <button
                    type="button"
                    className={`recipe-card-pin${pinnedRecipe?.id === r.id ? ' pinned' : ''}`}
                    onClick={() => pinRecipe(pinnedRecipe?.id === r.id ? null : r)}
                    title={pinnedRecipe?.id === r.id ? '取消固定' : '固定配方'}
                  >
                    📌
                  </button>
                  <div className="recipe-card-thumb">
                    <BreadCanvas recipe={r} width={48} height={48} size={12} />
                  </div>
                  <div className="recipe-card-title-row">
                    <h5>{r.name}</h5>
                    <span className={`recipe-card-rarity rarity-${r.rarity || 'common'}`}>{rc.label}</span>
                  </div>
                  {r.stats && (
                    <div className="recipe-card-stats">
                      {Object.entries(r.stats).map(([k, v]) => (
                        <span key={k} className="recipe-card-stat">{STAT_ICONS[k] || ''}{v}</span>
                      ))}
                    </div>
                  )}
                  <p className="recipe-card-desc">{r.shortDesc || r.description?.slice(0, 50)}</p>
                  {aiIngLines.length > 0 && (
                    <div className="recipe-card-ingredients">
                      {aiIngLines.map((line, i) => (
                        <span key={i} className="recipe-card-ing-line">
                          <IngredientThumb name={line} size="sm" />
                          <span className="recipe-card-ing-text">{line}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            });
            })()}
          </div>
          </>
        )}
        </>
        )}
      </div>
    </div>
  );
}

export function ExplorationPage() {
  const { state } = useGame();
  const exploredMoldIds = new Set(state.exploredMoldIds || []);
  const synergyRows = (state.exploredSynergyNames || [])
    .map((n) => getSynergyDefinitionByName(n))
    .filter(Boolean);
  const moldRows = breadMolds.filter((m) => exploredMoldIds.has(m.id));

  return (
    <div className="page-view panel">
      <div className="page-view-head">
        <h2>🔭 探索</h2>
        <p className="drawer-hint">出炉上架或把面包交给客人时，会记录当次触发的协同：原料两两组合、原料×模具、原料×手法、模具×手法（含加成分数值可能为负的「翻车型」协同）。</p>
      </div>
      <div className="page-view-body bakery-card-decor-host">
        <CardBreadDecor seed="page-explore" variant="chrome" />
        <section className="explore-section">
          <h3>协同效应</h3>
          {synergyRows.length === 0 ? (
            <p className="explore-empty">尚未在成品中触发过协同。尝试原料组合并在面包房烘焙上架即可收录。</p>
          ) : (
            <ul className="explore-list">
              {synergyRows.map((s) => (
                <li
                  key={s.name}
                  className={`explore-card bakery-card-decor-host${bonusHasNegative(s.bonus) ? ' explore-card--neg-syn' : ''}`}
                >
                  <CardBreadDecor seed={`explore-syn-${s.name}`} />
                  <div className="explore-card-title">{s.name}</div>
                  {s.kind === 'pair' && (
                    <div className="explore-card-meta explore-combo-row">
                      <span>组合：</span>
                      {s.combo.map((n) => (
                        <span key={n} className="explore-combo-item">
                          <IngredientThumb name={n} size="sm" />
                          {n}
                        </span>
                      ))}
                    </div>
                  )}
                  {s.kind === 'ingredient_mold' && (() => {
                    const m = breadMolds.find((x) => x.id === s.moldId);
                    return (
                      <div className="explore-card-meta explore-combo-row">
                        <span>原料 × 模具：</span>
                        <span className="explore-combo-item">
                          <IngredientThumb name={s.ingredient} size="sm" />
                          {s.ingredient}
                        </span>
                        <span className="explore-combo-item">{m ? `${m.icon} ${m.name}` : s.moldId}</span>
                      </div>
                    );
                  })()}
                  {s.kind === 'ingredient_technique' && (() => {
                    const t = bakeTechniques.find((x) => x.id === s.techniqueId);
                    return (
                      <div className="explore-card-meta explore-combo-row">
                        <span>原料 × 手法：</span>
                        <span className="explore-combo-item">
                          <IngredientThumb name={s.ingredient} size="sm" />
                          {s.ingredient}
                        </span>
                        <span className="explore-combo-item">{t?.name || s.techniqueId}</span>
                      </div>
                    );
                  })()}
                  {s.kind === 'mold_technique' && (() => {
                    const m = breadMolds.find((x) => x.id === s.moldId);
                    const t = bakeTechniques.find((x) => x.id === s.techniqueId);
                    return (
                      <div className="explore-card-meta explore-combo-row">
                        <span>模具 × 手法：</span>
                        <span className="explore-combo-item">{m ? `${m.icon} ${m.name}` : s.moldId}</span>
                        <span className="explore-combo-item">{t?.name || s.techniqueId}</span>
                      </div>
                    );
                  })()}
                  <div className="explore-card-meta">{formatStatBonus(s.bonus)}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="explore-section">
          <h3>模具加成</h3>
          {moldRows.length === 0 ? (
            <p className="explore-empty">尚未使用过需记录的模具。在研发中选择模具后完成烘焙即可收录。</p>
          ) : (
            <ul className="explore-list">
              {moldRows.map((m) => (
                <li key={m.id} className="explore-card bakery-card-decor-host">
                  <CardBreadDecor seed={`explore-mold-${m.id}`} />
                  <div className="explore-card-title">{m.icon} {m.name}</div>
                  <div className="explore-card-meta">成品类型：{m.breadType} · 单模约 {m.volumeG}g</div>
                  <div className="explore-card-meta">{formatStatBonus(m.bonus)}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export function StoryPage({ embeddedInWorkshop = false } = {}) {
  const { state, dispatch } = useGame();
  const { activePage } = useUI();
  const { setBgmOverride } = useBgm();
  const [viewingIdx, setViewingIdx] = useState(null);
  const completedUpTo = state.mainStoryCompletedUpTo ?? -1;
  const choices = state.storyChoices || {};
  const ending = computeEndingId(choices);

  const viewingChapter = viewingIdx != null ? mainStoryChapters[viewingIdx] : null;
  const viewingBg = viewingIdx != null ? MAIN_STORY_BG_BY_CHAPTER[viewingIdx] || '' : '';

  useEffect(() => {
    if (embeddedInWorkshop) {
      if (viewingIdx == null) {
        setBgmOverride(null);
        return;
      }
      setBgmOverride(getMainStoryChapterBgmTrackId(viewingIdx));
      return;
    }
    if (activePage !== PAGE_IDS.story) {
      if (activePage !== PAGE_IDS.workshop) {
        setBgmOverride(null);
      }
      return;
    }
    if (viewingIdx == null) {
      setBgmOverride(null);
      return;
    }
    setBgmOverride(getMainStoryChapterBgmTrackId(viewingIdx));
  }, [embeddedInWorkshop, activePage, viewingIdx, setBgmOverride]);

  useEffect(() => () => embeddedInWorkshop && setBgmOverride(null), [embeddedInWorkshop, setBgmOverride]);

  return (
    <div className="page-view panel story-panel">
      <div className="page-view-head">
        <h2>📖 主线剧情 · 十章 + 尾声</h2>
        <p className="drawer-hint">
          点击章节横条进入全屏对话（底图 + 主要角色发言时单侧立绘 + 下方对话框）。解锁条件见各章说明；读毕在结尾标记「本章已读」。已完成：{Math.max(0, completedUpTo + 1)} / {mainStoryChapters.length}。
        </p>
      </div>
      <div className="page-view-body bakery-story-page-body bakery-card-decor-host">
        <CardBreadDecor seed={`page-story-hub-${state.day}`} variant="chrome" />
        <div className="bakery-chapter-strip">
          {mainStoryChapters.map((c, i) => {
            const ok = isMainStoryChapterUnlocked(i, state);
            const done = completedUpTo >= i;
            const cardBg = MAIN_STORY_BG_BY_CHAPTER[i];
            return (
              <div
                key={c.id}
                className={`bakery-chapter-card${ok ? ' unlocked' : ' locked'}${done ? ' done' : ''}`}
                style={cardBg ? { '--bakery-chapter-bg': `url(${cardBg})` } : undefined}
                role={ok ? 'button' : undefined}
                tabIndex={ok ? 0 : -1}
                onClick={() => ok && setViewingIdx(i)}
                onKeyDown={(e) => {
                  if (ok && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    setViewingIdx(i);
                  }
                }}
              >
                {cardBg ? <div className="bakery-chapter-card-bg" aria-hidden /> : null}
                <div className="bakery-chapter-card-content">
                  <h4>{c.title}</h4>
                  {!ok ? (
                    <>
                      <p className="bakery-chapter-quest">{c.quest.desc}</p>
                      <p className="bakery-chapter-locked">未解锁 · 完成主线任务与上一章「已读」后可进入</p>
                    </>
                  ) : (
                    <p className="bakery-chapter-hint">{done ? '✓ 已读 · 可重温' : '点击进入剧情'}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="story-meta">
          <p>
            当前结局倾向：<strong>{endingDescriptions[ending] || ending}</strong>
          </p>
        </div>
      </div>

      <BakeryRPGDialogueView
        open={viewingIdx != null}
        onClose={() => setViewingIdx(null)}
        title={viewingChapter?.title || ''}
        bgUrl={viewingBg}
        chapter={viewingChapter}
        chapterIndex={viewingIdx ?? -1}
        completedUpTo={completedUpTo}
        storyChoices={choices}
        dispatch={dispatch}
        variant="chapter"
      />
    </div>
  );
}

export function CharactersPage({ embeddedInWorkshop = false } = {}) {
  const { state, dispatch } = useGame();
  const { activePage } = useUI();
  const { setBgmOverride } = useBgm();
  const [openArchive, setOpenArchive] = useState(null);

  const arc = openArchive ? characterArchiveStories.find((a) => a.archiveId === openArchive) : null;
  const arcUnlocked = arc?.quest.done(state);
  const arcDialogueChapter =
    arcUnlocked && arc ? { id: arc.archiveId, beats: arc.beats, synopsis: arc.synopsis } : null;

  useEffect(() => {
    if (embeddedInWorkshop) {
      if (!openArchive || !arc || !arcUnlocked || !arc.bgmTrackId) {
        setBgmOverride(null);
        return;
      }
      setBgmOverride(arc.bgmTrackId);
      return;
    }
    if (activePage !== PAGE_IDS.characters) {
      if (activePage !== PAGE_IDS.workshop) {
        setBgmOverride(null);
      }
      return;
    }
    if (!openArchive || !arc || !arcUnlocked || !arc.bgmTrackId) {
      setBgmOverride(null);
      return;
    }
    setBgmOverride(arc.bgmTrackId);
  }, [embeddedInWorkshop, activePage, openArchive, arc, arcUnlocked, setBgmOverride]);

  useEffect(() => () => embeddedInWorkshop && setBgmOverride(null), [embeddedInWorkshop, setBgmOverride]);

  return (
    <div className="page-view panel">
      <div className="page-view-head">
        <h2>👥 人物志与档案</h2>
        <p className="drawer-hint">阅读「人物志」需满足解锁条件；与主线相同的 RPG 对话形式。</p>
      </div>
      <div className="page-view-body char-list bakery-card-decor-host">
        <CardBreadDecor seed="page-characters" variant="chrome" />
        {characters.map((c) => {
          const story = getArchiveStoryForCharacter(c.name);
          const u = story?.quest.done(state);
          return (
            <article key={c.name} className="char-card">
              <h4>{c.name}</h4>
              <span className="char-role">
                {c.role}
                {c.age ? ` · ${c.age}` : ''}
              </span>
              {c.lines.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
              {story ? (
                <div className="char-archive-actions">
                  <p className={`archive-lock${u ? ' ok' : ''}`}>
                    {u ? '✓ 人物志已解锁' : `🔒 ${story.quest.desc}`}
                  </p>
                  <button
                    type="button"
                    className="btn btn-secondary btn-tiny"
                    disabled={!u}
                    onClick={() => setOpenArchive(story.archiveId)}
                  >
                    阅读人物志
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {arc && arcDialogueChapter ? (
        <BakeryRPGDialogueView
          variant="archive"
          open
          onClose={() => setOpenArchive(null)}
          title={arc.title}
          bgUrl={arc.dialogueBgUrl || './images/底图.jpg'}
          chapter={arcDialogueChapter}
          chapterIndex={-1}
          completedUpTo={-1}
          storyChoices={{}}
          dispatch={dispatch}
        />
      ) : null}
    </div>
  );
}

export function SettingsPage() {
  const [s, setS] = useState(() => loadAISettings());
  const [models, setModels] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const save = () => {
    saveAISettings(s);
    setMsg('已保存');
  };

  const pullModels = async () => {
    if (s.source === 'custom' && (!s.baseURL?.trim() || !s.apiKey?.trim())) {
      setMsg('请先填写端点与 API Key，并点击「保存设置」');
      return;
    }
    saveAISettings(s);
    setBusy(true);
    setMsg('');
    try {
      const list = await fetchModels();
      setModels(list);
      setMsg(`已拉取 ${list.length} 个模型`);
    } catch (e) {
      setMsg(e.message || '失败');
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    if (s.source === 'custom' && (!s.baseURL?.trim() || !s.apiKey?.trim())) {
      setMsg('请先填写端点与 API Key，并点击「保存设置」');
      return;
    }
    saveAISettings(s);
    setBusy(true);
    setMsg('');
    try {
      await testAIConnection();
      setMsg('连接成功');
    } catch (e) {
      setMsg(e.message || '失败');
    } finally {
      setBusy(false);
    }
  };


  return (
    <div className="page-view panel settings-panel">
      <div className="page-view-head">
        <h2>设置</h2>
        <p className="drawer-hint">在这里选择面包房使用的 AI 接口。</p>
      </div>
      <div className="page-view-body bakery-card-decor-host">
        <CardBreadDecor seed="page-settings" variant="chrome" />
        <h4 className="drawer-subtitle">新手引导</h4>
        <p className="drawer-hint">
          随时可从顶栏「📖 新手引导」或侧栏菜单同名字按钮重新播放主地图指引；此处亦可持续重置进度。
        </p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            resetHubOnboarding();
            setMsg('已重置：点击顶栏「主页」返回地图即可再次看到引导。');
          }}
        >
          重新显示主页新手引导
        </button>
        <h4 className="drawer-subtitle" style={{ marginTop: 20 }}>背景音乐</h4>
        <BgmPlayerCard />
        <h4 className="drawer-subtitle" style={{ marginTop: 20 }}>AI 与接口</h4>
        {hostedByMellow && <label>接口来源
          <select className="drawer-input" value={s.source} onChange={(e) => {
            const next = { ...s, source: e.target.value };
            saveAISettings(next);
            setS(next);
            setModels([]);
            setMsg('');
          }}>
            <option value="mellow">使用小手机 API</option>
            <option value="custom">游戏内单独配置</option>
          </select>
        </label>}
        {s.source === 'custom' && <>
        <label>API 端点（必须以 /v1 结尾）</label>
        <input
          className="drawer-input"
          value={s.baseURL || ''}
          placeholder="https://api.example.com/v1"
          onChange={(e) => setS({ ...s, baseURL: e.target.value })}
        />
        <label>API Key</label>
        <input
          className="drawer-input"
          type="password"
          value={s.apiKey || ''}
          placeholder="sk-..."
          onChange={(e) => setS({ ...s, apiKey: e.target.value })}
        />
        <label>模型 ID</label>
        <input
          className="drawer-input"
          value={s.model || ''}
          placeholder="gpt-4o-mini"
          onChange={(e) => setS({ ...s, model: e.target.value })}
        />
        </>}
        <div className="settings-actions">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={test}>一键测试连接</button>
          <button type="button" className="btn btn-secondary" disabled={busy || s.source === 'mellow'} onClick={pullModels}>拉取模型列表</button>
          <button type="button" className="btn btn-primary" onClick={save}>保存设置</button>
        </div>
        {s.source === 'custom' && models.length > 0 && (
          <select
            className="drawer-input"
            value={s.model || ''}
            onChange={(e) => setS({ ...s, model: e.target.value })}
          >
            {models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}
        {msg && <p className="settings-msg">{msg}</p>}
      </div>
    </div>
  );
}
