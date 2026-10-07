import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, Clock3, Flame, Heart, RotateCcw, Star, Trophy } from 'lucide-react'
import { useEffect, useReducer, useState, type ReactNode } from 'react'
import { storage } from '../../storage/StorageService.ts'
import type { Character } from '../../types/index.ts'

type GameId = 'flower' | 'book' | 'cafe'

interface GameInfo {
  id: GameId
  name: string
  icon: string
  tag: string
  intro: string
  cap: number
  tint: string
  deep: string
}

const GAMES: GameInfo[] = [
  { id: 'flower', name: '花摊', icon: '💐', tag: '经营 · 5 天', intro: '看天气备货定价，卖得多又不浪费，营收最高的老板是你。', cap: 60, tint: '#FCE3EC', deep: '#D9668F' },
  { id: 'book', name: '夜班书店', icon: '📚', tag: '推理 · 限时', intro: '先挑三本上架，再从客人的只言片语里猜出他要哪本。', cap: 20, tint: '#E3EAFB', deep: '#5B74C9' },
  { id: 'cafe', name: '窗边咖啡馆', icon: '☕', tag: '手速 · 配方', intro: '照着配方把材料放进杯子，赶在客人等不及之前出餐。', cap: 24, tint: '#E1F4EA', deep: '#3E9C73' },
]

const GUESTS = ['🧑‍🎓', '👩‍🦰', '👵', '🧔', '👧', '🧑‍💼', '👨‍🍳', '🧑‍🎨', '👩‍🚀', '🐱']

function shuffle<T>(list: T[]): T[] {
  const next = [...list]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swap]] = [next[swap] as T, next[index] as T]
  }
  return next
}

function rivalScore(id: string, game: string, cap: number): number {
  let hash = 0
  for (const char of `${id}:${game}`) hash = (hash * 33 + char.charCodeAt(0)) >>> 0
  const floor = Math.round(cap * 0.35)
  return floor + (hash % Math.max(1, cap - floor))
}

function starsOf(score: number, cap: number): number {
  const ratio = score / cap
  if (ratio >= 0.75) return 3
  if (ratio >= 0.45) return 2
  return score > 0 ? 1 : 0
}

export function GamesPage(props: { namespace: string; chars: Character[]; onBack: () => void }) {
  const [game, setGame] = useState<GameId | null>(null)
  const [round, setRound] = useState(0)
  const [best, setBest] = useState<Record<string, number>>({})
  useEffect(() => {
    let alive = true
    void storage.getBag<{ best: Record<string, number> }>(props.namespace, 'arcade').then((row) => {
      if (alive) setBest(row?.best ?? {})
    })
    return () => {
      alive = false
    }
  }, [props.namespace])
  const finish = (id: GameId, score: number) => {
    setBest((current) => {
      if (score <= (current[id] ?? 0)) return current
      const next = { ...current, [id]: score }
      void storage.setBag(props.namespace, 'arcade', { best: next })
      return next
    })
  }
  const info = GAMES.find((item) => item.id === game)
  const shared = info
    ? {
        info,
        best: best[info.id] ?? 0,
        chars: props.chars,
        onDone: (score: number) => finish(info.id, score),
        onAgain: () => setRound((value) => value + 1),
        onExit: () => setGame(null),
      }
    : null
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[var(--m-background)]">
      <header className="flex items-center gap-2 px-3 pb-2 pt-12">
        <button type="button" aria-label="返回" className="grid h-9 w-9 place-items-center rounded-full bg-white/80" onClick={() => (game ? setGame(null) : props.onBack())}><ChevronLeft size={18} /></button>
        <p className="text-sm">{info ? info.name : '游戏厅'}</p>
        {info ? <span className="ml-auto flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px]"><Trophy size={12} style={{ color: info.deep }} />最好 {best[info.id] ?? 0}</span> : null}
      </header>
      <div className="scroll min-h-0 flex-1 px-4 pb-16">
        {!shared ? <Lobby best={best} onPick={(id) => { setRound((value) => value + 1); setGame(id) }} /> : null}
        {shared?.info.id === 'flower' ? <FlowerRun key={round} {...shared} /> : null}
        {shared?.info.id === 'book' ? <BookRun key={round} {...shared} /> : null}
        {shared?.info.id === 'cafe' ? <CafeRun key={round} {...shared} /> : null}
      </div>
    </div>
  )
}

