import { motion } from 'framer-motion'
import { Gift, Mic, MicOff, PhoneOff, Truck, Volume2, Wallet, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { GIFT_COUNTS, REAL_GIFTS, VIRTUAL_GIFTS, type GiftItem } from '../../data/gifts.ts'
import { parseCard } from '../../engine/prompt.ts'
import { initialOf } from '../../lib/format.ts'
import { addCoins, readCoins } from '../../lib/wallet.ts'
import type { Character, ChatMessage } from '../../types/index.ts'

const dim = { color: 'var(--m-text-secondary)' }

function Face(props: { person: Character | undefined; size?: number }) {
  const size = props.size ?? 32
  const avatar = props.person?.avatar ?? ''
  const name = props.person?.nickname || props.person?.name || '群'
  if (avatar.startsWith('data:')) return <img src={avatar} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  return <span className="grid shrink-0 place-items-center rounded-full text-xs" style={{ width: size, height: size, background: 'var(--m-secondary)' }}>{avatar || initialOf(name)}</span>
}

function Sheet(props: { title: string; tint: string; onClose: () => void; children: ReactNode }) {
  return (
    <motion.div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/25" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={props.onClose}>
      <motion.div
        className="sms-shell max-h-[86%] overflow-auto rounded-t-[30px] px-4 pb-10 pt-3 shadow-[0_-12px_30px_rgba(90,70,80,0.15)]"
        initial={{ y: 60 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        onClick={(event) => event.stopPropagation()}
      >
        <span className="mx-auto mb-2 block h-1 w-10 rounded-full bg-black/10" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[17px] font-semibold"><span className="h-5 w-1.5 rounded-full" style={{ background: props.tint }} />{props.title}</h2>
          <button type="button" aria-label="关闭" className="grid h-8 w-8 place-items-center rounded-full bg-white/85" onClick={props.onClose}><X size={15} /></button>
        </div>
        {props.children}
      </motion.div>
    </motion.div>
  )
}

function Recipients(props: { people: Character[]; value: string; onChange: (id: string) => void; allowAll?: boolean }) {
  const options = props.allowAll ? [{ id: 'all', label: '全体' }, ...props.people.map((item) => ({ id: item.id, label: item.nickname || item.name }))] : props.people.map((item) => ({ id: item.id, label: item.nickname || item.name }))
  return (
    <div className="no-bar flex flex-wrap gap-2">
      {options.map((option) => {
        const person = props.people.find((item) => item.id === option.id)
        const on = props.value === option.id
        return (
          <button key={option.id} type="button" className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-xs transition-colors" style={{ background: on ? '#F8D0DC' : 'rgba(255,255,255,0.85)', boxShadow: on ? 'inset 0 0 0 1.5px #F3A8BA' : 'none' }} onClick={() => props.onChange(option.id)}>
            {person ? <Face person={person} size={22} /> : <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-[#F8E6C0] text-[10px]">全</span>}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

const QUICK_AMOUNTS = ['5.20', '8.88', '13.14', '52', '66', '520']

export function MoneySheet(props: { mode: 'redpacket' | 'transfer'; group: boolean; people: Character[]; onClose: () => void; onSend: (content: string) => void }) {
  const red = props.mode === 'redpacket'
  const [amount, setAmount] = useState(red ? '8.88' : '52')
  const [note, setNote] = useState('')
  const [count, setCount] = useState(Math.max(1, Math.min(props.people.length, 5)))
  const [lucky, setLucky] = useState(true)
  const [to, setTo] = useState(props.people[0]?.id ?? '')
  const value = Number(amount)
  const valid = Number.isFinite(value) && value > 0 && value <= 200000
  const target = props.people.find((item) => item.id === to)
  const send = () => {
    if (!valid) return
    const money = value.toFixed(2).replace(/\.00$/, '')
    if (red) props.onSend(`[红包] ${money}｜${note.trim() || '恭喜发财，大吉大利'}｜${props.group ? `${count} 个 · ${lucky ? '拼手气' : '普通'}红包` : ''}`)
    else props.onSend(`[转账] ${money}｜${note.trim()}｜给 ${target?.nickname || target?.name || '对方'}`)
    props.onClose()
  }
  return (
    <Sheet title={red ? '发红包' : '转账'} tint={red ? '#F58C8C' : '#F2B48A'} onClose={props.onClose}>
      <div className="relative overflow-hidden rounded-[24px] p-4 text-white shadow-[0_12px_24px_rgba(240,140,110,0.25)]" style={{ background: red ? 'linear-gradient(140deg,#F27B7B,#F3A8BA)' : 'linear-gradient(140deg,#F2A66E,#F0C56A)' }}>
        <span className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/15" />
        <p className="flex items-center gap-1.5 text-xs opacity-90">{red ? <Gift size={13} /> : <Wallet size={13} />}{red ? (props.group ? '群红包' : '红包') : `转给 ${target?.nickname || target?.name || '对方'}`}</p>
        <label className="mt-2 flex items-baseline gap-1">
          <span className="text-2xl">¥</span>
          <input value={amount} inputMode="decimal" aria-label="金额" onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ''))} className="min-w-0 flex-1 bg-transparent text-4xl font-semibold text-white outline-none placeholder:text-white/60" placeholder="0" />
        </label>
        <p className="mt-1 text-[11px] opacity-85">{red ? note.trim() || '恭喜发财，大吉大利' : note.trim() || '添加转账说明'}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {QUICK_AMOUNTS.map((item) => (
          <button key={item} type="button" className={amount === item ? 'chip chip-pink' : 'chip'} style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => setAmount(item)}>¥{item}</button>
        ))}
      </div>
      <section className="menu-card mt-3 space-y-3">
        {!red && props.group ? (
          <div>
            <p className="mb-1.5 text-xs" style={dim}>转给谁</p>
            <Recipients people={props.people} value={to} onChange={setTo} />
          </div>
        ) : null}
        {red && props.group ? (
          <>
            <div className="flex items-center justify-between text-sm">
              <span>红包个数</span>
              <span className="flex items-center gap-2">
                <button type="button" className="chip" style={{ padding: '2px 10px' }} onClick={() => setCount((value) => Math.max(1, value - 1))}>−</button>
                <span className="w-6 text-center tabular-nums">{count}</span>
                <button type="button" className="chip" style={{ padding: '2px 10px' }} onClick={() => setCount((value) => Math.min(100, value + 1))}>＋</button>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-full bg-black/[0.04] p-0.5">
              {[true, false].map((item) => (
                <button key={String(item)} type="button" className="rounded-full py-1.5 text-xs" style={{ background: lucky === item ? 'white' : 'transparent', fontWeight: lucky === item ? 600 : 400 }} onClick={() => setLucky(item)}>{item ? '拼手气红包' : '普通红包'}</button>
              ))}
            </div>
          </>
        ) : null}
        <label className="block text-xs" style={dim}>
          {red ? '祝福语' : '转账说明'}
          <input value={note} maxLength={30} onChange={(event) => setNote(event.target.value)} placeholder={red ? '恭喜发财，大吉大利' : '比如：今天的奶茶钱'} className="soft-input mt-1" />
        </label>
      </section>
      <button type="button" disabled={!valid} className="mt-4 w-full rounded-full py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(240,120,110,0.3)] disabled:opacity-50" style={{ background: red ? '#F27B7B' : '#F2A66E' }} onClick={send}>
        {red ? `塞钱进红包 ¥${valid ? amount : '0'}` : `确认转账 ¥${valid ? amount : '0'}`}
      </button>
    </Sheet>
  )
}

export function GiftSheet(props: { namespace: string; people: Character[]; onClose: () => void; onSend: (content: string) => void }) {
  const [tab, setTab] = useState<'virtual' | 'real'>('virtual')
  const [to, setTo] = useState(props.people[0]?.id ?? 'all')
  const [pick, setPick] = useState<GiftItem>(VIRTUAL_GIFTS[1] ?? VIRTUAL_GIFTS[0]!)
  const [count, setCount] = useState<number>(1)
  const [note, setNote] = useState('')
  const [coins, setCoins] = useState<number | null>(null)
  const [warn, setWarn] = useState('')
  useEffect(() => {
    let alive = true
    void readCoins(props.namespace).then((value) => {
      if (alive) setCoins(value)
    })
    return () => {
      alive = false
    }
  }, [props.namespace])
  const target = props.people.find((item) => item.id === to)
  const who = to === 'all' ? '全体群友' : target?.nickname || target?.name || '对方'
  const real = tab === 'real'
  const total = real ? pick.price : pick.price * count * (to === 'all' ? Math.max(1, props.people.length) : 1)
  const switchTab = (next: 'virtual' | 'real') => {
    setTab(next)
    setPick(next === 'real' ? REAL_GIFTS[0]! : VIRTUAL_GIFTS[1]!)
    setCount(1)
    setWarn('')
    if (next === 'real' && to === 'all') setTo(props.people[0]?.id ?? 'all')
  }
  const send = async () => {
    if (coins === null) return
    if (coins < total) {
      setWarn(`糖币不够，还差 ${total - coins}。去乘风玩一局就有啦`)
      return
    }
    setCoins(await addCoins(props.namespace, -total))
    props.onSend(real ? `[实物] ${pick.icon}｜${pick.name}｜送给 ${who}｜${note.trim()}` : `[礼物] ${pick.icon}｜${pick.name} ×${count}｜送给 ${who}｜${note.trim()}`)
    props.onClose()
  }
  const list = real ? REAL_GIFTS : VIRTUAL_GIFTS
  return (
    <Sheet title="群礼物" tint="#C9B6E8" onClose={props.onClose}>
      <div className="flex items-center justify-between rounded-[20px] bg-[linear-gradient(120deg,#EFE6FF,#FFE3EE)] px-3 py-2.5">
        <span className="text-xs" style={dim}>我的糖币</span>
        <span className="text-lg font-semibold tabular-nums text-[#7a5fb0]">🍬 {coins ?? '…'}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1 rounded-full bg-white/85 p-1">
        {(['virtual', 'real'] as const).map((id) => (
          <button key={id} type="button" className="rounded-full py-1.5 text-xs transition-colors" style={{ background: tab === id ? '#C9B6E8' : 'transparent', color: tab === id ? '#fff' : 'var(--m-text-secondary)', fontWeight: tab === id ? 600 : 400 }} onClick={() => switchTab(id)}>
            {id === 'virtual' ? '虚拟礼物' : '实物礼物'}
          </button>
        ))}
      </div>
      <div className="mt-3">
        <p className="mb-1.5 text-xs" style={dim}>送给</p>
        <Recipients people={props.people} value={to} onChange={setTo} allowAll={!real} />
      </div>
      {real ? (
        <ul className="mt-3 space-y-2">
          {list.map((item) => {
            const on = pick.id === item.id
            return (
              <li key={item.id}>
                <button type="button" className="flex w-full items-center gap-3 rounded-[20px] bg-white/90 p-2.5 text-left transition-shadow" style={{ boxShadow: on ? 'inset 0 0 0 1.5px #C9B6E8' : '0 4px 12px rgba(120,80,100,0.05)' }} onClick={() => setPick(item)}>
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-[#F6F1FF] text-2xl">{item.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm">{item.name}</span>
                    <span className="flex items-center gap-1 text-[11px]" style={dim}><Truck size={11} />{item.note}</span>
                  </span>
                  <span className="text-sm font-semibold text-[#7a5fb0]">🍬{item.price}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {list.map((item) => {
              const on = pick.id === item.id
              return (
                <motion.button key={item.id} type="button" whileTap={{ scale: 0.92 }} className="flex flex-col items-center rounded-[20px] bg-white/90 py-2.5" style={{ boxShadow: on ? 'inset 0 0 0 1.5px #C9B6E8' : '0 4px 12px rgba(120,80,100,0.05)', background: on ? '#F6F1FF' : undefined }} onClick={() => setPick(item)}>
                  <motion.span className="text-3xl" animate={on ? { y: [0, -4, 0] } : { y: 0 }} transition={{ repeat: on ? Infinity : 0, duration: 1.2 }}>{item.icon}</motion.span>
                  <span className="mt-1 text-xs">{item.name}</span>
                  <span className="text-[10px] text-[#7a5fb0]">🍬{item.price}</span>
                </motion.button>
              )
            })}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs" style={dim}>数量</span>
            {GIFT_COUNTS.map((item) => (
              <button key={item} type="button" className={count === item ? 'chip chip-lilac' : 'chip'} style={{ fontSize: 12, padding: '3px 12px' }} onClick={() => setCount(item)}>×{item}</button>
            ))}
          </div>
        </>
      )}
      <input value={note} maxLength={30} onChange={(event) => setNote(event.target.value)} placeholder={real ? '写张贺卡，随礼物一起送到' : '说点什么（可不填）'} className="soft-input mt-3" />
      {warn ? <p className="mt-2 text-center text-xs text-[#b0505c]">{warn}</p> : null}
      <button type="button" disabled={coins === null} className="mt-3 w-full rounded-full py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(160,130,210,0.35)]" style={{ background: 'linear-gradient(120deg,#B9A3E3,#F3A8BA)' }} onClick={() => void send()}>
        {real ? `购买并送给 ${who} · 🍬${total}` : `赠送 ${pick.name} ×${count} · 🍬${total}`}
      </button>
    </Sheet>
  )
}

function clock(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export function CallScreen(props: { title: string; person: Character | undefined; group: boolean; onEnd: (content: string) => void }) {
  const [connected, setConnected] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [muted, setMuted] = useState(false)
  const [speaker, setSpeaker] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setConnected(true), 2200)
    return () => window.clearTimeout(timer)
  }, [])
  useEffect(() => {
    if (!connected) return
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [connected])
  const hangUp = () => props.onEnd(connected ? `${props.group ? '群语音通话' : '语音通话'} · 通话时长 ${clock(seconds)}` : `${props.group ? '群语音通话' : '语音通话'} · 已取消`)
  return (
    <motion.div className="absolute inset-0 z-50 flex flex-col items-center justify-between bg-[linear-gradient(170deg,#3a3242,#5b4a63_55%,#c98ea2)] px-6 pb-16 pt-24 text-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex flex-col items-center">
        <div className="relative">
          {!connected ? <motion.span className="absolute inset-0 rounded-full bg-white/25" animate={{ scale: [1, 1.5], opacity: [0.6, 0] }} transition={{ repeat: Infinity, duration: 1.4 }} /> : null}
          <div className="relative overflow-hidden rounded-full ring-4 ring-white/20"><Face person={props.person} size={96} /></div>
        </div>
        <p className="mt-5 text-xl font-semibold">{props.title}</p>
        <p className="mt-1 text-sm opacity-75">{connected ? clock(seconds) : '正在等待对方接听…'}</p>
      </div>
      <div className="grid w-full max-w-xs grid-cols-3 items-end gap-4 text-center text-[11px]">
        <button type="button" aria-pressed={muted} className="flex flex-col items-center gap-2" onClick={() => setMuted((value) => !value)}>
          <span className="grid h-14 w-14 place-items-center rounded-full" style={{ background: muted ? '#fff' : 'rgba(255,255,255,0.18)', color: muted ? '#3a3242' : '#fff' }}>{muted ? <MicOff size={22} /> : <Mic size={22} />}</span>
          {muted ? '已静音' : '麦克风'}
        </button>
        <button type="button" aria-label="挂断" className="flex flex-col items-center gap-2" onClick={hangUp}>
          <span className="grid h-16 w-16 place-items-center rounded-full bg-[#F2556B] shadow-[0_10px_24px_rgba(242,85,107,0.45)]"><PhoneOff size={26} /></span>
          挂断
        </button>
        <button type="button" aria-pressed={speaker} className="flex flex-col items-center gap-2" onClick={() => setSpeaker((value) => !value)}>
          <span className="grid h-14 w-14 place-items-center rounded-full" style={{ background: speaker ? '#fff' : 'rgba(255,255,255,0.18)', color: speaker ? '#3a3242' : '#fff' }}><Volume2 size={22} /></span>
          扬声器
        </button>
      </div>
    </motion.div>
  )
}

export function CardBubble(props: { message: ChatMessage }) {
  const kind = props.message.kind
  const [head = '', first = '', second = '', third = ''] = parseCard(props.message.content)
  if (kind === 'gift') {
    const real = props.message.content.startsWith('[实物]')
    return (
      <span className="block w-56 overflow-hidden rounded-[20px] bg-white shadow-[0_8px_18px_rgba(160,130,210,0.25)]">
        <span className="flex items-center gap-3 bg-[linear-gradient(120deg,#EFE6FF,#FFE3EE)] px-3 py-3">
          <motion.span className="text-4xl" initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260 }}>{head}</motion.span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{first}</span>
            <span className="block truncate text-[11px]" style={dim}>{second}</span>
          </span>
        </span>
        {third ? <span className="block px-3 pt-2 text-xs leading-5">“{third}”</span> : null}
        <span className="flex items-center gap-1 px-3 pb-2 pt-1.5 text-[10px] text-[#7a5fb0]">{real ? <Truck size={11} /> : <Gift size={11} />}{real ? '实物礼物 · 已下单，正在配送' : '群礼物'}</span>
      </span>
    )
  }
  const red = kind === 'redpacket'
  return (
    <span className="flex w-56 flex-col overflow-hidden rounded-[18px] text-white shadow-[0_8px_16px_rgba(240,140,110,0.25)]" style={{ background: red ? 'linear-gradient(135deg,#F27B7B,#F3A8BA)' : 'linear-gradient(135deg,#F2A66E,#F0C56A)' }}>
      <span className="flex items-center gap-3 px-3 py-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/25">{red ? <Gift size={18} /> : <Wallet size={18} />}</span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">¥ {head}</span>
          <span className="block truncate text-[11px] opacity-90">{red ? first || '恭喜发财，大吉大利' : first || '转账'}</span>
        </span>
      </span>
      <span className="bg-white/90 px-3 py-1 text-[10px] text-[#b06a5a]">{red ? second || '红包' : second || '转账'}</span>
    </span>
  )
}