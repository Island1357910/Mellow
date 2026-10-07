import { useEffect, useRef, useState } from 'react'
import { isAiJobRunning, jobKey, runAiJob } from '../../engine/aiJobs.ts'
import { askLine } from '../../lib/ask.ts'
import { modePresetId } from '../../lib/defaults.ts'
import { candyStyle } from '../../lib/candy.ts'
import { aiMove as goAi, emptyGrid, winner, type Grid, type Stone } from '../../lib/gomoku.ts'
import { aiMove as chessAi, applyMove, legalMoves, PIECE_NAME, setupBoard, winnerOf, type Board } from '../../lib/xiangqi.ts'
import { aiChoice, canPlay, drawForTurn, freshMatch, playCard, topCard, UNO_COLOR, UNO_LABEL, type UnoColor, type UnoMatch } from '../../lib/uno.ts'
import { nextSeat, pickAt, shuffle } from '../../lib/tableTurn.ts'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import type { Character } from '../../types/index.ts'
import { PillNote, Screen } from '../ui/primitives.tsx'
import { PickCard } from '../ui/PickCard.tsx'
import { RoundTable } from '../ui/RoundTable.tsx'

const GAMES = [
  { id: 'soup', name: '海龟汤', blurb: '只问是或不是', min: 2, max: 2, emoji: '🐢', tint: '#D7E7F8', accent: '#7FB8E0' },
  { id: 'say', name: '你说我猜', blurb: '用话说，别用那个词', min: 2, max: 4, emoji: '💬', tint: '#F8E6C0', accent: '#E9B949' },
  { id: 'wolf', name: '狼人杀', blurb: '夜里闭上眼', min: 4, max: 8, emoji: '🌙', tint: '#E6DDF8', accent: '#B9A3E3' },
  { id: 'uno', name: 'UNO', blurb: '颜色或数字', min: 2, max: 6, emoji: '🃏', tint: '#F8D0DC', accent: '#EE9AB0' },
  { id: 'gomoku', name: '五子棋', blurb: '五子连起来', min: 2, max: 2, emoji: '⚫', tint: '#D5F0E4', accent: '#8EB5A6' },
  { id: 'xiangqi', name: '象棋', blurb: '你执红', min: 2, max: 2, emoji: '♟️', tint: '#F8DCC8', accent: '#D4A574' },
] as const

type GameId = (typeof GAMES)[number]['id']

function playerLabel(min: number, max: number) {
  return min === max ? `${min} 人` : `${min}～${max} 人`
}

let hostVoice = ''

function hostAsk(system: string, user: string, maxTokens?: number) {
  const extra = hostVoice.trim()
  return askLine(extra ? `${extra}\n${system}` : system, user, maxTokens)
}

const NPCS = ['店员', '邻居', '路人', '晚班', '楼对面', '花店']
const SOUPS = [
  { surface: '一个男人走进酒吧，要了一杯水。酒保拿枪指着他。男人说了谢谢，走了。', truth: '男人在打嗝。酒保用枪吓他，嗝停了。', yes: ['嗝', '打嗝', '吓'], no: ['死', '杀', '毒', '抢'] },
  { surface: '电梯里只有两个人。门开的时候，其中一个开始哭。', truth: '他们是陌生人。哭的人发现自己按错了楼层，而那一层是已经搬走的家。', yes: ['楼', '家', '错', '搬'], no: ['鬼', '杀', '爱情'] },
  { surface: '女人每天给花浇水。某一天她没有浇，花反而开了。', truth: '她浇的是盐水。这一天她忘了，雨水才是真的水。', yes: ['盐', '雨', '水'], no: ['人', '死', '魔法'] },
]
const SAYS = [
  { word: '热可可', hints: ['是热的', '捧在手里', '有一点甜'] },
  { word: '末班车', hints: ['很晚', '会关门', '有靠窗的位子'] },
  { word: '红伞', hints: ['下雨才拿出来', '颜色醒目', '撑在头顶'] },
  { word: '夜灯', hints: ['很小', '睡觉时还亮着', '暖的'] },
  { word: '围巾', hints: ['绕一圈', '风大的时候用', '软的'] },
]
function usePhone() {
  const identities = useMellow((state) => state.identities)
  const activeIdentityId = useMellow((state) => state.activeIdentityId)
  return identities.find((item) => item.id === activeIdentityId) ?? null
}

