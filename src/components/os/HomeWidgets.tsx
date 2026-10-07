import { Check, ImagePlus, Plus, Smile, X } from 'lucide-react'
import { useState } from 'react'
import { storage } from '../../storage/StorageService.ts'

const MOODS = [
  { face: '☺', label: '还不错', tint: '#F8E6C0' },
  { face: '♡', label: '心动', tint: '#F8D0DC' },
  { face: '☁', label: '有点累', tint: '#D7E7F8' },
  { face: '☼', label: '元气满满', tint: '#F8DCC8' },
  { face: '☾', label: '想安静', tint: '#E6DDF8' },
  { face: '♪', label: '轻飘飘', tint: '#D5F0E4' },
]

const WEEK = ['一', '二', '三', '四', '五', '六', '日']

type Todo = { id: string; text: string; done: boolean }

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function currentWeek() {
  const now = new Date()
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  return {
    today: dayKey(now),
    days: WEEK.map((_, offset) => dayKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + offset))),
  }
}

function useBag<T>(namespace: string, key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback)
  const [loaded, setLoaded] = useState('')
  if (loaded !== namespace) {
    setLoaded(namespace)
    void storage.getBag<T>(namespace, key).then((row) => setValue(row ?? fallback))
  }
  const save = (next: T) => {
    setValue(next)
    void storage.setBag(namespace, key, next)
  }
  return [value, save] as const
}

const shell = 'relative h-full min-h-0 overflow-hidden rounded-[26px] shadow-[0_8px_18px_rgba(90,70,80,0.06)]'

