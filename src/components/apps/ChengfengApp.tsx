import { AnimatePresence, motion } from 'framer-motion'
import { Flame, RotateCcw, Star } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { addCoins, readCoins } from '../../lib/wallet.ts'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import { Screen } from '../ui/primitives.tsx'

type GameId = 'petal' | 'color' | 'memory' | 'order' | 'beat'

interface GameInfo {
  id: GameId
  name: string
  icon: string
  tag: string
  intro: string
  rules: string[]
  rate: number
  cap: number
  tint: string
  deep: string
}

type Finish = (won: boolean, score: number, lines: Array<[string, string]>) => void

const GAMES: GameInfo[] = [
  {
    id: 'petal',
    name: '接花',
    icon: '🌸',
    tag: '反应 · 容易',
    intro: '花落下来时点中它。连续接住会计连击。',
    rules: ['一共落下 8 朵花', '接住 6 朵及以上过关', '过关 +4 枚，没过也有 1 枚'],
    rate: 1,
    cap: 120,
    tint: '#F8E3C4',
    deep: '#D98A3D',
  },
  {
    id: 'color',
    name: '配色',
    icon: '🎨',
    tag: '记忆 · 容易',
    intro: '记住闪过的颜色，再按同样的顺序点回去。',
    rules: ['序列一轮比一轮长，共 4 轮', '点错扣一颗心，三颗心用完结束', '过关 +4 枚，没过也有 1 枚'],
    rate: 1,
    cap: 130,
    tint: '#F7D0DC',
    deep: '#D9668F',
  },
  {
    id: 'memory',
    name: '翻牌',
    icon: '🃏',
    tag: '记忆 · 中等',
    intro: '在时间走完之前，把四对图案翻出来。',
    rules: ['一次翻两张，相同就留下', '限时 25 秒，连续配对有连击', '过关 +8 枚，没过也有 1 枚'],
    rate: 2,
    cap: 130,
    tint: '#D7F0E4',
    deep: '#3E9C73',
  },
  {
    id: 'order',
    name: '数序',
    icon: '🔢',
    tag: '眼力 · 中等',
    intro: '按 1 到 9 点。每点对一个，剩下的数字会换位置。',
    rules: ['点错扣一颗心，共三颗', '限时 20 秒', '过关 +8 枚，没过也有 1 枚'],
    rate: 2,
    cap: 160,
    tint: '#E4DDF6',
    deep: '#7A62B8',
  },
  {
    id: 'beat',
    name: '节拍',
    icon: '🥁',
    tag: '节奏 · 较难',
    intro: '光点走到中间的色块时敲下去，敲中 8 拍。',
    rules: ['深色是完美，浅色也算好', '8 拍里打中 6 拍过关', '过关 +12 枚，没过也有 1 枚'],
    rate: 3,
    cap: 140,
    tint: '#F6D7C4',
    deep: '#E07A4C',
  },
]

const DIM = { color: 'var(--m-text-secondary)' }
const LANES = [22, 70, 40, 58, 30, 76, 48, 18]
const PAD_COLORS = [
  { name: '粉', bg: '#F3A8BA' },
  { name: '薄荷', bg: '#9ED9C4' },
  { name: '黄油', bg: '#F0D48A' },
  { name: '丁香', bg: '#C9B6E8' },
]
const CARD_FACES = ['🌸', '🍵', '🌙', '⭐']

function shuffle<T>(list: T[]): T[] {
  const next = [...list]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    const left = next[index] as T
    const right = next[swap] as T
    next[index] = right
    next[swap] = left
  }
  return next
}

function starsOf(score: number, cap: number): number {
  const ratio = score / cap
  if (ratio >= 0.75) return 3
  if (ratio >= 0.45) return 2
  return score > 0 ? 1 : 0
}

function Stars(props: { value: number; size: number; color: string }) {
  return (
    <span className="flex items-center gap-0.5">
      {[0, 1, 2].map((index) => (
        <Star key={index} size={props.size} fill={index < props.value ? props.color : 'transparent'} style={{ color: index < props.value ? props.color : '#d8cfd3' }} />
      ))}
    </span>
  )
}

