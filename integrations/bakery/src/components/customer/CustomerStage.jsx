import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import LightGameOverlay from './LightGameOverlay';
import { useGame } from '../../context/GameContext';
import { useUI, PAGE_IDS } from '../../context/UIContext';
import CustomerCard from './CustomerCard';
import Modal from '../common/Modal';
import StoreCounterScene from '../store/StoreCounterScene';
import CardBreadDecor from '../CardBreadDecor';
import { resolveCustomerPortraitUrl } from '../../data/customerPortraits';
import BreadCanvas from '../bread/BreadCanvas';
import {
  generateGuest, generateGuestsAI, getGuestCount, calculateSatisfaction,
  decideAction, generateDialogue, generateCustomRequest,
  mergeNumericRequirements,
} from '../../systems/customerEngine';
import { chatComplete } from '../../services/aiService';
import { aiDesignDoughRecipeCore, getObtainableSkuSets } from '../../systems/aiDoughDesigner';
import { getBreadPrice, getDaysLeft, getPurchaseQtyBySize } from '../../systems/breadStock';
import { recipeExistsWithSameBakeIdentity } from '../../systems/recipeBakeIdentity';
import { adjustIncomingGold } from '../../systems/economyBalance';
import { getIngredientLines, getIngredientCapsuleCategory } from '../../utils/recipePreviewDisplay';
import IngredientThumb from '../IngredientThumb';
import { AI_GENERATION_GOLD_COST } from '../../constants/aiEconomy';
import { aiTintCategoryForIngredientLine, aiTintVariantForIngredientLine } from '../../utils/procurementDisplay';

/** 婉拒顾客时扣除的声望（不会减到负数） */
const REJECT_GUEST_REP_COST = 3;

function buildLiveCustomPrompt(guest, extraDesc) {
  const reqText = guest?._customRequest?.text || '';
  const nr = mergeNumericRequirements(guest?.numericRequirements, guest?._customRequest?.requirements);
  const fp = guest?._customRequest?.flavorPreference || guest?.flavorPreference;
  const hintParts = [];
  if (nr && typeof nr === 'object') {
    for (const k of ['甜度', '柔软度', '香气', '复杂度']) {
      const r = nr[k];
      if (!r || typeof r !== 'object') continue;
      if (r.min != null) hintParts.push(`${k}倾向≥${r.min}`);
      if (r.max != null) hintParts.push(`${k}倾向≤${r.max}`);
    }
  }
  const hint = hintParts.length ? `【数值倾向】${hintParts.join('；')}。` : '';
  const flavorLine = fp
    ? `【风味偏好】希望有明显「${fp}」风味，请从可用风味原料中选接近的一款并体现在面团配方中。`
    : '';
  const ex = (extraDesc || '').trim();
  const extraLine = ex ? `【店主补充】${ex.slice(0, 120)}` : '';
  const core = [reqText, flavorLine, hint, extraLine].filter(Boolean).join('');
  return core || '好吃、适合这位客人的面包';
}

function buildCustomerSnapshot(guest) {
  if (!guest) return null;
  const nr = mergeNumericRequirements(guest.numericRequirements, guest._customRequest?.requirements);
  const flavorPreference = guest._customRequest?.flavorPreference || guest.flavorPreference;
  return {
    name: guest.name,
    numericRequirements: nr,
    flavorPreference: flavorPreference || undefined,
    personality: {
      type: guest.personality?.type,
      flavorProfile: guest.personality?.flavorProfile,
      typeData: guest.personality?.typeData,
    },
  };
}

