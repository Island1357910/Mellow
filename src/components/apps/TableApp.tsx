import { TableHistory } from './TableHistory.tsx'
import type { TableSummary } from '../../lib/tableHistory.ts'
import { gomokuSituation, xiangqiSituation, unoSituation } from '../../lib/tableSituation.ts'
import { TableConversation } from './TableConversation.tsx'
import { addKeepsake, changeSharedLife, readSharedLife, sharedLifeNote } from '../../lib/sharedLife.ts'
import { uid } from '../../lib/id.ts'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { isAiJobRunning, jobKey, runAiJob } from '../../engine/aiJobs.ts'
import { moduleAi, readJson } from '../../lib/ask.ts'
import { SCENE_HOLD } from '../../data/officialPresets.ts'
import { modePresetId } from '../../lib/defaults.ts'
import { candyStyle } from '../../lib/candy.ts'
import { aiMove as goAi, emptyGrid, winner, type Grid, type Stone } from '../../lib/gomoku.ts'
import { aiMove as chessAi, applyMove, legalMoves, PIECE_NAME, setupBoard, winnerOf, type Board } from '../../lib/xiangqi.ts'
import { aiChoice, canPlayFromHand, drawForTurn, freshMatch, playCard, topCard, UNO_COLOR, UNO_LABEL, type UnoCard, type UnoColor, type UnoMatch } from '../../lib/uno.ts'
import { BLUFFS, SAYS, SOUPS, SPY_PAIRS } from '../../data/tableDecks.ts'
import { nextSeat, pickAt, shuffle } from '../../lib/tableTurn.ts'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import type { Character } from '../../types/index.ts'
import { PillNote, Screen } from '../ui/primitives.tsx'
import { PickCard } from '../ui/PickCard.tsx'
import { RoundTable } from '../ui/RoundTable.tsx'

const { askLine } = moduleAi('table')

const GAMES = [
  { id: 'soup', name: '海龟汤', blurb: '只问是或不是', min: 2, max: 2, emoji: '🐢', tint: '#D7E7F8', accent: '#7FB8E0' },
  { id: 'say', name: '你说我猜', blurb: '用话说，别用那个词', min: 2, max: 4, emoji: '💬', tint: '#F8E6C0', accent: '#E9B949' },
  { id: 'spy', name: '谁是卧底', blurb: '词很像，别说破', min: 4, max: 8, emoji: '🎭', tint: '#F6D6C9', accent: '#E08A6A' },
  { id: 'bluff', name: '谁是瞎掰王', blurb: '编一个像真的', min: 3, max: 8, emoji: '🎲', tint: '#E7F3C9', accent: '#8FB56A' },
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
  return askLine(extra ? `${extra}\n${system}` : system, user, maxTokens ?? 300, 45_000)
}

const TablePeople = createContext<Array<{ person: Character; bond: number }>>([])
function dispatchTableEvent(text:string,finished=false,roundStart=false){window.dispatchEvent(new CustomEvent('mellow-table-event',{detail:{text,finished,roundStart}}))}
function useTableEvent() {
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  return useCallback((text: string, finished = false, roundStart = false) => {
    if (active.current) dispatchTableEvent(text, finished, roundStart)
  }, [])
}

function mayYield(info:{person:Character;bond:number}|undefined){return Boolean(info&&info.bond>=50&&!/好胜|争强|不服输|认真/.test(info.person.personality)&&Math.random()<.22)}

const NPCS = ['店员', '邻居', '路人', '晚班', '楼对面', '花店']

function another<T>(list: readonly T[], same: (item: T) => boolean, current: T): T {
  return pickAt(list.filter((item) => !same(item))) ?? current
}

function firstAlive(flags: boolean[], from = 0) {
  for (let index = from; index < flags.length; index += 1) if (flags[index]) return index
  return -1
}

function compactText(text: string) {
  return text.replace(/\s/g, '').replace(/[。！？!?.，,]/g, '')
}

function oneLine(text: string, max = 40) {
  const line = text.replace(/\\n/g, '\n').split('\n').map((item) => item.trim()).find(Boolean) ?? ''
  return line.replace(/^["「『]+|["」』]+$/g, '').slice(0, max)
}

function hintLines(text: string, word: string) {
  return text.replace(/\\n/g, '\n').split(/\n+|；|;/).flatMap((row) => row.split(/(?=\d+[.、．])/))
    .map((item) => item.replace(/^\d+[.、．]\s*/, '').trim())
    .filter((item) => item && !item.includes(word))
}

function dealSpy(names: string[]) {
  const pair = pickAt(SPY_PAIRS) ?? SPY_PAIRS[0]
  const count = names.length >= 7 ? 2 : 1
  const spies = new Set(shuffle(names.map((_, index) => index)).slice(0, count))
  return names.map((_, index) => ({ word: spies.has(index) ? pair.spy : pair.civilian, spy: spies.has(index) }))
}
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

function runAi(match: UnoMatch, yielding=false): UnoMatch {
  let next = match
  for (let guard = 0; guard < 1 && next.winner === null && next.turn !== 0; guard += 1) {
    const choice = yielding ? null : aiChoice(next)
    if (!choice) {
      next = drawForTurn(next)
      continue
    }
    next = playCard(next, next.turn, choice.index, choice.color) ?? drawForTurn(next)
  }
  return next
}

