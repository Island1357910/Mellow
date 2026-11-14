import { GIFTS } from '../data/gifts';
import { SHOP_PRODUCTS } from '../data/shopProducts';
import { DELIVERY_ITEMS } from '../data/deliveryItems';
import type { CommerceProduct, Gift } from '../types';

function formatGiftLine(gifts: Gift[]): string {
  return gifts.map((g) => `${g.icon}${g.name}(${g.price}币${g.isBig ? '·全屏' : ''})`).join('、');
}

function formatProductLine(products: CommerceProduct[]): string {
  return products.map((p) => `${p.icon}${p.name}(约${p.price}元)`).join('、');
}

function groupProductsByCategory(products: CommerceProduct[]): string {
  const map = new Map<string, CommerceProduct[]>();
  for (const p of products) {
    const list = map.get(p.category) ?? [];
    list.push(p);
    map.set(p.category, list);
  }
  return Array.from(map.entries())
    .map(([cat, items]) => `${cat}：${formatProductLine(items)}`)
    .join('\n');
}

/** 直播间虚拟礼物清单（按价位档） */
export function formatVirtualGiftCatalogForPrompt(): string {
  const small = GIFTS.filter((g) => g.price <= 10);
  const mid = GIFTS.filter((g) => g.price >= 20 && g.price <= 99);
  const large = GIFTS.filter((g) => g.price >= 100 && g.price <= 520);
  const luxury = GIFTS.filter((g) => g.price >= 1000);
  return [
    `小额：${formatGiftLine(small)}`,
    `中档：${formatGiftLine(mid)}`,
    `大额：${formatGiftLine(large)}`,
    `豪华全屏特效：${formatGiftLine(luxury)}`,
  ].join('\n');
}

/** 淘淘购实体礼物清单（按分类） */
export function formatShopCatalogForPrompt(): string {
  return groupProductsByCategory(SHOP_PRODUCTS);
}

/** 美团外卖清单（按分类） */
export function formatDeliveryCatalogForPrompt(): string {
  return groupProductsByCategory(DELIVERY_ITEMS);
}
