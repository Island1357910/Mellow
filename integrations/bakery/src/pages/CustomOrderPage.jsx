import { useState, useEffect, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { adjustIncomingGold } from '../systems/economyBalance';
import { calculateSatisfaction } from '../systems/customerEngine';
import { chatComplete } from '../services/aiService';
import { getActiveOpenAPIConfig } from '../services/aiService';
import BreadCanvas from '../components/bread/BreadCanvas';
import CardBreadDecor from '../components/CardBreadDecor';
import {
  getCustomOrderPortraitKeyPoolsForAI,
  pickRandomCustomOrderPixelPortrait,
  resolvePortraitKeyForOrder,
} from '../data/customOrderPixelPortraits';

const STAT_ICONS = { 甜度: '🍬', 柔软度: '☁️', 香气: '🌸', 复杂度: '🎭' };
const EMOJI_POOL = ['👩', '👨', '👩‍🦰', '👨‍🦱', '👧', '👦', '🧑', '👴', '👵', '🧔', '👩‍🍳', '💼'];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const CUSTOM_ORDER_COUNT = 8; // 每天 8 个定制单可选

function attachPixelPortrait(customer, requestText = '') {
  const pix = pickRandomCustomOrderPixelPortrait({ name: customer.name, requestText });
  return { ...customer, ...pix };
}

/** 无 AI 时的预设订单 */
function getFallbackOrders(day) {
  const names = ['林小姐', '王先生', '陈太太', '张小姐', '李先生', '刘阿姨', '赵女士', '孙先生', '周小姐', '吴先生'];
  const requests = [
    { text: '想要甜一点、软软的面包', req: { 甜度: { min: 7 }, 柔软度: { min: 7 } }, flavor: '焦糖', baseGold: 70 },
    { text: '不要太甜，香气要足', req: { 甜度: { max: 4 }, 香气: { min: 7 } }, flavor: '伯爵茶', baseGold: 80 },
    { text: '层次丰富一些，软软的', req: { 复杂度: { min: 7 }, 柔软度: { min: 7 } }, flavor: '抹茶', baseGold: 85 },
    { text: '极致柔软入口即化', req: { 柔软度: { min: 9 } }, flavor: '香草', baseGold: 75 },
    { text: '低糖健康，有嚼劲', req: { 甜度: { max: 3 }, 柔软度: { max: 5 } }, flavor: '海盐', baseGold: 90 },
    { text: '甜蜜香气浓郁', req: { 甜度: { min: 8 }, 香气: { min: 8 } }, flavor: '肉桂', baseGold: 95 },
    { text: '简单朴素不复杂', req: { 复杂度: { max: 3 } }, flavor: '无添加', baseGold: 65 },
    { text: '四项均衡的经典款', req: { 甜度: { min: 5 }, 柔软度: { min: 5 }, 香气: { min: 5 }, 复杂度: { min: 5 } }, flavor: '薰衣草', baseGold: 120 },
  ];
  return requests.slice(0, CUSTOM_ORDER_COUNT).map((r, i) => {
    const customer = {
      name: names[(day + i) % names.length],
      avatar: pick(EMOJI_POOL),
      numericRequirements: Object.fromEntries(
        Object.entries(r.req).map(([k, v]) => [k, v])
      ),
      flavorPreference: r.flavor && r.flavor !== '无添加' ? r.flavor : undefined,
    };
    return {
      id: `fallback_${day}_${i}_${Date.now()}`,
      customer: attachPixelPortrait(customer, r.text),
      requestText: r.text,
      goldReward: r.baseGold + Math.floor(Math.random() * 35),
    };
  });
}

async function generateOrdersAI(day, reputation, count = CUSTOM_ORDER_COUNT) {
  const cfg = getActiveOpenAPIConfig();
  if (!cfg) return null;
  const POOLS = getCustomOrderPortraitKeyPoolsForAI();
  try {
    const text = await chatComplete(
      [
        {
          role: 'system',
          content: `你是《千味面包房》游戏的面包店定制单生成器。生成 ${count} 个定制订单，输出纯 JSON 数组，不要 markdown。
每项格式：{"name":"顾客名","storyHook":"一句生活情景（≤40字，可选）","avatar":"备用emoji","portraitKey":"字符串键名","requestText":"口语需求","requirements":{"甜度":{},"柔软度":{},"香气":{},"复杂度":{}},"flavorPreference":"风味或无","goldReward":80-180}
requirements 至少 2 个维度含 min 或 max（0-20）。
portraitKey 必须严格使用下方键名，且与顾客性别年龄一致：
· 一般顾客（青壮年等）：仅从「${POOLS.general}」中选。
· 故事或姓名明确「奶奶、阿婆、老太太」等老年女性：仅从「${POOLS.femaleElder}」中选，禁止选「老爷爷」。
· 明确「爷爷、老伯、老先生」等老年男性：仅从「${POOLS.maleElder}」中选。`,
        },
        {
          role: 'user',
          content: `第 ${day} 天、声望 ${reputation}、巷子里的温馨社区面包房。生成 ${count} 个各不相同、有人情味的订单，顾客身份与 portraitKey 尽量多样化。`,
        },
      ],
      { temperature: 0.8, max_tokens: 1500 }
    );
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) return null;
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr) || arr.length < 1) return null;
    return arr.slice(0, count).map((item, i) => {
      const req = item.requirements || {};
      const normalizeReq = (obj) => {
        if (!obj || typeof obj !== 'object') return undefined;
        const o = {};
        if (obj.min != null) o.min = clamp(Number(obj.min), 0, 20);
        if (obj.max != null) o.max = clamp(Number(obj.max), 0, 20);
        return Object.keys(o).length ? o : undefined;
      };
      const nr = {};
      for (const k of ['甜度', '柔软度', '香气', '复杂度']) {
        const v = normalizeReq(req[k]);
        if (v) nr[k] = v;
      }
      const fpRaw = item.flavorPreference ?? item.风味 ?? item.风味偏好;
      const fpStr = fpRaw != null ? String(fpRaw).trim() : '';
      const flavorPreference = fpStr && fpStr !== '无' && fpStr !== '无添加' ? fpStr.slice(0, 12) : undefined;
      const hook = item.storyHook != null ? String(item.storyHook).trim().slice(0, 42) : '';
      const baseReq = String(item.requestText || '想要好吃的面包').slice(0, 56);
      const requestText = hook ? `${baseReq}（${hook}）` : baseReq;
      const cname = String(item.name || '顾客').slice(0, 10);
      const pix = resolvePortraitKeyForOrder(cname, requestText, item.portraitKey);
      return {
        id: `ai_${Date.now()}_${i}`,
        customer: {
          name: cname,
          avatar: item.avatar || pick(EMOJI_POOL),
          ...pix,
          numericRequirements: Object.keys(nr).length ? nr : { 甜度: { min: 6 }, 柔软度: { min: 6 } },
          flavorPreference,
        },
        requestText,
        goldReward: clamp(Number(item.goldReward) || 80, 60, 200),
      };
    });
  } catch {
    return null;
  }
}