export function MemoWidget(props: { namespace: string; className?: string }) {
  const [memo, setMemo] = useBag(props.namespace, 'memo', '')
  const [editing, setEditing] = useState(false)
  return (
    <div className={`${shell} flex flex-col bg-[#FFF8E6] p-3 ${props.className ?? ''}`}>
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-[#F8E6C0] px-2 py-0.5 text-[10px] font-medium">便签</span>
        {editing ? (
          <button type="button" aria-label="写好了" className="grid h-5 w-5 place-items-center rounded-full bg-[#F3A8BA] text-white" onClick={() => setEditing(false)}>
            <Check size={11} strokeWidth={3} />
          </button>
        ) : (
          <span className="h-2 w-2 rounded-full bg-[#F3A8BA]" />
        )}
      </div>
      {editing ? (
        <textarea
          autoFocus
          value={memo}
          maxLength={80}
          onChange={(event) => setMemo(event.target.value)}
          onBlur={() => setEditing(false)}
          placeholder="写点今天想记住的"
          className="mt-1.5 min-h-0 w-full flex-1 resize-none bg-transparent text-[12px] leading-5 outline-none"
        />
      ) : (
        <button
          type="button"
          className="mt-1.5 flex min-h-0 flex-1 flex-col justify-start overflow-hidden text-left text-[12px] leading-5"
          style={{ color: memo ? 'var(--m-text)' : 'rgba(58,58,58,0.42)' }}
          onClick={() => setEditing(true)}
        >
          <span className="line-clamp-3 whitespace-pre-wrap">{memo || '点一下，写张小纸条'}</span>
        </button>
      )}
    </div>
  )
}

export function MoodWidget(props: { namespace: string; className?: string }) {
  const [today] = useState(() => currentWeek().today)
  const [row, setRow] = useBag<{ day: string; mood: number } | null>(props.namespace, 'mood', null)
  const index = row && row.day === today ? row.mood : -1
  const mood = index >= 0 ? MOODS[index % MOODS.length] : undefined
  return (
    <button
      type="button"
      className={`${shell} flex flex-col items-center justify-center gap-1 transition-transform active:scale-[0.97] ${props.className ?? ''}`}
      style={{ background: mood?.tint ?? '#FBF4EF' }}
      onClick={() => setRow({ day: today, mood: (index + 1) % MOODS.length })}
    >
      <span className="grid h-11 w-11 place-items-center rounded-full bg-white/85 text-xl shadow-sm">{mood?.face ?? <Smile size={20} className="opacity-50" />}</span>
      <span className="text-[11px] font-medium">{mood?.label ?? '今天心情'}</span>
      <span className="text-[9px]" style={{ color: 'rgba(58,58,58,0.45)' }}>{mood ? '点一下换' : '点一下选'}</span>
    </button>
  )
}

export function StampWidget(props: { namespace: string; className?: string }) {
  const [week] = useState(currentWeek)
  const [stamps, setStamps] = useBag<string[]>(props.namespace, 'stamps', [])
  const count = week.days.filter((day) => stamps.includes(day)).length
  return (
    <div className={`${shell} flex flex-col gap-3 bg-white/85 px-3 py-3 ${props.className ?? ''}`}>
      <div className="flex items-center gap-2">
        <span className="shrink-0 rounded-full bg-[#D5F0E4] px-2 py-0.5 text-[10px] font-medium">本周打卡</span>
        <span className="min-w-0 flex-1 truncate text-center text-[12px] font-semibold">{count === 0 ? '今天也来盖个章' : count === 7 ? '整周都没落下' : `已坚持 ${count} 天`}</span>
        <span className="shrink-0 text-[10px] tabular" style={{ color: 'rgba(58,58,58,0.5)' }}>{count}/7</span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {week.days.map((day, offset) => {
          const on = stamps.includes(day)
          const isToday = day === week.today
          return (
            <button
              key={day}
              type="button"
              aria-pressed={on}
              aria-label={`周${WEEK[offset]}打卡`}
              className="flex flex-col items-center gap-0.5"
              onClick={() => setStamps(on ? stamps.filter((item) => item !== day) : [...stamps.filter((item) => week.days.includes(item)), day])}
            >
              <span
                className="grid aspect-square w-full max-w-7 place-items-center rounded-full transition-colors"
                style={{ background: on ? '#9ED9C4' : '#F4F0EC', boxShadow: isToday ? '0 0 0 1.5px #F3A8BA' : 'none' }}
              >
                {on ? <Check size={12} strokeWidth={3} className="text-white" /> : null}
              </span>
              <span className="text-[9px]" style={{ color: isToday ? '#d0708a' : 'rgba(58,58,58,0.5)' }}>{WEEK[offset]}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function TodoWidget(props: { namespace: string; className?: string }) {
  const [items, setItems] = useBag<Todo[]>(props.namespace, 'todo', [])
  const [draft, setDraft] = useState('')
  const left = items.filter((item) => !item.done).length
  const add = () => {
    const text = draft.trim()
    if (!text || items.length >= 3) return
    setItems([...items, { id: crypto.randomUUID(), text, done: false }])
    setDraft('')
  }
  return (
    <div className={`${shell} flex flex-col bg-white/85 px-3.5 py-3 ${props.className ?? ''}`}>
      <Blossoms />
      <div className="relative flex items-center justify-between">
        <span className="text-[12px] font-semibold">今日待办</span>
        <span className="rounded-full bg-[#F8D0DC] px-2 py-0.5 text-[10px]">{items.length === 0 ? '空' : left === 0 ? '全部完成' : `剩 ${left}`}</span>
      </div>
      <ul className="relative mt-1.5 min-h-0 flex-1 space-y-1 overflow-hidden">
        {items.map((item) => (
          <li key={item.id} className="flex h-6 items-center gap-2 text-[12px]">
            <button
              type="button"
              aria-label={item.done ? '标记未完成' : '标记完成'}
              className="grid h-4 w-4 shrink-0 place-items-center rounded-full transition-colors"
              style={{ background: item.done ? '#F3A8BA' : 'white', boxShadow: item.done ? 'none' : 'inset 0 0 0 1.5px #F3A8BA' }}
              onClick={() => setItems(items.map((row) => (row.id === item.id ? { ...row, done: !row.done } : row)))}
            >
              {item.done ? <Check size={10} strokeWidth={3} className="text-white" /> : null}
            </button>
            <span className={item.done ? 'min-w-0 flex-1 truncate line-through opacity-45' : 'min-w-0 flex-1 truncate'}>{item.text}</span>
            <button type="button" aria-label="删掉" className="grid h-5 w-5 shrink-0 place-items-center rounded-full opacity-35" onClick={() => setItems(items.filter((row) => row.id !== item.id))}>
              <X size={11} />
            </button>
          </li>
        ))}
        {items.length < 3 ? (
          <li>
            <form
              className="flex h-6 items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                add()
              }}
            >
              <button type="submit" aria-label="加一条" className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#F8D0DC]">
                <Plus size={10} strokeWidth={3} />
              </button>
              <input value={draft} maxLength={24} onChange={(event) => setDraft(event.target.value)} placeholder="加一件小事" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-black/30" style={{ fontSize: 12 }} />
            </form>
          </li>
        ) : null}
      </ul>
    </div>
  )
}

function Flower(props: { size: number; color: string; className: string; rotate: number }) {
  return (
    <svg width={props.size} height={props.size} viewBox="0 0 40 40" className={props.className} style={{ transform: `rotate(${props.rotate}deg)` }} aria-hidden="true">
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse key={angle} cx="20" cy="10.5" rx="6.2" ry="9" fill={props.color} transform={`rotate(${angle} 20 20)`} />
      ))}
      <circle cx="20" cy="20" r="4.6" fill="#F8E6C0" />
    </svg>
  )
}

function Blossoms() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.22]">
      <Flower size={58} color="#F3A8BA" rotate={12} className="absolute -bottom-3 -right-2" />
      <Flower size={30} color="#C9B6E8" rotate={-18} className="absolute bottom-10 right-12" />
      <Flower size={20} color="#F3A8BA" rotate={30} className="absolute bottom-3 right-[4.6rem]" />
      <Flower size={16} color="#9ED9C4" rotate={0} className="absolute bottom-16 right-3" />
    </div>
  )
}

export function PhotoFrame(props: { image: string; wash: string; tilt?: number; className?: string; onPick: (image: string) => void }) {
  return (
    <label className={`${shell} block cursor-pointer ${props.className ?? ''}`} style={{ background: props.image ? '#fff' : props.wash }}>
      {props.image ? (
        <img src={props.image} alt="" className="h-full w-full object-cover" style={props.tilt ? { transform: `rotate(${props.tilt}deg) scale(1.15)` } : undefined} />
      ) : (
        <span className="flex h-full flex-col items-center justify-center gap-1.5 px-2 text-center">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white/80 shadow-sm">
            <ImagePlus size={16} className="opacity-60" />
          </span>
          <span className="text-[10px]" style={{ color: 'rgba(58,58,58,0.5)' }}>相框</span>
        </span>
      )}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file || file.size > 1_200_000) return
          const reader = new FileReader()
          reader.onload = () => props.onPick(String(reader.result ?? ''))
          reader.readAsDataURL(file)
        }}
      />
    </label>
  )
}