function Lobby(props: { best: Record<string, number>; onPick: (id: GameId) => void }) {
  return (
    <div className="space-y-3">
      <div className="rounded-[26px] bg-[linear-gradient(135deg,#FFE3EE,#E8E4FF)] p-4">
        <p className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>单机小游戏 · 和好友比分</p>
        <p className="mt-1 text-lg">今天玩哪个？</p>
        <div className="mt-3 flex gap-2">
          {GAMES.map((game) => (
            <span key={game.id} className="flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[11px]">
              {game.icon}
              <Stars value={starsOf(props.best[game.id] ?? 0, game.cap)} size={10} color={game.deep} />
            </span>
          ))}
        </div>
      </div>
      {GAMES.map((game, index) => (
        <motion.button
          key={game.id}
          type="button"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.06 }}
          whileTap={{ scale: 0.97 }}
          className="relative flex w-full items-center gap-3 overflow-hidden rounded-[26px] p-4 text-left"
          style={{ background: game.tint }}
          onClick={() => props.onPick(game.id)}
        >
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-[20px] bg-white/80 text-[34px] shadow-sm">{game.icon}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="text-[15px]">{game.name}</span>
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px]" style={{ color: game.deep }}>{game.tag}</span>
            </span>
            <span className="mt-1 block text-[11px] leading-4" style={{ color: 'var(--m-text-secondary)' }}>{game.intro}</span>
            <span className="mt-2 flex items-center gap-2 text-[11px]">
              <Stars value={starsOf(props.best[game.id] ?? 0, game.cap)} size={12} color={game.deep} />
              <span style={{ color: game.deep }}>最好 {props.best[game.id] ?? 0}</span>
            </span>
          </span>
          <span className="shrink-0 rounded-full px-3 py-1.5 text-xs text-white" style={{ background: game.deep }}>开始</span>
        </motion.button>
      ))}
    </div>
  )
}

function Stars(props: { value: number; size: number; color: string }) {
  return (
    <span className="flex items-center gap-0.5">
      {[0, 1, 2].map((index) => (
        <Star key={index} size={props.size} fill={index < props.value ? props.color : 'transparent'} style={{ color: index < props.value ? props.color : '#cfc8cc' }} />
      ))}
    </span>
  )
}

interface RunProps {
  info: GameInfo
  best: number
  chars: Character[]
  onDone: (score: number) => void
  onAgain: () => void
  onExit: () => void
}

interface Flash {
  id: number
  text: string
  good: boolean
}

function Hud(props: { info: GameInfo; label: string; step: number; total: number; score: number; extra?: ReactNode }) {
  return (
    <div className="rounded-[22px] bg-white/90 p-3 shadow-sm">
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded-full px-2 py-0.5 text-white" style={{ background: props.info.deep }}>{props.label} {Math.min(props.step + 1, props.total)}/{props.total}</span>
        {props.extra}
        <span className="ml-auto flex items-center gap-1 text-sm" style={{ color: props.info.deep }}><Star size={14} fill={props.info.deep} />{props.score}</span>
      </div>
      <div className="mt-2 flex gap-1">
        {Array.from({ length: props.total }, (_, index) => (
          <span key={index} className="h-1.5 flex-1 rounded-full transition-colors" style={{ background: index < props.step ? props.info.deep : index === props.step ? `${props.info.deep}66` : '#eee6ea' }} />
        ))}
      </div>
    </div>
  )
}

function TimeBar(props: { left: number; total: number; color: string }) {
  const ratio = Math.max(0, props.left / props.total)
  const color = ratio < 0.3 ? '#E2556B' : props.color
  return (
    <div className="flex items-center gap-2">
      <Clock3 size={13} style={{ color }} />
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#f1eaee]">
        <div className="h-full rounded-full transition-[width] duration-100 ease-linear" style={{ width: `${ratio * 100}%`, background: color }} />
      </div>
      <span className="w-7 text-right text-[11px] tabular-nums" style={{ color }}>{Math.ceil(props.left)}s</span>
    </div>
  )
}