function useCountdown(total: number, onZero: () => void): number {
  const [left, setLeft] = useState(total)
  const onZeroRef = useRef(onZero)
  const fired = useRef(false)
  const timeUp = left === 0
  useEffect(() => {
    onZeroRef.current = onZero
  })
  useEffect(() => {
    if (timeUp) {
      if (!fired.current) {
        fired.current = true
        onZeroRef.current()
      }
      return
    }
    const id = window.setInterval(() => setLeft((value) => (value <= 1 ? 0 : value - 1)), 100)
    return () => window.clearInterval(id)
  }, [timeUp])
  return left
}

export function ChengfengApp(props: { onBack: () => void }) {
  const identities = useMellow((state) => state.identities)
  const activeIdentityId = useMellow((state) => state.activeIdentityId)
  const phone = identities.find((item) => item.id === activeIdentityId)
  const namespace = phone?.namespace ?? ''
  const [coins, setCoins] = useState(0)
  const [best, setBest] = useState<Record<string, number>>({})
  const [game, setGame] = useState<GameId | null>(null)
  useEffect(() => {
    if (!namespace) return
    let alive = true
    void readCoins(namespace).then((value) => {
      if (alive) setCoins(value)
    })
    void storage.getBag<Record<string, number>>(namespace, 'wind_best').then((row) => {
      if (alive && row) setBest(row)
    })
    return () => {
      alive = false
    }
  }, [namespace])
  const settle = useCallback(
    async (won: boolean, score: number) => {
      if (!game || !namespace) return 0
      const item = GAMES.find((entry) => entry.id === game)
      if (!item) return 0
      const gain = won ? item.rate * 4 : 1
      setCoins(await addCoins(namespace, gain))
      setBest((current) => {
        if (score <= (current[item.id] ?? 0)) return current
        const next = { ...current, [item.id]: score }
        void storage.setBag(namespace, 'wind_best', next)
        return next
      })
      return gain
    },
    [game, namespace],
  )
  if (!phone) return null
  const info = GAMES.find((item) => item.id === game) ?? null
  return (
    <div className="sms-shell relative h-full min-h-0">
      <Screen
        title={info ? info.name : '乘风'}
        subtitle={info ? info.tag : '玩一局，赚一点'}
        onBack={() => (info ? setGame(null) : props.onBack())}
        right={
          <span className="flex items-center gap-1 rounded-full bg-white/80 px-3 py-1.5 text-sm shadow-[0_4px_12px_rgba(120,80,100,0.06)]" aria-label={`余额 ${coins} 枚`}>
            <span aria-hidden>🪙</span>
            <span className="font-medium tabular-nums">{coins}</span>
          </span>
        }
      >
        {info ? (
          <Stage key={info.id} info={info} best={best[info.id] ?? 0} onExit={() => setGame(null)} onSettle={settle} />
        ) : (
          <Lobby best={best} coins={coins} onPick={setGame} />
        )}
      </Screen>
    </div>
  )
}