function Soup(props: { names: string[]; namespace: string; onBack: () => void }) {
  const tableEvent = useTableEvent()
  const dataRevision = useMellow((state) => state.dataRevision)
  const hostIndex = 1
  const [soup, setSoup] = useState(() => pickAt(SOUPS) ?? SOUPS[0])
  const sessionId = props.names.join('-')
  const bagKey = `table_soup_${sessionId}_${soup?.surface ?? ''}`
  const [turns, setTurns] = useState<Array<{ who: string; q: string; a: string }>>([])
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const [asker, setAsker] = useState(0)
  useEffect(() => {
    let live = true
    void storage.getBag<{ turns: Array<{ who: string; q: string; a: string }> }>(props.namespace, bagKey).then((saved) => {
      if (live && saved?.turns?.length) setTurns(saved.turns)
    })
    return () => { live = false }
  }, [props.namespace, bagKey, dataRevision])
  if (!soup) return null
  const host = props.names[hostIndex] ?? '主持人'
  const busy = isAiJobRunning(jobKey(props.namespace, 'table-soup', `${sessionId}-${turns.length-1}`))
  const ask = () => {
    const q = draft.trim()
    if (!q || busy) return
    const local = '主持人正在判断…'
    const who = props.names[asker] ?? '我'
    const turnIndex = turns.length
    const nextTurns = [...turns, { who, q, a: local }]
    setTurns(nextTurns)
    void storage.setBag(props.namespace, bagKey, { turns: nextTurns })
    setDraft('')
    if (props.names.length > 2) setAsker(value => { const seat = nextSeat(value, props.names.length); return seat === hostIndex ? nextSeat(seat, props.names.length) : seat })
    const surface = soup.surface
    const truth = soup.truth
    runAiJob(jobKey(props.namespace, 'table-soup', `${sessionId}-${turnIndex}`), async () => {
      try {
        const line = await hostAsk(`你是海龟汤主持人 ${host}。汤面：${surface}。汤底只有你知道：${truth}。先回答「是」「不是」或「无关」，再用符合人设的短句回应，亲近时可给不剧透的提示。不要揭晓汤底。`, `${who} 问：${q}`, 40)
        const clean = line.trim().slice(0, 180)
        if (!/是|不|无关/.test(clean)) throw Error('主持人未给出明确判断')
        const saved = (await storage.getBag<{ turns: Array<{ who: string; q: string; a: string }> }>(props.namespace, bagKey)) ?? { turns: nextTurns }
        const updated = saved.turns.map((item, index) => (index === turnIndex ? { ...item, a: clean } : item))
        await storage.setBag(props.namespace, bagKey, { turns: updated })
        setTurns(updated)
        tableEvent(`海龟汤公开问答：${who}问：${q}；${host}答：${clean}`)
      } catch (e) {
        const failure=e instanceof Error?e.message:'主持人暂时没有接上'
        const updated=nextTurns.map((item,index)=>index===turnIndex?{...item,a:'本次回答失败：'+failure+'。请重新提问。'}:item)
        await storage.setBag(props.namespace,bagKey,{turns:updated})
        setTurns(updated)
      }
    })
  }
  return (
    <Screen title="海龟汤" subtitle={`${host} 主持 · 你在提问`} onBack={props.onBack}>
      <RoundTable variant="mystery" names={props.names} turn={asker} host={hostIndex} caption={`${props.names[asker] ?? '我'} 提问中`} />
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
      <div className="mt-3 flex flex-wrap gap-2">
        {open ? <PillNote tone="lilac">{soup.truth}</PillNote> : <button type="button" className="chip" onClick={() => { setOpen(true); tableEvent('海龟汤已公布汤底：'+soup.truth,true) }}>公布汤底</button>}
        <button type="button" className="chip" onClick={() => {
          if (!soup) return
          const next = another(SOUPS, (item) => item.surface === soup.surface, soup)
          setSoup(next)
          setTurns([])
          setOpen(false)
          setDraft('')
          setAsker(0)
          tableEvent('海龟汤换了一题。新的汤面已公开，汤底仍不可说。', false, true)
        }}>换一题</button>
      </div>
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
  const tableEvent = useTableEvent()
  const [round,setRound]=useState(0),[card,setCard]=useState(()=>pickAt(SAYS)??SAYS[0]!),[hints,setHints]=useState<string[]>([]),[draft,setDraft]=useState(''),[log,setLog]=useState<string[]>([]),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('')
  const describer=round%props.names.length
  const act=async()=>{const text=draft.trim();if(!text||busy||done)return
    if(describer===0&&text.includes(card.word)){setError('提示不能包含答案');return}
    setError('');setDraft('');setBusy(true)
    if(describer!==0){const good=text.replace(/\s/g,'')===card.word;setLog(l=>[...l,`你猜：${text}`,good?'猜对了！':'还没猜中，再给你一个提示。']);if(good){setDone(true);tableEvent('你说我猜：玩家猜中了'+card.word,true)}else { const hint=card.hints[hints.length]??'可以换个角度想想'; setHints(h=>[...h,hint]); tableEvent('玩家猜：'+text+'，还没猜中。公开新提示：'+hint) };setBusy(false);return}
    const next=[...hints,text];setHints(next);setLog(l=>[...l,`你：${text}`]);tableEvent('你说我猜：玩家给出公开提示：'+text)
    try{for(const name of props.names.slice(1)){const guess=await hostAsk(`你是${name}，正在你说我猜。只能根据玩家实际给出的提示猜一个词，禁止知道答案。只回复一个词。`,next.join('；'),40);setLog(l=>[...l,`${name}：${guess}`]);tableEvent('你说我猜公开猜测：'+name+'：'+guess);if(guess.replace(/[。！\s]/g,'')===card.word){setDone(true);setLog(l=>[...l,'猜对了！']);tableEvent('你说我猜：'+name+'根据玩家提示猜中了'+card.word,true);break}}}catch(e){setError(e instanceof Error?e.message:'没有猜成，请再给一个提示重试')}finally{setBusy(false)}}
  useEffect(()=>{if(describer===0)return;let live=true;setBusy(true);setError('');void hostAsk(`你是${props.names[describer]}。你说我猜中描述「${card.word}」，给3条逐步明确的提示，不要包含答案本身，每行一条。`,'现在给出提示',160).then(line=>{if(live){const publicHints=hintLines(line,card.word);setHints(publicHints);tableEvent('你说我猜：'+props.names[describer]+'公布提示：'+publicHints.join('；'))}}).catch(e=>{if(live){setHints(card.hints);setError(e instanceof Error?e.message:'使用本局词卡提示')}}).finally(()=>{if(live)setBusy(false)});return()=>{live=false}},[round,card,describer,props.names,tableEvent])
  return <Screen title="你说我猜" subtitle={describer===0?'你描述，其他人猜':'角色描述，你来猜'} onBack={props.onBack}><RoundTable names={props.names} turn={describer} caption="按真实提示猜词"/>{describer===0?<PillNote>你的词：{card.word}</PillNote>:<article className="menu-card space-y-2 text-sm leading-7">{hints.length?hints.map((hint,index)=><p key={index} className="whitespace-pre-wrap">{hint}</p>):'正在准备提示…'}</article>}<div className="mt-3 space-y-2 text-sm" aria-live="polite">{log.map((l,i)=><p key={i}>{l}</p>)}</div>{!done&&<form className="mt-3 flex gap-2" onSubmit={e=>{e.preventDefault();void act()}}><input className="soft-input min-w-0" value={draft} onChange={e=>setDraft(e.target.value)} placeholder={describer===0?'描述这个词':'猜一个词'}/><button className="chip shrink-0" disabled={busy||!draft.trim()}>{busy?'回应中…':describer===0?'说':'猜'}</button></form>}{error&&<p role="status" className="mt-2 text-xs">{error}</p>}<button className="chip mt-3" disabled={busy} onClick={()=>{tableEvent('你说我猜新一轮开始，角色根据当前提示参与，不得透露词卡答案。',false,true);setRound(r=>r+1);setCard(pickAt(SAYS.filter(c=>c.word!==card.word))??SAYS[0]!);setHints([]);setLog([]);setDone(false);setDraft('');setError('')}}>{done?'下一轮':'跳过本轮'}</button></Screen>
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
  const tableEvent = useTableEvent()
  const [seats, setSeats] = useState<WolfSeat[]>(() => rolesFor(props.names.length).map((role, index) => ({ name: props.names[index] ?? `座位${index}`, role, alive: true })))
  const [phase, setPhase] = useState<'night' | 'day' | 'end'>('night')
  const [nightStep, setNightStep] = useState<NightStep>('wolf')
  const [wolfTarget, setWolfTarget] = useState<string | null>(null)
  const [seen, setSeen] = useState('')
  const [log, setLog] = useState('天黑了。狼人请睁眼。')
  const [saveLeft, setSaveLeft] = useState(true)
  const [poisonLeft, setPoisonLeft] = useState(true)
  const [day, setDay] = useState(1)
  const [speech,setSpeech]=useState(''),[discussion,setDiscussion]=useState<string[]>([]),[discussing,setDiscussing]=useState(false)
  const [checks,setChecks]=useState<Record<string,string[]>>({})
  const discussionLock = useRef(false), alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const automaticDay = useRef(0)
  const discuss=useCallback(async(automatic=false)=>{
    if(discussionLock.current || (!automatic && (!speech.trim() || !seats[0]?.alive))) return
    discussionLock.current = true
    const context=[...discussion, ...(automatic ? ['第 '+day+' 天，'+log+'。请在场玩家依次主动发言。'] : ['你：'+speech.trim()])].slice(-20)
    if (!automatic) tableEvent('狼人杀玩家公开发言：'+speech.trim())
    setSpeech('');setDiscussing(true);setDiscussion(context)
    const replies=await Promise.all(seats.filter((s,i)=>i>0&&s.alive).map(async seat=>{
      try{const line=await hostAsk('你是狼人杀玩家'+seat.name+'，身份'+seat.role+'（保密）。自己的查验：'+((checks[seat.name]??[]).join('；')||'无')+'。根据公开发言主动讨论或质疑，不能知道他人的底牌，不可透露系统信息。只写一句角色发言。',context.join('；'),140);return seat.name+'：'+line}
      catch(e){return seat.name+' 本次发言失败：'+(e instanceof Error?e.message:'请重试')}
    }))
    if(alive.current){setDiscussion([...context,...replies]);setDiscussing(false);tableEvent('狼人杀白天公开发言：'+replies.join('；'))}
    discussionLock.current = false
  }, [speech, discussion, day, log, seats, checks, tableEvent])
  useEffect(() => {
    if(phase !== 'day' || automaticDay.current === day) return
    automaticDay.current = day
    tableEvent('狼人杀第 '+day+' 天：'+log+'。只能讨论公开信息。')
    void discuss(true)
    // A daytime speech round starts once per day, independently of player speech.
  }, [phase, day, log, discuss, tableEvent])
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
      tableEvent(wolves===0?'狼人杀：村子赢了':'狼人杀：狼人赢了',true)
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
    // 保留已经查验的信息，直到本局结束
    if (checkWin(next, unique.length ? `天亮了。${unique.join('、')} 没有起来。` : '天亮了。这一夜是安静的。')) return
    setPhase('day')
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

  const vote = async (name: string) => {
    if (discussionLock.current || discussing) return
    discussionLock.current = true
    setDiscussing(true)
    const tally: Record<string, number> = me?.alive ? { [name]: 1 } : {}
    const votes=await Promise.all(seats.filter(seat=>seat.alive&&seat.name!==me?.name).map(async seat=>{
      const options=seats.filter(item=>item.alive&&item.name!==seat.name&&(seat.role!=='狼人'||item.role!=='狼人'))
      let pick=pickAt(options)
      try{const answer=await hostAsk(`你是狼人杀玩家${seat.name}，身份${seat.role}。自己的查验：${(checks[seat.name]??[]).join('；')||'无'}。${seat.role==='狼人'?'狼队友：'+seats.filter(s=>s.role==='狼人').map(s=>s.name).join('、'):''}根据公开发言投票，不能知道其他人的底牌。只回复候选人的名字。`,JSON.stringify({candidates:options.map(s=>s.name),discussion:discussion.slice(-20)}),40);pick=options.find(s=>s.name===answer.trim())??pick}catch{/* 请求失败仍可使用本地投票继续游戏 */}
      return pick?.name
    }))
    if (!alive.current) return
    discussionLock.current = false
    for(const pick of votes)if(pick)tally[pick]=(tally[pick]??0)+1
    setDiscussion(d=>[...d,'本轮票数：'+Object.entries(tally).map(([n,c])=>n+' '+c+'票').join('、')])
    tableEvent('狼人杀公开投票：'+Object.entries(tally).map(([n,c])=>n+' '+c+'票').join('、'))
    setDiscussing(false)
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
      tableEvent(wolves===0?'狼人杀：村子赢了':'狼人杀：狼人赢了',true)
      return
    }
    tableEvent('狼人杀公开投票结果：'+(out?out+' 被投出。':'平票，无人出局。')+'即将进入夜间，简短回应投票，不评论夜间秘密。')
    setPhase('night')
    setNightStep('wolf')
    setDay(value=>value+1)
    setLog(`${out?out+' 被投票出局。':'平票，无人出局。'}第 ${day + 1} 夜。狼人请睁眼。`)
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
      <RoundTable variant="night" names={props.names} turn={turnSeat} out={outFlags} badges={badges} caption={log} />
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
      {phase === 'night' && nightStep === 'wolf' && (!me.alive || me.role !== '狼人') ? (
        <button type="button" className="chip chip-solid mt-3" onClick={autoWolfKill}>狼人行动（自动）</button>
      ) : null}
      {phase === 'night' && nightStep === 'seer' && me.alive && me.role === '预言家' ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {living.filter((seat) => seat.name !== me.name).map((seat) => (
            <button key={seat.name} type="button" className="chip" onClick={() => { setSeen(previous=>previous+`${previous?'；':''}${seat.name} 是 ${seat.role}`); finishSeerStep() }}>{seat.name}</button>
          ))}
        </div>
      ) : null}
      {phase === 'night' && nightStep === 'seer' && (!me.alive || me.role !== '预言家') ? (
        <button type="button" className="chip mt-3" onClick={()=>{const seer=seats.find(s=>s.alive&&s.role==='预言家'),target=pickAt(seats.filter(s=>s.alive&&s.name!==seer?.name));if(seer&&target)setChecks(previous=>({...previous,[seer.name]:[...(previous[seer.name]??[]),target.name+' 是'+(target.role==='狼人'?'狼人':'好人')]}));finishSeerStep()}}>预言家行动（自动）</button>
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
      {phase === 'night' && nightStep === 'witch' && (!me.alive || me.role !== '女巫') ? (
        <button type="button" className="chip mt-3" onClick={()=>{const witch=seats.find(s=>s.alive&&s.role==='女巫');const save=Boolean(saveLeft&&wolfTarget&&(wolfTarget===witch?.name||Math.random()<.6));const poison=!save&&poisonLeft&&Math.random()<.15?pickAt(seats.filter(s=>s.alive&&s.name!==witch?.name&&s.name!==wolfTarget))?.name??null:null;if(save)setSaveLeft(false);if(poison)setPoisonLeft(false);finishWitchStep(save,poison)}}>女巫行动（自动）</button>
      ) : null}
      {phase === 'night' && nightStep === 'resolve' ? (
        <button type="button" className="chip chip-solid mt-3" onClick={() => resolveNight(wolfTarget ? [wolfTarget] : [])}>天亮</button>
      ) : null}
      {phase === 'day'&&<section className="menu-card mt-3"><div className="space-y-2 text-xs leading-6">{discussion.map((l,i)=><p key={i}>{l}</p>)}</div><form className="mt-2 flex gap-2" onSubmit={e=>{e.preventDefault();void discuss()}}><input className="soft-input min-w-0" value={speech} onChange={e=>setSpeech(e.target.value)} placeholder="发言、质疑或询问其他玩家"/><button className="chip shrink-0" disabled={discussing||!me.alive||!speech.trim()}>{discussing?'发言中':'发言'}</button></form>{!discussing&&<button type="button" className="chip mt-2" onClick={()=>void discuss(true)}>再听一轮讨论</button>}</section>}
      {phase === 'day' ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {!me.alive&&<button className="chip" disabled={discussing} onClick={()=>void vote('')}>观看其他人的投票</button>}{living.map((seat) => <button key={seat.name} type="button" className="chip" disabled={discussing||!me.alive} onClick={() => void vote(seat.name)}>投 {seat.name}</button>)}
        </div>
      ) : null}
      {phase === 'end' ? (
        <div className="mt-3"><PillNote tone={wolvesAlive === 0 ? 'mint' : 'peach'}>{seats.map((seat) => `${seat.name} ${seat.role}`).join('、')}</PillNote></div>
      ) : null}
    </Screen>
  )
}

