import { Camera, ChevronLeft, ChevronRight, Ellipsis, Plus, Settings2 } from 'lucide-react'
import { deleteCharacterConfirmText } from '../../domain/characterCleanup.ts'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { isAiJobRunning, jobKey, runAiJob } from '../../engine/aiJobs.ts'
import { generateMomentsFeed, generateNearbyPeople } from '../../lib/socialAi.ts'
import { useMellow } from '../../store/useMellow.ts'
import { nameLetter } from '../../lib/pinyin.ts'
import { initialOf } from '../../lib/format.ts'
import { storage } from '../../storage/StorageService.ts'
import type { Character, Chat, ContactFolder } from '../../types/index.ts'
import { PillNote } from '../ui/primitives.tsx'
import { chatTitle } from '../../lib/chats.ts'
import { uid } from '../../lib/id.ts'

export interface Profile {
  nickname: string
  signature: string
  gender: string
  region: string
  birthday: string
  avatar?: string
  cover?: string
}

export interface Moment {
  id: string
  author: string
  text: string
  at: number
  mine?: boolean
  image?: string
}

export interface NearPerson {
  name: string
  gender: string
  age: string
  city: string
  signature: string
  bio: string
  tags: string[]
}

function when(at: number): string {
  const diff = Date.now() - at
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return new Date(at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatOnline(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  const hours = Math.floor(minutes / 60)
  if (hours <= 0) return `${minutes} 分钟`
  return `${hours} 小时 ${minutes % 60} 分`
}

function pickImage(limit: number, onData: (value: string) => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file || file.size > limit) return
    const reader = new FileReader()
    reader.onload = () => onData(String(reader.result ?? ''))
    reader.readAsDataURL(file)
  }
  input.click()
}

function Face(props: { value: string; className: string }) {
  if (props.value.startsWith('data:')) return <img src={props.value} alt="" className={props.className} />
  return <span className={`grid place-items-center ${props.className}`} style={{ background: 'var(--m-secondary)' }}>{props.value || '·'}</span>
}

export function FeedHub(props: { onOpen: (page: 'moments' | 'nearby' | 'games') => void }) {
  const rows: Array<{ id: 'moments' | 'nearby' | 'games'; title: string; hint: string; tint: string }> = [
    { id: 'moments', title: '朋友圈', hint: '看看别人，也发一条', tint: 'var(--m-primary)' },
    { id: 'nearby', title: '附近的人', hint: '每次走进去，都是新的几位', tint: 'var(--m-secondary)' },
    { id: 'games', title: '游戏', hint: '自己经营，和好友比成绩', tint: '#C9B6E8' },
  ]
  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <button key={row.id} type="button" className="flex w-full items-center gap-3 rounded-[24px] px-3.5 py-3.5 text-left shadow-[0_10px_20px_rgba(120,80,100,0.06)]" style={{ background: `color-mix(in srgb, ${row.tint} 55%, white)` }} onClick={() => props.onOpen(row.id)}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-sm" style={{ background: row.tint }}>{row.title.slice(0, 1)}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm">{row.title}</span>
            <span className="block truncate text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{row.hint}</span>
          </span>
          <ChevronRight size={16} />
        </button>
      ))}
    </div>
  )
}

