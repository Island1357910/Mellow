import { useEffect, useState, type ReactNode } from 'react'
import { askLine } from '../../lib/ask.ts'
import { candyStyle } from '../../lib/candy.ts'
import { uid } from '../../lib/id.ts'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import { PillNote, Screen } from '../ui/primitives.tsx'

function clock(): number {
  return Date.now()
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function usePhone() {
  const identities = useMellow((state) => state.identities)
  const activeIdentityId = useMellow((state) => state.activeIdentityId)
  return identities.find((item) => item.id === activeIdentityId) ?? null
}

function Shell(props: { title: string; subtitle: string; tint: string; onBack: () => void; children: ReactNode }) {
  return (
    <div className="sms-shell h-full min-h-0" style={candyStyle(props.tint, '#F8D0DC', '#E6DDF8')}>
      <Screen title={props.title} subtitle={props.subtitle} onBack={props.onBack}>{props.children}</Screen>
    </div>
  )
}

function Meter(props: { label: string; value: number; tint: string }) {
  return (
    <div>
      <div className="flex justify-between text-[11px]"><span>{props.label}</span><span>{props.value}</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/70">
        <div className="h-full rounded-full" style={{ width: `${props.value}%`, background: props.tint }} />
      </div>
    </div>
  )
}

function useRows<T>(bag: string) {
  const phone = usePhone()
  const [rows, setRows] = useState<T[] | null>(null)
  useEffect(() => {
    if (!phone) return
    let stop = false
    void storage.getBag<T[]>(phone.namespace, bag).then((saved) => {
      if (!stop) setRows(saved ?? [])
    })
    return () => {
      stop = true
    }
  }, [phone, bag])
  const save = (next: T[]) => {
    setRows(next)
    if (phone) void storage.setBag(phone.namespace, bag, next)
  }
  return { phone, rows, save }
}

type PetKind = '猫' | '狗' | '鸟' | '仓鼠'

interface PetLog {
  id: string
  text: string
  at: number
}

interface PetState {
  name: string
  kind: PetKind
  full: number
  mood: number
  energy: number
  bond: number
  log: PetLog[]
}

const PET_FACE: Record<PetKind, string> = { 猫: '🐱', 狗: '🐶', 鸟: '🐦', 仓鼠: '🐹' }

const PET_ACTS: Record<PetKind, Array<{ id: string; label: string; line: string; full: number; mood: number; energy: number; bond: number }>> = {
  猫: [
    { id: 'feed', label: '喂', line: '把脸埋进碗里，吃到一半抬头，胡须上沾着渣。', full: 22, mood: 6, energy: 4, bond: 2 },
    { id: 'play', label: '逗', line: '纸团滚到沙发底下。它钻进去，只露出一条尾巴。', full: -6, mood: 14, energy: -10, bond: 4 },
    { id: 'brush', label: '梳', line: '梳到下巴的时候，喉咙里响了一小下。', full: 0, mood: 8, energy: -2, bond: 6 },
    { id: 'out', label: '出门', line: '在门口坐了很久，最后只把一只爪子伸到外面。', full: -4, mood: 4, energy: -8, bond: 1 },
  ],
  狗: [
    { id: 'feed', label: '喂', line: '碗还没放下，尾巴已经把旁边的杯子扫倒了。', full: 24, mood: 10, energy: 6, bond: 3 },
    { id: 'play', label: '逗', line: '球滚远了。它捡回来，又故意放到你脚边。', full: -8, mood: 16, energy: -14, bond: 5 },
    { id: 'brush', label: '梳', line: '梳到耳朵后面，它侧过脸，把另一边也送过来。', full: 0, mood: 8, energy: -2, bond: 6 },
    { id: 'out', label: '出门', line: '看见别的狗就停住，回头确认你还在。', full: -6, mood: 10, energy: -12, bond: 4 },
  ],
  鸟: [
    { id: 'feed', label: '喂', line: '谷子撒在掌心。它跳上来，啄得很轻。', full: 18, mood: 8, energy: 4, bond: 3 },
    { id: 'play', label: '逗', line: '镜子前面站了很久，对着自己歪头。', full: -2, mood: 12, energy: -4, bond: 2 },
    { id: 'brush', label: '理羽', line: '你没碰它。它自己把翅膀理了一遍，羽毛落在桌上。', full: 0, mood: 6, energy: -2, bond: 4 },
    { id: 'out', label: '开窗', line: '窗开了一条缝。它看了看外面，又回到架子上。', full: -2, mood: 6, energy: -3, bond: 2 },
  ],
  仓鼠: [
    { id: 'feed', label: '喂', line: '瓜子被塞进腮帮，两边鼓得不一样高。', full: 20, mood: 8, energy: 2, bond: 2 },
    { id: 'play', label: '逗', line: '轮子转了很久。停下来的时候，它还在喘。', full: -8, mood: 12, energy: -16, bond: 3 },
    { id: 'brush', label: '换垫', line: '新垫料堆起来。它立刻挖了一个坑，把自己埋进去。', full: 0, mood: 6, energy: -4, bond: 3 },
    { id: 'out', label: '放风', line: '在桌子上跑了一圈，钻进袖口，不肯出来。', full: -4, mood: 10, energy: -8, bond: 5 },
  ],
}

function sceneOf(pet: PetState): string {
  if (pet.full < 30) return '盯着空碗，不看你。'
  if (pet.energy < 25) return '蜷成一小团，呼吸很轻。'
  if (pet.mood > 80) return '心情很好，连路过都会停一下。'
  if (pet.bond > 70) return '靠过来，把重量放在你手上。'
  return '在窗边发呆，尾巴偶尔动一下。'
}

function readPet(raw: PetState | { name: string; mood: number; log: PetLog[] } | null): PetState {
  if (!raw) return { name: '小糖', kind: '猫', full: 70, mood: 60, energy: 70, bond: 20, log: [] }
  if ('kind' in raw && raw.kind) return raw
  return { name: raw.name || '小糖', kind: '猫', full: 70, mood: raw.mood ?? 60, energy: 60, bond: 30, log: raw.log ?? [] }
}

export function PetApp(props: { onBack: () => void }) {
  const phone = usePhone()
  const [pet, setPet] = useState<PetState | null>(null)
  const [tab, setTab] = useState<'today' | 'diary'>('today')
  useEffect(() => {
    if (!phone) return
    let stop = false
    void storage.getBag<PetState>(phone.namespace, 'pet').then((saved) => {
      if (!stop) setPet(readPet(saved))
    })
    return () => {
      stop = true
    }
  }, [phone])
  if (!phone || !pet) return null
  const acts = PET_ACTS[pet.kind]
  const commit = (next: PetState, line: string) => {
    const saved = { ...next, log: [{ id: uid('pet'), text: line, at: clock() }, ...next.log].slice(0, 24) }
    setPet(saved)
    void storage.setBag(phone.namespace, 'pet', saved)
  }
  const act = (id: string) => {
    const row = acts.find((item) => item.id === id)
    if (!row) return
    commit({
      ...pet,
      full: clamp(pet.full + row.full),
      mood: clamp(pet.mood + row.mood),
      energy: clamp(pet.energy + row.energy),
      bond: clamp(pet.bond + row.bond),
    }, row.line)
    setTab('diary')
  }
  const look = () => {
    commit(pet, `${PET_FACE[pet.kind]} ${sceneOf(pet)}`)
    setTab('diary')
  }
  return (
    <Shell title="宠物日记" subtitle={`${pet.kind} · ${pet.name}`} tint="#F0C2B0" onBack={props.onBack}>
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-full bg-white/70 p-1 text-xs">
        <button type="button" className="rounded-full py-1.5" style={{ background: tab === 'today' ? '#F0C2B0' : 'transparent' }} onClick={() => setTab('today')}>今天</button>
        <button type="button" className="rounded-full py-1.5" style={{ background: tab === 'diary' ? '#F0C2B0' : 'transparent' }} onClick={() => setTab('diary')}>日记</button>
      </div>
      {tab === 'today' ? (
        <>
          <article className="menu-card">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-5xl">{PET_FACE[pet.kind]}</p>
                <p className="mt-2 text-lg font-semibold">{pet.name}</p>
                <p className="mt-1 text-sm leading-6">{sceneOf(pet)}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Meter label="饱食" value={pet.full} tint="#F3C27A" />
              <Meter label="心情" value={pet.mood} tint="#F3A8BA" />
              <Meter label="精力" value={pet.energy} tint="#9ED9C4" />
              <Meter label="亲近" value={pet.bond} tint="#C9B6E8" />
            </div>
          </article>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(['猫', '狗', '鸟', '仓鼠'] as PetKind[]).map((kind) => (
              <button key={kind} type="button" className="chip" style={pet.kind === kind ? { background: '#F0C2B0' } : undefined} onClick={() => {
                const next = { ...pet, kind }
                setPet(next)
                void storage.setBag(phone.namespace, 'pet', next)
              }}>{PET_FACE[kind]} {kind}</button>
            ))}
          </div>
          <input className="soft-input mt-3" value={pet.name} onChange={(event) => {
            const next = { ...pet, name: event.target.value }
            setPet(next)
            void storage.setBag(phone.namespace, 'pet', next)
          }} />
          <div className="mt-3 flex flex-wrap gap-2">
            {acts.map((item) => (
              <button key={item.id} type="button" className="chip chip-peach" onClick={() => act(item.id)}>{item.label}</button>
            ))}
            <button type="button" className="chip chip-mint" onClick={look}>看看它</button>
          </div>
        </>
      ) : (
        <div className="space-y-2">
          {pet.log.length === 0 ? <PillNote tone="butter">还没有记下的一天。先喂一次，或看看它在干什么。</PillNote> : pet.log.map((item) => (
            <article key={item.id} className="menu-card">
              {item.at ? <p className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{new Date(item.at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</p> : null}
              <p className="mt-1 text-sm leading-6">{item.text}</p>
            </article>
          ))}
        </div>
      )}
    </Shell>
  )
}

interface Plant {
  id: string
  name: string
  note: string
  water: number
  sun: number
}

function plantFace(item: Plant): string {
  if (item.water < 25) return '叶子卷起来了'
  if (item.sun < 25) return '颜色有点淡'
  if (item.water > 80 && item.sun > 60) return '新叶子刚展开'
  return '还撑着'
}

export function PlantApp(props: { onBack: () => void }) {
  const { phone, rows, save } = useRows<Plant>('plants')
  const [name, setName] = useState('')
  if (!phone || !rows) return null
  const plants = rows.map((item) => ({ ...item, water: item.water ?? 55, sun: item.sun ?? 50, note: item.note || '还在' }))
  const add = () => {
    if (!name.trim()) return
    save([{ id: uid('plant'), name: name.trim(), note: '刚搬进来', water: 60, sun: 50 }, ...plants])
    setName('')
  }
  const patch = (id: string, next: Partial<Plant>, note: string) => {
    save(plants.map((row) => (row.id === id ? { ...row, ...next, note } : row)))
  }
  return (
    <Shell title="植物管家" subtitle={`${rows.length} 盆`} tint="#9ED9C4" onBack={props.onBack}>
      <form className="mb-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); add() }}>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="这盆叫什么" className="soft-input" />
        <button type="submit" className="chip chip-solid shrink-0">添上</button>
      </form>
      <div className="space-y-2">
        {plants.length === 0 ? <PillNote tone="mint">窗台还是空的</PillNote> : plants.map((item) => (
          <article key={item.id} className="menu-card">
            <div className="flex items-start gap-3">
              <span className="text-3xl">{item.water < 25 ? '🥀' : '🪴'}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{plantFace(item)} · {item.note}</p>
                <div className="mt-2 space-y-1.5">
                  <Meter label="水" value={item.water} tint="#7FB8E0" />
                  <Meter label="光" value={item.sun} tint="#F0D48A" />
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-1.5">
              <button type="button" className="chip chip-mint" onClick={() => patch(item.id, { water: clamp(item.water + 28) }, '刚浇过，土是深的')}>浇水</button>
              <button type="button" className="chip chip-butter" onClick={() => patch(item.id, { sun: clamp(item.sun + 24), water: clamp(item.water - 6) }, '挪到有光的地方')}>晒一晒</button>
              <button type="button" className="chip" onClick={() => patch(item.id, { water: clamp(item.water - 8), sun: clamp(item.sun - 4) }, '今天没管它')}>放着</button>
            </div>
          </article>
        ))}
      </div>
    </Shell>
  )
}

interface BodyRow {
  id: string
  kind: string
  text: string
  at?: number
}

const BODY_KINDS = [
  { id: '睡', hint: '几点睡的，或睡得怎样' },
  { id: '吃', hint: '吃了什么' },
  { id: '身体', hint: '哪里不舒服，或还好' },
]

export function BodyApp(props: { onBack: () => void }) {
  const { phone, rows, save } = useRows<BodyRow>('body')
  const [kind, setKind] = useState('睡')
  const [text, setText] = useState('')
  if (!phone || !rows) return null
  const hint = BODY_KINDS.find((item) => item.id === kind)?.hint ?? ''
  return (
    <Shell title="身体记录" subtitle="睡、吃、身体" tint="#F2B48A" onBack={props.onBack}>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {BODY_KINDS.map((item) => (
          <button key={item.id} type="button" className="menu-card text-sm" style={kind === item.id ? { background: '#F8E6C0' } : undefined} onClick={() => setKind(item.id)}>
            {item.id}
            <span className="mt-1 block text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{rows.filter((row) => row.kind === item.id).length} 条</span>
          </button>
        ))}
      </div>
      <form className="mb-3 flex gap-2" onSubmit={(event) => {
        event.preventDefault()
        if (!text.trim()) return
        save([{ id: uid('body'), kind, text: text.trim(), at: clock() }, ...rows])
        setText('')
      }}>
        <input value={text} onChange={(event) => setText(event.target.value)} placeholder={hint} className="soft-input" />
        <button type="submit" className="chip chip-solid shrink-0">记下</button>
      </form>
      <div className="space-y-2">
        {rows.length === 0 ? <PillNote tone="peach">还没有记录。关心你的人以后可能会问。</PillNote> : rows.map((item) => (
          <article key={item.id} className="menu-card text-sm">
            <span className="mr-2 text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{item.kind}{item.at ? ` · ${new Date(item.at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}` : ''}</span>
            {item.text}
          </article>
        ))}
      </div>
    </Shell>
  )
}

interface Dream {
  id: string
  text: string
  echo?: string
}

export function DreamApp(props: { onBack: () => void }) {
  const { phone, rows, save } = useRows<Dream>('dreams')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState('')
  if (!phone || !rows) return null
  const air = async (item: Dream) => {
    if (busy) return
    setBusy(item.id)
    try {
      const echo = await askLine('把这段梦接成电台里的一小段旁白，60 字以内，不要解释，不要列点。', item.text, 120)
      save(rows.map((row) => (row.id === item.id ? { ...row, echo } : row)))
    } catch {
      save(rows.map((row) => (row.id === item.id ? { ...row, echo: '信号不好，这段先留在这里。' } : row)))
    } finally {
      setBusy('')
    }
  }
  return (
    <Shell title="梦境电台" subtitle="可能会漏出去" tint="#C9B6E8" onBack={props.onBack}>
      <form className="menu-card mb-3" onSubmit={(event) => {
        event.preventDefault()
        if (!text.trim()) return
        save([{ id: uid('dream'), text: text.trim() }, ...rows])
        setText('')
      }}>
        <textarea value={text} rows={4} onChange={(event) => setText(event.target.value)} placeholder="梦见了什么" className="soft-input resize-none" />
        <button type="submit" className="chip chip-lilac mt-2">留下</button>
      </form>
      <div className="space-y-2">
        {rows.length === 0 ? <PillNote tone="lilac">电台还是静音</PillNote> : rows.map((item) => (
          <article key={item.id} className="menu-card">
            <p className="text-sm leading-6">{item.text}</p>
            {item.echo ? <p className="mt-2 text-sm leading-6" style={{ color: 'var(--m-text-secondary)' }}>{item.echo}</p> : (
              <button type="button" className="chip mt-2" disabled={busy === item.id} onClick={() => void air(item)}>{busy === item.id ? '正在播…' : '播一则'}</button>
            )}
          </article>
        ))}
      </div>
    </Shell>
  )
}

interface Spark {
  id: string
  text: string
  pinned?: boolean
  more?: string
}

export function SparkApp(props: { onBack: () => void }) {
  const { phone, rows, save } = useRows<Spark>('sparks')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState('')
  if (!phone || !rows) return null
  const ordered = [...rows].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)))
  const expand = async (item: Spark) => {
    if (busy) return
    setBusy(item.id)
    try {
      const more = await askLine('把这句没写完的话展开成两句，保持原来的口气，不要总结。', item.text, 120)
      save(rows.map((row) => (row.id === item.id ? { ...row, more } : row)))
    } catch {
      save(rows.map((row) => (row.id === item.id ? { ...row, more: item.text } : row)))
    } finally {
      setBusy('')
    }
  }
  return (
    <Shell title="灵感捕手" subtitle="一句没写完" tint="#F0D48A" onBack={props.onBack}>
      <form className="mb-3 flex gap-2" onSubmit={(event) => {
        event.preventDefault()
        if (!text.trim()) return
        save([{ id: uid('spark'), text: text.trim() }, ...rows])
        setText('')
      }}>
        <input value={text} onChange={(event) => setText(event.target.value)} placeholder="先抓住这一句" className="soft-input" />
        <button type="submit" className="chip chip-butter shrink-0">抓住</button>
      </form>
      <div className="space-y-2">
        {ordered.length === 0 ? <PillNote tone="butter">还没有漏网的句子</PillNote> : ordered.map((item) => (
          <article key={item.id} className="menu-card">
            <p className="text-sm leading-6">{item.pinned ? '★ ' : ''}{item.text}</p>
            {item.more ? <p className="mt-2 text-sm leading-6" style={{ color: 'var(--m-text-secondary)' }}>{item.more}</p> : null}
            <div className="mt-2 flex gap-1.5">
              <button type="button" className="chip" onClick={() => save(rows.map((row) => row.id === item.id ? { ...row, pinned: !row.pinned } : row))}>{item.pinned ? '取消钉住' : '钉住'}</button>
              {!item.more ? <button type="button" className="chip chip-butter" disabled={busy === item.id} onClick={() => void expand(item)}>{busy === item.id ? '展开中' : '展开'}</button> : null}
            </div>
          </article>
        ))}
      </div>
    </Shell>
  )
}