function Undercover(props: { names: string[]; onBack: () => void }) {
  const tableEvent = useTableEvent()
  const [deal, setDeal] = useState(() => dealSpy(props.names))
  const [alive, setAlive] = useState(() => props.names.map(() => true))
  const [phase, setPhase] = useState<'talk' | 'vote' | 'end'>('talk')
  const [speaker, setSpeaker] = useState(0)
  const [lines, setLines] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('轮流描述自己的词，不要把词说出来。')
  const [retry, setRetry] = useState(0)
  const ticket = useRef(0)
  const mine = deal[0]
  const move = (from: number, flags: boolean[]) => {
    const next = firstAlive(flags, from)
    if (next < 0) setPhase('vote')
    else setSpeaker(next)
  }
  useEffect(() => {
    if (phase !== 'talk' || speaker <= 0 || !alive[speaker]) return
    const current = ++ticket.current
    const name = props.names[speaker] ?? '玩家'
    const word = deal[speaker]?.word ?? ''
    setBusy(true)
    setError('')
    void hostAsk(`你在玩谁是卧底。你拿到的词是「${word}」。用一句日常口语描述它，让别人觉得你们拿到的是同一个词。不要说出「${word}」，不要拆开这个词，不要说自己是不是卧底。只写这一句。`, '现在描述', 80)
      .then((line) => {
        if (ticket.current !== current) return
        const spoken = oneLine(line, 80).replaceAll(word, '这个') || '我想了想，先不说太满。'
        setLines((list) => [...list, `${name}：${spoken}`])
        tableEvent(`谁是卧底：${name}描述：${spoken}`)
        setBusy(false)
        move(speaker + 1, alive)
      })
      .catch((reason) => {
        if (ticket.current !== current) return
        setBusy(false)
        setError(reason instanceof Error ? reason.message : '这一句没说出来，请再试一次')
      })
    return () => { ticket.current += 1 }
  }, [phase, speaker, alive, deal, props.names, tableEvent, retry])
  const speak = () => {
    const text = draft.trim()
    if (!text || busy || phase !== 'talk' || speaker !== 0 || !mine) return
    if (compactText(text).includes(compactText(mine.word))) { setError('不能把词说出来'); return }
    setError('')
    setDraft('')
    const name = props.names[0] ?? '我'
    setLines((list) => [...list, `${name}：${text}`])
    tableEvent(`谁是卧底：${name}描述：${text}`)
    move(1, alive)
  }
  const vote = async (name: string) => {
    if (busy || phase !== 'vote') return
    setBusy(true)
    setError('')
    const tally: Record<string, number> = {}
    if (alive[0] && name) tally[name] = 1
    const voters = props.names.map((seat, index) => ({ seat, index })).filter((item) => item.index > 0 && alive[item.index])
    const results = await Promise.all(voters.map(async (item) => {
      const options = props.names.filter((candidate, index) => alive[index] && candidate !== item.seat)
      let pick = pickAt(options) ?? ''
      try {
        const answer = oneLine(await hostAsk(`你在玩谁是卧底。你拿到的词是「${deal[item.index]?.word ?? ''}」。根据已经公开的描述，投出最像拿到了另一个近义词的人。不能投自己，也不能投已经出局的人。只回复候选人的名字。`, `候选人：${options.join('、')}\n描述：\n${lines.join('\n')}`, 40), 20)
        pick = options.find((candidate) => answer.includes(candidate)) ?? pick
      } catch { /* 这一票改由本地代投，游戏继续 */ }
      return pick
    }))
    for (const pick of results) if (pick) tally[pick] = (tally[pick] ?? 0) + 1
    const ranked = Object.entries(tally).sort((left, right) => right[1] - left[1])
    const top = ranked[0]
    const tied = !top || ranked.filter((item) => item[1] === top[1]).length > 1
    const summary = Object.entries(tally).map(([seat, count]) => `${seat} ${count}票`).join('、') || '没有人投票'
    setLines((list) => [...list, `票数：${summary}`])
    tableEvent(`谁是卧底公开投票：${summary}`)
    if (tied) {
      setNote('平票，没有人出局。再描述一轮。')
      setLines((list) => [...list, '—— 新一轮描述 ——'])
      setPhase('talk')
      setSpeaker(firstAlive(alive))
      setBusy(false)
      return
    }
    const out = top[0]
    const nextFlags = alive.map((on, index) => on && props.names[index] !== out)
    setAlive(nextFlags)
    const spies = deal.filter((item, index) => nextFlags[index] && item.spy).length
    const civilians = deal.filter((item, index) => nextFlags[index] && !item.spy).length
    if (spies === 0 || spies >= civilians) {
      const civilianWin = spies === 0
      setPhase('end')
      setNote(civilianWin ? `${out} 出局。卧底都出去了，平民赢。` : `${out} 出局。卧底还在场，卧底赢。`)
      tableEvent(civilianWin ? '谁是卧底：平民赢了' : '谁是卧底：卧底赢了', true)
    } else {
      setNote(`${out} 出局，游戏继续。`)
      setLines((list) => [...list, '—— 新一轮描述 ——'])
      setPhase('talk')
      setSpeaker(firstAlive(nextFlags))
      tableEvent(`谁是卧底：${out} 出局，继续描述。`)
    }
    setBusy(false)
  }
  const again = () => {
    setDeal(dealSpy(props.names))
    setAlive(props.names.map(() => true))
    setPhase('talk')
    setSpeaker(0)
    setLines([])
    setDraft('')
    setError('')
    setNote('新的一局。轮流描述，不要把词说出来。')
    tableEvent('谁是卧底再来一局。每个人只知道自己的词。', false, true)
  }
  if (!mine) return null
  const votingNames = props.names.flatMap((name, index) => (alive[index] && index !== 0 ? [name] : []))
  return (
    <Screen title="谁是卧底" subtitle={phase === 'end' ? '本局结束' : phase === 'vote' ? '投票出局' : `${props.names[speaker] ?? '我'} 在描述`} onBack={props.onBack}>
      <RoundTable names={props.names} turn={phase === 'talk' ? speaker : null} out={phase === 'end' ? undefined : alive.map((on) => !on)} badges={phase === 'end' ? deal.map((item) => item.spy ? '卧底' : '平民') : undefined} caption={note} />
      <PillNote>{phase === 'end' ? `你的词是「${mine.word}」，你是${mine.spy ? '卧底' : '平民'}。` : `你的词：${mine.word}`}</PillNote>
      <div className="mt-3 space-y-2 text-sm leading-6" aria-live="polite">{lines.map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}</div>
      {phase === 'talk' && speaker === 0 && alive[0] ? (
        <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); speak() }}>
          <input className="soft-input min-w-0" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="描述这个词，别说破" />
          <button className="chip shrink-0" disabled={busy || !draft.trim()}>说</button>
        </form>
      ) : null}
      {phase === 'talk' && speaker > 0 ? <p className="mt-3 text-xs" style={{ color: 'var(--m-text-secondary)' }}>{busy ? `${props.names[speaker] ?? '对方'} 正在想怎么说…` : '等这一句说完。'}</p> : null}
      {error ? <p role="status" className="mt-2 text-xs">{error}</p> : null}
      {error && phase === 'talk' && speaker > 0 ? <button type="button" className="chip mt-2" onClick={() => setRetry((value) => value + 1)}>让 TA 再说一次</button> : null}
      {phase === 'vote' ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {alive[0] ? votingNames.map((name) => <button key={name} type="button" className="chip" disabled={busy} onClick={() => void vote(name)}>投 {name}</button>) : <button type="button" className="chip" disabled={busy} onClick={() => void vote('')}>{busy ? '投票中…' : '看其他人投票'}</button>}
        </div>
      ) : null}
      {phase === 'end' ? (
        <>
          <div className="mt-3"><PillNote tone="lilac">{deal.map((item, index) => `${props.names[index] ?? ''} ${item.spy ? '卧底' : '平民'} · ${item.word}`).join('、')}</PillNote></div>
          <button type="button" className="chip chip-solid mt-3" onClick={again}>再来一局</button>
        </>
      ) : null}
      <details className="menu-card mt-4 text-xs leading-6"><summary>玩法说明</summary><p>多数人拿到同一个词，卧底拿到一个很像的词。你看不出自己是哪一种。每人用一句话描述，不能把词说出来。然后投票，票数最高的人出局；平票就没人出局，再描述一轮。卧底全部出局则平民赢。卧底还在、且人数不少于平民，则卧底赢。4 到 6 人有 1 个卧底，7 到 8 人有 2 个。</p></details>
    </Screen>
  )
}

