import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { isAiJobRunning, jobKey, runAiJob } from '../../engine/aiJobs.ts'
import { askJson, askLine, readJson } from '../../lib/ask.ts'
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
  residents: string[]
  visits: number
}

interface Scene {
  id: string
  place: string
  text: string
}

type Daypart = 'dawn' | 'day' | 'dusk' | 'night'
type Panel = 'date' | 'work' | 'add' | 'here' | 'write' | 'invent' | null

interface World {
  places: Place[]
  here: string
  shifts: Record<string, number>
  scenes: Scene[]
  daypart: Daypart
}

const KINDS = ['家', '街', '店', '公司', '公园', '学校', '车站', '海边', '医院', '别处']
const DAYPARTS: Array<{ id: Daypart; name: string }> = [
  { id: 'dawn', name: '清晨' },
  { id: 'day', name: '白天' },
  { id: 'dusk', name: '傍晚' },
  { id: 'night', name: '夜里' },
]
const JOBS = [
  { id: 'flower', name: '花店店员', kinds: ['店'], pay: 8, titles: ['学徒', '店员', '主理人'] },
  { id: 'cafe', name: '咖啡馆', kinds: ['店'], pay: 7, titles: ['兼职', '吧台', '店长'] },
  { id: 'edit', name: '夜班编辑', kinds: ['公司'], pay: 12, titles: ['实习', '编辑', '主笔'] },
  { id: 'free', name: '自由撰稿', kinds: ['家', '别处'], pay: 10, titles: ['投稿', '专栏', '连载'] },
  { id: 'tutor', name: '课后辅导', kinds: ['学校'], pay: 9, titles: ['助教', '讲师', '班主任'] },
  { id: 'station', name: '车站问询', kinds: ['车站'], pay: 6, titles: ['志愿者', '站务', '值班'] },
  { id: 'shore', name: '海边摊', kinds: ['海边'], pay: 8, titles: ['帮手', '摊主', '常客'] },
  { id: 'clinic', name: '导诊', kinds: ['医院'], pay: 11, titles: ['引导', '分诊', '值班'] },
  { id: 'park', name: '公园值守', kinds: ['公园'], pay: 6, titles: ['巡园', '园艺', '管理员'] },
  { id: 'street', name: '街角快送', kinds: ['街'], pay: 7, titles: ['新手', '熟路', '调度'] },
]

const EXPLORE: Record<string, string> = {
  家: '房间里的灯还是上次离开时的亮度。',
  街: '街角的风停了一下，又往前走。',
  店: '门铃响了一声，有人抬头看你。',
  公司: '走廊的灯一盏隔一盏。',
  公园: '长椅是干的，叶子不是。',
  学校: '走廊的广播刚停，操场还有人。',
  车站: '时刻表翻过一页，下一班还没来。',
  海边: '浪退下去的时候，沙子是凉的。',
  医院: '消毒水很淡，椅子是一排一排的。',
  别处: '这里还没有被人叫出名字。',
}

function freshWorld(): World {
  return {
    here: 'home',
    shifts: {},
    scenes: [],
    daypart: 'day',
    places: [
      { id: 'home', name: '家', kind: '家', note: '自己的房间', x: 22, y: 72, residents: [], visits: 1 },
      { id: 'street', name: '街角', kind: '街', note: '风会停一下', x: 48, y: 46, residents: [], visits: 0 },
      { id: 'cafe', name: '咖啡馆', kind: '店', note: '靠窗的位子', x: 74, y: 28, residents: [], visits: 0 },
      { id: 'office', name: '公司', kind: '公司', note: '夜灯还亮着', x: 26, y: 24, residents: [], visits: 0 },
      { id: 'park', name: '公园', kind: '公园', note: '一张长椅', x: 70, y: 70, residents: [], visits: 0 },
    ],
  }
}

function normalize(saved: Partial<World> | null | undefined): World {
  const base = saved?.places?.length ? saved : freshWorld()
  const places = (base.places ?? []).map((place) => ({
    id: place.id,
    name: place.name,
    kind: KINDS.includes(place.kind) ? place.kind : '别处',
    note: place.note || '',
    x: place.x,
    y: place.y,
    residents: Array.isArray(place.residents) ? place.residents : [],
    visits: typeof place.visits === 'number' ? place.visits : 0,
  }))
  const fallback = places[0]?.id ?? 'home'
  const daypart = DAYPARTS.some((item) => item.id === base.daypart) ? (base.daypart as Daypart) : 'day'
  return {
    places: places.length ? places : freshWorld().places,
    here: places.some((item) => item.id === base.here) ? String(base.here) : fallback,
    shifts: base.shifts ?? {},
    scenes: Array.isArray(base.scenes) ? base.scenes : [],
    daypart,
  }
}