export function WriteApp(props: { onBack: () => void }) {
  const phone = usePhone()
  const [text, setText] = useState('')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!phone) return
    let stop = false
    void storage.getBag<string>(phone.namespace, 'draft_write').then((saved) => {
      if (stop) return
      setText(saved ?? '')
      setReady(true)
    })
    return () => {
      stop = true
    }
  }, [phone])
  if (!phone || !ready) return null
  const keep = (next: string) => {
    setText(next)
    void storage.setBag(phone.namespace, 'draft_write', next)
  }
  const more = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const line = await askLine('接着用户的文字往下写一两句，保持同一种语气，不要总结，不要列点。', text, 160)
      keep(`${text.trim()}\n${line}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '没接上')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Shell title="写作助手" subtitle={`${text.trim().length} 字`} tint="#E7B7C9" onBack={props.onBack}>
      <textarea value={text} rows={10} onChange={(event) => keep(event.target.value)} placeholder="从这里开始。写到卡住的地方，让它接下去。" className="soft-input resize-none leading-7" />
      <div className="mt-3 flex gap-2">
        <button type="button" className="chip chip-solid" disabled={busy || !text.trim()} onClick={() => void more()}>{busy ? '正在接…' : '接下去'}</button>
        <button type="button" className="chip" onClick={() => keep('')}>清空</button>
      </div>
      {error ? <div className="mt-2"><PillNote tone="peach" inline>{error}</PillNote></div> : null}
    </Shell>
  )
}

interface Tune {
  id: string
  title: string
  line: string
  mood?: string
}

const MOODS = ['轻', '夜', '快', '慢']

export function MusicApp(props: { onBack: () => void }) {
  const { phone, rows, save } = useRows<Tune>('tunes')
  const [title, setTitle] = useState('')
  const [line, setLine] = useState('')
  const [mood, setMood] = useState(MOODS[0] ?? '轻')
  if (!phone || !rows) return null
  return (
    <Shell title="音乐速记" subtitle="旋律和一句词" tint="#A9CDE8" onBack={props.onBack}>
      <form className="menu-card mb-3 space-y-2" onSubmit={(event) => {
        event.preventDefault()
        if (!title.trim() && !line.trim()) return
        save([{ id: uid('tune'), title: title.trim() || '未命名', line: line.trim(), mood }, ...rows])
        setTitle('')
        setLine('')
      }}>
        <div className="flex gap-1.5">
          {MOODS.map((item) => (
            <button key={item} type="button" className="chip" style={mood === item ? { background: '#A9CDE8' } : undefined} onClick={() => setMood(item)}>{item}</button>
          ))}
        </div>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="叫什么" className="soft-input" />
        <input value={line} onChange={(event) => setLine(event.target.value)} placeholder="一句词，或一段旋律" className="soft-input" />
        <button type="submit" className="chip chip-sky">记下</button>
      </form>
      <div className="space-y-2">
        {rows.length === 0 ? <PillNote tone="sky">还没有旋律。播放器里的歌是另外一处。</PillNote> : rows.map((item) => (
          <article key={item.id} className="menu-card">
            <p className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{item.mood || '未标'}</p>
            <p className="text-sm font-medium">{item.title}</p>
            <p className="mt-1 text-sm leading-6">{item.line}</p>
          </article>
        ))}
      </div>
    </Shell>
  )
}