function Lobby(props: { best: Record<string, number>; coins: number; onPick: (id: GameId) => void }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-3 rounded-[24px] p-4 shadow-[0_10px_22px_rgba(242,180,138,0.16)]" style={{ background: 'linear-gradient(135deg,#FFE3C4,#F8D0DC 58%,#E6DDF8)' }}>
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] bg-white/80 text-3xl shadow-[inset_0_-3px_0_rgba(0,0,0,0.04)]">🌬️</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">今天想赚一点？</span>
          <span className="mt-0.5 block text-xs leading-5" style={DIM}>过关拿满奖励，没过关也记 1 枚。现在余额 {props.coins} 枚。</span>
        </span>
      </div>
      <ul className="divide-y divide-black/[0.05] overflow-hidden rounded-[24px] bg-white/85 shadow-[0_8px_18px_rgba(120,80,100,0.05)]">
        {GAMES.map((game) => {
          const score = props.best[game.id] ?? 0
          return (
            <li key={game.id}>
              <button type="button" className="flex w-full items-center gap-3 px-3 py-3 text-left transition-transform active:scale-[0.99]" onClick={() => props.onPick(game.id)}>
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] text-[22px]" style={{ background: game.tint }}>{game.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[15px] font-medium">{game.name}</span>
                    <span className="shrink-0 rounded-full px-1.5 text-[10px]" style={{ background: game.tint, color: game.deep }}>{game.tag}</span>
                  </span>
                  <span className="mt-0.5 line-clamp-1 block text-xs" style={DIM}>{game.intro}</span>
                  <span className="mt-1 flex items-center gap-2">
                    <Stars value={starsOf(score, game.cap)} size={11} color={game.deep} />
                    <span className="text-[10px]" style={{ color: game.deep }}>最好 {score}</span>
                  </span>
                </span>
                <span className="chip chip-pink shrink-0" style={{ fontSize: 12, padding: '5px 12px' }}>开始</span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-center text-[11px]" style={DIM}>赚到的枚只在这台手机里，可以去多淘和闪送花掉</p>
    </div>
  )
}

function Stage(props: { info: GameInfo; best: number; onExit: () => void; onSettle: (won: boolean, score: number) => Promise<number> }) {
  const [phase, setPhase] = useState<'intro' | 'play' | 'result'>('intro')
  const [nonce, setNonce] = useState(0)
  const [end, setEnd] = useState<{ won: boolean; score: number; lines: Array<[string, string]>; gain: number | null } | null>(null)
  const paid = useRef(false)
  const alive = useRef(true)
  useEffect(() => () => {
    alive.current = false
  }, [])
  const finish = (won: boolean, score: number, lines: Array<[string, string]>) => {
    if (paid.current) return
    paid.current = true
    setEnd({ won, score, lines, gain: null })
    setPhase('result')
    void props.onSettle(won, score).then(
      (gain) => {
        if (alive.current) setEnd((current) => (current ? { ...current, gain } : current))
      },
      () => {
        if (alive.current) setEnd((current) => (current ? { ...current, gain: 0 } : current))
      },
    )
  }
  const again = () => {
    paid.current = false
    setEnd(null)
    setNonce((value) => value + 1)
    setPhase('play')
  }
  if (phase === 'intro') {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="rounded-[28px] p-5 text-center" style={{ background: props.info.tint }}>
        <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.2 }} className="text-[56px]">{props.info.icon}</motion.div>
        <p className="mt-1 text-lg font-medium">{props.info.name}</p>
        <p className="mt-1 text-xs leading-5" style={DIM}>{props.info.intro}</p>
        <ul className="mt-4 space-y-1.5 rounded-[20px] bg-white/80 p-3 text-left text-xs leading-5">
          {props.info.rules.map((rule, index) => (
            <li key={rule} className="flex gap-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] text-white" style={{ background: props.info.deep }}>{index + 1}</span>
              {rule}
            </li>
          ))}
        </ul>
        <button type="button" className="mt-4 w-full rounded-full py-3 text-sm text-white shadow-md" style={{ background: props.info.deep }} onClick={() => setPhase('play')}>开始游戏</button>
      </motion.div>
    )
  }
  if (phase === 'result' && end) return <Result info={props.info} best={props.best} end={end} onExit={props.onExit} onAgain={again} />
  return <Play key={nonce} info={props.info} onFinish={finish} />
}

