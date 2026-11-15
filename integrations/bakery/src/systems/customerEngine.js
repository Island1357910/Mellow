import { customerTypes, customerNames, moods } from '../data/customers';
import {
  pickPortraitKeyForCustomerType,
  normalizePortraitIdentity,
  CUSTOMER_IDENTITY_PROMPT_LIST,
} from '../data/customerPortraits';
import { ingredients } from '../data/ingredients';
import { chatComplete } from '../services/aiService';
import { getActiveOpenAPIConfig } from '../services/aiService';

let _id = 0;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo));

const FLAVOR_CHOICES = (ingredients.风味 || [])
  .map((i) => i.name)
  .filter((n) => n && n !== '无添加');

const FLAVOR_HINT_SHORT = ['香草', '抹茶', '可可', '肉桂', '焦糖', '伯爵茶', '薰衣草', '玫瑰', '海盐', '柚子'];

/** 成品配方中实际使用的风味原料名 */
export function getRecipeFlavorNames(recipe) {
  const names = [];
  const multi = recipe?.ingredientsMulti?.风味;
  if (Array.isArray(multi)) {
    for (const f of multi) {
      if (f?.name && f.name !== '无添加') names.push(f.name);
    }
  } else if (recipe?.ingredients?.风味?.name && recipe.ingredients.风味.name !== '无添加') {
    names.push(recipe.ingredients.风味.name);
  }
  return names;
}

/**
 * @param {string|string[]|null|undefined} pref 顾客风味偏好（关键词或全名）
 * @returns {boolean|null} null 表示未要求风味
 */
export function flavorMatchesPreference(pref, recipe) {
  if (pref == null || pref === '') return null;
  const prefs = (Array.isArray(pref) ? pref : [pref]).map((p) => String(p).trim()).filter(Boolean);
  if (prefs.length === 0) return null;
  const rNames = getRecipeFlavorNames(recipe);
  if (rNames.length === 0) return false;
  const norm = (s) => String(s).replace(/风味|味$/g, '').replace(/粉|精|酱|露$/g, '').trim();
  for (const p of prefs) {
    const needle = norm(p);
    if (!needle) continue;
    for (const rf of rNames) {
      const hay = norm(rf);
      if (!hay) continue;
      if (rf.includes(p) || p.includes(rf) || hay.includes(needle) || needle.includes(hay)) return true;
    }
  }
  return false;
}

export function mergeNumericRequirements(base, overlay) {
  const out = { ...(base || {}) };
  if (!overlay || typeof overlay !== 'object') {
    return Object.keys(out).length ? out : undefined;
  }
  for (const k of ['甜度', '柔软度', '香气', '复杂度']) {
    const o = overlay[k];
    if (!o || typeof o !== 'object') continue;
    const prev = out[k] && typeof out[k] === 'object' ? { ...out[k] } : {};
    if (o.min != null) prev.min = clamp(Number(o.min), 0, 20);
    if (o.max != null) prev.max = clamp(Number(o.max), 0, 20);
    if (prev.min != null || prev.max != null) out[k] = prev;
  }
  return Object.keys(out).length ? out : undefined;
}

function generateFlavorProfile(typeData) {
  const p = { 甜度: 5, 柔软度: 5, 香气: 5, 复杂度: 5 };
  for (const pref of typeData.flavorPrefs) {
    const [attr, level] = pref.includes('_') ? [pref.split('_')[0], pref.split('_')[1]] : [null, null];
    if (attr && p[attr] !== undefined) {
      if (level === 'high') p[attr] = 7 + Math.random() * 3;
      else if (level === 'low') p[attr] = 1 + Math.random() * 3;
      else if (level === 'medium') p[attr] = 4 + Math.random() * 2;
    }
  }
  for (const k of Object.keys(p)) p[k] = clamp(p[k] + (Math.random() - 0.5) * 2, 0, 12);
  return p;
}

export function describePreferences(personality) {
  const fp = personality.flavorProfile;
  const parts = [];
  if (fp.甜度 > 7) parts.push('甜蜜');
  else if (fp.甜度 < 3) parts.push('不甜');
  if (fp.柔软度 > 7) parts.push('松软');
  else if (fp.柔软度 < 3) parts.push('有嚼劲');
  if (fp.香气 > 7) parts.push('香气浓郁');
  if (fp.复杂度 > 7) parts.push('层次丰富');
  else if (fp.复杂度 < 3) parts.push('简单朴素');
  return parts.join('、') || '好吃';
}

export function generateDialogue(personality, context) {
  const d = personality.typeData.dialogues[context] || personality.typeData.dialogues.enter;
  return pick(d).replace('{pref_desc}', describePreferences(personality));
}