function cast(player: string, chars: Character[], chosen: string[], min: number, max: number): string[] {
  const names = [player || '我']
  for (const id of chosen) {
    const person = chars.find((item) => item.id === id)
    if (person && names.length < max && !names.includes(person.name)) names.push(person.name)
  }
  let index = 0
  while (names.length < min && index < 12) {
    const base = NPCS[index % NPCS.length] ?? '路人'
    const name = names.includes(base) ? `${base}${index}` : base
    names.push(name)
    index += 1
  }
  return names.slice(0, max)
}

function runAi(match: UnoMatch): UnoMatch {
  let next = match
  for (let guard = 0; guard < 16 && next.winner === null && next.turn !== 0; guard += 1) {
    const choice = aiChoice(next)
    if (!choice) {
      next = drawForTurn(next)
      continue
    }
    next = playCard(next, next.turn, choice.index, choice.color) ?? drawForTurn(next)
  }
  return next
}

function Soup(props: { names: string[]; namespace: string; onBack: () => void }) {
  const dataRevision = useMellow((state) => state.dataRevision)
  const hostIndex = 1
  const sessionId = props.names.join('-')
  const bagKey = `table_soup_${sessionId}`
  const [soup] = useState(() => SOUPS[Math.floor(Math.random() * SOUPS.length)] ?? SOUPS[0])
  const [turns, setTurns] = useState<Array<{ who: string; q: string; a: string }>>([])
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const [asker, setAsker] = useState(0)
  useEffect(() => {
    void storage.getBag<{ turns: Array<{ who: string; q: string; a: string }> }>(props.namespace, bagKey).then((saved) => {
      if (saved?.turns?.length) setTurns(saved.turns)
    })
  }, [props.namespace, bagKey, dataRevision])
  if (!soup) return null
  const host = props.names[hostIndex] ?? '主持人'
  const busy = isAiJobRunning(jobKey(props.namespace, 'table-soup', sessionId))
  const ask = () => {
    const q = draft.trim()
    if (!q || busy) return
    const local = soup.yes.some((word) => q.includes(word)) ? '是' : soup.no.some((word) => q.includes(word)) ? '不是' : '无关'
    const who = props.names[asker] ?? '我'
    const turnIndex = turns.length
    const nextTurns = [...turns, { who, q, a: local }]
    setTurns(nextTurns)
    void storage.setBag(props.namespace, bagKey, { turns: nextTurns })
    setDraft('')
    if (props.names.length > 2) setAsker((value) => nextSeat(value, props.names.length))
    const surface = soup.surface
    const truth = soup.truth
    runAiJob(jobKey(props.namespace, 'table-soup', `${sessionId}-${turnIndex}`), async () => {
      try {
        const line = await hostAsk(`你是海龟汤主持人 ${host}。汤面：${surface}。汤底只有你知道：${truth}。只回答「是」「不是」或「无关」，可以再加四个字。不要揭晓汤底。`, `${who} 问：${q}`, 40)
        const clean = line.replace(/[。！!]/g, '').slice(0, 12)
        if (!/是|不|无关/.test(clean)) return
        const saved = (await storage.getBag<{ turns: Array<{ who: string; q: string; a: string }> }>(props.namespace, bagKey)) ?? { turns: nextTurns }
        const updated = saved.turns.map((item, index) => (index === turnIndex ? { ...item, a: clean } : item))
        await storage.setBag(props.namespace, bagKey, { turns: updated })
      } catch {
        // 本地答案已经写上
      }
    })
  }
  return (
    <Screen title="海龟汤" subtitle={`${host} 主持 · 你在提问`} onBack={props.onBack}>
      <RoundTable names={props.names} turn={asker} host={hostIndex} caption={`${props.names[asker] ?? '我'} 提问中`} />
      <article className="menu-card text-sm leading-6">{soup.surface}</article>
      <div className="mt-3 space-y-2">
        {turns.map((item, index) => (
          <article key={`${index}-${item.q}`} className="menu-card">
            <p className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{item.who} 问</p>
            <p className="text-sm">{item.q}</p>
            <p className="mt-1 text-sm font-medium">{host}：{item.a}</p>
          </article>
        ))}
      </div>
      {open ? <div className="mt-3"><PillNote tone="lilac">{soup.truth}</PillNote></div> : <button type="button" className="chip mt-3" onClick={() => setOpen(true)}>公布汤底</button>}
      {asker === 0 ? (
        <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); void ask() }}>
          <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="是不是…" className="soft-input" />
          <button type="submit" className="chip chip-solid shrink-0" disabled={busy || !draft.trim()}>问</button>
        </form>
      ) : (
        <p className="mt-3 text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>轮到其他玩家提问时，请把问题交给 TA。</p>
      )}
    </Screen>
  )
}