type BluffEntry = { text: string; author: string | null; truth: boolean }

function Bluff(props: { names: string[]; onBack: () => void }) {
  const tableEvent = useTableEvent()
  const [card, setCard] = useState(() => pickAt(BLUFFS) ?? BLUFFS[0])
  const [phase, setPhase] = useState<'write' | 'vote' | 'show'>('write')
  const [draft, setDraft] = useState('')
  const [entries, setEntries] = useState<BluffEntry[]>([])
  const [scores, setScores] = useState(() => props.names.map(() => 0))
  const [gained, setGained] = useState(() => props.names.map(() => 0))
  const [votes, setVotes] = useState<Array<{ name: string; text: string }>>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async () => {
    const text = oneLine(draft, 24)
    if (!text || busy || phase !== 'write' || !card) return
    setBusy(true)
    setError('')
    setDraft('')
    const mine = props.names[0] ?? '我'
    const authored = [{ author: mine, text }]
    const replies = await Promise.all(props.names.slice(1).map(async (name) => {
      try {
        const line = await hostAsk(`你在玩谁是瞎掰王。题目是：「${card.question}」请编一个听起来像真的短答案，不超过16个字。你不知道标准答案。不要解释，不要说自己在编，只写答案本身。`, '写一个答案', 40)
        return { author: name, text: oneLine(line, 24) || '我说不准' }
      } catch {
        return { author: name, text: '我说不准' }
      }
    }))
    authored.push(...replies)
    const built: BluffEntry[] = []
    let truthTaken = false
    for (const item of authored) {
      if (compactText(item.text) === compactText(card.answer)) {
        if (!truthTaken) {
          built.push({ text: card.answer, author: item.author, truth: true })
          truthTaken = true
        }
        continue
      }
      built.push({ text: item.text, author: item.author, truth: false })
    }
    if (!truthTaken) built.push({ text: card.answer, author: null, truth: true })
    setEntries(shuffle(built))
    setVotes([])
    setPhase('vote')
    setBusy(false)
    tableEvent(`谁是瞎掰王题目：${card.question}。答案已混在选项里，还不能公布。`)
  }
  const vote = async (index: number) => {
    if (busy || phase !== 'vote' || !card) return
    const chosen = entries[index]
    if (!chosen || chosen.author === props.names[0]) return
    setBusy(true)
    const castVotes: Array<{ name: string; index: number }> = [{ name: props.names[0] ?? '我', index }]
    const aiVotes = await Promise.all(props.names.slice(1).map(async (name) => {
      const own = entries.find((item) => item.author === name)
      const options = entries.filter((item) => item.author !== name)
      let pick = pickAt(options) ?? options[0]
      try {
        const answer = oneLine(await hostAsk(`你在玩谁是瞎掰王。题目是：「${card.question}」下面只有一条是标准答案，其余是别人编的。你写的是「${own?.text ?? ''}」。选出最像标准答案的一条，不能选你自己写的。只回复那条答案的原文。`, options.map((item) => item.text).join('\n'), 40), 24)
        pick = options.find((item) => compactText(item.text) === compactText(answer)) ?? options.find((item) => answer.includes(item.text)) ?? pick
      } catch { /* 这一票随机选一条不像自己的 */ }
      return { name, index: pick ? entries.indexOf(pick) : -1 }
    }))
    for (const item of aiVotes) if (item.index >= 0) castVotes.push(item)
    const delta = props.names.map(() => 0)
    const shown: Array<{ name: string; text: string }> = []
    for (const item of castVotes) {
      const entry = entries[item.index]
      if (!entry) continue
      shown.push({ name: item.name, text: entry.text })
      const voter = props.names.indexOf(item.name)
      if (entry.truth && voter >= 0) delta[voter] = (delta[voter] ?? 0) + 2
      if (!entry.truth && entry.author) {
        const author = props.names.indexOf(entry.author)
        if (author >= 0) delta[author] = (delta[author] ?? 0) + 1
      }
    }
    setScores((current) => current.map((score, seat) => score + (delta[seat] ?? 0)))
    setGained(delta)
    setVotes(shown)
    setPhase('show')
    setBusy(false)
    tableEvent(`谁是瞎掰王公布标准答案：${card.answer}。本轮：${props.names.map((name, seat) => `${name}+${delta[seat] ?? 0}`).join('、')}`)
  }
  const nextCard = () => {
    if (!card) return
    setCard(another(BLUFFS, (item) => item.question === card.question, card))
    setPhase('write')
    setEntries([])
    setVotes([])
    setDraft('')
    setError('')
    setGained(props.names.map(() => 0))
    tableEvent('谁是瞎掰王换了一题。标准答案先不要说。', false, true)
  }
  if (!card) return null
  return (
    <Screen title="谁是瞎掰王" subtitle={phase === 'write' ? '编一个像真的答案' : phase === 'vote' ? '哪一条是标准答案' : '这一题揭晓了'} onBack={props.onBack}>
      <RoundTable names={props.names} caption={props.names.map((name, index) => `${name} ${scores[index] ?? 0}分`).join(' · ')} />
      <article className="menu-card text-sm leading-6">{card.question}</article>
      {phase === 'write' ? (
        <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); void submit() }}>
          <input className="soft-input min-w-0" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="写一个短答案" maxLength={24} />
          <button className="chip shrink-0" disabled={busy || !draft.trim()}>{busy ? '收答案…' : '写好了'}</button>
        </form>
      ) : null}
      {phase === 'vote' ? (
        <div className="mt-3 space-y-2">
          {entries.map((item, index) => {
            const own = item.author === props.names[0]
            return <button key={`${item.author ?? 'deck'}-${index}`} type="button" className="menu-card block w-full text-left text-sm" disabled={busy || own} onClick={() => void vote(index)}>{item.text}{own ? '（你写的）' : ''}</button>
          })}
        </div>
      ) : null}
      {phase === 'show' ? (
        <div className="mt-3 space-y-2">
          {entries.map((item, index) => (
            <article key={`${item.text}-${index}`} className="menu-card text-sm">
              <p>{item.text}</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--m-text-secondary)' }}>{item.truth ? `标准答案${item.author ? ` · ${item.author} 写中了` : ''}` : `${item.author ?? '题库'} 编的`}</p>
            </article>
          ))}
          <div className="text-xs leading-6">{votes.map((item, index) => <p key={`${item.name}-${index}`}>{item.name} 投了「{item.text}」</p>)}</div>
          <PillNote tone="mint">{props.names.map((name, index) => `${name} 本轮 +${gained[index] ?? 0}`).join('、')}</PillNote>
          <button type="button" className="chip chip-solid" onClick={nextCard}>下一题</button>
        </div>
      ) : null}
      {error ? <p role="status" className="mt-2 text-xs">{error}</p> : null}
      <details className="menu-card mt-4 text-xs leading-6"><summary>玩法说明</summary><p>题目是一条冷知识，标准答案先藏起来。每个人写一个听起来像真的短答案，标准答案会混进选项。投票时看不出是谁写的，也不能投自己写的那条。投中标准答案得 2 分。有人把你的假答案当成真的，每骗到一人得 1 分。写中标准答案本身不再额外加分。</p></details>
    </Screen>
  )
}