function titleOf(shifts: number, titles: string[]): string {
  if (shifts >= 8) return titles[2] ?? titles[0] ?? ''
  if (shifts >= 3) return titles[1] ?? titles[0] ?? ''
  return titles[0] ?? ''
}

function dayName(id: Daypart): string {
  return DAYPARTS.find((item) => item.id === id)?.name ?? '白天'
}

function usePhone() {
  const identities = useMellow((state) => state.identities)
  const activeIdentityId = useMellow((state) => state.activeIdentityId)
  return identities.find((item) => item.id === activeIdentityId) ?? null
}

function textOf(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function MapApp(props: { onBack: () => void }) {
  const phone = usePhone()
  const dataRevision = useMellow((state) => state.dataRevision)
  const [world, setWorld] = useState<World | null>(null)
  const [chars, setChars] = useState<Character[]>([])
  const [panel, setPanel] = useState<Panel>(null)
  const [dateId, setDateId] = useState('')
  const [kind, setKind] = useState('街')
  const [placeName, setPlaceName] = useState('')
  const [placeNote, setPlaceNote] = useState('')
  const [editName, setEditName] = useState('')
  const [editNote, setEditNote] = useState('')
  const [moment, setMoment] = useState('')
  const [idea, setIdea] = useState('')
  const [coins, setCoins] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const mapRef = useRef<HTMLDivElement | null>(null)
  const pinDrag = useRef<{ id: string; moved: boolean } | null>(null)
  const ignoreClick = useRef(false)

  useEffect(() => {
    if (!phone) return
    let stop = false
    void storage.getBag<World>(phone.namespace, 'map_world').then((saved) => {
      if (stop) return
      const next = normalize(saved)
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
  const namespace = phone.namespace
  const here = world.places.find((item) => item.id === world.here) ?? world.places[0]
  if (!here) return null
  const peopleHere = chars.filter((person) => here.residents.includes(person.id))
  const sceneBusy = world.scenes.some((item) => isAiJobRunning(jobKey(namespace, 'map', `scene-${item.id}`)))
  const inventBusy = isAiJobRunning(jobKey(namespace, 'map', 'invent'))

  const persist = (next: World) => {
    setWorld(next)
    void storage.setBag(namespace, 'map_world', next)
  }

  const patch = (recipe: (current: World) => World) => {
    setWorld((current) => {
      if (!current) return current
      const next = recipe(normalize(current))
      void storage.setBag(namespace, 'map_world', next)
      return next
    })
  }

  const goTo = (id: string) => {
    patch((current) => {
      if (current.here === id) return current
      return {
        ...current,
        here: id,
        places: current.places.map((place) => (place.id === id ? { ...place, visits: place.visits + 1 } : place)),
      }
    })
    const place = world.places.find((item) => item.id === id)
    if (place) {
      setEditName(place.name)
      setEditNote(place.note)
      setKind(place.kind)
    }
    setPanel('here')
  }

  const replaceScene = async (sceneId: string, text: string) => {
    const saved = normalize(await storage.getBag<World>(namespace, 'map_world'))
    const next = {
      ...saved,
      scenes: saved.scenes.map((item) => (item.id === sceneId ? { ...item, text } : item)),
    }
    await storage.setBag(namespace, 'map_world', next)
    setWorld(next)
  }

  const explore = () => {
    const local = `${dayName(world.daypart)}。${EXPLORE[here.kind] ?? EXPLORE['别处']} ${here.note}`
    const id = uid('scene')
    const next = { ...world, scenes: [{ id, place: here.name, text: local }, ...world.scenes].slice(0, 24) }
    setWorld(next)
    const placeNameNow = here.name
    const placeKind = here.kind
    const placeNoteNow = here.note
    const when = dayName(world.daypart)
    const withWho = peopleHere.map((person) => person.name).join('、')
    void storage.setBag(namespace, 'map_world', next).then(() => {
      runAiJob(jobKey(namespace, 'map', `scene-${id}`), async () => {
        const text = await askLine(
          '用两三句中文写一段当下的场景，像小说，不要列表，不要解释。',
          `时间：${when}。地点：${placeNameNow}，${placeKind}。备注：${placeNoteNow}${withWho ? `。在场：${withWho}` : ''}`,
          220,
        )
        await replaceScene(id, text.slice(0, 280))
      })
    })
  }

  const date = () => {
    const person = chars.find((item) => item.id === dateId)
    if (!person) return
    const local = `${dayName(world.daypart)}，你和${person.name}在${here.name}坐了一会儿。${here.note}`
    const id = uid('scene')
    const next = { ...world, scenes: [{ id, place: here.name, text: local }, ...world.scenes].slice(0, 24) }
    setWorld(next)
    setPanel(null)
    const personName = person.name
    const placeNameNow = here.name
    const placeNoteNow = here.note
    const when = dayName(world.daypart)
    void storage.setBag(namespace, 'map_world', next).then(() => {
      runAiJob(jobKey(namespace, 'map', `scene-${id}`), async () => {
        const text = await askLine(
          `用两三句中文写一段见面。你是旁白，人物是玩家和${personName}。不要替玩家做决定，不要列表。`,
          `时间：${when}。地点：${placeNameNow}。${placeNoteNow}`,
          240,
        )
        await replaceScene(id, text.slice(0, 320))
      })
    })
  }

  const work = async (jobId: string) => {
    const job = JOBS.find((item) => item.id === jobId)
    if (!job) return
    const shifts = (world.shifts[jobId] ?? 0) + 1
    const balance = await addCoins(namespace, job.pay)
    setCoins(balance)
    const role = titleOf(shifts, job.titles)
    persist({
      ...world,
      shifts: { ...world.shifts, [jobId]: shifts },
      scenes: [{ id: uid('scene'), place: here.name, text: `${dayName(world.daypart)}这一班结束了。口袋里多了 ${job.pay} 枚，现在是${job.name} · ${role}。` }, ...world.scenes].slice(0, 24),
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
      y: 16 + Math.round(Math.random() * 68),
      residents: [],
      visits: 1,
    }
    persist({ ...world, places: [...world.places, place], here: place.id })
    setPlaceName('')
    setPlaceNote('')
    setEditName(place.name)
    setEditNote(place.note)
    setPanel('here')
    setNote(`「${place.name}」已经标在地图上`)
  }

  const saveHere = () => {
    const name = editName.trim()
    if (!name) return
    patch((current) => ({
      ...current,
      places: current.places.map((place) => (place.id === here.id ? { ...place, name, kind, note: editNote.trim() || place.note } : place)),
    }))
    setNote('这个地方改好了')
  }

  const removeHere = () => {
    if (world.places.length <= 1) {
      setNote('至少留一个地方')
      return
    }
    const rest = world.places.filter((place) => place.id !== here.id)
    const nextHere = rest[0]
    if (!nextHere) return
    persist({ ...world, places: rest, here: nextHere.id })
    setPanel(null)
    setNote(`「${here.name}」从地图上拿掉了`)
  }

  const toggleResident = (charId: string) => {
    const on = here.residents.includes(charId)
    patch((current) => ({
      ...current,
      places: current.places.map((place) => {
        const residents = place.residents.filter((id) => id !== charId)
        if (!on && place.id === here.id) residents.push(charId)
        return { ...place, residents }
      }),
    }))
  }

  const writeMoment = (expand: boolean) => {
    const text = moment.trim()
    if (!text) return
    const id = uid('scene')
    const next = { ...world, scenes: [{ id, place: here.name, text }, ...world.scenes].slice(0, 24) }
    setWorld(next)
    setMoment('')
    setPanel(null)
    if (!expand) {
      void storage.setBag(namespace, 'map_world', next)
      setNote('记在这里了')
      return
    }
    const placeNameNow = here.name
    const when = dayName(world.daypart)
    void storage.setBag(namespace, 'map_world', next).then(() => {
      runAiJob(jobKey(namespace, 'map', `scene-${id}`), async () => {
        const line = await askLine('把玩家写的这一下扩成两三句场景，保留原意，不要替玩家做决定，不要列表。', `时间：${when}。地点：${placeNameNow}。玩家写的：${text}`, 240)
        await replaceScene(id, line.slice(0, 320))
      })
    })
    setNote('正在把这一下写成场景…')
  }

  const invent = () => {
    const text = idea.trim()
    if (text.length < 2 || inventBusy) return
    setNote('正在按你的描述找一个地方…')
    runAiJob(jobKey(namespace, 'map', 'invent'), async () => {
      try {
        const raw = await askJson(
          '根据玩家的一句话设计一个生活地图上的地点。kind 只能是：家、街、店、公司、公园、学校、车站、海边、医院、别处。只返回 JSON：{"name":"","kind":"","note":"一句氛围"}',
          text,
          400,
          60_000,
        )
        const parsed = readJson(raw)
        const row = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
        const name = textOf(row.name) || text.slice(0, 12)
        const nextKind = KINDS.includes(textOf(row.kind)) ? textOf(row.kind) : '别处'
        const place: Place = {
          id: uid('place'),
          name,
          kind: nextKind,
          note: textOf(row.note) || '刚被叫出名字',
          x: 18 + Math.round(Math.random() * 64),
          y: 16 + Math.round(Math.random() * 68),
          residents: [],
          visits: 1,
        }
        const saved = normalize(await storage.getBag<World>(namespace, 'map_world'))
        const next = { ...saved, places: [...saved.places, place], here: place.id }
        await storage.setBag(namespace, 'map_world', next)
        setWorld(next)
        setIdea('')
        setEditName(place.name)
        setEditNote(place.note)
        setKind(place.kind)
        setPanel('here')
        setNote(`「${place.name}」已经出现在地图上`)
      } catch (reason) {
        setNote(reason instanceof Error ? reason.message : '这个地方没生出来')
      }
    })
  }

  const onPinDown = (event: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    ignoreClick.current = false
    pinDrag.current = { id, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPinMove = (event: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    const drag = pinDrag.current
    if (!drag || drag.id !== id) return
    const rect = mapRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    const x = Math.min(92, Math.max(8, ((event.clientX - rect.left) / rect.width) * 100))
    const y = Math.min(88, Math.max(12, ((event.clientY - rect.top) / rect.height) * 100))
    const place = world.places.find((item) => item.id === id)
    if (!place) return
    if (Math.abs(x - place.x) + Math.abs(y - place.y) > 1.2) drag.moved = true
    if (!drag.moved) return
    patch((current) => ({
      ...current,
      places: current.places.map((item) => (item.id === id ? { ...item, x: Math.round(x), y: Math.round(y) } : item)),
    }))
  }

  const onPinUp = (id: string) => {
    if (pinDrag.current?.id === id && pinDrag.current.moved) ignoreClick.current = true
    pinDrag.current = null
  }

  const jobsHere = JOBS.filter((job) => job.kinds.includes(here.kind))
  const openHere = () => {
    setEditName(here.name)
    setEditNote(here.note)
    setKind(here.kind)
    setPanel(panel === 'here' ? null : 'here')
  }

  return (
    <div className="sms-shell h-full min-h-0" style={candyStyle('#9ED9C4', '#F8E6C0', '#F8D0DC')}>
      <Screen title="地图" subtitle={`${here.name} · ${dayName(world.daypart)} · 来过 ${here.visits} 次`} onBack={props.onBack}>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {DAYPARTS.map((item) => (
            <button key={item.id} type="button" className="chip" style={world.daypart === item.id ? { background: '#F8E6C0' } : undefined} onClick={() => persist({ ...world, daypart: item.id })}>{item.name}</button>
          ))}
        </div>
        <div ref={mapRef} className="relative h-[300px] overflow-hidden rounded-[28px] shadow-[0_12px_24px_rgba(120,80,100,0.08)]" style={{ background: 'radial-gradient(circle at 20% 30%, #d5f0e4, transparent 42%), radial-gradient(circle at 70% 20%, #f8e6c0, transparent 36%), radial-gradient(circle at 60% 80%, #f8d0dc, transparent 40%), #f7f1ea', touchAction: 'none' }}>
          <span className="absolute left-[8%] top-[48%] h-3 w-[84%] rounded-full bg-white/70" />
          <span className="absolute left-[46%] top-[8%] h-[84%] w-3 rounded-full bg-white/60" />
          <span className="absolute left-[18%] top-[22%] h-2 w-[46%] rotate-[-18deg] rounded-full bg-white/50" />
          {world.places.map((place) => (
            <button
              key={place.id}
              type="button"
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-2.5 py-1 text-xs shadow-[0_6px_14px_rgba(120,80,100,0.12)]"
              style={{ left: `${place.x}%`, top: `${place.y}%`, background: place.id === here.id ? '#F3A8BA' : 'rgba(255,255,255,0.92)', touchAction: 'none' }}
              onPointerDown={(event) => onPinDown(event, place.id)}
              onPointerMove={(event) => onPinMove(event, place.id)}
              onPointerUp={() => onPinUp(place.id)}
              onPointerCancel={() => onPinUp(place.id)}
              onClick={() => {
                if (ignoreClick.current) {
                  ignoreClick.current = false
                  return
                }
                goTo(place.id)
              }}
            >
              {place.name}
              {place.residents.length ? ` · ${place.residents.length}` : ''}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>点地点过去，按住可以拖位置。{peopleHere.length ? `这里有 ${peopleHere.map((person) => person.name).join('、')}` : '这里还没有人长住'}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button type="button" className="chip chip-mint" onClick={explore}>逛一逛</button>
          <button type="button" className="chip chip-pink" onClick={() => setPanel(panel === 'date' ? null : 'date')}>约人</button>
          <button type="button" className="chip chip-butter" onClick={() => setPanel(panel === 'work' ? null : 'work')}>上班</button>
          <button type="button" className="chip" onClick={openHere}>这个地方</button>
          <button type="button" className="chip" onClick={() => setPanel(panel === 'write' ? null : 'write')}>写一笔</button>
          <button type="button" className="chip" onClick={() => setPanel(panel === 'add' ? null : 'add')}>标一个地方</button>
          <button type="button" className="chip chip-lilac" onClick={() => setPanel(panel === 'invent' ? null : 'invent')}>AI 生一个地方</button>
        </div>
        {note ? <PillNote tone="mint" inline>{note}</PillNote> : null}
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
            {jobsHere.length === 0 ? <PillNote tone="butter" compact>这里暂时没有班可上。换一种地方，或改这个地点的类型。</PillNote> : jobsHere.map((job) => {
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
        {panel === 'here' ? (
          <div className="menu-card mt-3 space-y-2">
            <input value={editName} onChange={(event) => setEditName(event.target.value)} placeholder="地方的名字" className="soft-input" />
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map((item) => (
                <button key={item} type="button" className="chip" style={kind === item ? { background: '#D5F0E4' } : undefined} onClick={() => setKind(item)}>{item}</button>
              ))}
            </div>
            <input value={editNote} onChange={(event) => setEditNote(event.target.value)} placeholder="一句备注" className="soft-input" />
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className="chip chip-solid" disabled={!editName.trim()} onClick={saveHere}>保存修改</button>
              <button type="button" className="chip" onClick={removeHere}>从地图拿掉</button>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>把谁放在这里长住。一个人只会待在一个地方。</p>
            <div className="flex flex-wrap gap-1.5">
              {chars.map((person) => (
                <button key={person.id} type="button" className="chip" style={here.residents.includes(person.id) ? { background: '#F8D0DC' } : undefined} onClick={() => toggleResident(person.id)}>{person.name}</button>
              ))}
            </div>
            {chars.length === 0 ? <PillNote tone="pink" compact>还没有角色可以安放</PillNote> : null}
          </div>
        ) : null}
        {panel === 'write' ? (
          <div className="menu-card mt-3 space-y-2">
            <textarea value={moment} rows={4} onChange={(event) => setMoment(event.target.value)} placeholder={`此刻在${here.name}发生了什么`} className="soft-input resize-none leading-6" />
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className="chip chip-solid" disabled={!moment.trim()} onClick={() => writeMoment(false)}>就这样记下</button>
              <button type="button" className="chip chip-lilac" disabled={!moment.trim()} onClick={() => writeMoment(true)}>让 AI 写成场景</button>
            </div>
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
        {panel === 'invent' ? (
          <div className="menu-card mt-3 space-y-2">
            <textarea value={idea} rows={3} onChange={(event) => setIdea(event.target.value)} placeholder="比如：江边一家只在夜里开门的唱片店" className="soft-input resize-none leading-6" />
            <button type="button" className="chip chip-solid" disabled={inventBusy || idea.trim().length < 2} onClick={invent}>{inventBusy ? '正在找…' : '生成并标上'}</button>
          </div>
        ) : null}
        <div className="mt-4">
          <p className="mb-2 text-xs" style={{ color: 'var(--m-text-secondary)' }}>全部地点</p>
          <div className="flex flex-wrap gap-1.5">
            {world.places.map((place) => (
              <button key={place.id} type="button" className="chip" style={place.id === here.id ? { background: '#F3A8BA' } : undefined} onClick={() => goTo(place.id)}>
                {place.name}
                <span className="ml-1 text-[10px]" style={{ color: 'var(--m-text-secondary)' }}>{place.visits}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: 'var(--m-text-secondary)' }}>脚印</p>
            {world.scenes.length > 0 ? <button type="button" className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }} onClick={() => persist({ ...world, scenes: [] })}>清空</button> : null}
          </div>
          {sceneBusy || inventBusy ? <PillNote tone="lilac" compact>{inventBusy ? '正在生一个地方…' : '正在写场景…'}</PillNote> : null}
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