export function generateCustomRequest(personality) {
  const fp = personality.flavorProfile;
  const parts = [];
  if (fp.甜度 > 7) parts.push('甜一些');
  else if (fp.甜度 < 4) parts.push('不要太甜');
  if (fp.柔软度 > 7) parts.push('要软软的');
  else if (fp.柔软度 < 4) parts.push('硬一些也没关系');
  if (fp.香气 > 7) parts.push('很香的');
  if (fp.复杂度 > 7) parts.push('口味丰富一些');
  else if (fp.复杂度 < 3) parts.push('简单就好');
  const flavorPick = Math.random() < 0.55
    ? pick(FLAVOR_CHOICES.length ? FLAVOR_CHOICES : FLAVOR_HINT_SHORT)
    : null;
  let text = `我想要一款${parts.join('、') || '特别'}的面包。`;
  if (flavorPick) text = text.replace(/。$/, '') + `，最好带点${flavorPick.replace(/粉|精|酱|露$/g, '')}风味。`;
  return {
    text,
    flavorPreference: flavorPick,
    requirements: {
      甜度: fp.甜度 > 7 ? { min: 8 } : fp.甜度 < 4 ? { max: 5 } : null,
      柔软度: fp.柔软度 > 7 ? { min: 8 } : fp.柔软度 < 4 ? { max: 5 } : null,
      香气: fp.香气 > 7 ? { min: 7 } : null,
      复杂度: fp.复杂度 > 7 ? { min: 7 } : fp.复杂度 < 3 ? { max: 4 } : null,
    },
  };
}

/** 将 flavorProfile 转为隐式数值要求 */
function profileToRequirements(fp, invertSweet) {
  if (!fp) return null;
  const req = {};
  for (const attr of ['甜度', '柔软度', '香气', '复杂度']) {
    const v = fp[attr] ?? 5;
    if (invertSweet && attr === '甜度') {
      req[attr] = v > 7 ? { max: 4 } : v < 4 ? { min: 7 } : null;
    } else if (v > 7) req[attr] = { min: 8 };
    else if (v < 4) req[attr] = { max: 5 };
  }
  return Object.keys(req).length ? req : null;
}

/** 顾客满意度：甜度、柔软度、香气、复杂度 + 可选风味偏好 */
export function calculateSatisfaction(customer, recipe) {
  let req = customer.numericRequirements;
  if (!req && customer.personality?.flavorProfile) {
    req = profileToRequirements(customer.personality.flavorProfile, customer.personality.typeData?.invertSweet);
  }
  const attrs = ['甜度', '柔软度', '香气', '复杂度'];
  let scoreSum = 0;
  let count = 0;
  for (const attr of attrs) {
    const r = req?.[attr];
    const actual = recipe.stats?.[attr] ?? 0;
    if (r && (r.min != null || r.max != null)) {
      count += 1;
      let s = 100;
      if (r.min != null && actual < r.min) {
        s = Math.max(0, 100 - (r.min - actual) * 20);
      } else if (r.max != null && actual > r.max) {
        s = Math.max(0, 100 - (actual - r.max) * 20);
      }
      scoreSum += s;
    }
  }
  const fpref = customer.flavorPreference ?? customer.flavorHint;
  const fm = flavorMatchesPreference(fpref, recipe);
  if (fm !== null) {
    count += 1;
    scoreSum += fm ? 100 : 38;
  }
  const sat = count > 0 ? scoreSum / count : 50;
  return clamp(Math.round(sat), 0, 100);
}

export function decideAction(satisfaction) {
  if (satisfaction >= 80) return 'buy';
  if (satisfaction >= 50) return 'negotiate';
  return 'custom';
}

export function calculatePayment(recipe, satisfaction, customer) {
  let price = recipe.price;
  if (satisfaction >= 90) price = Math.round(price * 1.2);
  else if (satisfaction < 60) price = Math.round(price * 0.8);
  return Math.max(5, price);
}

export function calculateRewards(satisfaction, customer, recipe) {
  return {
    gold: calculatePayment(recipe, satisfaction, customer),
    reputation: satisfaction >= 80 ? 3 : satisfaction >= 60 ? 1 : -1,
  };
}

export function generateGuest(dayNumber, shopReputation, event) {
  let pool = [...customerTypes];
  if (event?.effect?.customerType) {
    const boosted = pool.find(t => t.type === event.effect.customerType);
    if (boosted) for (let i = 0; i < Math.floor(event.effect.spawnRate || 1.5); i++) pool.push(boosted);
  }
  if (shopReputation > 50 && Math.random() < 0.2) {
    const sp = pool.find(t => t.type === '神秘老人');
    if (sp) pool.push(sp);
  }
  const typeData = pick(pool);
  const fp = generateFlavorProfile(typeData);
  const mood = pick(moods);
  const name = pick(customerNames[typeData.type] || ['访客']);
  const personality = {
    type: typeData.type, typeData, flavorProfile: fp,
    patience: typeData.patience + (Math.random() - 0.5) * 0.2, mood,
  };
  const flavorPreference = FLAVOR_CHOICES.length && Math.random() < 0.42 ? pick(FLAVOR_CHOICES) : null;
  const portraitKey = pickPortraitKeyForCustomerType(typeData.type);
  return {
    id: 'guest_' + Date.now() + '_' + (++_id),
    name, personality,
    flavorPreference,
    portraitKey,
    enterDialogue: generateDialogue(personality, 'enter'),
    state: 'entering',
  };
}

