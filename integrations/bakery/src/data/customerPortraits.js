/** 顾客立绘：按身份名映射 URL；AI 与规则生成均写入 portraitKey */

export const CUSTOMER_PORTRAIT_URL_BY_KEY = {
  小姑娘: 'https://drive.mujian.me/f/3gQT4/%E5%B0%8F%E5%A7%91%E5%A8%98.png',
  中年男人: 'https://drive.mujian.me/f/Paxhp/%E4%B8%AD%E5%B9%B4%E7%94%B7%E4%BA%BA.png',
  年轻男人: 'https://drive.mujian.me/f/6gnFa/%E5%B9%B4%E8%BD%BB%E7%94%B7%E4%BA%BA.png',
  黑人男人: 'https://drive.mujian.me/f/jwjs9/%E9%BB%91%E4%BA%BA%E7%94%B7%E4%BA%BA.png',
  职场女士: 'https://drive.mujian.me/f/yBQs5/%E8%81%8C%E5%9C%BA%E5%A5%B3%E5%A3%AB.png',
  白发老头: 'https://drive.mujian.me/f/MvXFo/%E7%99%BD%E5%8F%91%E8%80%81%E5%A4%B4.png',
  老奶奶: 'https://drive.mujian.me/f/Z76TO/%E8%80%81%E5%A5%B6%E5%A5%B6.png',
  艺术男生: 'https://drive.mujian.me/f/AX6Cm/%E8%89%BA%E6%9C%AF%E7%94%B7%E7%94%9F.png',
  家庭主妇: 'https://drive.mujian.me/f/801Hv/%E5%AE%B6%E5%BA%AD%E4%B8%BB%E5%A6%87.png',
  文艺成年男人: 'https://drive.mujian.me/f/oRBS6/%E6%96%87%E8%89%BA%E6%88%90%E5%B9%B4%E7%94%B7%E4%BA%BA.png',
  白人文艺成年男人: 'https://drive.mujian.me/f/E6XsG/%E7%99%BD%E4%BA%BA%E6%96%87%E8%89%BA%E6%88%90%E5%B9%B4%E7%94%B7%E4%BA%BA.png',
  青年男学生: 'https://drive.mujian.me/f/mDXUg/%E9%9D%92%E5%B9%B4%E7%94%B7%E5%AD%A6%E7%94%9F.png',
  黄皮肤青年男人: 'https://drive.mujian.me/f/QJEtl/%E9%BB%84%E7%9A%AE%E8%82%A4%E9%9D%92%E5%B9%B4%E7%94%B7%E4%BA%BA.png',
  光头老头子: 'https://drive.mujian.me/f/B5jtv/%E5%85%89%E5%A4%B4%E8%80%81%E5%A4%B4%E5%AD%90.png',
  戴帽子的老头: 'https://drive.mujian.me/f/Dlzcw/%E6%88%B4%E5%B8%BD%E5%AD%90%E7%9A%84%E8%80%81%E5%A4%B4.png',
  黑人女士: 'https://drive.mujian.me/f/NQaTG/%E9%BB%91%E4%BA%BA%E5%A5%B3%E5%A3%AB.png',
  拄拐杖的老人: 'https://drive.mujian.me/f/RaNtl/%E6%8B%84%E6%8B%90%E6%9D%96%E7%9A%84%E8%80%81%E4%BA%BA.png',
  毛头小伙子: 'https://drive.mujian.me/f/OQZFx/%E6%AF%9B%E5%A4%B4%E5%B0%8F%E4%BC%99%E5%AD%90.png',
};

export const CUSTOMER_IDENTITY_PROMPT_LIST = Object.keys(CUSTOMER_PORTRAIT_URL_BY_KEY).join('、');

const ALL_KEYS = Object.keys(CUSTOMER_PORTRAIT_URL_BY_KEY);

const TYPE_TO_PORTRAIT_KEYS = {
  美食家: ['艺术男生', '文艺成年男人', '白人文艺成年男人', '中年男人'],
  匆忙上班族: ['职场女士', '中年男人', '黄皮肤青年男人', '年轻男人'],
  好奇小孩: ['小姑娘', '毛头小伙子', '青年男学生'],
  浪漫情侣: ['年轻男人', '家庭主妇', '职场女士', '文艺成年男人'],
  神秘老人: ['白发老头', '戴帽子的老头', '拄拐杖的老人', '光头老头子'],
  健康达人: ['年轻男人', '中年男人', '职场女士', '黑人女士'],
  AI顾客: ALL_KEYS,
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function pickPortraitKeyForCustomerType(type) {
  const pool = TYPE_TO_PORTRAIT_KEYS[type] || ALL_KEYS;
  const valid = pool.filter((k) => CUSTOMER_PORTRAIT_URL_BY_KEY[k]);
  return pick(valid.length ? valid : ALL_KEYS);
}

export function normalizePortraitIdentity(raw) {
  const s = String(raw ?? '').trim();
  if (CUSTOMER_PORTRAIT_URL_BY_KEY[s]) return s;
  for (const k of ALL_KEYS) {
    if (s.includes(k) || k.includes(s)) return k;
  }
  return pickPortraitKeyForCustomerType('AI顾客');
}

export function resolveCustomerPortraitUrl(customer) {
  if (!customer) return null;
  const key = customer.portraitKey || normalizePortraitIdentity(customer.identity);
  return CUSTOMER_PORTRAIT_URL_BY_KEY[key] || null;
}