function FlashLayer(props: { flash: Flash | null }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-6 z-10 flex justify-center">
      <AnimatePresence>
        {props.flash ? (
          <motion.span
            key={props.flash.id}
            initial={{ opacity: 0, y: 10, scale: 0.7 }}
            animate={{ opacity: 1, y: -14, scale: 1 }}
            exit={{ opacity: 0, y: -34 }}
            transition={{ duration: 0.45 }}
            className="rounded-full px-3 py-1 text-sm text-white shadow-md"
            style={{ background: props.flash.good ? '#3E9C73' : '#E2556B' }}
          >
            {props.flash.text}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function Intro(props: { info: GameInfo; rules: string[]; onStart: () => void; wait?: string; children?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="rounded-[28px] p-5 text-center" style={{ background: props.info.tint }}>
      <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="text-[56px]">{props.info.icon}</motion.div>
      <p className="mt-1 text-lg">{props.info.name}</p>
      <p className="mt-1 text-xs" style={{ color: 'var(--m-text-secondary)' }}>{props.info.intro}</p>
      <ul className="mt-4 space-y-1.5 rounded-[20px] bg-white/80 p-3 text-left text-xs leading-5">
        {props.rules.map((rule, index) => (
          <li key={rule} className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] text-white" style={{ background: props.info.deep }}>{index + 1}</span>{rule}</li>
        ))}
      </ul>
      {props.children}
      <motion.button type="button" whileTap={{ scale: 0.95 }} className="mt-4 w-full rounded-full py-3 text-sm text-white shadow-md" style={{ background: props.info.deep, opacity: props.wait ? 0.5 : 1 }} disabled={Boolean(props.wait)} onClick={props.onStart}>{props.wait ?? '开始游戏'}</motion.button>
    </motion.div>
  )
}

function Result(props: RunProps & { score: number; lines: Array<[string, string]> }) {
  const [before] = useState(props.best)
  const stars = starsOf(props.score, props.info.cap)
  const record = props.score > before
  const rows = [
    { name: '我', score: Math.max(before, props.score), self: true },
    ...props.chars.map((char) => ({ name: char.remark || char.name, score: rivalScore(char.id, props.info.id, props.info.cap), self: false })),
  ].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh-CN'))
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div className="space-y-3">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-[28px] p-5 text-center" style={{ background: props.info.tint }}>
        <p className="text-xs" style={{ color: 'var(--m-text-secondary)' }}>本局结算</p>
        <div className="mt-2 flex justify-center gap-2">
          {[0, 1, 2].map((index) => (
            <motion.span key={index} initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.2 + index * 0.18, type: 'spring', stiffness: 300 }}>
              <Star size={index === 1 ? 44 : 34} fill={index < stars ? '#F5B83D' : 'transparent'} style={{ color: index < stars ? '#F5B83D' : '#d8cfd3' }} />
            </motion.span>
          ))}
        </div>
        <p className="mt-2 text-4xl" style={{ color: props.info.deep }}>{props.score}</p>
        {record ? <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.8 }} className="mt-2 inline-block rounded-full bg-[#F5B83D] px-3 py-1 text-xs text-white">新纪录！</motion.span> : <p className="mt-1 text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>最好成绩 {before}</p>}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {props.lines.map(([label, value]) => (
            <div key={label} className="rounded-[16px] bg-white/80 px-2 py-2">
              <p className="text-sm">{value}</p>
              <p className="text-[10px]" style={{ color: 'var(--m-text-secondary)' }}>{label}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" className="chip flex-1 justify-center" onClick={props.onExit}>回大厅</button>
          <button type="button" className="flex flex-1 items-center justify-center gap-1 rounded-full py-2 text-sm text-white" style={{ background: props.info.deep }} onClick={props.onAgain}><RotateCcw size={14} />再来一局</button>
        </div>
      </motion.div>
      <div className="rounded-[24px] bg-white/90 p-4">
        <p className="flex items-center gap-1.5 text-sm"><Trophy size={15} style={{ color: '#F5B83D' }} />好友排行</p>
        <ol className="mt-3 space-y-1.5">
          {rows.map((row, index) => (
            <li key={`${row.name}-${index}`} className="flex items-center gap-2 rounded-[14px] px-2 py-1.5 text-sm" style={{ background: row.self ? props.info.tint : 'transparent' }}>
              <span className="w-6 text-center text-xs">{medals[index] ?? index + 1}</span>
              <span className="min-w-0 flex-1 truncate">{row.name}</span>
              <span className="tabular-nums" style={{ color: row.self ? props.info.deep : undefined }}>{row.score}</span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-[10px]" style={{ color: 'var(--m-text-secondary)' }}>好友的分数是本地生成的陪练成绩。</p>
      </div>
    </div>
  )
}

const WEATHERS = [
  { icon: '☀️', name: '大晴天', mul: 1.2 },
  { icon: '🌧️', name: '下雨', mul: 0.6 },
  { icon: '☁️', name: '阴天', mul: 0.9 },
  { icon: '💐', name: '节日', mul: 1.8 },
  { icon: '🌬️', name: '大风', mul: 0.75 },
]

const STOCKS = [
  { value: 3, label: '少进', cost: 3 },
  { value: 6, label: '适中', cost: 6 },
  { value: 9, label: '多进', cost: 9 },
] as const

const PRICES = [
  { id: 'cheap', label: '亲民', base: 7, gain: 2 },
  { id: 'fair', label: '平常', base: 5, gain: 3 },
  { id: 'fine', label: '精致', base: 3, gain: 5 },
] as const

interface FlowerDay {
  weather: (typeof WEATHERS)[number]
  sold: number
  waste: number
  income: number
}

function FlowerRun(props: RunProps) {
  const [plan, setPlan] = useState<(typeof WEATHERS)[number][] | null>(null)
  const [days, setDays] = useState<FlowerDay[]>([])
  const [report, setReport] = useState<FlowerDay | null>(null)
  const [stock, setStock] = useState<number>(6)
  const [price, setPrice] = useState<(typeof PRICES)[number]['id']>('fair')
  const [flash, setFlash] = useState<Flash | null>(null)
  const total = days.reduce((sum, day) => sum + day.income, 0)
  const over = days.length >= 5
  const { onDone } = props
  useEffect(() => {
    if (over) onDone(total)
  }, [over, total, onDone])
  if (!plan) {
    return (
      <Intro info={props.info} onStart={() => setPlan(Array.from({ length: 5 }, () => WEATHERS[Math.floor(Math.random() * WEATHERS.length)] ?? WEATHERS[0]!))} rules={['每天开张前先看天气预报，决定进多少花。', '定价越高单价越高，但来买的人越少。', '卖不完的花会蔫掉，每枝扣 1 分。']} />
    )
  }
  const index = days.length
  const finished = index >= 5 && !report
  if (finished) {
    const sold = days.reduce((sum, day) => sum + day.sold, 0)
    const waste = days.reduce((sum, day) => sum + day.waste, 0)
    return <Result {...props} score={total} lines={[['卖出', `${sold} 枝`], ['蔫掉', `${waste} 枝`], ['营业', '5 天']]} />
  }
  const weather = plan[Math.min(index, 4)] ?? WEATHERS[0]!
  const tier = PRICES.find((item) => item.id === price) ?? PRICES[1]
  const open = () => {
    const demand = Math.max(0, Math.round(tier.base * weather.mul + (Math.random() * 3 - 1)))
    const sold = Math.min(stock, demand)
    const waste = stock - sold
    const income = Math.max(0, sold * tier.gain - waste - Math.round(stock / 3))
    const day = { weather, sold, waste, income }
    setReport(day)
    setFlash({ id: Date.now(), text: income > 0 ? `+${income}` : '没赚到', good: income > 0 })
  }
  const next = () => {
    if (!report) return
    const after = [...days, report]
    setDays(after)
    setReport(null)
  }
  return (
    <div className="relative space-y-3">
      <FlashLayer flash={flash} />
      <Hud info={props.info} label="第" step={index} total={5} score={total + (report?.income ?? 0)} extra={<span>{weather.icon} {weather.name}</span>} />
      <div className="flex gap-1.5">
        {plan.map((item, day) => (
          <span key={day} className="flex flex-1 flex-col items-center rounded-[14px] py-1.5 text-[10px]" style={{ background: day === index ? props.info.tint : 'rgba(255,255,255,.7)', outline: day === index ? `1.5px solid ${props.info.deep}` : 'none', opacity: day < index ? 0.5 : 1 }}>
            <span className="text-base">{item.icon}</span>
            第{day + 1}天
          </span>
        ))}
      </div>
      {report ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[24px] bg-white/90 p-4">
          <p className="text-sm">打烊啦 · 第 {index + 1} 天账本</p>
          <div className="mt-3 flex min-h-10 flex-wrap gap-1">
            {Array.from({ length: report.sold }, (_, guest) => (
              <motion.span key={guest} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: guest * 0.08 }} className="text-2xl">{GUESTS[(guest + index) % GUESTS.length]}</motion.span>
            ))}
            {report.sold === 0 ? <span className="text-xs" style={{ color: 'var(--m-text-secondary)' }}>今天一个客人都没有……</span> : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-0.5">
            {Array.from({ length: report.sold }, (_, flower) => <span key={`s${flower}`} className="text-lg">🌷</span>)}
            {Array.from({ length: report.waste }, (_, flower) => <span key={`w${flower}`} className="text-lg opacity-30 grayscale">🥀</span>)}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <span className="rounded-[14px] bg-[#E1F4EA] py-2">卖出 {report.sold}</span>
            <span className="rounded-[14px] bg-[#FDE4E4] py-2">蔫掉 {report.waste}</span>
            <span className="rounded-[14px] py-2" style={{ background: props.info.tint }}>营收 {report.income}</span>
          </div>
          <button type="button" className="mt-4 w-full rounded-full py-2.5 text-sm text-white" style={{ background: props.info.deep }} onClick={next}>{index >= 4 ? '看结算' : '明天继续'}</button>
        </motion.div>
      ) : (
        <div className="rounded-[24px] bg-white/90 p-4">
          <p className="text-sm">今天进多少花</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {STOCKS.map((item) => (
              <motion.button key={item.value} type="button" whileTap={{ scale: 0.94 }} className="rounded-[18px] px-2 py-3 text-center" style={{ background: stock === item.value ? props.info.tint : '#faf6f8', outline: stock === item.value ? `1.5px solid ${props.info.deep}` : 'none' }} onClick={() => setStock(item.value)}>
                <span className="block text-sm tracking-tighter">{'🌷'.repeat(item.value / 3)}</span>
                <span className="mt-1 block text-xs">{item.label} {item.value} 枝</span>
              </motion.button>
            ))}
          </div>
          <p className="mt-4 text-sm">怎么定价</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {PRICES.map((item) => (
              <motion.button key={item.id} type="button" whileTap={{ scale: 0.94 }} className="rounded-[18px] px-2 py-3 text-center" style={{ background: price === item.id ? props.info.tint : '#faf6f8', outline: price === item.id ? `1.5px solid ${props.info.deep}` : 'none' }} onClick={() => setPrice(item.id)}>
                <span className="block text-sm">{'¥'.repeat(PRICES.indexOf(item) + 1)}</span>
                <span className="mt-1 block text-xs">{item.label}</span>
                <span className="block text-[10px]" style={{ color: 'var(--m-text-secondary)' }}>每枝 +{item.gain}</span>
              </motion.button>
            ))}
          </div>
          <p className="mt-3 text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{weather.icon} 预报：{weather.name}，{weather.mul >= 1.2 ? '客人会比平时多' : weather.mul < 0.8 ? '出门的人会少很多' : '客流和平时差不多'}。</p>
          <motion.button type="button" whileTap={{ scale: 0.96 }} className="mt-4 w-full rounded-full py-2.5 text-sm text-white" style={{ background: props.info.deep }} onClick={open}>开张营业</motion.button>
        </div>
      )}
    </div>
  )
}

