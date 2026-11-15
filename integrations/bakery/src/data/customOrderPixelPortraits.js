/**
 * 定制单像素立绘：老年男性仅用「老爷爷」；老年女性仅用「白人奶奶」「黑人奶奶」，不得混用。
 */

export const CUSTOM_ORDER_PIXEL_PORTRAIT_URL_BY_KEY = {
  白人小伙子: 'https://drive.mujian.me/f/5qjCO/%E7%99%BD%E4%BA%BA%E5%B0%8F%E4%BC%99%E5%AD%90.png',
  黑人小伙子: 'https://drive.mujian.me/f/awEH0/%E9%BB%91%E4%BA%BA%E5%B0%8F%E4%BC%99%E5%AD%90.png',
  年轻小伙子: 'https://drive.mujian.me/f/zjKuP/%E5%B9%B4%E8%BD%BB%E5%B0%8F%E4%BC%99%E5%AD%90.png',
  白人奶奶: 'https://drive.mujian.me/f/dYdC0/%E7%99%BD%E4%BA%BA%E5%A5%B6%E5%A5%B6.png',
  年轻女士: 'https://drive.mujian.me/f/lAvuw/%E5%B9%B4%E8%BD%BB%E5%A5%B3%E5%A3%AB.png',
  黑人奶奶: 'https://drive.mujian.me/f/rWGFM/%E9%BB%91%E4%BA%BA%E5%A5%B6%E5%A5%B6.png',
  中年男人: 'https://drive.mujian.me/f/w3QcK/%E4%B8%AD%E5%B9%B4%E7%94%B7%E4%BA%BA1.png',
  小女孩: 'https://drive.mujian.me/f/KBNiv/%E5%B0%8F%E5%A5%B3%E5%AD%A9.png',
  中年女人: 'https://drive.mujian.me/f/05ocx/%E4%B8%AD%E5%B9%B4%E5%A5%B3%E4%BA%BA.png',
  帅气青年: 'https://drive.mujian.me/f/2vYTR/%E5%B8%85%E6%B0%94%E9%9D%92%E5%B9%B4.png',
  麻花辫小姑娘: 'https://drive.mujian.me/f/X59um/%E9%BA%BB%E8%8A%B1%E8%BE%AB%E5%B0%8F%E5%A7%91%E5%A8%98.png',
  /** 老爷爷立绘：仅用于老年男性定制单，不可用于奶奶类角色 */
  老爷爷: 'https://drive.mujian.me/f/GYPTW/%E8%80%81%E4%BA%BA.png',
};

const FEMALE_ELDER_KEYS = ['白人奶奶', '黑人奶奶'];
const MALE_ELDER_KEYS = ['老爷爷'];

const ALL_KEYS = Object.keys(CUSTOM_ORDER_PIXEL_PORTRAIT_URL_BY_KEY);
const GENERAL_KEYS = ALL_KEYS.filter((k) => !FEMALE_ELDER_KEYS.includes(k) && !MALE_ELDER_KEYS.includes(k));

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** 从姓名与需求文案推断老年性别，用于避免老爷爷头像出现在奶奶订单上 */
export function inferElderGenderHint(name, requestText) {
  const s = `${String(name ?? '')}${String(requestText ?? '')}`;
  if (
    /奶奶|阿婆|外婆|婆婆|老太太|老夫人|孙老太|刘阿姨|大娘|大妈|奶奶级/i.test(s) ||
    (/阿姨|女士|太太/i.test(s) && /花甲|退休|年近|六十|七十|八十|抱孙/i.test(s))
  ) {
    return 'female_elder';
  }
  if (/爷爷|老伯|大爷|老先生|老爷爷|外公|姥爷|老爹/i.test(s)) {
    return 'male_elder';
  }
  return null;
}

export function getCustomOrderPortraitKeyPoolsForAI() {
  return {
    general: GENERAL_KEYS.join('、'),
    femaleElder: FEMALE_ELDER_KEYS.join('、'),
    maleElder: MALE_ELDER_KEYS.join('、'),
  };
}

export function pickRandomCustomOrderPixelPortrait(opts = {}) {
  const hint = inferElderGenderHint(opts.name, opts.requestText);
  if (hint === 'female_elder') {
    const k = pick(FEMALE_ELDER_KEYS);
    return { portraitKey: k, portraitUrl: CUSTOM_ORDER_PIXEL_PORTRAIT_URL_BY_KEY[k] };
  }
  if (hint === 'male_elder') {
    const k = pick(MALE_ELDER_KEYS);
    return { portraitKey: k, portraitUrl: CUSTOM_ORDER_PIXEL_PORTRAIT_URL_BY_KEY[k] };
  }
  const k = pick(GENERAL_KEYS.length ? GENERAL_KEYS : ALL_KEYS);
  return { portraitKey: k, portraitUrl: CUSTOM_ORDER_PIXEL_PORTRAIT_URL_BY_KEY[k] };
}

/** AI 返回的 portraitKey 与顾客描述冲突时纠正 */
export function resolvePortraitKeyForOrder(name, requestText, portraitKey) {
  const k = String(portraitKey || '').trim();
  const hint = inferElderGenderHint(name, requestText);
  if (hint === 'female_elder' && MALE_ELDER_KEYS.includes(k)) {
    const nk = pick(FEMALE_ELDER_KEYS);
    return { portraitKey: nk, portraitUrl: CUSTOM_ORDER_PIXEL_PORTRAIT_URL_BY_KEY[nk] };
  }
  if (hint === 'male_elder' && FEMALE_ELDER_KEYS.includes(k)) {
    const nk = pick(MALE_ELDER_KEYS);
    return { portraitKey: nk, portraitUrl: CUSTOM_ORDER_PIXEL_PORTRAIT_URL_BY_KEY[nk] };
  }
  if (CUSTOM_ORDER_PIXEL_PORTRAIT_URL_BY_KEY[k]) {
    return { portraitKey: k, portraitUrl: CUSTOM_ORDER_PIXEL_PORTRAIT_URL_BY_KEY[k] };
  }
  return pickRandomCustomOrderPixelPortrait({ name, requestText });
}