function Say(props: { names: string[]; namespace: string; onBack: () => void }) {
  const dataRevision = useMellow((state) => state.dataRevision)
  const count = props.names.length
  const [round, setRound] = useState(0)
  const [card] = useState(() => SAYS[Math.floor(Math.random() * SAYS.length)] ?? SAYS[0])
  const [hintIndex, setHintIndex] = useState(0)
  const [guesserOffset, setGuesserOffset] = useState(1)
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState('')
  const npcGuessed = useRef('')
  const describer = round % count
  const guesser = (describer + guesserOffset) % count
  const phase = hintIndex < (card?.hints.length ?? 0) ? 'hint' : 'guess'
  const activeSeat = phase === 'hint' ? describer : guesser

  const nextRound = () => {
    npcGuessed.current = ''
    setRound((value) => value + 1)
    setHintIndex(0)
    setGuesserOffset(1)
    setNote('')
    setDraft('')
  }

  const giveHint = async (text: string) => {
    if (!text.trim() || text.includes(card.word)) {
      setNote(text.includes(card.word) ? '这个词不能说出来' : '')
      return
    }
    setNote(`${props.names[describer] ?? '描述者'}：${text.trim()}`)
    setDraft('')
    setHintIndex((value) => value + 1)
  }

  const tryGuess = async (text: string) => {
    const clean = text.trim()
    if (!clean) return
    if (clean === card.word) {
      setNote(`${props.names[guesser] ?? '玩家'} 猜对了：${card.word}`)
      return
    }
    if (guesserOffset < count - 1) {
      setGuesserOffset((value) => value + 1)
      setNote(`${props.names[guesser] ?? '玩家'} 没猜中，换下一位`)
      setDraft('')
      return
    }
    setNote(`这一轮没人猜中。词是 ${card.word}`)
  }

  useEffect(() => {
    if (phase !== 'hint' || describer === 0) return
    const timer = window.setTimeout(() => {
      setHintIndex((value) => Math.min(value + 1, card.hints.length))
      setNote(`${props.names[describer] ?? '描述者'}：${card.hints[hintIndex] ?? '……'}`)
    }, 900)
    return () => window.clearTimeout(timer)
  }, [phase, describer, hintIndex, card.hints])

  useEffect(() => {
    void storage.getBag<{ note: string; guesserOffset?: number }>(props.namespace, `table_say_${round}`).then((saved) => {
      if (saved?.note) setNote(saved.note)
      if (typeof saved?.guesserOffset === 'number') setGuesserOffset(saved.guesserOffset)
    })
  }, [props.namespace, round, dataRevision])

  useEffect(() => {
    if (phase !== 'guess' || guesser === 0) return
    const key = `${round}-${guesserOffset}-${hintIndex}`
    if (npcGuessed.current === key) return
    npcGuessed.current = key
    const hints = card.hints.slice(0, hintIndex).join('，')
    const word = card.word
    const guesserName = props.names[guesser] ?? '玩家'
    runAiJob(jobKey(props.namespace, 'table-say', key), async () => {
      try {
        const line = await hostAsk('你说我猜。只回答一个中文词，不要解释。', `提示：${hints}`, 20)
        const guess = line.replace(/[。\s]/g, '').slice(0, 8)
        let message = ''
        let nextOffset = guesserOffset
        if (guess === word) message = `${guesserName} 猜对了：${word}`
        else if (guesserOffset < count - 1) {
          nextOffset = guesserOffset + 1
          message = `${guesserName} 猜：${guess || '……'}，不对`
        } else message = `这一轮结束。词是 ${word}`
        await storage.setBag(props.namespace, `table_say_${round}`, { note: message, guesserOffset: nextOffset })
      } catch {
        await storage.setBag(props.namespace, `table_say_${round}`, { note: `${guesserName} 还在想…` })
      }
    })
  }, [phase, guesser, guesserOffset, hintIndex, round, count, card.word, card.hints, props.names, props.namespace])

  if (!card) return null

  return (
    <Screen title="你说我猜" subtitle={phase === 'hint' ? `${props.names[describer] ?? ''} 描述` : `${props.names[guesser] ?? ''} 猜词`} onBack={props.onBack}>
      <RoundTable
        names={props.names}
        turn={activeSeat}
        caption={phase === 'hint' ? '描述者按顺序给提示，不能说出原词' : '其他人轮流猜词'}
      />
      {describer === 0 && phase === 'hint' ? (
        <PillNote tone="butter" compact>你在描述：{card.word}</PillNote>
      ) : (
        <article className="menu-card text-sm leading-6">{card.hints.slice(0, hintIndex).join('，') || '还没有提示'}</article>
      )}
      {describer === 0 && phase === 'hint' ? (
        <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); void giveHint(draft) }}>
          <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="给一句提示" className="soft-input" />
          <button type="submit" className="chip chip-solid shrink-0">说</button>
        </form>
      ) : null}
      {guesser === 0 && phase === 'guess' ? (
        <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); void tryGuess(draft) }}>
          <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="我猜是" className="soft-input" />
          <button type="submit" className="chip chip-solid shrink-0">猜</button>
        </form>
      ) : null}
      {note ? <div className="mt-3"><PillNote tone="lilac" inline>{note}</PillNote></div> : null}
      {note.includes('猜对了') || note.includes('词是') ? (
        <button type="button" className="chip chip-solid mt-3" onClick={nextRound}>下一轮</button>
      ) : null}
    </Screen>
  )
}

