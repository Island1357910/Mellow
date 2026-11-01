import { addKeepsake, changeSharedLife, readSharedLife, sharedLifeNote } from '../../lib/sharedLife.ts'
import { uid } from '../../lib/id.ts'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { isAiJobRunning, jobKey, runAiJob } from '../../engine/aiJobs.ts'
import { askLine, readJson } from '../../lib/ask.ts'
import { modePresetId } from '../../lib/defaults.ts'
import { candyStyle } from '../../lib/candy.ts'
import { aiMove as goAi, emptyGrid, winner, type Grid, type Stone } from '../../lib/gomoku.ts'
import { aiMove as chessAi, applyMove, legalMoves, PIECE_NAME, setupBoard, winnerOf, type Board } from '../../lib/xiangqi.ts'
import { aiChoice, canPlayFromHand, drawForTurn, freshMatch, playCard, topCard, UNO_COLOR, UNO_LABEL, type UnoCard, type UnoColor, type UnoMatch } from '../../lib/uno.ts'
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
  return askLine(extra ? `${extra}\n${system}` : system, user, Math.max(768,maxTokens??300),45_000)
}

const TablePeople = createContext<Array<{ person: Character; bond: number }>>([])
function tableEvent(text:string,finished=false){window.dispatchEvent(new CustomEvent('mellow-table-event',{detail:{text,finished}}))}
function mayYield(info:{person:Character;bond:number}|undefined){return Boolean(info&&info.bond>=50&&!/好胜|争强|不服输|认真/.test(info.person.personality)&&Math.random()<.22)}
function TableConversation({ game }: { game: string }) {
  const people = useContext(TablePeople)
  const [draft,setDraft]=useState(''),[lines,setLines]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const historyRef=useRef<string[]>([]),lock=useRef(false),mounted=useRef(true)
  const react=async(text:string,automatic=false)=>{if(!text.trim()||lock.current)return;lock.current=true;setBusy(true);setError('');const history=[...historyRef.current,`${automatic?'本局事件':'玩家'}：${text}`].slice(-20);historyRef.current=history;setLines(history)
    try { const answer=await hostAsk(`正在玩${game}，你扮演同桌角色。${people.map(({person,bond})=>`${person.name}：${person.personality}；设定：${person.description}；与玩家亲密度：${bond}/100`).join('\n')}。按人设和关系回应刚刚的游戏事件或玩家的话，亲近的人可逗弄、安慰、暗示或适度放水，好胜者仍认真比赛。只写一两句同桌对话，禁止替玩家行动或声称改变了未执行的棋局。不能获知隐藏牌或未公开身份。`,history.slice(-12).join('\n'),200,);if(mounted.current){historyRef.current=[...history,answer];setLines(historyRef.current)} } catch(e){if(mounted.current)setError(e instanceof Error?e.message:'互动暂时没接上，请重试')}finally{lock.current=false;if(mounted.current)setBusy(false)}}
  useEffect(()=>{mounted.current=true;const receive=(event:Event)=>{void react(String((event as CustomEvent<{text:string}>).detail.text),true)};window.addEventListener('mellow-table-event',receive);return()=>{mounted.current=false;window.removeEventListener('mellow-table-event',receive)}},[game,people])
  return <section className="table-talk"><details open><summary>桌边互动</summary><div className="mt-2 max-h-32 space-y-2 overflow-y-auto text-xs leading-6" aria-live="polite">{lines.map((l,i)=><p key={i}>{l}</p>)}</div><form className="mt-2 flex gap-2" onSubmit={e=>{e.preventDefault();const text=draft.trim();if(text&&!lock.current){setDraft('');void react(text)}}}><input className="soft-input min-w-0" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="和同桌聊聊、求个提示…"/><button className="chip shrink-0" disabled={busy||!draft.trim()}>{busy?'回应中':'说话'}</button></form>{error&&<p role="status" className="mt-2 text-xs">{error}</p>}</details></section>
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
  const dataRevision = useMellow((state) => state.dataRevision)
  const hostIndex = 1
  const [soup] = useState(() => SOUPS[Math.floor(Math.random() * SOUPS.length)] ?? SOUPS[0])
  const sessionId = props.names.join('-')
  const bagKey = `table_soup_${sessionId}_${soup?.surface ?? ''}`
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
  const [round,setRound]=useState(0),[card,setCard]=useState(()=>pickAt(SAYS)??SAYS[0]!),[hints,setHints]=useState<string[]>([]),[draft,setDraft]=useState(''),[log,setLog]=useState<string[]>([]),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('')
  const describer=round%props.names.length
  const act=async()=>{const text=draft.trim();if(!text||busy||done)return
    if(describer===0&&text.includes(card.word)){setError('提示不能包含答案');return}
    setError('');setDraft('');setBusy(true)
    if(describer!==0){const good=text.replace(/\s/g,'')===card.word;setLog(l=>[...l,`你猜：${text}`,good?'猜对了！':'还没猜中，再给你一个提示。']);if(good){setDone(true);tableEvent('你说我猜：玩家猜中了'+card.word,true)}else setHints(h=>[...h,card.hints[h.length]??'可以换个角度想想']);setBusy(false);return}
    const next=[...hints,text];setHints(next);setLog(l=>[...l,`你：${text}`])
    try{for(const name of props.names.slice(1)){const guess=await hostAsk(`你是${name}，正在你说我猜。只能根据玩家实际给出的提示猜一个词，禁止知道答案。只回复一个词。`,next.join('；'),40);setLog(l=>[...l,`${name}：${guess}`]);if(guess.replace(/[。！\s]/g,'')===card.word){setDone(true);setLog(l=>[...l,'猜对了！']);tableEvent('你说我猜：'+name+'根据玩家提示猜中了'+card.word,true);break}}}catch(e){setError(e instanceof Error?e.message:'没有猜成，请再给一个提示重试')}finally{setBusy(false)}}
  useEffect(()=>{if(describer===0)return;let live=true;setBusy(true);setError('');void hostAsk(`你是${props.names[describer]}。你说我猜中描述「${card.word}」，给3条逐步明确的提示，不要包含答案本身，每行一条。`,'现在给出提示',160).then(line=>{if(live)setHints(line.split('\n').filter(h=>h.trim()&&!h.includes(card.word)))}).catch(e=>{if(live){setHints(card.hints);setError(e instanceof Error?e.message:'使用本局词卡提示')}}).finally(()=>{if(live)setBusy(false)});return()=>{live=false}},[round,card,describer,props.names])
  return <Screen title="你说我猜" subtitle={describer===0?'你描述，其他人猜':'角色描述，你来猜'} onBack={props.onBack}><RoundTable names={props.names} turn={describer} caption="按真实提示猜词"/>{describer===0?<PillNote>你的词：{card.word}</PillNote>:<article className="menu-card text-sm leading-7">{hints.join('；')||'正在准备提示…'}</article>}<div className="mt-3 space-y-2 text-sm" aria-live="polite">{log.map((l,i)=><p key={i}>{l}</p>)}</div>{!done&&<form className="mt-3 flex gap-2" onSubmit={e=>{e.preventDefault();void act()}}><input className="soft-input min-w-0" value={draft} onChange={e=>setDraft(e.target.value)} placeholder={describer===0?'描述这个词':'猜一个词'}/><button className="chip shrink-0" disabled={busy||!draft.trim()}>{busy?'回应中…':describer===0?'说':'猜'}</button></form>}{error&&<p role="status" className="mt-2 text-xs">{error}</p>}<button className="chip mt-3" disabled={busy} onClick={()=>{setRound(r=>r+1);setCard(pickAt(SAYS.filter(c=>c.word!==card.word))??SAYS[0]!);setHints([]);setLog([]);setDone(false);setDraft('');setError('')}}>{done?'下一轮':'跳过本轮'}</button></Screen>
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
  const [speech,setSpeech]=useState(''),[discussion,setDiscussion]=useState<string[]>([]),[discussing,setDiscussing]=useState(false)
  const [checks,setChecks]=useState<Record<string,string[]>>({})
  const discuss=async()=>{
    if(!speech.trim()||discussing||!seats[0]?.alive)return
    const text=speech.trim(),context=[...discussion,`你：${text}`].slice(-20)
    setSpeech('');setDiscussing(true);setDiscussion(context)
    const replies=await Promise.all(seats.filter((s,i)=>i>0&&s.alive).map(async seat=>{
      try{const line=await hostAsk(`你是狼人杀玩家${seat.name}，身份${seat.role}（保密）。自己的查验：${(checks[seat.name]??[]).join('；')||'无'}。根据公开发言讨论，不能知道他人的底牌，不可透露系统信息。只写一句角色发言。`,context.join('；'),140);return `${seat.name}：${line}`}
      catch(e){return `${seat.name} 本次发言失败：${e instanceof Error?e.message:'请重试'}`}
    }))
    setDiscussion([...context,...replies]);setDiscussing(false)
  }
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
    if (discussing) return
    setDiscussing(true)
    const tally: Record<string, number> = me?.alive ? { [name]: 1 } : {}
    const votes=await Promise.all(seats.filter(seat=>seat.alive&&seat.name!==me?.name).map(async seat=>{
      const options=seats.filter(item=>item.alive&&item.name!==seat.name&&(seat.role!=='狼人'||item.role!=='狼人'))
      let pick=pickAt(options)
      try{const answer=await hostAsk(`你是狼人杀玩家${seat.name}，身份${seat.role}。自己的查验：${(checks[seat.name]??[]).join('；')||'无'}。${seat.role==='狼人'?'狼队友：'+seats.filter(s=>s.role==='狼人').map(s=>s.name).join('、'):''}根据公开发言投票，不能知道其他人的底牌。只回复候选人的名字。`,JSON.stringify({candidates:options.map(s=>s.name),discussion:discussion.slice(-20)}),40);pick=options.find(s=>s.name===answer.trim())??pick}catch{/* 请求失败仍可使用本地投票继续游戏 */}
      return pick?.name
    }))
    for(const pick of votes)if(pick)tally[pick]=(tally[pick]??0)+1
    setDiscussion(d=>[...d,'本轮票数：'+Object.entries(tally).map(([n,c])=>n+' '+c+'票').join('、')])
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
      {phase === 'day'&&<section className="menu-card mt-3"><div className="space-y-2 text-xs leading-6">{discussion.map((l,i)=><p key={i}>{l}</p>)}</div><form className="mt-2 flex gap-2" onSubmit={e=>{e.preventDefault();void discuss()}}><input className="soft-input min-w-0" value={speech} onChange={e=>setSpeech(e.target.value)} placeholder="发言、质疑或询问其他玩家"/><button className="chip shrink-0" disabled={discussing||!me.alive||!speech.trim()}>{discussing?'发言中':'发言'}</button></form></section>}
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

function Gomoku(props: { names: string[]; onBack: () => void }) {
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
      tableEvent('玩家连成五子，赢下了这局',true)
      return
    }
    setTurn(1)
    const mercy = mayYield(rivalInfo)
    const empty=next.flatMap((line,r)=>line.flatMap((stone,c)=>stone?[]:[[r,c] as [number,number]]))
    const move = mercy ? pickAt(empty) : goAi(next, 2)
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
    tableEvent(`玩家落在${row+1}行${col+1}列，${rival}落在${move[0]+1}行${move[1]+1}列。${winner(next)?rival+'赢了':''}`,Boolean(winner(next)))
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
      tableEvent(`玩家从${pick[0]+1},${pick[1]+1}走到${row+1},${col+1}，${rival}完成回应。${winnerOf(done)?'本局结束':''}`,Boolean(winnerOf(done)))
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
  const people=useContext(TablePeople)
  const [match, setMatch] = useState<UnoMatch>(() => freshMatch(props.names))
  const [wildAt, setWildAt] = useState<number | null>(null)
  useEffect(() => {
    if (match.winner !== null || match.turn === 0) return
    const timer = window.setTimeout(() => {const info=people.find(p=>p.person.name===match.names[match.turn]);const next=runAi(match,mayYield(info));setMatch(next);tableEvent(next.note,next.winner!==null)}, 450)
    return () => window.clearTimeout(timer)
  }, [match,people])
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
    tableEvent(next.note,next.winner!==null)
  }
  const draw = () => {
    const next = drawForTurn(match)
    setMatch(next)
    tableEvent(next.note,next.winner!==null)
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
    {match.winner!==null&&<button className="chip chip-solid mt-4" onClick={()=>{setWildAt(null);setMatch(freshMatch(props.names))}}>再来一局</button>}
    <details className="menu-card mt-4 text-xs leading-6"><summary>玩法说明</summary><p>同色、同数字或同功能可以出牌。摸牌后只能打出本次摸到的牌，或选择过牌。+4 仅在没有当前颜色时可出；不叠加罚牌。牌面同时显示颜色名称。</p></details>
  </Screen>
}

