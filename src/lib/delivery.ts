import { ensureDirectChat } from '../domain/messaging.ts'
import { askLine } from './ask.ts'
import { uid } from './id.ts'
import { addCoins, readCoins } from './wallet.ts'
import { storage } from '../storage/StorageService.ts'
import type { Character, ChatMessage } from '../types/index.ts'

export type ShopId = 'duotao' | 'flash'

export interface Goods {
  id: string
  name: string
  price: number
  blurb: string
  emoji: string
  cat: string
  level?: string
  trait?: string
}

export interface CartLine {
  id: string
  qty: number
}

export interface DeliveryItem {
  name: string
  qty: number
  price: number
}

export interface Delivery {
  id: string
  shop: ShopId
  items: DeliveryItem[]
  total: number
  recipient: string
  recipientName: string
  told: boolean
  note: string
  createdAt: number
  arrivesAt: number
  reacted: boolean
}

export const DUOTAO: Goods[] = [
  { id: 'cup', name: '雾面杯子', price: 12, blurb: '捧着刚好', emoji: '🥛', cat: '居家' },
  { id: 'lamp', name: '小夜灯', price: 28, blurb: '睡前那一点', emoji: '💡', cat: '居家' },
  { id: 'blanket', name: '薄毯子', price: 36, blurb: '盖到胸口', emoji: '🛏️', cat: '居家' },
  { id: 'ribbon', name: '细缎带', price: 6, blurb: '可以系礼物', emoji: '🎀', cat: '礼物' },
  { id: 'daisy', name: '小雏菊', price: 18, blurb: '一小把', emoji: '🌼', cat: '礼物' },
  { id: 'card', name: '空白明信片', price: 4, blurb: '背面还空着', emoji: '💌', cat: '礼物' },
  { id: 'pajama', name: '柔软睡衣', price: 42, blurb: '洗过会更软', emoji: '👕', cat: '衣服' },
  { id: 'scarf', name: '围巾', price: 26, blurb: '风大的时候', emoji: '🧣', cat: '衣服' },
  { id: 'notebook', name: '浅色笔记本', price: 9, blurb: '格子很轻', emoji: '📓', cat: '文具' },
  { id: 'pen', name: '一支笔', price: 5, blurb: '写得出字', emoji: '🖊️', cat: '文具' },
]

export const FLASH: Goods[] = [
  { id: 'tea', name: '热茶', price: 8, blurb: '温的', emoji: '🍵', cat: '奶茶' },
  { id: 'taro', name: '芋泥', price: 14, blurb: '甜一点', emoji: '🧋', cat: '奶茶' },
  { id: 'rice', name: '一份饭', price: 16, blurb: '刚好一口', emoji: '🍱', cat: '正餐' },
  { id: 'noodle', name: '一碗面', price: 15, blurb: '热汤', emoji: '🍜', cat: '正餐' },
  { id: 'porridge', name: '粥', price: 10, blurb: '晚上也行', emoji: '🥣', cat: '正餐' },
  { id: 'cake', name: '小蛋糕', price: 14, blurb: '一角', emoji: '🍰', cat: '甜品' },
  { id: 'pudding', name: '布丁', price: 9, blurb: '凉的', emoji: '🍮', cat: '甜品' },
  { id: 'dumpling', name: '煎饺', price: 12, blurb: '夜宵', emoji: '🥟', cat: '夜宵' },
  { id: 'oden', name: '关东煮', price: 11, blurb: '热气', emoji: '🍢', cat: '夜宵' },
]

const pending = new Set<string>()

function cartKey(shop: ShopId): string {
  return shop === 'duotao' ? 'cart_duotao' : 'cart_flash'
}

function catalogKey(shop: ShopId): string {
  return shop === 'duotao' ? 'catalog_duotao' : 'catalog_flash'
}

export async function readCatalog(namespace: string, shop: ShopId): Promise<Goods[]> {
  return (await storage.getBag<Goods[]>(namespace, catalogKey(shop))) ?? []
}

export async function writeCatalog(namespace: string, shop: ShopId, goods: Goods[]): Promise<void> {
  await storage.setBag(namespace, catalogKey(shop), goods.slice(0, 40))
}

export function draftGoods(shop: ShopId, wish: string): Goods[] {
  const text = wish.trim().slice(0, 12) || (shop === 'flash' ? '夜宵' : '礼物')
  const rows = [
    { level: '普通', price: shop === 'flash' ? 9 : 12, trait: '日常能买到' },
    { level: '精致', price: shop === 'flash' ? 18 : 28, trait: '包装更好' },
    { level: '稀有', price: shop === 'flash' ? 32 : 48, trait: '不常有' },
  ]
  return rows.map((row, index) => ({
    id: uid('good'),
    name: index === 0 ? text : `${text} · ${row.level}`,
    price: row.price,
    blurb: row.trait,
    emoji: shop === 'flash' ? '🍱' : '🎁',
    cat: '自定义',
    level: row.level,
    trait: row.trait,
  }))
}

export async function readCart(namespace: string, shop: ShopId): Promise<CartLine[]> {
  return (await storage.getBag<CartLine[]>(namespace, cartKey(shop))) ?? []
}

