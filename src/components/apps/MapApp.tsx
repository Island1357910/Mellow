import { useEffect, useState } from 'react'
import { isAiJobRunning, jobKey, runAiJob } from '../../engine/aiJobs.ts'
import { askLine } from '../../lib/ask.ts'
import { candyStyle } from '../../lib/candy.ts'
import { uid } from '../../lib/id.ts'
import { addCoins } from '../../lib/wallet.ts'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import type { Character } from '../../types/index.ts'
import { PillNote, Screen } from '../ui/primitives.tsx'

interface Place {
  id: string
  name: string
  kind: string
  note: string
  x: number
  y: number
}

interface Scene {
  id: string
  place: string
  text: string
}

interface World {
  places: Place[]
  here: string
  shifts: Record<string, number>
  scenes: Scene[]
}

const KINDS = ['家', '街', '店', '公司', '公园', '别处']
const JOBS = [
  { id: 'flower', name: '花店店员', kinds: ['店'], pay: 8, titles: ['学徒', '店员', '主理人'] },
  { id: 'cafe', name: '咖啡馆', kinds: ['店'], pay: 7, titles: ['兼职', '吧台', '店长'] },
  { id: 'edit', name: '夜班编辑', kinds: ['公司'], pay: 12, titles: ['实习', '编辑', '主笔'] },
  { id: 'free', name: '自由撰稿', kinds: ['家', '别处'], pay: 10, titles: ['投稿', '专栏', '连载'] },
]

const EXPLORE: Record<string, string> = {
  家: '房间里的灯还是上次离开时的亮度。',
  街: '街角的风停了一下，又往前走。',
  店: '门铃响了一声，有人抬头看你。',
  公司: '走廊的灯一盏隔一盏。',
  公园: '长椅是干的，叶子不是。',
  别处: '这里还没有被人叫出名字。',
}

function freshWorld(): World {
  return {
    here: 'home',
    shifts: {},
    scenes: [],
    places: [
      { id: 'home', name: '家', kind: '家', note: '自己的房间', x: 22, y: 72 },
      { id: 'street', name: '街角', kind: '街', note: '风会停一下', x: 48, y: 46 },
      { id: 'cafe', name: '咖啡馆', kind: '店', note: '靠窗的位子', x: 74, y: 28 },
      { id: 'office', name: '公司', kind: '公司', note: '夜灯还亮着', x: 26, y: 24 },
      { id: 'park', name: '公园', kind: '公园', note: '一张长椅', x: 70, y: 70 },
    ],
  }
}

function titleOf(shifts: number, titles: string[]): string {
  if (shifts >= 8) return titles[2] ?? titles[0] ?? ''
  if (shifts >= 3) return titles[1] ?? titles[0] ?? ''
  return titles[0] ?? ''
}

function usePhone() {
  const identities = useMellow((state) => state.identities)
  const activeIdentityId = useMellow((state) => state.activeIdentityId)
  return identities.find((item) => item.id === activeIdentityId) ?? null
}

async function rewriteSceneInBag(namespace: string, sceneId: string, text: string): Promise<void> {
  const saved = await storage.getBag<World>(namespace, 'map_world')
  if (!saved) return
  const next = { ...saved, scenes: saved.scenes.map((item) => (item.id === sceneId ? { ...item, text } : item)) }
  await storage.setBag(namespace, 'map_world', next)
}