function rolesFor(count: number): string[] {
  const roles = ['狼人']
  if (count >= 4) roles.push('预言家')
  if (count >= 5) roles.push('女巫')
  while (roles.length < count) roles.push('村民')
  if (count >= 6) roles[roles.length - 1] = '狼人'
  return shuffle(roles)
}

type WolfSeat = { name: string; role: string; alive: boolean }
type NightStep = 'wolf' | 'seer' | 'witch' | 'resolve'

function Wolf(props: { names: string[]; onBack: () => void }) {
  const [seats, setSeats] = useState<WolfSeat[]>(() => rolesFor(props.names.length).map((role, index) => ({ name: props.names[index] ?? `座位${index}`, role, alive: true })))
  const [phase, setPhase] = useState<'night' | 'day' | 'end'>('night')
  const [nightStep, setNightStep] = useState<NightStep>('wolf')
  const [wolfTarget, setWolfTarget] = useState<string | null>(null)
  const [seen, setSeen] = useState('')
  const [log, setLog] = useState('天黑了。狼人请睁眼。')
  const [saveLeft, setSaveLeft] = useState(true)
  const [poisonLeft, setPoisonLeft] = useState(true)
  const [day, setDay] = useState(1)
  const me = seats[0]
  const living = seats.filter((seat) => seat.alive)
  const outFlags = seats.map((seat) => !seat.alive)
  const wolvesAlive = seats.filter((seat) => seat.alive && seat.role === '狼人').length
  const badges = seats.map((seat) => (phase === 'end' || seat.name === me?.name ? seat.role : seat.alive ? undefined : '出局'))

  const checkWin = (next: WolfSeat[], message: string) => {
    const wolves = next.filter((seat) => seat.alive && seat.role === '狼人').length
    const others = next.filter((seat) => seat.alive && seat.role !== '狼人').length
    if (wolves === 0 || wolves >= others) {
      setPhase('end')
      setLog(wolves === 0 ? '村子赢了。' : '狼人赢了。')
      return true
    }
    setLog(message)
    return false
  }

  const resolveNight = (deadNames: string[]) => {
    const unique = [...new Set(deadNames.filter(Boolean))]
    const next = seats.map((seat) => (unique.includes(seat.name) ? { ...seat, alive: false } : seat))
    setSeats(next)
    setNightStep('wolf')
    setWolfTarget(null)
    setSeen('')
    if (checkWin(next, unique.length ? `天亮了。${unique.join('、')} 没有起来。` : '天亮了。这一夜是安静的。')) return
    setPhase('day')
    setDay((value) => value + 1)
  }

  const finishWolfStep = (target: string | null) => {
    setWolfTarget(target)
    const seerAlive = seats.some((seat) => seat.alive && seat.role === '预言家')
    const witchAlive = seats.some((seat) => seat.alive && seat.role === '女巫')
    if (seerAlive) setNightStep('seer')
    else if (witchAlive) setNightStep('witch')
    else resolveNight(target ? [target] : [])
  }

  const finishSeerStep = () => {
    const witchAlive = seats.some((seat) => seat.alive && seat.role === '女巫')
    if (witchAlive) setNightStep('witch')
    else resolveNight(wolfTarget ? [wolfTarget] : [])
  }

  const finishWitchStep = (saved: boolean, poison: string | null) => {
    const dead: string[] = []
    if (wolfTarget && !saved) dead.push(wolfTarget)
    if (poison) dead.push(poison)
    resolveNight(dead)
  }

  const autoWolfKill = () => {
    const victims = seats.filter((seat) => seat.alive && seat.role !== '狼人')
    finishWolfStep(pickAt(victims)?.name ?? null)
  }

  const vote = (name: string) => {
    const tally: Record<string, number> = { [name]: 1 }
    for (const seat of seats) {
      if (!seat.alive || seat.name === me?.name) continue
      const options = seats.filter((item) => item.alive && item.name !== seat.name && (seat.role !== '狼人' || item.role !== '狼人'))
      const pick = pickAt(options)
      if (pick) tally[pick.name] = (tally[pick.name] ?? 0) + 1
    }
    const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]
    const out = top && Object.values(tally).filter((value) => value === top[1]).length === 1 ? top[0] : ''
    const next = seats.map((seat) => (seat.name === out ? { ...seat, alive: false } : seat))
    setSeats(next)
    const wolves = next.filter((seat) => seat.alive && seat.role === '狼人').length
    const others = next.filter((seat) => seat.alive && seat.role !== '狼人').length
    if (!out) setLog('票数一样，今晚没有人出局。')
    else setLog(`${out} 被投票出局。`)
    if (wolves === 0 || (wolves > 0 && wolves >= others)) {
      setPhase('end')
      setLog(wolves === 0 ? `${out || '这一轮'}之后，村子赢了。` : '狼人赢了。')
      return
    }
    setPhase('night')
    setNightStep('wolf')
    setLog(`第 ${day + 1} 夜。狼人请睁眼。`)
  }

  if (!me) return null
  const turnSeat = phase === 'night'
    ? nightStep === 'wolf'
      ? seats.findIndex((seat) => seat.alive && seat.role === '狼人')
      : nightStep === 'seer'
        ? seats.findIndex((seat) => seat.alive && seat.role === '预言家')
        : nightStep === 'witch'
          ? seats.findIndex((seat) => seat.alive && seat.role === '女巫')
          : null
    : null

  return (
    <Screen title="狼人杀" subtitle={phase === 'end' ? '结束' : phase === 'night' ? `第 ${day} 夜 · ${nightStep === 'wolf' ? '狼人' : nightStep === 'seer' ? '预言家' : '女巫'}` : `第 ${day} 天 · 投票`} onBack={props.onBack}>
      <RoundTable names={props.names} turn={turnSeat} out={outFlags} badges={badges} caption={log} />
      <article className="menu-card">
        <p className="text-sm">你是 {me.role}</p>
        {seen ? <p className="mt-1 text-xs">{seen}</p> : null}
      </article>
      {phase === 'night' && nightStep === 'wolf' && me.alive && me.role === '狼人' ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {living.filter((seat) => seat.role !== '狼人').map((seat) => (
            <button key={seat.name} type="button" className="chip chip-danger" onClick={() => finishWolfStep(seat.name)}>{seat.name}</button>
          ))}
        </div>
      ) : null}
      {phase === 'night' && nightStep === 'wolf' && me.role !== '狼人' ? (
        <button type="button" className="chip chip-solid mt-3" onClick={autoWolfKill}>狼人行动（自动）</button>
      ) : null}
      {phase === 'night' && nightStep === 'seer' && me.alive && me.role === '预言家' ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {living.filter((seat) => seat.name !== me.name).map((seat) => (
            <button key={seat.name} type="button" className="chip" onClick={() => { setSeen(`${seat.name} 是 ${seat.role}`); finishSeerStep() }}>{seat.name}</button>
          ))}
        </div>
      ) : null}
      {phase === 'night' && nightStep === 'seer' && me.role !== '预言家' ? (
        <button type="button" className="chip mt-3" onClick={finishSeerStep}>预言家行动（自动）</button>
      ) : null}
      {phase === 'night' && nightStep === 'witch' && me.alive && me.role === '女巫' ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs" style={{ color: 'var(--m-text-secondary)' }}>{wolfTarget ? `今晚倒牌的是 ${wolfTarget}` : '今晚看不出倒牌'}</p>
          {saveLeft && wolfTarget ? <button type="button" className="chip chip-mint" onClick={() => { setSaveLeft(false); finishWitchStep(true, null) }}>救 {wolfTarget}</button> : null}
          {poisonLeft ? living.filter((seat) => seat.name !== me.name).map((seat) => (
            <button key={seat.name} type="button" className="chip chip-danger" onClick={() => { setPoisonLeft(false); finishWitchStep(false, seat.name) }}>毒 {seat.name}</button>
          )) : null}
          <button type="button" className="chip" onClick={() => finishWitchStep(false, null)}>不用药</button>
        </div>
      ) : null}
      {phase === 'night' && nightStep === 'witch' && me.role !== '女巫' ? (
        <button type="button" className="chip mt-3" onClick={() => finishWitchStep(false, null)}>女巫行动（自动）</button>
      ) : null}
      {phase === 'night' && nightStep === 'resolve' ? (
        <button type="button" className="chip chip-solid mt-3" onClick={() => resolveNight(wolfTarget ? [wolfTarget] : [])}>天亮</button>
      ) : null}
      {phase === 'day' ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {living.map((seat) => <button key={seat.name} type="button" className="chip" onClick={() => vote(seat.name)}>投 {seat.name}</button>)}
        </div>
      ) : null}
      {phase === 'end' ? (
        <div className="mt-3"><PillNote tone={wolvesAlive === 0 ? 'mint' : 'peach'}>{seats.map((seat) => `${seat.name} ${seat.role}`).join('、')}</PillNote></div>
      ) : null}
    </Screen>
  )
}

