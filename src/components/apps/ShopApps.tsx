import { ShoppingBag } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { askLine, readJson } from '../../lib/ask.ts'
import {
  DUOTAO,
  FLASH,
  addLine,
  arriveLabel,
  checkout,
  draftGoods,
  readCart,
  readCatalog,
  readDeliveries,
  stageOf,
  writeCart,
  writeCatalog,
  type CartLine,
  type Delivery,
  type Goods,
  type ShopId,
} from '../../lib/delivery.ts'
import { uid } from '../../lib/id.ts'
import { candyStyle } from '../../lib/candy.ts'
import { readCoins } from '../../lib/wallet.ts'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import type { Character } from '../../types/index.ts'
import { PillNote, Screen } from '../ui/primitives.tsx'

function usePhone() {
  const identities = useMellow((state) => state.identities)
  const activeIdentityId = useMellow((state) => state.activeIdentityId)
  return identities.find((item) => item.id === activeIdentityId) ?? null
}

function ShopApp(props: {
  shop: ShopId
  title: string
  tint: string
  goods: Goods[]
  layout: 'grid' | 'list'
  onBack: () => void
}) {
  const phone = usePhone()
  const paying = useRef(false)
  const [tab, setTab] = useState<'browse' | 'cart' | 'orders'>('browse')
  const [cat, setCat] = useState('全部')
  const [detail, setDetail] = useState<Goods | null>(null)
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [orders, setOrders] = useState<Delivery[]>([])
  const [chars, setChars] = useState<Character[]>([])
  const [coins, setCoins] = useState(0)
  const [who, setWho] = useState('self')
  const [told, setTold] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [catalog, setCatalog] = useState<Goods[]>([])
  const [wish, setWish] = useState('')
  const [ideas, setIdeas] = useState<Goods[]>([])
  const [finding, setFinding] = useState(false)

  useEffect(() => {
    if (!phone) return
    let stop = false
    void Promise.all([
      readCart(phone.namespace, props.shop),
      readDeliveries(phone.namespace),
      readCoins(phone.namespace),
      storage.listModernCharacters(phone.namespace),
      readCatalog(phone.namespace, props.shop),
    ]).then(([lines, rows, balance, people, extra]) => {
      if (stop) return
      setCart(lines)
      setOrders(rows.filter((item) => item.shop === props.shop))
      setCoins(balance)
      setChars(people)
      setCatalog(extra)
    })
    return () => {
      stop = true
    }
  }, [phone, props.shop])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  if (!phone) return null
  const shelf = [...props.goods, ...catalog]
  const cats = ['全部', ...Array.from(new Set(shelf.map((item) => item.cat)))]
  const goodsOf = (id: string) => shelf.find((item) => item.id === id)
  const lines = cart.map((line) => ({ ...line, goods: goodsOf(line.id) })).filter((line) => line.goods)
  const total = lines.reduce((sum, line) => sum + (line.goods?.price ?? 0) * line.qty, 0)
  const count = lines.reduce((sum, line) => sum + line.qty, 0)
  const shown = shelf.filter((item) => (cat === '全部' || item.cat === cat) && (!query.trim() || item.name.includes(query.trim())))
  const pin = (item: Goods) => {
    if (catalog.some((row) => row.id === item.id)) return
    const next = [item, ...catalog]
    setCatalog(next)
    setIdeas((current) => current.filter((row) => row.id !== item.id))
    void writeCatalog(phone.namespace, props.shop, next)
  }
  const seek = async () => {
    const text = wish.trim()
    if (!text || finding) return
    setFinding(true)
    setError('')
    const local = draftGoods(props.shop, text)
    try {
      const raw = await askLine(
        `你是${props.title}的店员。只返回 JSON 数组，正好 3 件货。每项 {"name":"名字","price":数字,"level":"普通或精致或稀有","blurb":"一句","emoji":"一个表情","cat":"分类","trait":"一句属性"}。价格在 4 到 80。三件是同一需求的不同等级。`,
        text,
        400,
      )
      const parsed = readJson(raw)
      if (!Array.isArray(parsed)) throw new Error('empty')
      const made = parsed.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const row = item as { name?: unknown; price?: unknown; level?: unknown; blurb?: unknown; emoji?: unknown; cat?: unknown; trait?: unknown }
        const name = typeof row.name === 'string' ? row.name.trim() : ''
        if (!name) return []
        const price = typeof row.price === 'number' ? Math.max(1, Math.round(row.price)) : 12
        return [{
          id: uid('good'),
          name: name.slice(0, 16),
          price,
          blurb: typeof row.blurb === 'string' ? row.blurb.slice(0, 24) : '',
          emoji: typeof row.emoji === 'string' && row.emoji.trim() ? row.emoji.trim().slice(0, 2) : '🎁',
          cat: typeof row.cat === 'string' && row.cat.trim() ? row.cat.trim().slice(0, 6) : '自定义',
          level: typeof row.level === 'string' ? row.level.slice(0, 4) : '普通',
          trait: typeof row.trait === 'string' ? row.trait.slice(0, 24) : '',
        }]
      })
      setIdeas(made.length ? made : local)
    } catch (reason) {
      setIdeas(local)
      if (reason instanceof Error && reason.message !== 'empty') setError(reason.message)
    } finally {
      setFinding(false)
    }
  }
  const recipientName = who === 'self' ? '我' : chars.find((item) => item.id === who)?.name ?? '我'

  const changeQty = (id: string, delta: number) => {
    const next = cart.flatMap((line) => {
      if (line.id !== id) return [line]
      const qty = line.qty + delta
      return qty > 0 ? [{ ...line, qty }] : []
    })
    setCart(next)
    void writeCart(phone.namespace, props.shop, next)
  }

  const pay = async () => {
    if (!lines.length || paying.current) return
    paying.current = true
    setError('')
    try {
      const order = await checkout({
        namespace: phone.namespace,
        shop: props.shop,
        items: lines.map((line) => ({ name: line.goods?.name ?? '', qty: line.qty, price: line.goods?.price ?? 0 })),
        recipient: who,
        recipientName,
        told: who !== 'self' && told,
        note,
      })
      setCart([])
      setOrders((current) => [order, ...current])
      setCoins(await readCoins(phone.namespace))
      setNote('')
      setTab('orders')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '没结成')
    } finally { paying.current = false }
  }

  return (
    <div className="sms-shell h-full min-h-0" style={candyStyle(props.tint, '#F8D0DC', '#D5F0E4')}>
      <Screen title={props.title} subtitle={`余额 ${coins} 枚 · 购物车 ${count}`} onBack={props.onBack}>
        <div className="mb-3 grid grid-cols-3 gap-1 rounded-full bg-white/70 p-1 text-xs">
          {([['browse', '逛'], ['cart', `购物车${count ? ` ${count}` : ''}`], ['orders', '订单']] as const).map(([id, label]) => (
            <button key={id} type="button" className="rounded-full py-1.5" style={{ background: tab === id ? props.tint : 'transparent' }} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        {tab === 'browse' ? (
          <>
            <form className="menu-card mb-3 space-y-2" onSubmit={(event) => { event.preventDefault(); void seek() }}>
              <p className="text-xs" style={{ color: 'var(--m-text-secondary)' }}>想要货单上没有的，说一声</p>
              <div className="flex gap-2">
                <input value={wish} onChange={(event) => setWish(event.target.value)} placeholder={props.shop === 'duotao' ? '比如一只旧唱片机' : '比如热的姜茶'} className="soft-input" />
                <button type="submit" className="chip chip-solid shrink-0" disabled={finding || !wish.trim()}>{finding ? '在找' : '找货'}</button>
              </div>
              {ideas.length > 0 ? (
                <div className="space-y-2">
                  {ideas.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2">
                      <ProductPicture item={item} className="h-10 w-10 shrink-0 rounded-xl" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm">{item.name}</span>
                        <span className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{item.level} · {item.price} 枚 · {item.trait || item.blurb}</span>
                      </span>
                      <button type="button" className="chip chip-mint" onClick={() => pin(item)}>加入货单</button>
                    </div>
                  ))}
                </div>
              ) : null}
              {error ? <PillNote tone="peach" inline>{error}</PillNote> : null}
            </form>
            <div className="shop-editorial mb-4 rounded-3xl p-5" style={{ background: `linear-gradient(135deg, ${props.tint}, var(--m-secondary))` }}><p className="text-[10px] tracking-[.2em]">{props.shop === 'duotao' ? 'MELLOW SELECT / 好物甄选' : 'FRESH & WARM / 好好吃饭'}</p><h2 className="mt-2 text-2xl font-semibold">{props.shop === 'duotao' ? '把日子过得有质感' : '热乎的，现在就想吃'}</h2><p className="mt-2 text-xs">{props.shop === 'duotao' ? '居家器物 · 随心礼物 · 每件都有故事' : '暖胃正餐 · 午后甜品 · 夜宵小食'}</p></div>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={props.shop === 'duotao' ? '搜一件' : '想吃什么'} className="soft-input mb-3" />
            <div className="mb-3 flex flex-wrap gap-1.5">
              {cats.map((item) => (
                <button key={item} type="button" className="chip" style={cat === item ? { background: props.tint } : undefined} onClick={() => setCat(item)}>{item}</button>
              ))}
            </div>
            {props.layout === 'grid' ? (
              <div className="grid grid-cols-2 gap-3">
                {shown.map((item) => (
                  <article key={item.id} className="menu-card">
                    <button className="w-full" aria-label={`查看${item.name}`} onClick={() => setDetail(item)}><ProductPicture item={item} className="h-32 w-full rounded-2xl object-cover" /></button>
                    <p className="mt-2 text-sm font-medium">{item.name}</p>
                    <p className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{item.level ? `${item.level} · ` : ''}{item.trait || item.blurb}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm">{item.price} 枚</span>
                      <button type="button" className="chip chip-solid" onClick={() => void addLine(phone.namespace, props.shop, item.id).then(setCart)}>加入</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <ul className="space-y-2">
                {shown.map((item) => (
                  <li key={item.id} className="menu-card flex items-center gap-3">
                    <button aria-label={`查看${item.name}`} onClick={() => setDetail(item)}><ProductPicture item={item} className="h-20 w-20 shrink-0 rounded-2xl object-cover" /></button>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{item.name}</span>
                      <span className="block text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{item.level ? `${item.level} · ` : ''}{item.trait || item.blurb} · {item.price} 枚</span>
                    </span>
                    <button type="button" className="chip chip-solid shrink-0" onClick={() => void addLine(phone.namespace, props.shop, item.id).then(setCart)}>加入</button>
                  </li>
                ))}
              </ul>
            )}
            {shown.length === 0 ? <PillNote tone="butter">没有找到</PillNote> : null}
          </>
        ) : null}
        {tab === 'cart' ? (
          <div className="space-y-3">
            {lines.length === 0 ? <PillNote tone="butter">购物车是空的</PillNote> : lines.map((line) => (
              <div key={line.id} className="menu-card flex items-center gap-3">
                {line.goods && <ProductPicture item={line.goods} className="h-12 w-12 shrink-0 rounded-xl" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{line.goods?.name}</span>
                  <span className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{line.goods?.price} 枚</span>
                </span>
                <button type="button" className="chip" onClick={() => changeQty(line.id, -1)}>-</button>
                <span className="w-4 text-center text-sm">{line.qty}</span>
                <button type="button" className="chip" onClick={() => changeQty(line.id, 1)}>+</button>
              </div>
            ))}
            <section className="menu-card">
              <p className="text-sm font-medium">收货人</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button type="button" className="chip" style={who === 'self' ? { background: props.tint } : undefined} onClick={() => setWho('self')}>我自己</button>
                {chars.map((person) => (
                  <button key={person.id} type="button" className="chip" style={who === person.id ? { background: props.tint } : undefined} onClick={() => setWho(person.id)}>{person.name}</button>
                ))}
              </div>
              {who !== 'self' ? (
                <button type="button" className="chip mt-2" style={told ? { background: '#D5F0E4' } : undefined} onClick={() => setTold((value) => !value)}>{told ? '已经提前跟 TA 说了' : '先不告诉 TA'}</button>
              ) : null}
              <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="留言，可以空着" className="soft-input mt-3" />
              <p className="mt-3 text-sm">合计 {total} 枚</p>
              <p className="mt-1 text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>下单后大约两三天送到。不会立刻出现在门口。</p>
              {error ? <div className="mt-2"><PillNote tone="peach" inline>{error}</PillNote></div> : null}
              <button type="button" className="chip chip-solid mt-3" disabled={!lines.length || coins < total} onClick={() => void pay()}>{coins < total && lines.length ? `还差 ${total - coins} 枚` : '结账'}</button>
            </section>
          </div>
        ) : null}
        {tab === 'orders' ? (
          <div className="space-y-2">
            {orders.length === 0 ? <PillNote tone="butter">还没有订单</PillNote> : orders.map((order) => (
              <article key={order.id} className="menu-card">
                <p className="text-sm font-medium">{order.items.map((item) => `${item.name}×${item.qty}`).join('、')}</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--m-text-secondary)' }}>送给 {order.recipientName} · {order.total} 枚</p>
                <p className="mt-2 text-sm">{stageOf(order, now)} · {arriveLabel(order, now)}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/5">
                  <div className="h-full rounded-full" style={{ width: now >= order.arrivesAt ? '100%' : `${Math.max(8, Math.min(92, ((now - order.createdAt) / Math.max(1, order.arrivesAt - order.createdAt)) * 100))}%`, background: props.tint }} />
                </div>
                {order.reacted ? <p className="mt-2 text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>对方已经在短信里提起这件事</p> : null}
              </article>
            ))}
          </div>
        ) : null}
        {detail && <div role="dialog" aria-modal="true" aria-label={detail.name} className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6" onClick={() => setDetail(null)}><article className="menu-card w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}><ProductPicture item={detail} className="h-48 w-full rounded-2xl object-contain" /><h2 className="text-xl font-semibold">{detail.name}</h2><p className="text-sm leading-6">{detail.blurb}。{detail.trait || (props.shop === 'flash' ? '可在订单留言填写口味偏好，送给角色时也能留一句话。' : '留给自己，或附上一句留言送给在意的人。')}</p><p className="text-sm">{detail.cat} · {detail.price} 枚</p><div className="flex gap-2"><button className="chip chip-solid" onClick={() => void addLine(phone.namespace, props.shop, detail.id).then(setCart).then(() => setDetail(null))}>加入购物车</button><button className="chip" onClick={() => setDetail(null)}>关闭</button></div></article></div>}
      </Screen>
    </div>
  )
}

export function DuotaoApp(props: { onBack: () => void }) {
  return <ShopApp shop="duotao" title="多淘" tint="#F3C27A" goods={DUOTAO} layout="grid" onBack={props.onBack} />
}

export function FlashApp(props: { onBack: () => void }) {
  return <ShopApp shop="flash" title="闪送" tint="#F0C56A" goods={FLASH} layout="list" onBack={props.onBack} />
}

const PRODUCT_CELLS: Record<string, [number, number]> = {
  cup: [1,0], lamp: [1,9], daisy: [1,2], notebook: [1,5], cake: [1,1], noodle: [1,11], dumpling: [1,17],
  blanket: [2,0], ribbon: [2,1], card: [2,2], scarf: [2,3], pen: [2,4], tea: [2,5], taro: [2,6], rice: [2,7], porridge: [2,8], pudding: [2,9], oden: [2,10], pajama: [2,11],
}
function ProductPicture({ item, className }: { item: Goods; className: string }) {
  const cell = PRODUCT_CELLS[item.id]
  if (!cell) return <span role="img" aria-label={item.name} className={className + ' grid place-items-center bg-white/50'}><ShoppingBag size={30} strokeWidth={1.5} /></span>
  const [atlas, index] = cell
  const rows = atlas === 1 ? 5 : 3
  return <span role="img" aria-label={item.name} data-holiday-preserve className={className + ' block product-illustration'} style={{ backgroundImage: 'url(' + import.meta.env.BASE_URL + 'goods/product-atlas-v' + atlas + '.png)', backgroundSize: '400% ' + rows * 100 + '%', backgroundPosition: (index % 4) / 3 * 100 + '% ' + Math.floor(index / 4) / (rows - 1) * 100 + '%' }} />
}