export function MomentsPage(props: {
  namespace: string
  profile: Profile
  avatar: string
  chars: Character[]
  moments: Moment[]
  onPost: (moment: Moment) => Promise<void>
  onBack: () => void
}) {
  const [writing, setWriting] = useState(false)
  const [text, setText] = useState('')
  const [image, setImage] = useState('')
  const [others, setOthers] = useState<Moment[]>([])
  const [note, setNote] = useState('')
  const dataRevision = useMellow((state) => state.dataRevision)
  const key = `${props.namespace}:${props.chars.map((item) => item.id).join(',')}`
  const momentsBusy = isAiJobRunning(jobKey(props.namespace, 'moments'))
  useEffect(() => {
    let alive = true
    void storage.getBag<{ at: number; posts: Moment[] }>(props.namespace, 'circle-feed').then(async (cached) => {
      if (!alive) return
      if (cached?.posts?.length) setOthers(cached.posts)
      if (cached && Date.now() - cached.at < 6 * 3_600_000 && cached.posts.length > 0) return
      const names = props.chars.map((item) => item.remark || item.name).slice(0, 8).join('、') || '没有旧熟人'
      runAiJob(jobKey(props.namespace, 'moments'), async () => {
        try {
          await generateMomentsFeed(props.namespace, names)
        } catch (error) {
          await storage.setBag(props.namespace, 'circle-feed_error', error instanceof Error ? error.message : '别人的动态没加载出来')
        }
      })
    })
    void storage.getBag<string>(props.namespace, 'circle-feed_error').then((message) => {
      if (alive && message) {
        setNote(message)
        void storage.setBag(props.namespace, 'circle-feed_error', '')
      }
    })
    return () => {
      alive = false
    }
  }, [key, props.namespace, props.chars, dataRevision])
  const mineAvatar = props.profile.avatar || props.avatar
  const feed = [...props.moments, ...others].sort((a, b) => b.at - a.at)
  const publish = async () => {
    const body = text.trim()
    if (!body) return
    await props.onPost({
      id: uid(),
      author: props.profile.nickname || '我',
      text: body,
      at: Date.now(),
      mine: true,
      image: image || undefined,
    })
    setText('')
    setImage('')
    setWriting(false)
  }
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[var(--m-background)]">
      <header className="flex items-center gap-2 px-3 pb-2 pt-12">
        <button type="button" aria-label="返回" className="grid h-9 w-9 place-items-center rounded-full bg-white/80" onClick={props.onBack}><ChevronLeft size={18} /></button>
        <p className="min-w-0 flex-1 text-sm">朋友圈</p>
        <button type="button" aria-label="发表" className="grid h-9 w-9 place-items-center rounded-full bg-white/80" onClick={() => setWriting(true)}><Camera size={16} /></button>
      </header>
      <div className="scroll min-h-0 flex-1 pb-16">
        <div className="relative h-40" style={{ background: props.profile.cover ? `center/cover url(${props.profile.cover})` : 'linear-gradient(145deg, var(--m-primary), var(--m-secondary))' }}>
          <div className="absolute bottom-3 right-4 flex items-end gap-3 text-white">
            <p className="pb-2 text-sm drop-shadow">{props.profile.nickname || '我'}</p>
            <Face value={mineAvatar.startsWith('data:') ? mineAvatar : initialOf(props.profile.nickname || '我')} className="h-14 w-14 overflow-hidden rounded-xl text-lg" />
          </div>
        </div>
        {momentsBusy ? <div className="px-4 pt-3"><PillNote tone="lilac" compact>正在写别人的动态</PillNote></div> : null}
        {note ? <div className="px-4 pt-3"><PillNote tone="butter" compact>{note}</PillNote></div> : null}
        <div className="mt-3 divide-y divide-black/5">
          {feed.map((moment) => (
            <article key={moment.id} className="flex gap-3 px-4 py-3">
              <Face value={moment.mine ? (mineAvatar.startsWith('data:') ? mineAvatar : initialOf(moment.author)) : initialOf(moment.author)} className="h-10 w-10 shrink-0 overflow-hidden rounded-lg text-sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm" style={{ color: '#3d6b8a' }}>{moment.author}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{moment.text}</p>
                {moment.image ? <img src={moment.image} alt="" className="mt-2 max-h-48 rounded-xl object-cover" /> : null}
                <p className="mt-1 text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{when(moment.at)}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
      {writing ? (
        <div className="absolute inset-0 z-10 flex flex-col bg-[var(--m-background)]">
          <header className="flex items-center justify-between px-4 pb-2 pt-12">
            <button type="button" className="chip" onClick={() => setWriting(false)}>取消</button>
            <button type="button" className="rounded-full bg-[var(--m-primary)] px-3 py-1 text-sm" onClick={() => void publish()}>发表</button>
          </header>
          <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="这一刻的想法" className="min-h-32 w-full flex-1 resize-none bg-transparent px-4 text-sm leading-6 outline-none" />
          <div className="px-4 pb-16">
            <button type="button" className="rounded-2xl bg-white px-3 py-2 text-xs" onClick={() => pickImage(800_000, setImage)}>{image ? '换一张图' : '加一张图'}</button>
            {image ? <img src={image} alt="" className="mt-2 h-24 rounded-xl object-cover" /> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

type NearbyDrag = { x: number; y: number; axis: 'h' | 'v' | null }

export function NearbyPage(props: {
  visit: number
  namespace: string
  onLike: (person: NearPerson) => Promise<void>
  onChat: (person: NearPerson) => Promise<void>
  onBack: () => void
}) {
  const dataRevision = useMellow((state) => state.dataRevision)
  const [people, setPeople] = useState<NearPerson[]>([])
  const [index, setIndex] = useState(0)
  const [dx, setDx] = useState(0)
  const [note, setNote] = useState('正在往这边看')
  const [liked, setLiked] = useState('')
  const [dragging, setDragging] = useState(false)
  const drag = useRef<NearbyDrag | null>(null)
  const nearbyBusy = isAiJobRunning(jobKey(props.namespace, 'nearby', String(props.visit)))
  useEffect(() => {
    let alive = true
    void storage.getBag<{ visit: number; people: NearPerson[] }>(props.namespace, 'nearby_people').then((cached) => {
      if (!alive) return
      if (cached?.visit === props.visit && cached.people.length >= 6) {
        setPeople(cached.people)
        setIndex(0)
        setNote('')
        return
      }
      runAiJob(jobKey(props.namespace, 'nearby', String(props.visit)), async () => {
        try {
          await generateNearbyPeople(props.namespace, props.visit)
        } catch (error) {
          await storage.setBag(props.namespace, 'nearby_error', error instanceof Error ? error.message : '附近没有加载出来')
        }
      })
    })
    void storage.getBag<string>(props.namespace, 'nearby_error').then((message) => {
      if (alive && message) {
        setNote(message)
        void storage.setBag(props.namespace, 'nearby_error', '')
      }
    })
    return () => {
      alive = false
    }
  }, [props.visit, props.namespace, dataRevision])

  useEffect(() => {
    void storage.getBag<{ visit: number; people: NearPerson[] }>(props.namespace, 'nearby_people').then((cached) => {
      if (cached?.visit === props.visit && cached.people.length >= 6) {
        setPeople(cached.people)
        setNote('')
      }
    })
  }, [props.visit, props.namespace, dataRevision])

  const person = people[index]
  const finish = (dir: 'left' | 'right') => {
    if (!person) return
    if (dir === 'right') {
      setLiked(`喜欢了 ${person.name}，已加入联系人`)
      void props.onLike(person)
    }
    setDx(dir === 'right' ? 360 : -360)
    window.setTimeout(() => {
      setDx(0)
      setIndex((value) => value + 1)
    }, 180)
  }

  const resetDrag = () => {
    drag.current = null
    setDragging(false)
    setDx(0)
  }

  const onDown = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation()
    drag.current = { x: event.clientX, y: event.clientY, axis: null }
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    const deltaX = event.clientX - drag.current.x
    const deltaY = event.clientY - drag.current.y
    if (!drag.current.axis) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return
      drag.current.axis = Math.abs(deltaX) >= Math.abs(deltaY) ? 'h' : 'v'
    }
    if (drag.current.axis !== 'h') return
    event.preventDefault()
    setDx(Math.max(-140, Math.min(140, deltaX)))
  }

  const onEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !person) {
      resetDrag()
      return
    }
    const delta = event.clientX - drag.current.x
    const axis = drag.current.axis
    resetDrag()
    if (axis !== 'h') return
    if (delta > 88) finish('right')
    else if (delta < -88) finish('left')
  }

  const swipeHint = dx > 36 ? '喜欢' : dx < -36 ? '跳过' : ''

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col bg-[var(--m-background)]"
      style={{ overscrollBehavior: 'contain', touchAction: 'pan-y' }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <header className="flex items-center gap-2 px-3 pb-2 pt-12">
        <button type="button" aria-label="返回" className="grid h-9 w-9 place-items-center rounded-full bg-white/80" onClick={props.onBack}><ChevronLeft size={18} /></button>
        <div className="min-w-0 flex-1">
          <p className="text-sm">附近的人</p>
          <p className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>左滑跳过，右滑喜欢；也可点下方按钮</p>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 pb-4">
        {person ? (
          <div
            className="nearby-card relative w-full max-w-sm rounded-[28px] bg-white p-5 text-left shadow-[0_16px_40px_rgba(90,70,80,0.08)]"
            style={{
              transform: `translateX(${dx}px) rotate(${dx / 20}deg)`,
              transition: dragging ? 'none' : 'transform 0.18s ease',
              touchAction: dragging ? 'none' : 'pan-y',
            }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onEnd}
            onPointerCancel={resetDrag}
          >
            {swipeHint ? (
              <span
                className="pointer-events-none absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  background: dx > 0 ? '#D5F0E4' : '#FBD5D5',
                  color: dx > 0 ? '#3d6b55' : '#9a4a4a',
                  opacity: Math.min(1, Math.abs(dx) / 88),
                }}
              >
                {swipeHint}
              </span>
            ) : null}
            <span className="grid h-16 w-16 place-items-center rounded-full text-xl" style={{ background: 'var(--m-primary)' }}>{initialOf(person.name)}</span>
            <p className="mt-4 text-2xl">{person.name}</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--m-text-secondary)' }}>{[person.gender, person.age, person.city].filter(Boolean).join(' · ')}</p>
            <p className="mt-3 text-sm">{person.signature || '刚出现在附近'}</p>
            <p className="mt-2 text-sm leading-6">{person.bio}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {person.tags.map((tag) => <span key={tag} className="rounded-full bg-black/5 px-2 py-0.5 text-[11px]">{tag}</span>)}
            </div>
          </div>
        ) : (
          <PillNote tone={people.length > 0 && index >= people.length ? 'mint' : 'lilac'}>{people.length > 0 && index >= people.length ? '这一带的人看完了' : nearbyBusy ? '正在往这边看' : note || '正在往这边看'}</PillNote>
        )}
      </div>
      {person ? (
        <div className="flex shrink-0 items-center justify-center gap-4 px-6 pb-14 pt-2">
          <button type="button" className="chip chip-danger min-w-[5.5rem] py-2.5 text-sm" onClick={() => finish('left')}>跳过</button>
          <button type="button" className="chip chip-sky min-w-[5.5rem] py-2.5 text-sm" onClick={() => void props.onChat(person)}>聊天</button>
          <button type="button" className="chip chip-mint min-w-[5.5rem] py-2.5 text-sm" onClick={() => finish('right')}>喜欢</button>
        </div>
      ) : null}
      {liked ? <p className="pointer-events-none absolute bottom-[5.5rem] left-0 right-0 text-center text-xs">{liked}</p> : null}
    </div>
  )
}