export default function CustomOrderPage() {
  const { state, dispatch, notify } = useGame();
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState(null);
  const [pickOrderId, setPickOrderId] = useState(null);

  const pool = state.customOrderPool;
  const orders = pool?.day === state.day && Array.isArray(pool.orders) ? pool.orders : [];
  const needsLoad = !pool || pool.day !== state.day;

  const loadOrders = useCallback(async () => {
    if (!needsLoad) return;
    setLoading(true);
    const aiOrders = await generateOrdersAI(state.day, state.reputation);
    const list = aiOrders?.length > 0 ? aiOrders : getFallbackOrders(state.day);
    dispatch({ type: 'SET_CUSTOM_ORDER_POOL', day: state.day, orders: list });
    setLoading(false);
  }, [state.day, state.reputation, dispatch, needsLoad]);

  useEffect(() => {
    if (needsLoad) loadOrders();
  }, [needsLoad, loadOrders]);

  const menuRecipes = state.menuRecipes || [];

  const submitBread = (order, menuIndex) => {
    const recipe = menuRecipes[menuIndex];
    if (!recipe) return;
    const customer = { ...order.customer, personality: null };
    const satisfaction = calculateSatisfaction(customer, recipe);
    const gold = satisfaction >= 60 ? order.goldReward : Math.max(5, Math.round(order.goldReward * 0.25));
    const reputation = satisfaction >= 80 ? 2 : satisfaction >= 60 ? 1 : -1;

    dispatch({
      type: 'COMPLETE_OFFLINE_CUSTOM_ORDER',
      gold,
      reputation,
      satisfaction,
      menuIndex,
      incomeKind: 'custom_order',
    });
    dispatch({ type: 'REMOVE_CUSTOM_ORDER', orderId: order.id });

    setPickOrderId(null);
    setSubmittingId(null);
    const showGold = adjustIncomingGold(state, gold, 'custom_order');
    if (satisfaction >= 80) {
      notify(`✅ ${order.customer.name} 非常满意！获得 ${showGold}💰`, 'success');
    } else if (satisfaction >= 60) {
      notify(`✓ ${order.customer.name} 满意，获得 ${showGold}💰`, 'success');
    } else {
      notify(`⚠ 不太符合要求，获得安慰金 ${showGold}💰`, 'info');
    }
  };

  return (
    <div className="page-view panel">
      <div className="page-view-head">
        <h2>📋 定制单</h2>
        <p className="drawer-hint">
          今日订单每日更新，每单仅可提交一次。从菜单中选择符合要求的面包提交即可获利。
        </p>
      </div>
      <div className="page-view-body bakery-card-decor-host">
        <CardBreadDecor seed="page-custom-order" variant="chrome" />
        {loading && orders.length === 0 ? (
          <p className="drawer-hint">正在生成今日订单…</p>
        ) : orders.length === 0 ? (
          <p className="drawer-hint">今日订单已全部完成，明天将更新新订单。</p>
        ) : (
          <div className="custom-order-grid">
            {orders.map((order) => (
              <div key={order.id} className="custom-order-card bakery-card-decor-host">
                <CardBreadDecor seed={`custo-${order.id}`} />
                <div className="custom-order-header">
                  {order.customer.portraitUrl ? (
                    <img
                      className="custom-order-avatar-img"
                      src={order.customer.portraitUrl}
                      alt=""
                      width={48}
                      height={48}
                    />
                  ) : (
                    <span className="custom-order-avatar">{order.customer.avatar}</span>
                  )}
                  <div>
                    <strong>{order.customer.name}</strong>
                    <p className="custom-order-request">{order.requestText}</p>
                  </div>
                  <span className="custom-order-reward">{order.goldReward}💰</span>
                </div>
                <div className="custom-order-reqs">
                  {Object.entries(order.customer.numericRequirements || {}).map(
                    ([k, v]) => (
                      <span key={k} className="req-tag">
                        {STAT_ICONS[k]}{k}:
                        {v.min != null && `≥${v.min}`}
                        {v.max != null && `≤${v.max}`}
                      </span>
                    )
                  )}
                  {order.customer.flavorPreference ? (
                    <span className="req-tag">🌿风味：{order.customer.flavorPreference}</span>
                  ) : null}
                </div>
                {pickOrderId === order.id ? (
                  <div className="custom-order-pick">
                    <p className="drawer-hint">选择要提交的面包：</p>
                    {menuRecipes.length === 0 ? (
                      <p className="drawer-hint">菜单无面包，请先制作。</p>
                    ) : (
                      <div className="custom-order-menu-pick">
                        {menuRecipes.map((item, idx) => {
                          const sat = calculateSatisfaction(
                            { ...order.customer, personality: null },
                            item
                          );
                          return (
                            <button
                              key={idx}
                              type="button"
                              className={`custom-order-pick-btn${sat >= 60 ? ' ok' : ''}`}
                              disabled={submittingId === order.id}
                              onClick={() => {
                                setSubmittingId(order.id);
                                submitBread(order, idx);
                              }}
                            >
                              <BreadCanvas recipe={item} width={40} height={40} size={10} />
                              <span>{item.name}</span>
                              <span className="sat-badge">满意度 {sat}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <button
                      type="button"
                      className="btn btn-tiny"
                      onClick={() => setPickOrderId(null)}
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={menuRecipes.length === 0}
                    onClick={() => setPickOrderId(order.id)}
                  >
                    提交面包
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