function Gomoku(props: { names: string[]; onBack: () => void }) {
  const tableEvent = useTableEvent()
  const rival = props.names[1] ?? '对面'
  const people=useContext(TablePeople)
  const rivalInfo=people.find(p=>p.person.name===rival)
  const [grid, setGrid] = useState<Grid>(() => emptyGrid())
  const [zoomed,setZoomed]=useState(false)
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
      tableEvent('玩家连成五子，赢下了这局。'+gomokuSituation(next,props.names),true)
      return
    }
    setTurn(1)
    const mercy = mayYield(rivalInfo)
    const empty=next.flatMap((line,r)=>line.flatMap((stone,c)=>stone?[]:[[r,c] as [number,number]]))
    const move = mercy ? pickAt(empty) : goAi(next, 2)
    if (!move) {
      setGrid(next)
      setOver('下满了')
      tableEvent('棋盘下满，平局。',true)
      setTurn(0)
      return
    }
    const target = next[move[0]]
    if (target) target[move[1]] = 2 as Stone
    setGrid(next)
    setTurn(0)
    setOver(winner(next) ? `${rival} 赢了` : '')
    tableEvent(`玩家落在${row+1}行${col+1}列，${rival}落在${move[0]+1}行${move[1]+1}列。${gomokuSituation(next,props.names)}`,Boolean(winner(next)))
  }
  return (
    <Screen title="五子棋" subtitle={over || (turn === 0 ? '轮到你落子' : `${rival} 在想…`)} onBack={props.onBack}>
      <RoundTable compact variant="board" names={props.names.slice(0, 2)} turn={turn} badges={['黑子', '白子']} caption="黑白轮流，先连五子者胜" />
      <div className="mb-3 flex items-center justify-between text-xs"><span>15 × 15 · 225 个落点</span><button className="chip" onClick={()=>setZoomed(!zoomed)}>{zoomed?'查看全盘':'放大棋盘'}</button></div>
      <div className="max-w-full overflow-auto" data-no-swipe><div className="strategy-board gomoku-board" style={zoomed?{width:480,minWidth:480}:undefined} data-holiday-preserve>
        {grid.map((line, row) => line.map((stone, col) => (
          <button key={`${row}-${col}`} type="button" aria-label={`第${row + 1}行第${col + 1}列`} className="strategy-cell" onClick={() => play(row, col)}>
            {stone ? <span className={stone===1?'go-stone is-black':'go-stone is-white'} /> : null}
          </button>
        )))}
      </div></div>
    </Screen>
  )
}