function Result(props: {
  info: GameInfo
  best: number
  end: { won: boolean; score: number; lines: Array<[string, string]>; gain: number | null }
  onExit: () => void
  onAgain: () => void
}) {
  const [before] = useState(props.best)
  const stars = starsOf(props.end.score, props.info.cap)
  const record = props.end.score > before
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] p-5 text-center" style={{ background: props.info.tint }}>
      <p className="text-xs" style={DIM}>{props.end.won ? '过关' : '差一点点'}</p>
      <div className="mt-2 flex items-end justify-center gap-2">
        {[0, 1, 2].map((index) => (
          <motion.span key={index} initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.15 + index * 0.16, type: 'spring', stiffness: 320 }}>
            <Star size={index === 1 ? 46 : 34} fill={index < stars ? '#F5B83D' : 'transparent'} style={{ color: index < stars ? '#F5B83D' : '#d8cfd3' }} />
          </motion.span>
        ))}
      </div>
      <p className="mt-2 text-4xl tabular-nums" style={{ color: props.info.deep }}>{props.end.score}</p>
      {record ? (
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.7 }} className="mt-2 inline-block rounded-full bg-[#F5B83D] px-3 py-1 text-xs text-white">新纪录</motion.span>
      ) : (
        <p className="mt-1 text-[11px]" style={DIM}>最好成绩 {before}</p>
      )}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {props.end.lines.map(([label, value]) => (
          <div key={label} className="rounded-[16px] bg-white/80 px-2 py-2">
            <p className="text-sm tabular-nums">{value}</p>
            <p className="text-[10px]" style={DIM}>{label}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 rounded-full bg-white/80 py-2 text-sm" style={{ color: props.info.deep }}>
        {props.end.gain === null ? '正在入账…' : `+${props.end.gain} 枚`}
      </p>
      <div className="mt-4 flex gap-2">
        <button type="button" className="chip flex-1 justify-center" onClick={props.onExit}>回大厅</button>
        <button type="button" className="flex flex-1 items-center justify-center gap-1 rounded-full py-2 text-sm text-white" style={{ background: props.info.deep }} onClick={props.onAgain}>
          <RotateCcw size={14} />再来一局
        </button>
      </div>
    </motion.div>
  )
}

function Play(props: { info: GameInfo; onFinish: Finish }) {
  if (props.info.id === 'petal') return <PetalPlay onFinish={props.onFinish} />
  if (props.info.id === 'color') return <ColorPlay info={props.info} onFinish={props.onFinish} />
  if (props.info.id === 'memory') return <MemoryPlay info={props.info} onFinish={props.onFinish} />
  if (props.info.id === 'order') return <OrderPlay info={props.info} onFinish={props.onFinish} />
  return <BeatPlay info={props.info} onFinish={props.onFinish} />
}

function Hud(props: { color: string; label: string; extra?: ReactNode; value: string }) {
  return (
    <div className="mb-3 flex items-center gap-2 rounded-[20px] bg-white/85 px-3 py-2 text-xs shadow-[0_8px_16px_rgba(120,80,100,0.05)]">
      <span className="rounded-full px-2 py-0.5 text-white" style={{ background: props.color }}>{props.label}</span>
      {props.extra}
      <span className="ml-auto font-medium tabular-nums" style={{ color: props.color }}>{props.value}</span>
    </div>
  )
}

function TimeBar(props: { left: number; total: number; color: string }) {
  const ratio = Math.max(0, props.left / props.total)
  const color = ratio < 0.25 ? '#E2556B' : props.color
  return (
    <div className="mt-3 flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/70">
        <div className="h-full rounded-full transition-[width] duration-100 ease-linear" style={{ width: `${ratio * 100}%`, background: color }} />
      </div>
      <span className="w-8 text-right text-[11px] tabular-nums" style={{ color }}>{(props.left / 10).toFixed(1)}</span>
    </div>
  )
}

function FlashLine(props: { text: string }) {
  return (
    <div className="mt-2 h-6 text-center text-sm font-medium">
      <AnimatePresence mode="wait">
        {props.text ? (
          <motion.span key={props.text} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {props.text}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function PetalPlay(props: { onFinish: Finish }) {
  const info = GAMES[0] as GameInfo
  const [step, setStep] = useState(0)
  const [flying, setFlying] = useState(true)
  const [catches, setCatches] = useState(0)
  const [combo, setCombo] = useState(0)
  const [flash, setFlash] = useState('花要落下来了')
  const lock = useRef(false)
  const flyingRef = useRef(true)
  const stepRef = useRef(0)
  const comboRef = useRef(0)
  const stats = useRef({ catches: 0, bestCombo: 0 })
  const finishRef = useRef(props.onFinish)
  const timer = useRef(0)
  useEffect(() => {
    finishRef.current = props.onFinish
  })
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const settle = () => {
    const caught = stats.current.catches
    const bestCombo = stats.current.bestCombo
    finishRef.current(caught >= 6, caught * 12 + bestCombo * 4, [
      ['接住', `${caught}/8`],
      ['错过', `${8 - caught}`],
      ['连击', `${bestCombo}`],
    ])
  }
  const advance = () => {
    if (stepRef.current >= 7) {
      settle()
      return
    }
    stepRef.current += 1
    lock.current = false
    flyingRef.current = true
    setFlying(true)
    setStep(stepRef.current)
    setFlash('接住它')
  }
  const later = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(advance, 380)
  }
  const miss = () => {
    if (lock.current) return
    lock.current = true
    flyingRef.current = false
    comboRef.current = 0
    setCombo(0)
    setFlying(false)
    setFlash('溜走了')
    later()
  }
  const hit = () => {
    if (lock.current) return
    lock.current = true
    flyingRef.current = false
    const nextCombo = comboRef.current + 1
    comboRef.current = nextCombo
    stats.current.catches += 1
    stats.current.bestCombo = Math.max(stats.current.bestCombo, nextCombo)
    setCatches(stats.current.catches)
    setCombo(nextCombo)
    setFlying(false)
    setFlash(nextCombo > 1 ? `连击 ×${nextCombo}` : '接住了')
    later()
  }
  return (
    <div>
      <Hud color={info.deep} label={`${step + 1}/8`} value={`接住 ${catches}`} extra={combo > 1 ? <span className="flex items-center gap-0.5 text-[#E07A4C]"><Flame size={12} />×{combo}</span> : null} />
      <div className="relative h-[280px] overflow-hidden rounded-[28px]" style={{ background: 'linear-gradient(180deg,#FFF6EA,#F8E3C4)' }}>
        <motion.button
          key={step}
          type="button"
          aria-label="接花"
          initial={{ y: 0, opacity: 1, scale: 1 }}
          animate={flying ? { y: 214, opacity: 1, scale: 1 } : { y: 120, opacity: 0, scale: 1.5 }}
          transition={{ duration: flying ? 1.25 : 0.26, ease: flying ? 'easeIn' : 'easeOut' }}
          onAnimationComplete={() => {
            if (flyingRef.current) miss()
          }}
          className="absolute top-3 text-5xl"
          style={{ left: `${LANES[step] ?? 40}%`, translate: '-50% 0' }}
          onClick={hit}
        >
          🌸
        </motion.button>
        <div className="absolute inset-x-0 bottom-3 text-center text-3xl">🧺</div>
      </div>
      <FlashLine text={flash} />
    </div>
  )
}

function ColorPlay(props: { info: GameInfo; onFinish: Finish }) {
  const [seq] = useState(() => Array.from({ length: 4 }, () => Math.floor(Math.random() * PAD_COLORS.length)))
  const [round, setRound] = useState(0)
  const [phase, setPhase] = useState<'watch' | 'play'>('watch')
  const [lit, setLit] = useState<number | null>(null)
  const [at, setAt] = useState(0)
  const [lives, setLives] = useState(3)
  const [cleared, setCleared] = useState(0)
  const [flash, setFlash] = useState('看颜色')
  const ended = useRef(false)
  const finishRef = useRef(props.onFinish)
  useEffect(() => {
    finishRef.current = props.onFinish
  })
  useEffect(() => {
    if (phase !== 'watch' || ended.current) return
    const length = round + 1
    let cursor = 0
    let hide = 0
    const tick = window.setInterval(() => {
      if (cursor >= length) {
        window.clearInterval(tick)
        setLit(null)
        setAt(0)
        setPhase('play')
        setFlash('轮到你了')
        return
      }
      const color = seq[cursor] ?? 0
      setLit(color)
      window.clearTimeout(hide)
      hide = window.setTimeout(() => setLit(null), 240)
      cursor += 1
    }, 520)
    return () => {
      window.clearInterval(tick)
      window.clearTimeout(hide)
    }
  }, [phase, round, seq])
  const finish = (won: boolean, rounds: number, life: number) => {
    if (ended.current) return
    ended.current = true
    finishRef.current(won, rounds * 25 + life * 10, [
      ['记住', `${rounds}/4`],
      ['生命', `${life}`],
      ['轮次', `第 ${Math.max(rounds, 1)} 轮`],
    ])
  }
  const tap = (index: number) => {
    if (phase !== 'play' || ended.current) return
    if (index !== seq[at]) {
      const life = lives - 1
      setLives(life)
      setFlash('记错了')
      if (life <= 0) finish(false, cleared, 0)
      else setPhase('watch')
      return
    }
    const next = at + 1
    if (next >= round + 1) {
      const rounds = round + 1
      setCleared(rounds)
      if (rounds >= 4) finish(true, 4, lives)
      else {
        setFlash('下一轮')
        setRound(rounds)
        setPhase('watch')
      }
      return
    }
    setAt(next)
  }
  return (
    <div>
      <Hud
        color={props.info.deep}
        label={`第 ${round + 1}/4 轮`}
        value={'❤'.repeat(lives) || '没有心了'}
        extra={<span style={DIM}>{phase === 'watch' ? '看着' : `点第 ${at + 1} 个`}</span>}
      />
      <div className="grid grid-cols-2 gap-3 rounded-[28px] p-3" style={{ background: props.info.tint }}>
        {PAD_COLORS.map((color, index) => (
          <button
            key={color.name}
            type="button"
            aria-label={color.name}
            className="h-24 rounded-[22px] text-sm font-medium transition-transform"
            style={{
              background: color.bg,
              transform: lit === index ? 'scale(1.05)' : undefined,
              boxShadow: lit === index ? '0 0 0 4px rgba(255,255,255,0.95)' : 'inset 0 -4px 0 rgba(0,0,0,0.05)',
            }}
            onClick={() => tap(index)}
          >
            {color.name}
          </button>
        ))}
      </div>
      <FlashLine text={flash} />
    </div>
  )
}

function MemoryPlay(props: { info: GameInfo; onFinish: Finish }) {
  const [deck] = useState(() => shuffle([...CARD_FACES, ...CARD_FACES]))
  const [open, setOpen] = useState<number[]>([])
  const [known, setKnown] = useState<number[]>([])
  const [lock, setLock] = useState(false)
  const [pairs, setPairs] = useState(0)
  const [combo, setCombo] = useState(0)
  const [flash, setFlash] = useState('翻开两张一样的')
  const ended = useRef(false)
  const finishRef = useRef(props.onFinish)
  const stats = useRef({ pairs: 0, bestCombo: 0, left: 250 })
  const wait = useRef(0)
  useEffect(() => {
    finishRef.current = props.onFinish
  })
  useEffect(() => () => window.clearTimeout(wait.current), [])
  const finish = (won: boolean) => {
    if (ended.current) return
    ended.current = true
    const { pairs: found, bestCombo, left } = stats.current
    finishRef.current(won, found * 20 + Math.round(left / 10) + bestCombo * 5, [
      ['配对', `${found}/4`],
      ['连击', `${bestCombo}`],
      ['剩余', `${(left / 10).toFixed(1)}s`],
    ])
  }
  const left = useCountdown(250, () => {
    stats.current.left = 0
    finish(false)
  })
  const flip = (index: number) => {
    if (lock || ended.current || known.includes(index) || open.includes(index) || open.length === 2) return
    const next = [...open, index]
    setOpen(next)
    if (next.length < 2) return
    const [a, b] = next
    if (a === undefined || b === undefined || deck[a] !== deck[b]) {
      setCombo(0)
      setFlash('不是一对')
      setLock(true)
      wait.current = window.setTimeout(() => {
        setOpen([])
        setLock(false)
      }, 520)
      return
    }
    const nextCombo = combo + 1
    const found = pairs + 1
    stats.current.pairs = found
    stats.current.bestCombo = Math.max(stats.current.bestCombo, nextCombo)
    setKnown((current) => [...current, a, b])
    setOpen([])
    setCombo(nextCombo)
    setPairs(found)
    setFlash(nextCombo > 1 ? `连击 ×${nextCombo}` : '配对')
    stats.current.left = left
    if (found === 4) finish(true)
  }
  return (
    <div>
      <Hud color={props.info.deep} label={`${pairs}/4 对`} value={`${(left / 10).toFixed(1)}s`} extra={combo > 1 ? <span className="flex items-center gap-0.5" style={{ color: props.info.deep }}><Flame size={12} />×{combo}</span> : null} />
      <div className="grid grid-cols-4 gap-2 rounded-[28px] p-3" style={{ background: props.info.tint }}>
        {deck.map((face, index) => {
          const shown = open.includes(index) || known.includes(index)
          return (
            <motion.button key={`${face}-${index}`} type="button" aria-label={shown ? face : '翻牌'} whileTap={{ scale: 0.94 }} className="h-[68px] rounded-[18px] text-2xl" style={{ background: known.includes(index) ? '#fff' : shown ? '#fff' : props.info.deep }} onClick={() => flip(index)}>
              {shown ? face : '✦'}
            </motion.button>
          )
        })}
      </div>
      <TimeBar left={left} total={250} color={props.info.deep} />
      <FlashLine text={flash} />
    </div>
  )
}

function OrderPlay(props: { info: GameInfo; onFinish: Finish }) {
  const [layout, setLayout] = useState(() => shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]))
  const [next, setNext] = useState(1)
  const [hearts, setHearts] = useState(3)
  const [bad, setBad] = useState<number | null>(null)
  const [flash, setFlash] = useState('从 1 开始')
  const ended = useRef(false)
  const finishRef = useRef(props.onFinish)
  const stats = useRef({ next: 1, hearts: 3, left: 200 })
  useEffect(() => {
    finishRef.current = props.onFinish
  })
  const finish = (won: boolean) => {
    if (ended.current) return
    ended.current = true
    const { next: step, hearts: life, left } = stats.current
    const done = Math.min(9, step - 1)
    finishRef.current(won, done * 10 + life * 12 + Math.round(left / 10), [
      ['点对', `${done}/9`],
      ['生命', `${life}`],
      ['剩余', `${(left / 10).toFixed(1)}s`],
    ])
  }
  const left = useCountdown(200, () => {
    stats.current.left = 0
    finish(false)
  })
  const tap = (value: number) => {
    if (ended.current || value < stats.current.next) return
    if (value !== stats.current.next) {
      setBad(value)
      window.setTimeout(() => setBad(null), 280)
      const life = stats.current.hearts - 1
      stats.current.hearts = life
      stats.current.left = left
      setHearts(life)
      setFlash('不是这个')
      if (life <= 0) finish(false)
      return
    }
    if (value === 9) {
      stats.current.next = 10
      stats.current.left = left
      setNext(10)
      setFlash('全点对了')
      finish(true)
      return
    }
    const step = value + 1
    stats.current.next = step
    setNext(step)
    setLayout(shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]))
    setFlash(`下一个 ${step}`)
  }
  return (
    <div>
      <Hud color={props.info.deep} label={`下一个 ${Math.min(next, 9)}`} value={'❤'.repeat(Math.max(0, hearts)) || '没有心了'} />
      <div className="grid grid-cols-3 gap-2 rounded-[28px] p-3" style={{ background: props.info.tint }}>
        {layout.map((value) => {
          const done = value < next
          return (
            <motion.button
              layout
              key={value}
              type="button"
              aria-label={`数字 ${value}`}
              disabled={done}
              animate={bad === value ? { x: [0, -7, 7, -3, 0] } : { x: 0 }}
              transition={{ duration: 0.28 }}
              className="h-16 rounded-[18px] text-lg tabular-nums"
              style={{ background: done ? 'rgba(255,255,255,0.45)' : '#fff', color: done ? '#b7adba' : props.info.deep }}
              onClick={() => tap(value)}
            >
              {done ? '✓' : value}
            </motion.button>
          )
        })}
      </div>
      <TimeBar left={left} total={200} color={props.info.deep} />
      <FlashLine text={flash} />
    </div>
  )
}