const BOOKS = [
  { name: '诗集', icon: '📜', hint: '想读几句短短的、有韵脚的' },
  { name: '食谱', icon: '🍳', hint: '今晚想给家里人露一手' },
  { name: '地图', icon: '🗺️', hint: '下周要去一个没去过的城市' },
  { name: '童话', icon: '🧚', hint: '孩子睡前总要听个故事' },
  { name: '乐谱', icon: '🎼', hint: '钢琴老师让我准备新曲子' },
  { name: '词典', icon: '📖', hint: '有个字一直不会念' },
]
const BOOK_TIME = 9
const BOOK_GUESTS = 6

interface ArcadeState {
  phase: 'pick' | 'run' | 'end'
  queue: number[]
  step: number
  score: number
  combo: number
  bestCombo: number
  hits: number
  left: number
  flash: Flash | null
}

type ArcadeAction =
  | { type: 'start'; queue: number[] }
  | { type: 'tick' }
  | { type: 'answer'; good: boolean; points: number; text: string }

function arcadeReducer(limit: number) {
  return (state: ArcadeState, action: ArcadeAction): ArcadeState => {
    if (action.type === 'start') return { ...state, phase: 'run', queue: action.queue, step: 0, left: limit }
    if (state.phase !== 'run') return state
    const advance = (good: boolean, points: number, text: string): ArcadeState => {
      const combo = good ? state.combo + 1 : 0
      const bonus = good && combo >= 3 ? 1 : 0
      const step = state.step + 1
      return {
        ...state,
        step,
        phase: step >= state.queue.length ? 'end' : 'run',
        score: state.score + points + bonus,
        combo,
        bestCombo: Math.max(state.bestCombo, combo),
        hits: state.hits + (good ? 1 : 0),
        left: limit,
        flash: { id: state.flash ? state.flash.id + 1 : 1, text: bonus ? `${text} 连击+1` : text, good },
      }
    }
    if (action.type === 'tick') {
      const left = Math.round((state.left - 0.1) * 10) / 10
      return left <= 0 ? advance(false, 0, '客人走掉了') : { ...state, left }
    }
    return advance(action.good, action.points, action.text)
  }
}