export async function writeCart(namespace: string, shop: ShopId, lines: CartLine[]): Promise<void> {
  await storage.setBag(namespace, cartKey(shop), lines)
}

export async function addLine(namespace: string, shop: ShopId, goodsId: string): Promise<CartLine[]> {
  const cart = await readCart(namespace, shop)
  const found = cart.find((line) => line.id === goodsId)
  const next = found ? cart.map((line) => (line.id === goodsId ? { ...line, qty: line.qty + 1 } : line)) : [...cart, { id: goodsId, qty: 1 }]
  await writeCart(namespace, shop, next)
  return next
}

export async function readDeliveries(namespace: string): Promise<Delivery[]> {
  return (await storage.getBag<Delivery[]>(namespace, 'deliveries')) ?? []
}

export function stageOf(order: Delivery, now: number): string {
  if (now >= order.arrivesAt) return '已送达'
  const span = Math.max(1, order.arrivesAt - order.createdAt)
  const progress = (now - order.createdAt) / span
  if (progress < 0.2) return '已揽收'
  if (progress < 0.65) return '运输中'
  return '派送中'
}

export function arriveLabel(order: Delivery, now: number): string {
  if (now >= order.arrivesAt) return '已经到了'
  const days = Math.max(1, Math.ceil((order.arrivesAt - now) / 86_400_000))
  return `大约 ${days} 天到`
}

export async function checkout(input: {
  namespace: string
  shop: ShopId
  items: DeliveryItem[]
  recipient: string
  recipientName: string
  told: boolean
  note: string
}): Promise<Delivery> {
  const total = input.items.reduce((sum, item) => sum + item.price * item.qty, 0)
  const coins = await readCoins(input.namespace)
  if (coins < total) throw new Error('枚不够')
  await addCoins(input.namespace, -total)
  const now = Date.now()
  const order: Delivery = {
    id: uid('order'),
    shop: input.shop,
    items: input.items,
    total,
    recipient: input.recipient,
    recipientName: input.recipientName,
    told: input.told,
    note: input.note.trim(),
    createdAt: now,
    arrivesAt: now + (2 + Math.random()) * 86_400_000,
    reacted: false,
  }
  const all = await readDeliveries(input.namespace)
  await storage.setBag(input.namespace, 'deliveries', [order, ...all])
  await writeCart(input.namespace, input.shop, [])
  return order
}

async function say(namespace: string, person: Character, text: string): Promise<void> {
  const chat = await ensureDirectChat(namespace, person)
  const message: ChatMessage = {
    id: uid('msg'),
    chatId: chat.id,
    role: 'assistant',
    kind: 'text',
    content: text,
    charId: person.id,
    createdAt: Date.now(),
    status: 'sent',
  }
  await storage.putMessage(namespace, message)
  const fresh = (await storage.getChat(namespace, chat.id)) ?? chat
  await storage.putChat(namespace, {
    ...fresh,
    lastMessage: text,
    lastMessageAt: message.createdAt,
    updatedAt: message.createdAt,
    unread: fresh.unread + 1,
  })
}

export async function tickDeliveries(namespace: string, chars: Character[]): Promise<boolean> {
  const orders = await readDeliveries(namespace)
  const now = Date.now()
  let changed = false
  const moments = (await storage.getBag<Array<{ id: string; author: string; text: string; at: number }>>(namespace, 'moments')) ?? []
  const extra: Array<{ id: string; author: string; text: string; at: number }> = []
  for (const order of orders) {
    if (order.reacted || order.recipient === 'self' || now < order.arrivesAt || pending.has(order.id)) continue
    const person = chars.find((item) => item.id === order.recipient)
    if (!person) {
      order.reacted = true
      changed = true
      continue
    }
    pending.add(order.id)
    const names = order.items.map((item) => item.name).join('、')
    const fallback = order.told
      ? `${names}到了。${order.note || '我很喜欢。'}`
      : `门口有个包裹，拆开是${names}。是你买的吗？`
    let text = fallback
    try {
      const line = await askLine(
        `你是${person.name}。用一两句口语发短信。${order.told ? '对方提前说过要给你买这些，你刚收到，高兴。' : '你事先不知道这个包裹，觉得可能是对方买的，问一句。'}不要加引号。`,
        `包裹里是：${names}${order.note ? `。留言：${order.note}` : ''}`,
        80,
      )
      if (line) text = line.replace(/^["“]|["”]$/g, '').slice(0, 140)
    } catch {
      text = fallback
    }
    try {
      await say(namespace, person, text)
      extra.push({
        id: uid('moment'),
        author: person.name,
        text: order.told ? `有人给我买了${names}。` : `收到一份${names}，还不知道是谁送的。`,
        at: Date.now(),
      })
      order.reacted = true
      changed = true
    } finally {
      pending.delete(order.id)
    }
  }
  if (extra.length) await storage.setBag(namespace, 'moments', [...extra, ...moments])
  if (changed) await storage.setBag(namespace, 'deliveries', orders)
  return changed
}