function Gomoku(props: { names: string[]; onBack: () => void }) {
  const rival = props.names[1] ?? '对面'
  const [grid, setGrid] = useState<Grid>(() => emptyGrid())
  const [over, setOver] = useState('')
  const [turn, setTurn] = useState(0)
  const play = (row: number, col: number) => {
    if (over || turn !== 0 || grid[row]?.[col]) return
    const next = grid.map((line) => line.slice())
    const line = next[row]
    if (!line) return
    line[col] = 1
    if (winner(next)) {
      setGrid(next)
      setOver('你赢了')
      return
    }
    setTurn(1)
    const move = goAi(next, 2)
    if (!move) {
      setGrid(next)
      setOver('下满了')
      setTurn(0)
      return
    }
    const target = next[move[0]]
    if (target) target[move[1]] = 2 as Stone
    setGrid(next)
    setTurn(0)
    setOver(winner(next) ? `${rival} 赢了` : '')
  }
  return (
    <Screen title="五子棋" subtitle={over || (turn === 0 ? '轮到你落子' : `${rival} 在想…`)} onBack={props.onBack}>
      <RoundTable names={props.names.slice(0, 2)} turn={turn} badges={['粉子', '墨子']} caption="黑白轮流，先连五子者胜" />
      <div className="grid grid-cols-9 gap-1 rounded-[24px] bg-white/80 p-2">
        {grid.map((line, row) => line.map((stone, col) => (
          <button key={`${row}-${col}`} type="button" aria-label={`第${row + 1}行第${col + 1}列`} className="grid aspect-square place-items-center rounded-lg bg-[#f8efe4]" onClick={() => play(row, col)}>
            {stone ? <span className="h-3.5 w-3.5 rounded-full" style={{ background: stone === 1 ? '#F3A8BA' : '#4a4458' }} /> : null}
          </button>
        )))}
      </div>
    </Screen>
  )
}