export function MapApp(props: { onBack: () => void }) {
  const phone = usePhone()
  const dataRevision = useMellow((state) => state.dataRevision)
  const [world, setWorld] = useState<World | null>(null)
  const [chars, setChars] = useState<Character[]>([])
  const [panel, setPanel] = useState<'date' | 'work' | 'add' | null>(null)
  const [dateId, setDateId] = useState('')
  const [kind, setKind] = useState('街')
  const [placeName, setPlaceName] = useState('')
  const [placeNote, setPlaceNote] = useState('')
  const [coins, setCoins] = useState<number | null>(null)

  useEffect(() => {
    if (!phone) return
    let stop = false
    void storage.getBag<World>(phone.namespace, 'map_world').then((saved) => {
      if (stop) return
      const next = saved?.places?.length ? saved : freshWorld()
      setWorld(next)
      if (!saved?.places?.length) void storage.setBag(phone.namespace, 'map_world', next)
    })
    void storage.listCharacters(phone.namespace).then((rows) => {
      if (!stop) setChars(rows)
    })
    return () => {
      stop = true
    }
  }, [phone, dataRevision])

  if (!phone || !world) return null
  const here = world.places.find((item) => item.id === world.here) ?? world.places[0]
  if (!here) return null
  const commit = (next: World) => {
    setWorld(next)
    void storage.setBag(phone.namespace, 'map_world', next)
  }
  const pushScene = (place: string, text: string) => {
    const scene = { id: uid('scene'), place, text }
    commit({ ...world, scenes: [scene, ...world.scenes].slice(0, 6) })
    return scene.id
  }
  const explore = () => {
    const local = `${EXPLORE[here.kind] ?? EXPLORE['别处']} ${here.note}`
    const id = pushScene(here.name, local)
    const placeName = here.name
    const placeKind = here.kind
    const placeNote = here.note
    runAiJob(jobKey(phone.namespace, 'map', `scene-${id}`), async () => {
      const text = await askLine('用两三句中文写一段当下的场景，像小说，不要列表，不要解释。', `地点：${placeName}，${placeKind}。备注：${placeNote}`, 140)
      await rewriteSceneInBag(phone.namespace, id, text.slice(0, 180))
    })
  }
  const date = () => {
    const person = chars.find((item) => item.id === dateId)
    if (!person) return
    const local = `你和${person.name}在${here.name}坐了一会儿。${here.note}`
    const id = pushScene(here.name, local)
    setPanel(null)
    const personName = person.name
    const placeName = here.name
    const placeNote = here.note
    runAiJob(jobKey(phone.namespace, 'map', `scene-${id}`), async () => {
      const text = await askLine(`用两三句中文写一段约会。你是旁白，人物是玩家和${personName}。不要替玩家做决定，不要列表。`, `地点：${placeName}。${placeNote}`, 160)
      await rewriteSceneInBag(phone.namespace, id, text.slice(0, 200))
    })
  }
  const sceneBusy = world.scenes.some((item) => isAiJobRunning(jobKey(phone.namespace, 'map', `scene-${item.id}`)))
  const work = async (jobId: string) => {
    const job = JOBS.find((item) => item.id === jobId)
    if (!job) return
    const shifts = (world.shifts[jobId] ?? 0) + 1
    const balance = await addCoins(phone.namespace, job.pay)
    setCoins(balance)
    const role = titleOf(shifts, job.titles)
    commit({
      ...world,
      shifts: { ...world.shifts, [jobId]: shifts },
      scenes: [{ id: uid('scene'), place: here.name, text: `这一班结束了。口袋里多了 ${job.pay} 枚，现在是${job.name} · ${role}。` }, ...world.scenes].slice(0, 6),
    })
  }
  const addPlace = () => {
    const name = placeName.trim()
    if (!name) return
    const place: Place = {
      id: uid('place'),
      name,
      kind,
      note: placeNote.trim() || '新标上的',
      x: 18 + Math.round(Math.random() * 64),
      y: 18 + Math.round(Math.random() * 64),
    }
    commit({ ...world, places: [...world.places, place], here: place.id })
    setPlaceName('')
    setPlaceNote('')
    setPanel(null)
  }
  const jobsHere = JOBS.filter((job) => job.kinds.includes(here.kind))

  return (
    <div className="sms-shell h-full min-h-0" style={candyStyle('#9ED9C4', '#F8E6C0', '#F8D0DC')}>
      <Screen title="地图" subtitle={here ? `${here.name} · ${here.note}` : '走走看看'} onBack={props.onBack}>
        <div className="relative h-[340px] overflow-hidden rounded-[28px] shadow-[0_12px_24px_rgba(120,80,100,0.08)]" style={{ background: 'radial-gradient(circle at 20% 30%, #d5f0e4, transparent 42%), radial-gradient(circle at 70% 20%, #f8e6c0, transparent 36%), radial-gradient(circle at 60% 80%, #f8d0dc, transparent 40%), #f7f1ea' }}>
          <span className="absolute left-[8%] top-[48%] h-3 w-[84%] rounded-full bg-white/70" />
          <span className="absolute left-[46%] top-[8%] h-[84%] w-3 rounded-full bg-white/60" />
          {world.places.map((place) => (
            <button
              key={place.id}
              type="button"
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-2.5 py-1 text-xs shadow-[0_6px_14px_rgba(120,80,100,0.12)]"
              style={{ left: `${place.x}%`, top: `${place.y}%`, background: place.id === here.id ? '#F3A8BA' : 'rgba(255,255,255,0.92)' }}
              onClick={() => { commit({ ...world, here: place.id }); setPanel(null) }}
            >
              {place.name}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button type="button" className="chip chip-mint" onClick={explore}>逛一逛</button>
          <button type="button" className="chip chip-pink" onClick={() => setPanel(panel === 'date' ? null : 'date')}>约人</button>
          <button type="button" className="chip chip-butter" onClick={() => setPanel(panel === 'work' ? null : 'work')}>上班</button>
          <button type="button" className="chip" onClick={() => setPanel(panel === 'add' ? null : 'add')}>标一个地方</button>
        </div>
        {panel === 'date' ? (
          <div className="menu-card mt-3">
            <div className="flex flex-wrap gap-1.5">
              {chars.map((person) => (
                <button key={person.id} type="button" className="chip" style={dateId === person.id ? { background: '#F8D0DC' } : undefined} onClick={() => setDateId(person.id)}>{person.name}</button>
              ))}
            </div>
            {chars.length === 0 ? <PillNote tone="pink" compact>先把人放进这台手机</PillNote> : <button type="button" className="chip chip-solid mt-2" disabled={!dateId} onClick={date}>就在这里见</button>}
          </div>
        ) : null}
        {panel === 'work' ? (
          <div className="menu-card mt-3 space-y-2">
            {jobsHere.length === 0 ? <PillNote tone="butter" compact>这里暂时没有班可上</PillNote> : jobsHere.map((job) => {
              const shifts = world.shifts[job.id] ?? 0
              return (
                <button key={job.id} type="button" className="flex w-full items-center justify-between rounded-2xl bg-white/80 px-3 py-2 text-left" onClick={() => void work(job.id)}>
                  <span>
                    <span className="block text-sm">{job.name}</span>
                    <span className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{titleOf(shifts, job.titles)} · 上过 {shifts} 班</span>
                  </span>
                  <span className="chip chip-butter">+{job.pay}</span>
                </button>
              )
            })}
            {coins !== null ? <p className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>现在口袋里 {coins} 枚</p> : null}
          </div>
        ) : null}
        {panel === 'add' ? (
          <div className="menu-card mt-3 space-y-2">
            <input value={placeName} onChange={(event) => setPlaceName(event.target.value)} placeholder="地方的名字" className="soft-input" />
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map((item) => (
                <button key={item} type="button" className="chip" style={kind === item ? { background: '#D5F0E4' } : undefined} onClick={() => setKind(item)}>{item}</button>
              ))}
            </div>
            <input value={placeNote} onChange={(event) => setPlaceNote(event.target.value)} placeholder="一句备注" className="soft-input" />
            <button type="button" className="chip chip-solid" disabled={!placeName.trim()} onClick={addPlace}>标在地图上</button>
          </div>
        ) : null}
        <div className="mt-4 space-y-2">
          {sceneBusy ? <PillNote tone="lilac" compact>正在写场景…</PillNote> : null}
          {world.scenes.length === 0 ? <PillNote tone="mint">还没在这里留下脚印</PillNote> : world.scenes.map((scene) => (
            <article key={scene.id} className="menu-card">
              <p className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{scene.place}</p>
              <p className="mt-1 text-sm leading-6">{scene.text}</p>
            </article>
          ))}
        </div>
      </Screen>
    </div>
  )
}