export function PeopleTab(props: {
  chars: Character[]
  chats: Chat[]
  folders: ContactFolder[]
  onlineMs: number
  nickname: string
  avatar: string
  onTalk: (char: Character) => void
  onOpenChat: (id: string) => void
  onChange: (folders: ContactFolder[]) => Promise<void>
  onDelete: (ids: string[]) => Promise<void>
  onGroup: (name: string, ids: string[]) => Promise<void>
  onSettings: (character: Character) => void
}) {
  const [plus, setPlus] = useState(false)
  const [panel, setPanel] = useState<'group' | 'folder' | 'batch' | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [groupName, setGroupName] = useState('新群')
  const [folderName, setFolderName] = useState('')
  const groups = props.chats.filter((chat) => chat.kind === 'group')
  const sorted = [...props.chars].sort((a, b) => (a.remark || a.name).localeCompare(b.remark || b.name, 'zh-CN'))
  const buckets = new Map<string, Character[]>()
  for (const char of sorted) {
    const letter = nameLetter(char.remark || char.name)
    buckets.set(letter, [...(buckets.get(letter) ?? []), char])
  }
  const letters = [...buckets.keys()].sort((a, b) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)))
  const toggle = (id: string) => setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  return (
    <div>
      <div className="relative flex items-center gap-3 rounded-[26px] bg-white/90 px-3 py-3 shadow-[0_12px_24px_rgba(243,168,186,0.16)]">
        <Face value={props.avatar || initialOf(props.nickname || '我')} className="h-12 w-12 overflow-hidden rounded-2xl text-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{props.nickname || '我'}</p>
          <p className="mt-0.5 text-xs">好友 {props.chars.length}</p>
          <p className="text-xs" style={{ color: 'var(--m-text-secondary)' }}>在线 {formatOnline(props.onlineMs)}</p>
        </div>
        <button type="button" aria-label="添加" className="grid h-9 w-9 place-items-center rounded-full" style={{ background: 'var(--m-primary)' }} onClick={() => setPlus((value) => !value)}>
          <Plus size={16} />
        </button>
        {plus ? (
          <div className="absolute right-3 top-14 z-10 w-36 overflow-hidden rounded-2xl bg-white py-1 shadow-[0_12px_30px_rgba(90,70,80,0.12)]">
            {([
              ['group', '建群'],
              ['folder', '管理分组'],
              ['batch', '批量操作'],
            ] as const).map(([id, label]) => (
              <button key={id} type="button" className="block w-full px-3 py-2 text-left text-sm" onClick={() => { setPanel(id); setPlus(false) }}>{label}</button>
            ))}
          </div>
        ) : null}
      </div>
      {panel === 'group' ? (
        <div className="mt-3 rounded-[22px] bg-white/80 p-3">
          <input value={groupName} onChange={(event) => setGroupName(event.target.value)} className="w-full rounded-full bg-white px-3 py-1.5 text-sm" />
          <p className="mt-2 text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>勾选至少两个人</p>
          <button type="button" className="chip chip-solid mt-2 w-full" onClick={() => { if (picked.length >= 2) void props.onGroup(groupName, picked) }}>建群</button>
        </div>
      ) : null}
      {panel === 'folder' ? (
        <div className="mt-3 rounded-[22px] bg-white/80 p-3">
          <div className="flex gap-2">
            <input value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="分组名" className="min-w-0 flex-1 rounded-full bg-white px-3 py-1.5 text-sm" />
            <button type="button" className="chip chip-pink" onClick={() => {
              if (!folderName.trim()) return
              void props.onChange([...props.folders, { id: uid(), name: folderName.trim(), charIds: picked }])
              setFolderName('')
            }}>建立</button>
          </div>
          {props.folders.map((folder) => (
            <div key={folder.id} className="mt-2 flex items-center justify-between text-sm">
              <span>{folder.name} · {folder.charIds.length} 人</span>
              <button type="button" className="chip chip-danger px-2.5 py-1 text-[11px]" onClick={() => void props.onChange(props.folders.filter((item) => item.id !== folder.id))}>移除</button>
            </div>
          ))}
        </div>
      ) : null}
      {panel === 'batch' && picked.length > 0 ? (
        <button
          type="button"
          className="chip chip-danger mt-3 w-full"
          onClick={() => {
            const names = picked.map((id) => props.chars.find((item) => item.id === id)?.remark || props.chars.find((item) => item.id === id)?.name || '角色')
            if (!window.confirm(deleteCharacterConfirmText(names))) return
            void props.onDelete(picked).then(() => setPicked([]))
          }}
        >
          删除 {picked.length} 人
        </button>
      ) : null}
      {groups.length > 0 ? (
        <div className="mt-4">
          <p className="px-1 text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>群聊</p>
          {groups.map((chat) => (
            <button key={chat.id} type="button" className="mt-1 flex w-full items-center gap-3 rounded-2xl px-1 py-2 text-left text-sm" onClick={() => props.onOpenChat(chat.id)}>{chatTitle(chat)}</button>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex">
        <div className="min-w-0 flex-1">
          {letters.map((letter) => (
            <section key={letter} id={`letter-${letter}`}>
              <p className="sticky top-0 w-fit rounded-full bg-[#F8D0DC] px-2 py-0.5 text-[11px]">{letter}</p>
              {(buckets.get(letter) ?? []).map((char, index) => (
                <div key={char.id} className="mt-1.5 flex items-center gap-2 rounded-[18px] px-2 py-1.5" style={{ background: ['#FFF6F8', '#F4FBF7', '#FFF8EC', '#F6F3FC'][index % 4] }}>
                  {panel === 'group' || panel === 'batch' || panel === 'folder' ? (
                    <input type="checkbox" checked={picked.includes(char.id)} onChange={() => toggle(char.id)} />
                  ) : null}
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => props.onTalk(char)}>
                    <Face value={char.avatar.startsWith('data:') ? char.avatar : initialOf(char.name)} className="h-9 w-9 overflow-hidden rounded-full text-xs" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{char.remark || char.name}</span>
                      {char.remark ? <span className="block truncate text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{char.name}</span> : null}
                    </span>
                  </button>
                  {!panel ? (
                    <button type="button" aria-label="角色设置" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/80" onClick={() => props.onSettings(char)}>
                      <Settings2 size={14} />
                    </button>
                  ) : null}
                </div>
              ))}
            </section>
          ))}
        </div>
        <div className="sticky top-2 flex h-fit flex-col items-center px-1 text-[10px]" style={{ color: 'var(--m-text-secondary)' }}>
          {letters.map((letter) => (
            <button key={letter} type="button" className="px-0.5 leading-4" onClick={() => document.getElementById(`letter-${letter}`)?.scrollIntoView({ block: 'start' })}>{letter}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function MeTab(props: {
  profile: Profile
  avatar: string
  moments: Moment[]
  chats: Chat[]
  onSave: (profile: Profile) => Promise<void>
  onOpenChat: (id: string) => void
  onOpen: (page: 'moments' | 'nearby') => void
}) {
  const [editing, setEditing] = useState(false)
  const [profile, setProfile] = useState(props.profile)
  const shown = props.profile.avatar || props.avatar
  const mine = props.moments.filter((item) => item.mine || item.author === props.profile.nickname)
  const unread = props.chats.filter((chat) => chat.unread > 0)
  if (editing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <button type="button" className="chip" onClick={() => setEditing(false)}>返回</button>
          <button type="button" className="chip chip-solid" onClick={() => void props.onSave(profile).then(() => setEditing(false))}>保存</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="chip chip-lilac" onClick={() => pickImage(1_200_000, (avatar) => setProfile({ ...profile, avatar }))}>更换头像</button>
          <button type="button" className="chip chip-sky" onClick={() => pickImage(1_200_000, (cover) => setProfile({ ...profile, cover }))}>更换主页背景</button>
        </div>
        <label className="block text-xs" style={{ color: 'var(--m-text-secondary)' }}>昵称<input value={profile.nickname} onChange={(event) => setProfile({ ...profile, nickname: event.target.value })} className="mt-1 w-full rounded-2xl bg-white px-3 py-2 text-sm" /></label>
        <label className="block text-xs" style={{ color: 'var(--m-text-secondary)' }}>签名<input value={profile.signature} onChange={(event) => setProfile({ ...profile, signature: event.target.value })} className="mt-1 w-full rounded-2xl bg-white px-3 py-2 text-sm" /></label>
        <div>
          <p className="text-xs" style={{ color: 'var(--m-text-secondary)' }}>性别</p>
          <div className="mt-1 flex gap-2">
            {['女', '男', '保密'].map((item) => (
              <button key={item} type="button" className="rounded-full px-3 py-1 text-xs" style={{ background: profile.gender === item ? 'var(--m-primary)' : 'white' }} onClick={() => setProfile({ ...profile, gender: item })}>{item}</button>
            ))}
          </div>
        </div>
        <label className="block text-xs" style={{ color: 'var(--m-text-secondary)' }}>生日<input value={profile.birthday} onChange={(event) => setProfile({ ...profile, birthday: event.target.value })} placeholder="2000-01-01" className="mt-1 w-full rounded-2xl bg-white px-3 py-2 text-sm" /></label>
        <label className="block text-xs" style={{ color: 'var(--m-text-secondary)' }}>地区<input value={profile.region} onChange={(event) => setProfile({ ...profile, region: event.target.value })} className="mt-1 w-full rounded-2xl bg-white px-3 py-2 text-sm" /></label>
      </div>
    )
  }
  return (
    <div>
      <div className="overflow-hidden rounded-[28px] bg-white/80">
        <div className="h-28" style={{ background: props.profile.cover ? `center/cover url(${props.profile.cover})` : 'linear-gradient(145deg, var(--m-primary), var(--m-secondary))' }} />
        <div className="flex items-start gap-3 px-4 pb-4">
          <Face value={shown || initialOf(props.profile.nickname || '我')} className="-mt-6 h-16 w-16 overflow-hidden rounded-2xl border-2 border-white text-lg" />
          <div className="min-w-0 flex-1 pt-2">
            <p className="truncate text-lg">{props.profile.nickname || '还没写名字'}</p>
            <p className="truncate text-xs" style={{ color: 'var(--m-text-secondary)' }}>{props.profile.signature || '写一条签名'}</p>
          </div>
          <button type="button" aria-label="编辑资料" className="mt-2 grid h-8 w-8 place-items-center rounded-full bg-black/5" onClick={() => { setProfile(props.profile); setEditing(true) }}>
            <Ellipsis size={16} />
          </button>
        </div>
        <div className="px-4 pb-4">{[props.profile.gender, props.profile.region, props.profile.birthday].filter(Boolean).join(' · ') ? <p className="text-xs" style={{ color: 'var(--m-text-secondary)' }}>{[props.profile.gender, props.profile.region, props.profile.birthday].filter(Boolean).join(' · ')}</p> : <PillNote tone="sky" compact>资料还空着</PillNote>}</div>
      </div>
      <div className="mt-3 space-y-2">
        <button type="button" className="flex w-full items-center rounded-[22px] bg-[#FFF1F5] px-4 py-3 text-left text-sm" onClick={() => unread[0] && props.onOpenChat(unread[0].id)}>
          <span className="mr-2 grid h-8 w-8 place-items-center rounded-xl bg-[#F3A8BA] text-xs">信</span>
          <span className="flex-1">消息</span>
          <span className="text-xs" style={{ color: 'var(--m-text-secondary)' }}>{unread.length > 0 ? `${unread.reduce((sum, chat) => sum + chat.unread, 0)} 条未读` : '没有新消息'}</span>
        </button>
        {unread.slice(0, 3).map((chat) => (
          <button key={chat.id} type="button" className="flex w-full items-center rounded-2xl bg-white/80 px-4 py-2 text-left text-xs" onClick={() => props.onOpenChat(chat.id)}>
            <span className="min-w-0 flex-1 truncate">{chatTitle(chat)}</span>
            <span>{chat.unread}</span>
          </button>
        ))}
        <button type="button" className="flex w-full items-center rounded-[22px] bg-[#F4FBF7] px-4 py-3 text-sm" onClick={() => props.onOpen('moments')}>
          <span className="mr-2 grid h-8 w-8 place-items-center rounded-xl bg-[#9ED9C4] text-xs">圈</span>
          <span className="flex-1 text-left">朋友圈</span>
          <ChevronRight size={14} />
        </button>
        <button type="button" className="flex w-full items-center rounded-[22px] bg-[#FFF8EC] px-4 py-3 text-sm" onClick={() => props.onOpen('nearby')}>
          <span className="mr-2 grid h-8 w-8 place-items-center rounded-xl bg-[#F0D48A] text-xs">近</span>
          <span className="flex-1 text-left">附近的人</span>
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="mt-4">
        <p className="text-xs" style={{ color: 'var(--m-text-secondary)' }}>我发出的</p>
        {mine.length === 0 ? <PillNote tone="lilac">还没有自己的动态。</PillNote> : mine.slice(0, 6).map((moment) => (
          <article key={moment.id} className="mt-2 rounded-2xl bg-white/75 px-3 py-2">
            <p className="text-sm leading-6">{moment.text}</p>
            <p className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{when(moment.at)}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