function Xiangqi(props: { names: string[]; onBack: () => void }) {
  const rival = props.names[1] ?? '对面'
  const [board, setBoard] = useState<Board>(() => setupBoard())
  const [pick, setPick] = useState<[number, number] | null>(null)
  const [over, setOver] = useState('')
  const [turn, setTurn] = useState(0)
  const targets = pick ? legalMoves(board, pick[0], pick[1]) : []
  const click = (row: number, col: number) => {
    if (over || turn !== 0) return
    const hit = targets.some(([tr, tc]) => tr === row && tc === col)
    if (pick && hit) {
      const after = applyMove(board, pick[0], pick[1], row, col)
      setPick(null)
      if (winnerOf(after) === 'red') {
        setBoard(after)
        setOver('你赢了')
        return
      }
      setTurn(1)
      const reply = chessAi(after, false)
      if (!reply) {
        setBoard(after)
        setOver('对方无棋可走')
        setTurn(0)
        return
      }
      const done = applyMove(after, reply.r, reply.c, reply.tr, reply.tc)
      setBoard(done)
      setTurn(0)
      if (winnerOf(done) === 'black') setOver(`${rival} 赢了`)
      return
    }
    const piece = board[row]?.[col]
    if (piece && piece === piece.toUpperCase()) setPick([row, col])
    else setPick(null)
  }
  return (
    <Screen title="象棋" subtitle={over || (turn === 0 ? '轮到你走棋' : `${rival} 在想…`)} onBack={props.onBack}>
      <RoundTable names={props.names.slice(0, 2)} turn={turn} badges={['红方', '黑方']} caption="红先黑后，将死对方即胜" />
      <div className="grid grid-cols-9 gap-0.5 rounded-[20px] bg-[#f6e7c1] p-1.5">
        {board.map((line, row) => line.map((piece, col) => {
          const on = targets.some(([tr, tc]) => tr === row && tc === col)
          const selected = pick?.[0] === row && pick?.[1] === col
          return (
            <button key={`${row}-${col}`} type="button" aria-label={piece ? PIECE_NAME[piece] ?? '棋子' : '空位'} className="grid h-7 place-items-center rounded-full text-[11px] font-medium" style={{ background: selected ? '#F3A8BA' : on ? '#fff' : 'transparent', color: piece && piece === piece.toUpperCase() ? '#c45b6a' : '#2c2a3a' }} onClick={() => click(row, col)}>
              {piece ? PIECE_NAME[piece] : ''}
            </button>
          )
        }))}
      </div>
    </Screen>
  )
}