function Xiangqi(props: { names: string[]; onBack: () => void }) {
  const tableEvent = useTableEvent()
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
        tableEvent('象棋：玩家赢了。'+xiangqiSituation(after,props.names),true)
        return
      }
      setTurn(1)
      const reply = chessAi(after, false)
      if (!reply) {
        setBoard(after)
        setOver('对方无棋可走')
        tableEvent('象棋：对方无棋可走，本局结束',true)
        setTurn(0)
        return
      }
      const done = applyMove(after, reply.r, reply.c, reply.tr, reply.tc)
      setBoard(done)
      setTurn(0)
      tableEvent(`玩家从${pick[0]+1},${pick[1]+1}走到${row+1},${col+1}，${rival}从${reply.r+1},${reply.c+1}走到${reply.tr+1},${reply.tc+1}。${xiangqiSituation(done,props.names)}`,Boolean(winnerOf(done)))
      if (winnerOf(done) === 'black') setOver(`${rival} 赢了`)
      return
    }
    const piece = board[row]?.[col]
    if (piece && piece === piece.toUpperCase()) setPick([row, col])
    else setPick(null)
  }
  return (
    <Screen title="象棋" subtitle={over || (turn === 0 ? '轮到你走棋' : `${rival} 在想…`)} onBack={props.onBack}>
      <RoundTable compact variant="board" names={props.names.slice(0, 2)} turn={turn} badges={['红方', '黑方']} caption="红先黑后，将死对方即胜" />
      <div className="strategy-board xiangqi-board" data-holiday-preserve>
        {board.map((line, row) => line.map((piece, col) => {
          const on = targets.some(([tr, tc]) => tr === row && tc === col)
          const selected = pick?.[0] === row && pick?.[1] === col
          return (
            <button key={`${row}-${col}`} type="button" aria-label={piece ? PIECE_NAME[piece] ?? '棋子' : '空位'} className="strategy-cell" data-selected={selected} data-target={on} data-row={row} onClick={() => click(row, col)}>
              {piece ? <span className={piece===piece.toUpperCase()?'chess-piece is-red':'chess-piece is-black'}>{PIECE_NAME[piece]}</span> : on ? <span className="chess-target"/> : null}
            </button>
          )
        }))}
      </div>
    </Screen>
  )
}