/** 每天 6–10 位顾客，由 AI 生成 */
export function getGuestCount(dayNumber, reputation, event) {
  let base = 6 + Math.floor(Math.random() * 5);
  if (event?.effect?.guestCount) base = Math.round(base * event.effect.guestCount);
  return Math.max(6, Math.min(10, base));
}

const EMOJI_POOL = ['👩', '👨', '👩‍🦰', '👨‍🦱', '👧', '👦', '🧑', '👴', '👵', '🧔', '👩‍🍳', '💼', '🧑‍💼', '👩‍🦳', '👨‍🦲', '🧒', '👱‍♀️', '👱‍♂️'];
function pickEmoji() {
  return EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)];
}

const CUSTOMER_TYPE_HINT = {
  好奇小孩: '学生/小朋友',
  健康达人: '注重健康的人',
  美食家: '美食家',
  匆忙上班族: '上班族',
  浪漫情侣: '情侣',
  神秘老人: '神秘客人',
};

export async function generateGuestsAI(count, dayNumber, reputation, event) {
  const cfg = getActiveOpenAPIConfig();
  if (!cfg) return null;
  const boostHint = event?.effect?.spawnRate && event?.effect?.customerType
    ? `【顾客类型】${CUSTOMER_TYPE_HINT[event.effect.customerType] || event.effect.customerType}较多，请让其中至少一半符合该类型特征（如好奇小孩偏好甜软、健康达人偏好低糖等）。`
    : '';
  try {
    const text = await chatComplete(
      [
        {
          role: 'system',
          content: `你是面包店顾客生成器。生成 exactly ${count} 个顾客，输出纯 JSON 数组，不要 markdown。
每项格式：{"name":"中文名","identity":"身份类型，须严格从下列选一：${CUSTOMER_IDENTITY_PROMPT_LIST}","avatar":"单人emoji如👩👨👧","requirements":{"甜度":{"min":0,"max":20},"柔软度":{},"香气":{},"复杂度":{}},"flavorPreference":"风味关键词，须从游戏可能原料中选：香草精、抹茶粉、可可粉、肉桂粉、焦糖酱、伯爵茶、薰衣草、玫瑰露、海盐、柚子蜜等，或简写如抹茶、可可","enterDialogue":"进店说的第一句话"}
identity 必须与顾客形象一致（如学生用青年男学生、老翁用白发老头等）。requirements 必须有明确数值：每个属性至少 min 或 max 其一，范围 0-20。flavorPreference 为字符串。不要包含 budget 字段。`,
        },
        {
          role: 'user',
          content: `为第 ${dayNumber} 天、声望 ${reputation} 的面包店生成 ${count} 位顾客。每人要求不同、头像 emoji 不同。${boostHint}`,
        },
      ],
      { temperature: 0.85, max_tokens: 1200 },
    );
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) return null;
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr) || arr.length < count) return null;
    const types = customerTypes;
    return arr.slice(0, count).map((item, i) => {
      const typeData = types[i % types.length];
      const req = item.requirements || {};
      const normalizeReq = (obj) => {
        if (!obj || typeof obj !== 'object') return undefined;
        const o = {};
        if (obj.min != null) o.min = clamp(obj.min, 0, 20);
        if (obj.max != null) o.max = clamp(obj.max, 0, 20);
        return Object.keys(o).length ? o : undefined;
      };
      const fpRaw = item.flavorPreference ?? item.风味偏好 ?? item.风味;
      const flavorPreference = fpRaw != null && String(fpRaw).trim() ? String(fpRaw).trim().slice(0, 12) : null;
      const portraitKey = normalizePortraitIdentity(item.identity ?? item.portraitKey);
      return {
        id: 'guest_ai_' + Date.now() + '_' + i,
        name: String(item.name || '顾客').slice(0, 10),
        avatar: item.avatar || pickEmoji(),
        identity: portraitKey,
        portraitKey,
        numericRequirements: {
          甜度: normalizeReq(req.甜度),
          柔软度: normalizeReq(req.柔软度),
          香气: normalizeReq(req.香气),
          复杂度: normalizeReq(req.复杂度),
        },
        flavorPreference,
        personality: {
          type: 'AI顾客',
          typeData,
          flavorProfile: { 甜度: 5, 柔软度: 5, 香气: 5, 复杂度: 5 },
          mood: '期待',
        },
        enterDialogue: String(item.enterDialogue || '有什么好吃的？').slice(0, 80),
        state: 'entering',
      };
    });
  } catch {
    return null;
  }
}