function Uno(props: { names: string[]; onBack: () => void }) {
  const [match, setMatch] = useState<UnoMatch>(() => freshMatch(props.names))
  const [wildAt, setWildAt] = useState<number | null>(null)
  const top = topCard(match)
  const hand = match.hands[0] ?? []
  const play = (index: number, color: UnoColor | null) => {
    const card = hand[index]
    if (!card || match.turn !== 0 || match.winner !== null) return
    if ((card.rank === 'wild' || card.rank === 'wild4') && !color) {
      setWildAt(index)
      return
    }
    const next = playCard(match, 0, index, color)
    if (!next) return
    setWildAt(null)
    setMatch(runAi(next))
  }
  const draw = () => {
    const next = drawForTurn(match)
    setMatch(next.turn === 0 ? next : runAi(next))
  }
  const stuck = hand.every((card) => !canPlay(card, top, match.wild))
  const badges = match.names.map((_, index) => `${match.hands[index]?.length ?? 0} 张`)
  return (
    <Screen title="UNO" subtitle={match.winner === null ? `${match.names[match.turn] ?? ''} 的回合` : `${match.names[match.winner] ?? ''} 赢了`} onBack={props.onBack}>
      <RoundTable
        names={props.names}
        turn={match.winner === null ? match.turn : null}
        badges={badges}
        center={<span className="grid h-16 w-11 place-items-center rounded-xl text-sm font-semibold" style={{ background: top?.color ? UNO_COLOR[top.color] : '#fff' }}>{top ? UNO_LABEL[top.rank] ?? top.rank : ''}</span>}
        caption={match.wild ? `当前颜色：${match.wild === 'red' ? '粉' : match.wild === 'yellow' ? '黄' : match.wild === 'green' ? '绿' : '蓝'}` : match.note}
      />
      <div className="mt-1 flex flex-wrap gap-2">
        {hand.map((card, index) => (
          <button key={card.id} type="button" disabled={!canPlay(card, top, match.wild) || match.turn !== 0} className="grid h-16 w-11 place-items-center rounded-xl text-sm font-semibold disabled:opacity-40" style={{ background: card.color ? UNO_COLOR[card.color] : '#fff' }} onClick={() => play(index, null)}>
            {UNO_LABEL[card.rank] ?? card.rank}
          </button>
        ))}
      </div>
      {wildAt !== null ? (
        <div className="mt-3 flex gap-1.5">
          {(Object.keys(UNO_COLOR) as UnoColor[]).map((color) => (
            <button key={color} type="button" className="h-8 w-8 rounded-full" style={{ background: UNO_COLOR[color] }} onClick={() => play(wildAt, color)} />
          ))}
        </div>
      ) : null}
      {stuck && match.turn === 0 && match.winner === null ? <button type="button" className="chip mt-3" onClick={draw}>摸一张</button> : null}
    </Screen>
  )
}

