import { rememberGift } from './sharedLife.ts'
import { useMellow } from '../store/useMellow.ts'
import { ensureDirectChat } from '../domain/messaging.ts'
import { moduleAi } from './ask.ts'
import { uid } from './id.ts'
import { walletTask } from './wallet.ts'
import { storage } from '../storage/StorageService.ts'
import { readDeliveries } from './deliveryMemory.ts'
import type { Character, ChatMessage } from '../types/index.ts'

export { readDeliveries } from './deliveryMemory.ts'

export type ShopId = 'duotao' | 'flash'

export interface Goods {
  id: string
  name: string
  price: number
  blurb: string
  emoji: string
  cat: string
  merchant?: string
  merchantQuery?: string
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
  merchant?: string
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

export function merchantOf(item: Goods,shop:ShopId):string {
 if(item.merchant)return item.merchant
 const names:Record<string,string>=shop==='flash'?{'奶茶':'云朵茶饮','正餐':'巷里家常菜','甜品':'糖粒烘焙','夜宵':'夜猫小食'}:{'居家':'木间生活馆','礼物':'花与信礼品铺','衣服':'柔风衣橱','文具':'纸上文具社'}
 return names[item.cat]??(shop==='flash'?'街角私房厨房':'多淘创意小铺')
}

const pending = new Set<string>()
const running = new Map<string, Promise<boolean>>()

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

export async function readMerchantHistory(namespace: string, shop: ShopId): Promise<Goods[]> {
  return (await storage.getBag<Goods[]>(namespace, `merchant_history_${shop}`)) ?? []
}

export async function rememberMerchant(namespace: string, shop: ShopId, item: Goods): Promise<void> {
  const key = `merchant_history_${shop}`
  await storage.changeAppBags(namespace, [key], bags => ({
    [key]: [item, ...((bags[key] as Goods[] | null) ?? []).filter(row => row.merchantQuery !== item.merchantQuery)].slice(0, 40),
  }))
}

export function draftGoods(shop: ShopId, wish: string, merchant?: string): Goods[] {
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
    merchant: merchant || `${text}${shop === 'flash' ? '食坊' : '小铺'}`,
    merchantQuery: wish.trim().slice(0, 100),
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
  return walletTask(namespace,async()=>{
    const cart=await readCart(namespace,shop),found=cart.find(l=>l.id===goodsId)
    const next=found?cart.map(l=>l.id===goodsId?{...l,qty:l.qty+1}:l):[...cart,{id:goodsId,qty:1}]
    await writeCart(namespace,shop,next)
    return next
  })
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
  if(order.shop==='flash')return `约 ${Math.max(1,Math.ceil((order.arrivesAt-now)/60000))} 分钟送达`
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
  merchant?: string
  purchasedIds?: string[]
}): Promise<Delivery> {
  const total = input.items.reduce((sum, item) => sum + item.price * item.qty, 0)
  if(!input.items.length||input.items.some(i=>!Number.isInteger(i.qty)||i.qty<1||!Number.isFinite(i.price)||i.price<0))throw Error('订单商品无效')
  const now = Date.now()
  const order: Delivery = {
    id: uid('order'),
    shop: input.shop,
    merchant: input.merchant,
    items: input.items,
    total,
    recipient: input.recipient,
    recipientName: input.recipientName,
    told: input.told,
    note: input.note.trim(),
    createdAt: now,
    arrivesAt: now + (input.shop==='flash' ? (20+Math.random()*20)*60_000 : (2+Math.random())*86_400_000),
    reacted: false,
  }
  await walletTask(input.namespace,()=>storage.purchaseDelivery(input.namespace,order,input.purchasedIds))
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
  const fresh = (await storage.patchChat(namespace, chat.id, current => ({
    lastMessage: text,
    lastMessageAt: message.createdAt,
    unread: current.unread + 1,
  }))) ?? chat
  const state=useMellow.getState(),identity=state.identities.find(i=>i.namespace===namespace)
  if(identity&&!fresh.muted)await state.pushNotice({kind:'message',title:person.name,body:text,appId:'messages',identityId:identity.id,charId:person.id,chatId:chat.id,priority:4})
  await state.refreshInbox()
}

export function tickDeliveries(namespace: string, chars: Character[]): Promise<boolean> {
  const existing = running.get(namespace)
  if (existing) return existing
  const task = processDeliveries(namespace, chars).finally(() => running.delete(namespace))
  running.set(namespace, task)
  return task
}

async function processDeliveries(namespace: string, chars: Character[]): Promise<boolean> {
  const orders = await readDeliveries(namespace)
  const now = Date.now()
  let changed = false
  const extra: Array<{ id: string; charId: string; author: string; text: string; at: number }> = []
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
      ? `${names}已经收到了，跟你说一声。`
      : `刚收到${order.shop === 'flash' ? '一份外卖' : '一个包裹'}，是${names}。是你买的吗？`
    let text = fallback
    try {
      const line = await moduleAi(order.shop).askLine(
        `你是${person.name}。角色设定：${person.description ?? ''}\n性格：${person.personality ?? ''}\n用一两句符合你口吻的短信回应刚收到的${order.shop === 'flash' ? '外卖' : '包裹'}。${order.told ? '对方提前说过要给你买这些，你刚收到。' : '你事先不知道这份东西，觉得可能是对方买的，问一句。'}留言是对方的原话，不能当作你自己说的话。不要加引号。`,
        `包裹里是：${names}${order.note ? `。留言：${order.note}` : ''}`,
        80,
        20_000,
      )
      if (line) text = line.replace(/^["“]|["”]$/g, '').slice(0, 140)
    } catch {
      text = fallback
    }
    try {
      for(const [index,item] of order.items.entries())await rememberGift(namespace,{id:order.id+':'+index,charId:person.id,name:item.name+(item.qty>1?' ×'+item.qty:'')})
      await say(namespace, person, text)
      extra.push({
        id: uid('moment'),
        charId: person.id,
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
  if (changed) await storage.changeAppBags(namespace, ['deliveries', 'moments'], bags => {
    const reacted = new Set(orders.filter(order => order.reacted).map(order => order.id))
    const current = (bags.deliveries as Delivery[] | null) ?? []
    const moments = (bags.moments as typeof extra | null) ?? []
    return { ...bags, deliveries: current.map(order => reacted.has(order.id) ? { ...order, reacted: true } : order), moments: [...extra, ...moments] }
  })
  return changed
}