function BeatPlay(props: { info: GameInfo; onFinish: Finish }) {
  const dot = useRef<HTMLSpanElement>(null)
  const finishRef = useRef(props.onFinish)
  const pos = useRef(0)
  const dir = useRef(1)
  const judged = useRef(false)
  const stopped = useRef(false)
  const stats = useRef({ perfect: 0, good: 0, miss: 0, combo: 0, best: 0 })
  const [ui, setUi] = useState({ beat: 1, combo: 0, flash: '光点进绿区再敲' })
  useEffect(() => {
    finishRef.current = props.onFinish
  })
  useEffect(() => {
    let frame = 0
    let prev = performance.now()
    const judge = (kind: 'perfect' | 'good' | 'miss') => {
      if (stopped.current) return
      const current = stats.current
      if (kind === 'miss') {
        current.miss += 1
        current.combo = 0
      } else {
        current[kind] += 1
        current.combo += 1
        current.best = Math.max(current.best, current.combo)
      }
      const count = current.perfect + current.good + current.miss
      const word = kind === 'perfect' ? '完美' : kind === 'good' ? '好' : '错过'
      setUi({
        beat: Math.min(8, count + 1),
        combo: current.combo,
        flash: current.combo > 1 && kind !== 'miss' ? `${word} · 连击 ×${current.combo}` : word,
      })
      if (count >= 8) {
        stopped.current = true
        const score = current.perfect * 15 + current.good * 8 + current.best * 2
        finishRef.current(current.perfect + current.good >= 6, score, [
          ['完美', `${current.perfect}`],
          ['好', `${current.good}`],
          ['错过', `${current.miss}`],
        ])
      }
    }
    const loop = (now: number) => {
      if (stopped.current) return
      const dt = Math.min(34, now - prev)
      prev = now
      pos.current += dir.current * dt * 0.09
      if (pos.current >= 100) {
        pos.current = 100
        if (!judged.current) judge('miss')
        if (stopped.current) return
        judged.current = false
        dir.current = -1
      } else if (pos.current <= 0 && dir.current < 0) {
        pos.current = 0
        if (!judged.current) judge('miss')
        if (stopped.current) return
        judged.current = false
        dir.current = 1
      }
      if (dot.current) dot.current.style.left = `${pos.current}%`
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [])
  const tap = () => {
    if (judged.current || stopped.current) return
    judged.current = true
    const distance = Math.abs(pos.current - 50)
    const kind = distance <= 6 ? 'perfect' : distance <= 14 ? 'good' : 'miss'
    const current = stats.current
    if (kind === 'miss') {
      current.miss += 1
      current.combo = 0
    } else {
      current[kind] += 1
      current.combo += 1
      current.best = Math.max(current.best, current.combo)
    }
    const count = current.perfect + current.good + current.miss
    const word = kind === 'perfect' ? '完美' : kind === 'good' ? '好' : '错过'
    setUi({
      beat: Math.min(8, count + 1),
      combo: current.combo,
      flash: current.combo > 1 && kind !== 'miss' ? `${word} · 连击 ×${current.combo}` : word,
    })
    if (count >= 8) {
      stopped.current = true
      const score = current.perfect * 15 + current.good * 8 + current.best * 2
      finishRef.current(current.perfect + current.good >= 6, score, [
        ['完美', `${current.perfect}`],
        ['好', `${current.good}`],
        ['错过', `${current.miss}`],
      ])
    }
  }
  return (
    <div>
      <Hud color={props.info.deep} label={`${Math.min(ui.beat, 8)}/8`} value={ui.combo > 1 ? `连击 ×${ui.combo}` : '节拍'} />
      <div className="rounded-[28px] p-4" style={{ background: props.info.tint }}>
        <div className="relative h-16 rounded-full bg-white/80">
          <div className="absolute inset-y-2 rounded-full" style={{ left: '36%', width: '28%', background: '#D5F0E4' }} />
          <div className="absolute inset-y-3 rounded-full" style={{ left: '44%', width: '12%', background: '#9ED9C4' }} />
          <span ref={dot} className="absolute top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-md" style={{ left: '0%', background: props.info.deep }} />
        </div>
        <button type="button" className="mt-4 w-full rounded-full py-4 text-base text-white shadow-md active:scale-[0.98]" style={{ background: props.info.deep }} onClick={tap}>敲</button>
      </div>
      <FlashLine text={ui.flash} />
    </div>
  )
}