export function TableApp(props: { onBack: () => void }) {
  const phone = usePhone()
  const presets = useMellow((state) => state.presets)
  const settings = useMellow((state) => state.settings)
  const voice = presets.find((item) => item.id === modePresetId(settings, 'table'))?.data.prompts.find((item) => item.enabled)?.content ?? ''
  useEffect(() => {
    hostVoice = voice
  }, [voice])
  const [chars, setChars] = useState<Character[]>([])
  const [game, setGame] = useState<GameId | null>(null)
  const [chosen, setChosen] = useState<string[]>([])
  const [names, setNames] = useState<string[]>([])
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    if (!phone) return
    let stop = false
    void storage.listCharacters(phone.namespace).then((rows) => {
      if (!stop) setChars(rows)
    })
    return () => {
      stop = true
    }
  }, [phone])
  if (!phone) return null
  const meta = GAMES.find((item) => item.id === game)
  const maxPick = meta ? meta.max - 1 : 0
  const toggle = (id: string) => {
    if (!meta) return
    setChosen((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id)
      if (current.length >= maxPick) return current
      return [...current, id]
    })
  }
  const start = () => {
    if (!meta) return
    setNames(cast(phone.name, chars, chosen, meta.min, meta.max))
    setPlaying(true)
  }
  const leave = () => {
    setPlaying(false)
    setGame(null)
  }
  let view = (
    <Screen title="桌游" subtitle="围桌而坐，按顺序轮流" onBack={props.onBack}>
      <div className="pick-card-grid">
        {GAMES.map((item) => (
          <PickCard
            key={item.id}
            item={{ ...item, badge: playerLabel(item.min, item.max) }}
            selected={game === item.id}
            onClick={() => { setGame(item.id); setPlaying(false); setChosen([]) }}
          />
        ))}
      </div>
      {meta ? (
        <div className="menu-card mt-3">
          <p className="text-sm font-medium">和谁一起玩 {meta.name}</p>
          <p className="mt-1 text-[11px] leading-5" style={{ color: 'var(--m-text-secondary)' }}>
            需要 {playerLabel(meta.min, meta.max)} · 已选 {chosen.length} 位角色{maxPick > 0 ? `（最多 ${maxPick} 位）` : ''}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chars.map((person) => {
              const on = chosen.includes(person.id)
              const locked = !on && chosen.length >= maxPick
              return (
                <button key={person.id} type="button" disabled={locked} className={`chip ${on ? 'chip-pink' : ''}`} style={locked ? { opacity: 0.45 } : undefined} onClick={() => toggle(person.id)}>{person.name}</button>
              )
            })}
          </div>
          <p className="mt-2 text-[11px] leading-5" style={{ color: 'var(--m-text-secondary)' }}>
            {meta.min > 1 && chosen.length < meta.min - 1
              ? `不足 ${meta.min} 人时会用路人补位。`
              : maxPick > 0
                ? '也可以不选，全部用路人坐下。'
                : '这个游戏只能两个人玩。'}
          </p>
          <button type="button" className="chip chip-solid mt-2" onClick={start}>开始</button>
        </div>
      ) : <div className="mt-3"><PillNote tone="lilac">先选一个游戏</PillNote></div>}
    </Screen>
  )
  if (playing && game === 'soup') view = <Soup names={names} namespace={phone.namespace} onBack={leave} />
  if (playing && game === 'say') view = <Say names={names} namespace={phone.namespace} onBack={leave} />
  if (playing && game === 'wolf') view = <Wolf names={names} onBack={leave} />
  if (playing && game === 'uno') view = <Uno names={names} onBack={leave} />
  if (playing && game === 'gomoku') view = <Gomoku names={names} onBack={leave} />
  if (playing && game === 'xiangqi') view = <Xiangqi names={names} onBack={leave} />
  return <div className="sms-shell h-full min-h-0" style={candyStyle('#C9B6E8', '#F8D0DC', '#D5F0E4')}>{view}</div>
}