export default function CustomerStage({ onDayEnd }) {
  const { state, dispatch, notify, checkMilestones } = useGame();
  const { pinRecipe, navigateTo } = useUI();
  const cached = state.dayGuests?.[state.day];
  const [guests, setGuests] = useState(cached || []);
  const [guestsLoading, setGuestsLoading] = useState(!cached);

  // 点灯小游戏：当日未游戏时显示覆盖层
  const showLightGame = state.dayMultiplierDay !== state.day;
  const [lightGameDone, setLightGameDone] = useState(!showLightGame);

  const handleLightGameComplete = useCallback((multiplier) => {
    dispatch({ type: 'SET_DAY_MULTIPLIER', multiplier, day: state.day });
    setLightGameDone(true);
  }, [dispatch, state.day]);

  useEffect(() => {
    if (cached && cached.length > 0) {
      setGuests(cached);
      setGuestsLoading(false);
      return;
    }
    const count = getGuestCount(state.day, state.reputation, state.currentEvent);
    let cancelled = false;
    setGuestsLoading(true);
    generateGuestsAI(count, state.day, state.reputation, state.currentEvent).then((aiGuests) => {
      if (cancelled) return;
      const g = (aiGuests && aiGuests.length >= count)
        ? aiGuests
        : Array.from({ length: count }, () => generateGuest(state.day, state.reputation, state.currentEvent));
      setGuests(g);
      dispatch({ type: 'SET_DAY_GUESTS', day: state.day, guests: g });
      setGuestsLoading(false);
    }).catch(() => {
      if (cancelled) return;
      const g = Array.from({ length: count }, () => generateGuest(state.day, state.reputation, state.currentEvent));
      setGuests(g);
      dispatch({ type: 'SET_DAY_GUESTS', day: state.day, guests: g });
      setGuestsLoading(false);
    });
    return () => { cancelled = true; };
  }, [state.day, state.reputation, state.currentEvent]); // 按游戏天数更新，同一天不重新生成
  const [guestIdx, setGuestIdx] = useState(0);
  const [current, setCurrent] = useState(null);
  const [dialogue, setDialogue] = useState('');
  const [satisfaction, setSatisfaction] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [result, setResult] = useState(null);
  const [customModal, setCustomModal] = useState(false);
  const [customDesc, setCustomDesc] = useState('');
  const [customRecipe, setCustomRecipe] = useState(null);
  const [customLoading, setCustomLoading] = useState(false);
  const [logEntries, setLogEntries] = useState([]);
  const [todayIncome, setTodayIncome] = useState(0);
  const [todayHappy, setTodayHappy] = useState(0);
  const [logOpen, setLogOpen] = useState(false);

  const storeDayRef = useRef(state.day);
  /** 游戏日切换时重置店面接待进度（首次挂载同一天不重复清空） */
  useEffect(() => {
    if (storeDayRef.current === state.day) return;
    storeDayRef.current = state.day;
    setGuestIdx(0);
    setCurrent(null);
    setDialogue('');
    setSatisfaction(null);
    setPhase('idle');
    setResult(null);
    setLogEntries([]);
    setTodayIncome(0);
    setTodayHappy(0);
  }, [state.day]);

  const nextGuest = useCallback(() => {
    if (guestIdx >= guests.length) {
      setPhase('allDone');
      return;
    }
    const g = guests[guestIdx];
    setCurrent(g);
    setDialogue(g.enterDialogue);
    setSatisfaction(null);
    setPhase('browsing');
    setResult(null);
    setGuestIdx((i) => i + 1);
    dispatch({ type: 'GUEST_VISITED' });
  }, [guestIdx, guests, dispatch]);

  const availableBreads = (state.menuRecipes || []).map((r, i) => ({ ...r, menuIndex: i }))
    .filter((r) => (r.qty ?? 1) > 0 && getDaysLeft(r, state.day) > 0);

  const buildPurchaseItems = (primaryRecipe, sat) => {
    const items = [];
    const primaryAvail = primaryRecipe.qty ?? 1;
    const primaryQty = Math.min(getPurchaseQtyBySize(primaryRecipe, primaryAvail), primaryAvail);
    items.push({ recipe: primaryRecipe, sat, menuIndex: primaryRecipe.menuIndex, qty: primaryQty });

    let total = primaryQty;
    const preferSingleSku = primaryAvail >= 8 && Math.random() < 0.42;
    const tryAddDifferent = !preferSingleSku && availableBreads.length >= 2 && (total < 3 || Math.random() < 0.55);
    if (tryAddDifferent) {
      const others = availableBreads.filter((r) => r.menuIndex !== primaryRecipe.menuIndex && (r.qty ?? 1) >= 1);
      const satisfying = others.filter((r) => calculateSatisfaction(current, r) >= 50);
      const pool = satisfying.length > 0 ? satisfying : others;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (pick) {
        const pickAvail = pick.qty ?? 1;
        const extraMax = getPurchaseQtyBySize(pick, pickAvail);
        const room = Math.max(1, 12 - total);
        const extraQty = Math.min(extraMax, pickAvail, room);
        if (extraQty >= 1) {
          items.push({ recipe: pick, sat: calculateSatisfaction(current, pick), menuIndex: pick.menuIndex, qty: extraQty });
        }
      }
    }
    return items;
  };

  const serveRecipe = (item) => {
    if (!current || phase !== 'browsing') return;
    const recipe = item;
    const sat = calculateSatisfaction(current, recipe);
    setSatisfaction(sat);
    const action = decideAction(sat);
    const ctx = sat >= 80 ? 'happy' : sat >= 50 ? 'medium' : 'unhappy';
    setDialogue(generateDialogue(current.personality, ctx));

    setTimeout(() => {
      if (action === 'buy' || action === 'negotiate') {
        const items = buildPurchaseItems(recipe, action === 'negotiate' ? Math.min(sat + 10, 85) : sat);
        if (items.length > 0) completePurchase(items);
      } else {
        setPhase('customRequest');
        const req = generateCustomRequest(current.personality);
        current._customRequest = req;
        setDialogue(`"${req.text}"`);
      }
    }, 1000);
  };

  const completePurchase = (itemsOrRecipe, satOrUndef) => {
    const items = Array.isArray(itemsOrRecipe)
      ? itemsOrRecipe
      : itemsOrRecipe && satOrUndef != null
        ? [{ recipe: itemsOrRecipe, sat: satOrUndef, menuIndex: -1, qty: 1 }]
        : [];
    if (items.length === 0) return;
    const maxSat = Math.max(...items.map((x) => x.sat));
    const repMult = state.currentEvent?.effect?.repBonus || 1;
    let totalPayment = 0;
    const names = [];
    const saleItems = [];
    for (let i = 0; i < items.length; i++) {
      const { recipe, sat, menuIndex = -1 } = items[i];
      const qtySold = items[i].qtySold ?? items[i].qty ?? 1;
      const unitPrice = getBreadPrice(recipe, state.day);
      const priceFactor = sat >= 90 ? 1.2 : sat < 60 ? 0.8 : 1;
      const payment = Math.max(5, Math.round(unitPrice * priceFactor * qtySold));
      totalPayment += payment;
      names.push(`"${recipe.name}"${qtySold > 1 ? ` x${qtySold}` : ''}`);
      saleItems.push({ menuIndex, qtySold });
    }
    if (saleItems.length === 1) {
      dispatch({ type: 'COMPLETE_SALE', gold: totalPayment, reputation: Math.round((maxSat >= 80 ? 3 : maxSat >= 60 ? 1 : -1) * repMult), satisfaction: maxSat, menuIndex: saleItems[0].menuIndex, qtySold: saleItems[0].qtySold });
    } else {
      dispatch({ type: 'COMPLETE_MULTI_SALE', items: saleItems, totalGold: totalPayment, maxSat, repMult });
    }
    const totalRep = maxSat >= 80 ? 3 : maxSat >= 60 ? 1 : -1;
    const incomeKind = saleItems.length === 1 ? 'sale' : 'multi_sale';
    const basePayment = adjustIncomingGold(state, totalPayment, incomeKind);
    const dayMult = state.dayMultiplier ?? 1.0;
    const adjustedPayment = dayMult !== 1.0 ? Math.max(1, Math.round(basePayment * dayMult)) : basePayment;
    setTodayIncome((v) => v + adjustedPayment);
    if (maxSat >= 70) setTodayHappy((v) => v + 1);

    checkMilestones();

    addLog(`✅ ${current.name} 购买了 ${names.join('、')}，+${adjustedPayment}💰`, 'success');
    setResult({
      success: true,
      icon: maxSat >= 80 ? '🎉' : '🤝',
      title: maxSat >= 80 ? '交易成功！' : '成交',
      desc: `${current.name}${maxSat >= 80 ? '非常满意地' : ''}买走了${names.join('、')}！`,
      rewards: [
        { text: `💰 +${adjustedPayment}` },
        ...(totalRep > 0 ? [{ text: `⭐ +${Math.round(totalRep * repMult)}` }] : []),
      ],
    });
    setPhase('result');
  };

  const rejectGuest = () => {
    if (!current || (phase !== 'browsing' && phase !== 'customRequest')) return;
    const loss = REJECT_GUEST_REP_COST;
    dispatch({ type: 'REJECT_CUSTOMER', repCost: loss });
    notify(`已婉拒 ${current.name}，声望 -${loss}`, 'info');
    addLog(`🚫 婉拒 ${current.name}，声望 -${loss}`, 'info');
    setResult({
      success: false,
      icon: '🚶',
      title: '已婉拒顾客',
      desc: `${current.name} 离开了店铺。`,
      rewards: [{ text: `⭐ -${loss}`, negative: true }],
    });
    setPhase('result');
  };

  const openCustom = () => {
    setCustomModal(true);
    setCustomDesc('');
    setCustomRecipe(null);
  };

  const generateCustomRecipe = () => {
    if (!current) return;
    if (state.gold < AI_GENERATION_GOLD_COST) {
      notify(`使用 AI 生成配方需 ${AI_GENERATION_GOLD_COST}💰`, 'error');
      return;
    }
    (async () => {
      setCustomLoading(true);
      setCustomRecipe(null);
      try {
        const userPrompt = buildLiveCustomPrompt(current, customDesc);
        const { flour, liquid, yeast, accessory, flavor } = getObtainableSkuSets(state);
        const av = { flour, liquid, yeast, accessory, flavor };
        const { recipe } = await aiDesignDoughRecipeCore({
          userPrompt,
          av,
          excludeHint: '',
          chatComplete,
        });
        setCustomRecipe(recipe);
        dispatch({ type: 'SPEND_GOLD', amount: AI_GENERATION_GOLD_COST });
        notify(`AI 面团已生成（已支付 ${AI_GENERATION_GOLD_COST}💰）`, 'success');
      } catch (e) {
        notify(e?.message || 'AI 生成失败，请检查采购目录是否有面粉/液体/酵母', 'error');
      } finally {
        setCustomLoading(false);
      }
    })();
  };

  const goPendingAndBakery = () => {
    const snap = buildCustomerSnapshot(current);
    dispatch({ type: 'SET_PENDING_CUSTOM_ORDER', order: { recipe: customRecipe, customerSnapshot: snap } });
    setCustomModal(false);
    navigateTo(PAGE_IDS.gameBakery);
    notify('已接单，请在面包房按固定/配方完成制作，出炉后点「端给等待的客人」', 'info');
  };

  const saveCustomToLibrary = () => {
    if (!customRecipe) return;
    if (recipeExistsWithSameBakeIdentity(state.recipes, customRecipe)) {
      notify('配方库已有相同面团配置', 'info');
      return;
    }
    dispatch({ type: 'ADD_CUSTOM_RECIPE', recipe: customRecipe });
    notify('已存入配方库', 'success');
  };

  const pinSaveAndGo = () => {
    if (!customRecipe) return;
    pinRecipe(customRecipe);
    if (!recipeExistsWithSameBakeIdentity(state.recipes, customRecipe)) {
      dispatch({ type: 'ADD_CUSTOM_RECIPE', recipe: customRecipe });
    }
    goPendingAndBakery();
  };

  const afterResult = () => {
    setCurrent(null);
    setResult(null);
    setSatisfaction(null);
    if (guestIdx >= guests.length) setPhase('allDone');
    else setPhase('idle');
  };

  const addLog = (text, type) => setLogEntries(e => [{ text, type, id: Date.now() }, ...e]);

  const renderCabinetBody = () => (
    <div className="cabinet-grid store-modal-cabinet">
      {availableBreads.length === 0 ? (
        <p className="drawer-hint" style={{ padding: '12px 8px' }}>暂无可售面包，请先在面包房研发并上架。</p>
      ) : (
        availableBreads.map((r) => (
          <div className="cabinet-item bakery-card-decor-host" key={`${r.id}-${r.menuIndex}`}>
            <CardBreadDecor seed={`cabinet-${r.id}-${r.menuIndex}`} />
            <BreadCanvas recipe={r} width={56} height={56} size={14} />
            <div className="cabinet-item-info">
              <div className="name">{r.name}</div>
              <div className="price">{getBreadPrice(r, state.day)}💰 ×{r.qty ?? 1}</div>
              <div className="cabinet-item-meta"><span title="剩余天数">{getDaysLeft(r, state.day)}天</span></div>
              {r.stats && (
                <div className="cabinet-item-stats">
                  <span title="甜度">🍬{r.stats.甜度 ?? '-'}</span>
                  <span title="柔软度">☁️{r.stats.柔软度 ?? '-'}</span>
                  <span title="香气">🌸{r.stats.香气 ?? '-'}</span>
                  <span title="复杂度">🎭{r.stats.复杂度 ?? '-'}</span>
                </div>
              )}
            </div>
            <button className="serve-btn serve-btn--always" type="button" onClick={() => serveRecipe(r)}>推荐</button>
          </div>
        ))
      )}
    </div>
  );

  /** 第一位客人之后：回到 idle 时自动进店，无需再点「迎接」 */
  useEffect(() => {
    if (phase !== 'idle' || guestsLoading || guests.length === 0) return;
    if (guestIdx === 0) return;
    const t = window.setTimeout(() => nextGuest(), 0);
    return () => clearTimeout(t);
  }, [phase, guestsLoading, guests.length, guestIdx, nextGuest]);

  const renderSceneFloatingBody = () => {
    if (phase === 'idle' || phase === 'allDone') return null;
    if (phase === 'result' && result) {
      return (
        <div className="store-floating-guest-layout store-floating-guest-layout--bottom">
          <div className="store-floating-requirements-dock store-floating-result-dock">
            <div className="transaction-result transaction-result--bubble store-transaction-split">
              <div className="store-transaction-split-left">
                <div className="result-icon">{result.icon}</div>
                <h3>{result.title}</h3>
                <p>{result.desc}</p>
              </div>
              <div className="store-transaction-split-right">
                <div className="result-rewards">
                  {result.rewards.map((r, i) => (
                    <div key={i} className={`reward-item${r.negative ? ' negative' : ''}`}>{r.text}</div>
                  ))}
                </div>
                <button type="button" className="btn btn-primary btn-small" onClick={afterResult}>
                  {guestIdx >= guests.length ? '今日客人已全部接待' : '下一位客人 →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    if ((phase === 'browsing' || phase === 'customRequest') && current) {
      return (
        <div className="store-floating-guest-layout store-floating-guest-layout--bottom">
          <div className="store-floating-requirements-dock">
            <h4 className="store-requirements-title">顾客需求</h4>
            <CustomerCard customer={current} dialogue={dialogue} satisfaction={satisfaction} variant="requirementsSplit">
              {phase === 'browsing' && (
                <div className="customer-actions store-customer-actions-stack">
                  <p className="action-hint">下方选面包点「推荐」，或现场定制；可不接待并婉拒（扣声望）。</p>
                  <div className="store-customer-action-row">
                    <button type="button" className="btn btn-accent btn-small" onClick={openCustom}>🧪 现场定制</button>
                    <button type="button" className="btn btn-secondary btn-small store-btn-reject" onClick={rejectGuest}>
                      婉拒顾客（-{REJECT_GUEST_REP_COST}⭐）
                    </button>
                  </div>
                </div>
              )}
              {phase === 'customRequest' && (
                <div className="customer-actions store-customer-actions-stack">
                  <p className="action-hint">开始定制接单，或婉拒离开（扣声望）。</p>
                  <div className="store-customer-action-row">
                    <button type="button" className="btn btn-accent btn-small" onClick={openCustom}>🧪 开始定制</button>
                    <button type="button" className="btn btn-secondary btn-small store-btn-reject" onClick={rejectGuest}>
                      婉拒顾客（-{REJECT_GUEST_REP_COST}⭐）
                    </button>
                  </div>
                </div>
              )}
            </CustomerCard>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderLogBody = () => (
    <>
      <div className="log-stats">
        <div className="log-stat"><span>收入</span><strong>{todayIncome} 💰</strong></div>
        <div className="log-stat"><span>客人</span><strong>{Math.min(guestIdx, guests.length)} 人</strong></div>
        <div className="log-stat"><span>满意</span><strong>{todayHappy}</strong></div>
        {(state.dayMultiplier ?? 1.0) !== 1.0 && (
          <div className="log-stat">
            <span>收益倍率</span>
            <strong style={{ color: '#ffd166' }}>{(state.dayMultiplier ?? 1.0).toFixed(1)}x 🎮</strong>
          </div>
        )}
      </div>
      <div className="log-entries store-modal-log-entries">
        {logEntries.length === 0 ? (
          <p className="drawer-hint">尚无成交记录</p>
        ) : (
          logEntries.map(e => (
            <div key={e.id} className={`log-entry ${e.type}`}>{e.text}</div>
          ))
        )}
      </div>
      {phase === 'allDone' && (
        <div className="store-modal-log-footer">
          <button type="button" className="btn btn-secondary" onClick={onDayEnd}>🌙 结束营业</button>
        </div>
      )}
    </>
  );

  const scenePortrait =
    current && (phase === 'browsing' || phase === 'customRequest' || phase === 'result')
      ? resolveCustomerPortraitUrl(current)
      : null;

  return (
    <div className="store-business-root store-business-root--hero">
      {/* 点灯小游戏覆盖层：当日首次进入营业时显示 */}
      {!lightGameDone && (
        <LightGameOverlay
          guestsReady={!guestsLoading}
          onComplete={handleLightGameComplete}
        />
      )}

      <header className="store-welcome-bar">
        {guestsLoading && lightGameDone && <p className="store-welcome-text">正在生成今日客人…</p>}
        {!guestsLoading && phase === 'idle' && guestIdx === 0 && guests.length > 0 && (
          <div className="store-welcome-first">
            <p className="store-welcome-text" style={{ margin: 0 }}>准备迎接今天的第一位客人。</p>
            <button type="button" className="btn btn-primary" onClick={nextGuest}>
              开始营业 · 迎接第一位客人
            </button>
          </div>
        )}
        {!guestsLoading && phase === 'idle' && guestIdx === 0 && guests.length === 0 && (
          <p className="store-welcome-text">今日暂无客人排班。</p>
        )}
        {!guestsLoading && phase === 'idle' && guestIdx > 0 && guests.length > 0 && (
          <p className="store-welcome-text" style={{ margin: 0 }}>下一位客人正在进店…</p>
        )}
        {!guestsLoading && phase === 'allDone' && (
          <div className="store-welcome-done">
            <p className="store-welcome-text" style={{ margin: 0 }}>今天的客人都已经接待完毕。</p>
            <button type="button" className="btn btn-secondary" onClick={onDayEnd}>🌙 结束营业</button>
          </div>
        )}
        <span className="store-welcome-meta drawer-hint">
                接待进度：{Math.min(guestIdx, guests.length)} / {guests.length} 位客人
        </span>
      </header>

      <StoreCounterScene
        portraitUrl={scenePortrait}
        topRightSlot={(
          <button
            type="button"
            className="btn-store-log-pill"
            onClick={() => setLogOpen(true)}
            title="今日成交与统计"
          >
            📋 今日记录
          </button>
        )}
        floatingUI={renderSceneFloatingBody()}
      />

      <section className="store-cabinet-below" aria-label="今日上架推荐面包">
        <h4 className="store-cabinet-below-title">🗄️ 今日上架 · 推荐面包</h4>
        {renderCabinetBody()}
      </section>

      {logOpen && (
        <Modal
          title="📋 今日记录"
          onClose={() => setLogOpen(false)}
          footer={(
            <button type="button" className="btn btn-secondary" onClick={() => setLogOpen(false)}>关闭窗口</button>
          )}
        >
          {renderLogBody()}
        </Modal>
      )}

      {/* 定制弹窗 */}
      {customModal && (
        <Modal title="🧪 现场定制" onClose={() => setCustomModal(false)}
          footer={<>
            {customRecipe && (
              <div className="custom-modal-actions">
                <div className="custom-modal-actions-row">
                  <button type="button" className="btn btn-secondary btn-small" onClick={() => { pinRecipe(customRecipe); notify('已固定配方，可在面包房查看', 'success'); }}>固定配方</button>
                  <button type="button" className="btn btn-secondary btn-small" onClick={saveCustomToLibrary}>保存配方</button>
                  <button type="button" className="btn btn-primary btn-small" onClick={pinSaveAndGo}>固定保存并跳转</button>
                </div>
              </div>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => setCustomModal(false)}>关闭</button>
          </>}>
          <p className="drawer-hint" style={{ marginBottom: 10 }}>
            补充说明可选；点「生成 AI 配方」消耗 {AI_GENERATION_GOLD_COST}💰，按客人需求与补充内容设计面团（不点不会自动生成）。
          </p>
          {current?._customRequest && (
            <div className="customer-request">
              <strong>{current.name}的需求：</strong><br />
              "{current._customRequest.text}"
            </div>
          )}
          {customLoading && <p className="drawer-hint">AI 正在根据客人信息设计配方…</p>}
          <textarea
            value={customDesc} onChange={(e) => setCustomDesc(e.target.value)}
            placeholder="可选：补充说明（如造型、口感细节）"
            rows={2}
            lang="zh-CN"
            inputMode="text"
            style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-sans)', fontSize: '.9rem', background: 'var(--surface-alt)', marginBottom: 12 }}
          />
          <button
            type="button"
            className="btn btn-primary btn-small"
            onClick={generateCustomRecipe}
            disabled={customLoading || !current || state.gold < AI_GENERATION_GOLD_COST}
          >
            {customLoading ? '生成中…' : `✨ 生成 AI 配方（${AI_GENERATION_GOLD_COST}💰）`}
          </button>
          {customRecipe && (
            <div style={{ marginTop: 12, padding: 12, background: 'var(--surface-alt)', borderRadius: 8 }}>
              <h4>{customRecipe.name}</h4>
              <p className="custom-order-hint">必须实际烘焙后才能端给客人。「固定保存并跳转」会固定配方、写入配方库（若无重复）并前往面包房接单。</p>
              <p style={{ fontSize: '.85rem', color: 'var(--text-secondary)', margin: '6px 0' }}>{customRecipe.shortDesc || customRecipe.description}</p>
              {(() => {
                const lines = getIngredientLines(customRecipe);
                if (!lines.length) return null;
                return (
                  <div className="ai-preview-ingredient-capsules" style={{ marginBottom: 8 }}>
                    {lines.map((s, i) => (
                      <span key={i} className={`ai-preview-capsule ai-ing-${getIngredientCapsuleCategory(s)}`}>
                        <IngredientThumb
                          name={s}
                          size="sm"
                          aiTintCategory={aiTintCategoryForIngredientLine(state.customProcurementItems, s)}
                          aiTintVariant={aiTintVariantForIngredientLine(state.customProcurementItems, s)}
                        />
                        {s}
                      </span>
                    ))}
                  </div>
                );
              })()}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className="mini-tag">🍬 甜度 {customRecipe.stats.甜度}</span>
                <span className="mini-tag">☁️ 柔软度 {customRecipe.stats.柔软度}</span>
                <span className="mini-tag">🌸 香气 {customRecipe.stats.香气}</span>
                <span className="mini-tag">🎭 复杂度 {customRecipe.stats.复杂度}</span>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
