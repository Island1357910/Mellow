import type { CommerceProduct } from '../types';

const SHOP_ICONS = ['🎁', '👕', '⌚', '📱', '💐', '🧸', '💡', '🎧', '📷', '👟'];
const DELIVERY_ICONS = ['🧋', '🍔', '🍕', '🍰', '☕', '🍜', '🍣', '🥤', '🥗', '🍗'];

const SHOP_KEYWORDS: Record<string, { icon: string; category: string; basePrice: number }> = {
  键盘: { icon: '⌨️', category: '数码', basePrice: 399 },
  耳机: { icon: '🎧', category: '数码', basePrice: 599 },
  花: { icon: '💐', category: '礼物', basePrice: 199 },
  玩偶: { icon: '🧸', category: '礼物', basePrice: 128 },
  香水: { icon: '🌸', category: '美妆', basePrice: 520 },
  鞋: { icon: '👟', category: '服饰', basePrice: 699 },
  表: { icon: '⌚', category: '数码', basePrice: 1299 },
  相机: { icon: '📷', category: '数码', basePrice: 899 },
};

const DELIVERY_KEYWORDS: Record<string, { icon: string; category: string; basePrice: number }> = {
  奶茶: { icon: '🧋', category: '奶茶', basePrice: 18 },
  咖啡: { icon: '☕', category: '咖啡', basePrice: 28 },
  蛋糕: { icon: '🍰', category: '甜品', basePrice: 35 },
  烧烤: { icon: '🍢', category: '正餐', basePrice: 58 },
  面: { icon: '🍜', category: '正餐', basePrice: 26 },
  汉堡: { icon: '🍔', category: '快餐', basePrice: 38 },
  炸鸡: { icon: '🍗', category: '快餐', basePrice: 42 },
  寿司: { icon: '🍣', category: '正餐', basePrice: 55 },
  沙拉: { icon: '🥗', category: '轻食', basePrice: 32 },
};

function hashDesc(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** 本地根据描述生成商品（AI 不可用时的兜底） */
export function generateProductLocal(
  description: string,
  type: 'shop' | 'delivery'
): CommerceProduct {
  const text = description.trim() || '自定义好物';
  const icons = type === 'shop' ? SHOP_ICONS : DELIVERY_ICONS;
  const keywords = type === 'shop' ? SHOP_KEYWORDS : DELIVERY_KEYWORDS;

  let icon = icons[hashDesc(text) % icons.length];
  let category = type === 'shop' ? '自定义' : '自定义';
  let price = 30 + (hashDesc(text) % 20) * 5;

  for (const [key, meta] of Object.entries(keywords)) {
    if (text.includes(key)) {
      icon = meta.icon;
      category = meta.category;
      price = meta.basePrice + (hashDesc(text) % 5) * 10;
      break;
    }
  }

  const name = text.length > 14 ? `${text.slice(0, 14)}…` : text;

  return {
    id: `custom_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    price: Math.min(type === 'shop' ? 2999 : 199, Math.max(type === 'shop' ? 29 : 8, price)),
    icon,
    desc: text,
    category,
  };
}

/** 解析 AI 返回的 JSON 商品 */
export function parseProductFromAI(raw: string, type: 'shop' | 'delivery'): CommerceProduct | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as Partial<CommerceProduct>;
    if (!parsed.name) return null;
    return {
      id: `custom_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: String(parsed.name).slice(0, 20),
      price: Math.min(
        type === 'shop' ? 2999 : 199,
        Math.max(type === 'shop' ? 29 : 8, Number(parsed.price) || 50)
      ),
      icon: parsed.icon || (type === 'shop' ? '🎁' : '🧋'),
      desc: String(parsed.desc || parsed.name),
      category: parsed.category || '自定义',
    };
  } catch {
    return null;
  }
}