function Uno(props: { names: string[]; onBack: () => void }) {
  const tableEvent = useTableEvent()
  const people=useContext(TablePeople)
  const [match, setMatch] = useState<UnoMatch>(() => freshMatch(props.names))
  const [wildAt, setWildAt] = useState<number | null>(null)
  useEffect(() => {
    if (match.winner !== null || match.turn === 0) return
    const timer = window.setTimeout(() => {const info=people.find(p=>p.person.name===match.names[match.turn]);const next=runAi(match,mayYield(info));setMatch(next);tableEvent(next.note+'。'+unoSituation(next),next.winner!==null)}, 450)
    return () => window.clearTimeout(timer)
  }, [match,people,tableEvent])
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
    setMatch(next)
    tableEvent(next.note+'。'+unoSituation(next),next.winner!==null)
  }
  const draw = () => {
    const next = drawForTurn(match)
    setMatch(next)
    tableEvent(next.note+'。'+unoSituation(next),next.winner!==null)
  }
  const stuck = hand.every((card) => !canPlayFromHand(match, card))
  const names: Record<UnoColor,string> = {red:'红',yellow:'黄',green:'绿',blue:'蓝'}
  const currentColor = match.wild ?? top?.color
  const face = (card: UnoCard) => <><span className="uno-corner">{UNO_LABEL[card.rank] ?? card.rank}</span><span className="uno-face-value">{UNO_LABEL[card.rank] ?? card.rank}</span><span className="uno-color-name">{card.color ? names[card.color] : '万能'}</span></>
  return <Screen title="UNO" subtitle={match.winner === null ? (match.turn===0?'轮到你出牌':(match.names[match.turn]??'')+' 正在思考') : (match.names[match.winner]??'')+' 获胜'} onBack={props.onBack}>
    <section className="uno-arena" data-holiday-preserve>
      <div className="uno-opponents">{match.names.slice(1).map((name,i)=><div key={i} className={match.turn===i+1?'uno-opponent is-turn':'uno-opponent'}><span className="uno-avatar">{name.slice(0,1)}</span><strong>{name}</strong><span>{match.hands[i+1]?.length??0} 张{match.hands[i+1]?.length===1?' · UNO!':''}</span><div className="uno-mini-hand">{Array.from({length:Math.min(5,match.hands[i+1]?.length??0)},(_,n)=><i key={n}/>)}</div></div>)}</div>
      <div className="uno-play-area"><button type="button" className="uno-draw-pile" disabled={match.turn!==0||match.winner!==null||(!stuck&&match.drawnCardId===undefined)} onClick={draw} aria-label={match.drawnCardId!==undefined?'保留此牌并过牌':'从牌堆摸一张'}><span>UNO</span><small>{match.drawnCardId!==undefined?'过牌':'摸牌堆'}</small></button><div className="uno-discard">{top&&<span className="uno-playing-card" data-color={top.color??'wild'}>{face(top)}</span>}<span className="uno-pile-caption">弃牌堆</span></div></div>
      <div className="uno-round-info"><span className="uno-current-color" data-color={currentColor??'wild'}>{currentColor?names[currentColor]+'色':'万能牌'}</span><span>{match.dir===1?'顺时针':'逆时针'} · {match.winner!==null?'本局结束':match.turn===0?'你的回合':'等待对方'}</span></div>
      <p className="uno-note" role="status">{match.note}</p>
    </section>
    <div className="my-4 flex items-center justify-between"><h3 className="text-sm font-semibold">我的手牌 · {hand.length} 张</h3><span className="text-xs" style={{color:'var(--m-text-secondary)'}}>亮边牌可出</span></div>
    <div className="uno-hand" data-holiday-preserve>{hand.map((card,index)=>{const playable=canPlayFromHand(match,card)&&match.turn===0&&match.winner===null;return <button key={card.id} type="button" className={playable?'uno-playing-card is-playable':'uno-playing-card'} data-color={card.color??'wild'} disabled={!playable} aria-label={(card.color?names[card.color]+'色':'万能')+' '+(UNO_LABEL[card.rank]??card.rank)+(playable?'，可出牌':'，不可出牌')} onClick={()=>play(index,null)}>{face(card)}</button>})}</div>
    {wildAt!==null&&<section className="menu-card mt-4"><h3 className="mb-3 text-sm font-semibold">为万能牌选择颜色</h3><div className="uno-color-options" data-holiday-preserve>{(Object.keys(UNO_COLOR) as UnoColor[]).map(color=><button key={color} className="uno-current-color" data-color={color} onClick={()=>play(wildAt,color)}>{names[color]}色</button>)}</div><button className="chip mt-3" onClick={()=>setWildAt(null)}>取消</button></section>}
    {(stuck||match.drawnCardId!==undefined)&&match.turn===0&&match.winner===null&&<button className="chip chip-solid mt-4" onClick={draw}>{match.drawnCardId!==undefined?'保留此牌并过牌':'摸一张'}</button>}
    {match.winner!==null&&<button className="chip chip-solid mt-4" onClick={()=>{setWildAt(null);const next=freshMatch(props.names);setMatch(next);tableEvent('UNO再来一局。'+unoSituation(next),false,true)}}>再来一局</button>}
    <details className="menu-card mt-4 text-xs leading-6"><summary>玩法说明</summary><p>同色、同数字或同功能可以出牌。摸牌后只能打出本次摸到的牌，或选择过牌。+4 仅在没有当前颜色时可出；不叠加罚牌。牌面同时显示颜色名称。</p></details>
  </Screen>
}