const ARCADE_START: ArcadeState = { phase: 'pick', queue: [], step: 0, score: 0, combo: 0, bestCombo: 0, hits: 0, left: 0, flash: null }

function useArcadeClock(phase: ArcadeState['phase'], dispatch: (action: ArcadeAction) => void) {
  useEffect(() => {
    if (phase !== 'run') return
    const timer = window.setInterval(() => dispatch({ type: 'tick' }), 100)
    return () => window.clearInterval(timer)
  }, [phase, dispatch])
}

const bookReducer = arcadeReducer(BOOK_TIME)

function BookRun(props: RunProps) {
  const [shelf, setShelf] = useState<string[]>([])
  const [state, dispatch] = useReducer(bookReducer, ARCADE_START)
  useArcadeClock(state.phase, dispatch)
  const { onDone } = props
  useEffect(() => {
    if (state.phase === 'end') onDone(state.score)
  }, [state.phase, state.score, onDone])
  if (state.phase === 'end') return <Result {...props} score={state.score} lines={[['答对', `${state.hits}/${BOOK_GUESTS}`], ['最高连击', `${state.bestCombo}`], ['上架', `${shelf.length} 本`]]} />
  if (state.phase === 'pick') {
    const toggle = (name: string) => setShelf((current) => (current.includes(name) ? current.filter((item) => item !== name) : current.length >= 3 ? current : [...current, name]))
    return (
      <Intro info={props.info} rules={['从六本书里挑三本摆上书架。', '客人只会说个大概，猜对他要的书 +2，回答够快再 +1。', '架上没有就说「抱歉」，诚实也算 +1；连续答对三次有连击奖励。']} wait={shelf.length < 3 ? `再挑 ${3 - shelf.length} 本` : undefined} onStart={() => dispatch({ type: 'start', queue: shuffle(BOOKS.map((_, index) => index)).slice(0, BOOK_GUESTS) })}>
        <p className="mt-4 text-left text-xs">挑三本上架 · {shelf.length}/3</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {BOOKS.map((book) => {
            const on = shelf.includes(book.name)
            return (
              <motion.button key={book.name} type="button" whileTap={{ scale: 0.92 }} className="rounded-[16px] py-2.5 text-xs" style={{ background: on ? 'white' : 'rgba(255,255,255,.5)', outline: on ? `1.5px solid ${props.info.deep}` : 'none' }} onClick={() => toggle(book.name)}>
                <span className="block text-2xl">{book.icon}</span>{book.name}
              </motion.button>
            )
          })}
        </div>
      </Intro>
    )
  }
  const want = BOOKS[state.queue[state.step] ?? 0] ?? BOOKS[0]!
  const answer = (name: string | null) => {
    const has = shelf.includes(want.name)
    if (name === null) {
      dispatch(has ? { type: 'answer', good: false, points: 0, text: '架上明明有' } : { type: 'answer', good: true, points: 1, text: '+1 诚实' })
      return
    }
    if (name === want.name) dispatch({ type: 'answer', good: true, points: 2 + (state.left > BOOK_TIME / 2 ? 1 : 0), text: state.left > BOOK_TIME / 2 ? '+3 神速' : '+2' })
    else dispatch({ type: 'answer', good: false, points: 0, text: '拿错啦' })
  }
  return (
    <div className="relative space-y-3">
      <FlashLayer flash={state.flash} />
      <Hud info={props.info} label="客人" step={state.step} total={BOOK_GUESTS} score={state.score} extra={state.combo >= 2 ? <span className="flex items-center gap-0.5 text-[#E8743B]"><Flame size={12} />{state.combo} 连击</span> : null} />
      <AnimatePresence mode="wait">
        <motion.div key={state.step} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="rounded-[26px] bg-[linear-gradient(180deg,#2E3456,#46507E)] p-4 text-white">
          <div className="flex items-end gap-3">
            <span className="text-[44px] leading-none">{GUESTS[(state.queue[state.step] ?? 0) + state.step] ?? '🧑'}</span>
            <div className="relative mb-2 flex-1 rounded-[18px] rounded-bl-[4px] bg-white px-3 py-2 text-sm text-[#2c2628]">「{want.hint}，有合适的书吗？」</div>
          </div>
          <div className="mt-3"><TimeBar left={state.left} total={BOOK_TIME} color="#9FB4FF" /></div>
        </motion.div>
      </AnimatePresence>
      <div className="rounded-[24px] bg-[#F3E6D6] p-3">
        <p className="mb-2 text-[11px] text-[#8a6a4a]">书架</p>
        <div className="grid grid-cols-3 gap-2">
          {shelf.map((name) => {
            const book = BOOKS.find((item) => item.name === name)
            return (
              <motion.button key={name} type="button" whileTap={{ scale: 0.9, rotate: -4 }} className="rounded-[14px] border-b-4 border-[#C9A57E] bg-white py-3 text-xs shadow-sm" onClick={() => answer(name)}>
                <span className="block text-2xl">{book?.icon}</span>{name}
              </motion.button>
            )
          })}
        </div>
        <button type="button" className="chip mt-3 w-full justify-center" onClick={() => answer(null)}>抱歉，这本没进货</button>
      </div>
    </div>
  )
}