export function TableApp(props: { onBack: () => void }) {
  const phone = usePhone()
  const presets = useMellow((state) => state.presets)
  const settings = useMellow((state) => state.settings)
  const voice = presets.find((item) => item.id === modePresetId(settings, 'table'))?.data.prompts.filter(item => item.enabled).map(item => item.content).join('\n') ?? ''
  useEffect(() => {
    hostVoice = voice
  }, [voice])
  const [chars, setChars] = useState<Character[]>([])
  const [game, setGame] = useState<GameId | null>(null)
  const [chosen, setChosen] = useState<string[]>([])
  const [names, setNames] = useState<string[]>([])
  const [playing, setPlaying] = useState(false)
  const [people,setPeople]=useState<Array<{person:Character;bond:number}>>([])
  const session=useRef(0),sessionKey=useRef('')
  useEffect(()=>()=>{session.current++},[])
  useEffect(()=>{if(!playing||!phone)return;const receive=(event:Event)=>{const detail=(event as CustomEvent<{text:string;finished:boolean}>).detail;if(!detail.finished)return;void changeSharedLife(phone.namespace,state=>people.reduce((next,{person})=>addKeepsake(next,{charId:person.id,title:(GAMES.find(g=>g.id===game)?.name??'桌游')+'战绩',text:names.join('、')+'一起玩。'+detail.text,at:Date.now(),kind:'game',source:sessionKey.current+'_'+detail.text}),state)).then(()=>useMellow.getState().touchData()).catch(()=>undefined)};window.addEventListener('mellow-table-event',receive);return()=>window.removeEventListener('mellow-table-event',receive)},[playing,phone,people,game,names])
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
    hostVoice=voice+'\n同桌人设与关系：'+castPeople.map(({person,bond,recent,backstory,sharedNote})=>`${sharedNote}\n${person.name}：${person.personality}；${person.description}；亲密度${bond}/100。共同过往：${backstory}。近期短信（背景记忆，不是本局刚说的话）：${recent}。互动遵循性格和关系，适度给提示，不随意改变规则。`).join('\n')
    setNames(cast(phone.name, chars, chosen, meta.min, meta.max))
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
          <button type="button" className="chip chip-solid mt-2" onClick={()=>void start()}>开始</button>
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
  return <TablePeople.Provider value={people}><div className="sms-shell table-app h-full min-h-0" style={candyStyle('#C9B6E8', '#F8D0DC', '#D5F0E4')}>{view}{playing&&<TableConversation key={game} game={meta?.name??''}/>}</div></TablePeople.Provider>
}