export function TableApp(props: { onBack: () => void }) {
  const phone = usePhone()
  const presets = useMellow((state) => state.presets)
  const settings = useMellow((state) => state.settings)
  const voice = `${presets.find((item) => item.id === modePresetId(settings, 'table'))?.data.prompts.filter(item => item.enabled).map(item => item.content).join('\n') ?? ''}\n${SCENE_HOLD}`
  useEffect(() => {
    hostVoice = voice
  }, [voice])
  const [chars, setChars] = useState<Character[]>([])
  const [game, setGame] = useState<GameId | null>(null)
  const [chosen, setChosen] = useState<string[]>([])
  const [names, setNames] = useState<string[]>([])
  const [playing, setPlaying] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [recordSession, setRecordSession] = useState<TableSummary | null>(null)
  const [people,setPeople]=useState<Array<{person:Character;bond:number}>>([])
  const session=useRef(0),sessionKey=useRef('')
  useEffect(()=>()=>{session.current++},[])
  useEffect(()=>{if(!playing||!phone)return;const receive=(event:Event)=>{const detail=(event as CustomEvent<{text:string;finished:boolean;roundStart?:boolean}>).detail;if(detail.roundStart){sessionKey.current=uid('table_session');setRecordSession({id:sessionKey.current,game:GAMES.find(item=>item.id===game)?.name??'桌游',names,startedAt:Date.now()});return}if(!detail.finished)return;void changeSharedLife(phone.namespace,state=>people.reduce((next,{person})=>addKeepsake(next,{charId:person.id,title:(GAMES.find(g=>g.id===game)?.name??'桌游')+'战绩',text:names.join('、')+'一起玩。'+detail.text,at:Date.now(),kind:'game',source:sessionKey.current+'_'+detail.text}),state)).then(()=>useMellow.getState().touchData()).catch(()=>undefined)};window.addEventListener('mellow-table-event',receive);return()=>window.removeEventListener('mellow-table-event',receive)},[playing,phone,people,game,names])
  useEffect(() => {
    if (!phone) return
    let stop = false
    void storage.listModernCharacters(phone.namespace).then((rows) => {
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
  const start = async () => {
    if (!meta) return
    const ticket=++session.current
    sessionKey.current=uid('table_session')
    const chats=await storage.listChats(phone.namespace)
    const shared=await readSharedLife(phone.namespace)
    const castPeople=await Promise.all(chars.filter(c=>chosen.includes(c.id)).map(async person=>{
      const saved=await storage.getBag<number>(phone.namespace,'assess_bond_'+person.id),previous=await storage.getBag<number>(phone.namespace,'table_bond_'+person.id)
      const intimacy=(await storage.getCharState(phone.namespace,person.id))?.bond.intimacy??0
      const chat=chats.find(c=>c.kind==='dm'&&c.memberIds.includes(person.id))
      const recent=chat?(await storage.listMessages(phone.namespace,chat.id)).filter(m=>!m.hidden&&m.kind!=='system').slice(-12).map(m=>(m.role==='user'?phone.name:person.name)+'：'+m.content.slice(0,140)).join('\n'):''
      const relation=shared.characters[person.id]?.relationship
      return {person,bond:relation?(relation.familiarity+relation.trust)/2:previous??saved??(intimacy<=1?intimacy*100:intimacy),recent,backstory:chat?.backstory??'',sharedNote:await sharedLifeNote(phone.namespace,person.id)}
    }))
    if(session.current!==ticket)return
    setPeople(castPeople)
    hostVoice=voice+'\n同桌人设与关系：'+castPeople.map(({person,bond,recent,backstory,sharedNote})=>`${sharedNote}\n${person.name}：${person.personality}；${person.description}；亲密度${bond}/100。共同过往：${backstory}。近期短信（背景记忆，不是本局刚说的话）：${recent}。互动遵循性格和关系，适度给提示，不随意改变规则。`).join('\n')+'\n'+SCENE_HOLD
    const seatedNames = cast(phone.name, chars, chosen, meta.min, meta.max)
    setNames(seatedNames)
    setRecordSession({ id: sessionKey.current, game: meta.name, names: seatedNames, startedAt: Date.now() })
    setPlaying(true)
    if(castPeople.length)runAiJob(jobKey(phone.namespace,'table-relationship',String(ticket)),async()=>{
      try{
        const raw=await askLine('根据角色人设、共同过往和最近实际对话评估角色与玩家的亲密程度，不能只凭聊天条数加分，争执冷淡可降分。只返回JSON数组，每项{"id":"原角色id","bond":0至100的整数}。',JSON.stringify(castPeople.map(({person,bond,recent,backstory})=>({id:person.id,name:person.name,personality:person.personality,previousBond:bond,recent,backstory}))),768,45_000)
        const parsed=readJson(raw)
        if(!Array.isArray(parsed))return
        const updated=castPeople.map(row=>{const value=parsed.find(p=>p&&p.id===row.person.id)?.bond;return {...row,bond:typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(100,Math.round(value))):row.bond}})
        for(const row of updated)await storage.setBag(phone.namespace,'table_bond_'+row.person.id,row.bond)
        if(session.current===ticket)setPeople(updated)
      }catch{/* 接口不可用时保留已有关系，棋局仍可继续 */}
    })
  }

  const leave = () => {
    session.current++
    setPlaying(false)
    setGame(null)
  }
  let view = (
    <Screen title="桌游" subtitle="围桌而坐，按顺序轮流" onBack={props.onBack} right={<button className="chip text-xs" onClick={() => setHistoryOpen(true)}>游玩历史</button>}>
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
          <button type="button" className="chip chip-solid mt-2" onClick={()=>void start()}>开始</button>
        </div>
      ) : <div className="mt-3"><PillNote tone="lilac">先选一个游戏</PillNote></div>}
    </Screen>
  )
  if (playing && game === 'soup') view = <Soup names={names} namespace={phone.namespace} onBack={leave} />
  if (playing && game === 'say') view = <Say names={names} namespace={phone.namespace} onBack={leave} />
  if (playing && game === 'spy') view = <Undercover names={names} onBack={leave} />
  if (playing && game === 'bluff') view = <Bluff names={names} onBack={leave} />
  if (playing && game === 'wolf') view = <Wolf names={names} onBack={leave} />
  if (playing && game === 'uno') view = <Uno names={names} onBack={leave} />
  if (playing && game === 'gomoku') view = <Gomoku names={names} onBack={leave} />
  if (playing && game === 'xiangqi') view = <Xiangqi names={names} onBack={leave} />
  return <TablePeople.Provider value={people}><div className="sms-shell table-app h-full min-h-0" style={candyStyle('#C9B6E8', '#F8D0DC', '#D5F0E4')}>{view}{historyOpen&&<TableHistory namespace={phone.namespace} onClose={() => setHistoryOpen(false)}/>}{playing&&recordSession&&<TableConversation namespace={phone.namespace} session={recordSession} key={recordSession.id} game={meta?.name??''} names={names} people={people} ask={hostAsk}/>}</div></TablePeople.Provider>
}