const INGREDIENTS = [
  { id: 'coffee', name: '咖啡', icon: '☕' },
  { id: 'milk', name: '牛奶', icon: '🥛' },
  { id: 'water', name: '热水', icon: '💧' },
  { id: 'matcha', name: '抹茶', icon: '🍵' },
  { id: 'cocoa', name: '可可', icon: '🍫' },
  { id: 'ice', name: '冰块', icon: '🧊' },
]
const RECIPES = [
  { name: '美式', parts: ['coffee', 'water'] },
  { name: '拿铁', parts: ['coffee', 'milk'] },
  { name: '冰拿铁', parts: ['coffee', 'milk', 'ice'] },
  { name: '抹茶拿铁', parts: ['matcha', 'milk'] },
  { name: '热可可', parts: ['cocoa', 'milk'] },
  { name: '摩卡', parts: ['coffee', 'cocoa', 'milk'] },
]
const CAFE_TIME = 12
const CAFE_ORDERS = 6

const cafeReducer = arcadeReducer(CAFE_TIME)

function CafeRun(props: RunProps) {
  const [state, dispatch] = useReducer(cafeReducer, ARCADE_START)
  const [cup, setCup] = useState<string[]>([])
  const [book, setBook] = useState(false)
  useArcadeClock(state.phase, dispatch)
  const { onDone } = props
  useEffect(() => {
    if (state.phase === 'end') onDone(state.score)
  }, [state.phase, state.score, onDone])
  if (state.phase === 'end') return <Result {...props} score={state.score} lines={[['出餐成功', `${state.hits}/${CAFE_ORDERS}`], ['最高连击', `${state.bestCombo}`], ['满分', `${props.info.cap}`]]} />
  if (state.phase === 'pick') {
    return <Intro info={props.info} rules={['客人点单后，照配方点材料放进杯子。', '配方对了点「出餐」+3，留出一半以上的时间再 +1。', '放错可以倒掉重来；客人等不及就会走。']} onStart={() => dispatch({ type: 'start', queue: Array.from({ length: CAFE_ORDERS }, () => Math.floor(Math.random() * RECIPES.length)) })} />
  }
  const order = RECIPES[state.queue[state.step] ?? 0] ?? RECIPES[0]!
  const serve = () => {
    const good = cup.length === order.parts.length && order.parts.every((part) => cup.includes(part))
    const fast = state.left > CAFE_TIME / 2
    dispatch(good ? { type: 'answer', good: true, points: fast ? 4 : 3, text: fast ? '+4 完美' : '+3' } : { type: 'answer', good: false, points: 0, text: '味道不对' })
    setCup([])
  }
  const add = (id: string) => setCup((current) => (current.length >= 3 || current.includes(id) ? current : [...current, id]))
  return (
    <div className="relative space-y-3">
      <FlashLayer flash={state.flash} />
      <Hud info={props.info} label="订单" step={state.step} total={CAFE_ORDERS} score={state.score} extra={<span className="flex items-center gap-0.5 text-[#E2556B]">{Array.from({ length: 3 }, (_, index) => <Heart key={index} size={11} fill={index < 3 - Math.min(3, state.step - state.hits) ? '#E2556B' : 'transparent'} />)}</span>} />
      <AnimatePresence mode="wait">
        <motion.div key={state.step} initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="rounded-[26px] bg-white/90 p-4">
          <div className="flex items-center gap-3">
            <span className="text-[40px] leading-none">{GUESTS[(state.step * 3 + (state.queue[state.step] ?? 0)) % GUESTS.length]}</span>
            <div className="flex-1">
              <p className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>客人点单</p>
              <p className="text-lg" style={{ color: props.info.deep }}>一杯{order.name}</p>
            </div>
            <button type="button" className="chip chip-mint" onClick={() => setBook(!book)}>{book ? '收起' : '配方'}</button>
          </div>
          {book ? (
            <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px]">
              {RECIPES.map((recipe) => (
                <span key={recipe.name} className="rounded-[12px] px-2 py-1" style={{ background: recipe.name === order.name ? props.info.tint : '#f7f3f5' }}>{recipe.name} {recipe.parts.map((part) => INGREDIENTS.find((item) => item.id === part)?.icon).join('')}</span>
              ))}
            </div>
          ) : null}
          <div className="mt-3"><TimeBar left={state.left} total={CAFE_TIME} color={props.info.deep} /></div>
        </motion.div>
      </AnimatePresence>
      <div className="rounded-[24px] p-3" style={{ background: props.info.tint }}>
        <div className="mx-auto flex h-20 w-28 items-end justify-center gap-1 rounded-b-[28px] rounded-t-[8px] border-4 border-white bg-white/60 pb-2">
          <AnimatePresence>
            {cup.map((id) => (
              <motion.span key={id} initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ scale: 0 }} className="text-2xl">{INGREDIENTS.find((item) => item.id === id)?.icon}</motion.span>
            ))}
          </AnimatePresence>
          {cup.length === 0 ? <span className="pb-4 text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>空杯子</span> : null}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {INGREDIENTS.map((item) => (
            <motion.button key={item.id} type="button" whileTap={{ scale: 0.88 }} className="rounded-[16px] bg-white py-2 text-xs shadow-sm" style={{ opacity: cup.includes(item.id) ? 0.4 : 1 }} onClick={() => add(item.id)}>
              <span className="block text-2xl">{item.icon}</span>{item.name}
            </motion.button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" className="chip flex-1 justify-center" onClick={() => setCup([])}>倒掉</button>
          <motion.button type="button" whileTap={{ scale: 0.95 }} className="flex-[2] rounded-full py-2 text-sm text-white" style={{ background: props.info.deep }} disabled={cup.length === 0} onClick={serve}>出餐</motion.button>
        </div>
      </div>
    </div>
  )
}
