import { Search } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { homePages, type PhoneApp } from '../../data/apps.ts'
import { rememberSearch } from '../../domain/glance.ts'
import { DEFAULT_DECORS } from '../../lib/defaults.ts'
import { storage } from '../../storage/StorageService.ts'
import { formatClock } from '../../lib/format.ts'
import { useMellow } from '../../store/useMellow.ts'
import type { DecorCard } from '../../types/index.ts'
import { AppGlyph } from './AppGlyph.tsx'
import { MemoWidget, MoodWidget, PhotoFrame, StampWidget, TodoWidget } from './HomeWidgets.tsx'
import { MusicPlayer, PlayerSheet } from './MusicPlayer.tsx'
import { Wallpaper } from './LockScreen.tsx'
import { SecretLock } from './SecretLock.tsx'
import { SimBrowser } from './SimBrowser.tsx'

export function HomeScreen() {
  const openApp = useMellow((state) => state.openApp)
  const sessionApps = useMellow((state) => state.sessionApps)
  const grantApp = useMellow((state) => state.grantApp)
  const requestOpenChat = useMellow((state) => state.requestOpenChat)
  const touchData = useMellow((state) => state.touchData)
  const inbox = useMellow((state) => state.inbox)
  const identities = useMellow((state) => state.identities)
  const activeIdentityId = useMellow((state) => state.activeIdentityId)
  const identitySheet = useMellow((state) => state.identitySheet)
  const setIdentitySheet = useMellow((state) => state.setIdentitySheet)
  const switchIdentity = useMellow((state) => state.switchIdentity)
  const settings = useMellow((state) => state.settings)
  const patchSettings = useMellow((state) => state.patchSettings)
  const phone = identities.find((item) => item.id === activeIdentityId)
  const unread = inbox.reduce((sum, chat) => sum + chat.unread, 0)
  const { page2, page3 } = homePages(settings.installedApps)
  const home = settings.home
  const dock = page2.filter((app) => app.dock).concat(page3.filter((app) => app.dock))
  const pageCount = page3.length > 0 ? 3 : 2
  const pagerRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ x: number; y: number; id: number; active: boolean } | null>(null)
  const suppressClick = useRef(false)
  const [index, setIndex] = useState(0)
  const [dragX, setDragX] = useState(0)
  const [settling, setSettling] = useState(true)
  const [browser, setBrowser] = useState<string | null>(null)
  const [pendingSearch, setPendingSearch] = useState<string | null>(null)
  const [pad, setPad] = useState<string | null>(null)
  const [birthdayStamp, setBirthdayStamp] = useState(0)
  const [playerSheet, setPlayerSheet] = useState(false)
  const activeApp = useMellow((state) => state.activeApp)
  if (index > pageCount - 1) setIndex(pageCount - 1)
  const page = Math.min(index, pageCount - 1)

  useEffect(() => {
    const node = pagerRef.current
    if (!node) return
    let cool = false
    const onWheel = (event: WheelEvent) => {
      if (identitySheet || activeApp || browser || pad !== null) return
      const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey
      if (!horizontal) return
      const delta = event.shiftKey && Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX
      if (Math.abs(delta) < 16) return
      event.preventDefault()
      if (cool) return
      cool = true
      window.setTimeout(() => {
        cool = false
      }, 420)
      setIndex((current) => Math.max(0, Math.min(pageCount - 1, current + (delta > 0 ? 1 : -1))))
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [activeApp, browser, identitySheet, pad, pageCount])

  useEffect(() => {
    if (activeApp || identitySheet || browser || pad !== null) return
    const onKey = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
      if (event.key === 'ArrowRight') setIndex((current) => Math.min(pageCount - 1, current + 1))
      if (event.key === 'ArrowLeft') setIndex((current) => Math.max(0, current - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeApp, browser, identitySheet, pad, pageCount])

  const searchHash = settings.privacy.appHashes.search ?? ''
  const searchLocked = Boolean(settings.privacy.enabled && searchHash && settings.privacy.appLocks.search && !sessionApps.includes('search'))
  const runSearch = (query: string) => {
    if (searchLocked) {
      setPendingSearch(query)
      return
    }
    if (phone) void rememberSearch(phone.namespace, phone.id, query)
    setBrowser(query)
  }
  const paintDecor = (id: string, image: string) => {
    const exists = home.decors.some((item) => item.id === id)
    const decors = exists
      ? home.decors.map((item) => (item.id === id ? { ...item, image } : item))
      : [...home.decors, ...DEFAULT_DECORS.filter((item) => item.id === id).map((item) => ({ ...item, image }))]
    void patchSettings({ home: { ...home, decors } })
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || identitySheet || browser || pad !== null || playerSheet) return
    const target = event.target
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
    dragRef.current = { x: event.clientX, y: event.clientY, id: event.pointerId, active: false }
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.id !== event.pointerId) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    if (!drag.active) {
      if (Math.abs(dx) < 14 || Math.abs(dx) < Math.abs(dy)) return
      drag.active = true
      setSettling(false)
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // 指针不在当前手势里时，仍然按位移翻页
      }
    }
    const atStart = page <= 0 && dx > 0
    const atEnd = page >= pageCount - 1 && dx < 0
    const next = atStart || atEnd ? dx * 0.28 : dx
    setDragX(next)
  }

  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag || drag.id !== event.pointerId) return
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // 捕获可能已经结束
    }
    if (!drag.active) return
    suppressClick.current = true
    const dx = event.clientX - drag.x
    setSettling(true)
    setDragX(0)
    if (dx <= -56) setIndex((current) => Math.min(pageCount - 1, current + 1))
    else if (dx >= 56) setIndex((current) => Math.max(0, current - 1))
  }

  return (
    <div
      ref={pagerRef}
      className="home-pager"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onClickCapture={(event) => {
        if (!suppressClick.current) return
        suppressClick.current = false
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      <Wallpaper />
      <div
        className={settling ? 'home-track is-settle' : 'home-track'}
        style={{ transform: `translate3d(calc(${-page * 100}% + ${dragX}px), 0, 0)` }}
      >
      <section className="home-page relative z-10">
        <div className="launcher-col flex h-full min-h-full flex-col">
          <button type="button" aria-label={phone?.name ?? '切换身份'} onClick={() => setIdentitySheet(true)} className="mb-2 w-fit origin-left scale-90">
            <Face value={phone?.avatar ?? '🙂'} />
          </button>
          <div className="grid grid-cols-[1.12fr_0.88fr] items-start gap-3">
            <div>
              <ClockBlock />
              {phone ? <WaterWidget namespace={phone.namespace} /> : null}
              {phone ? (
                <BirthdayLine
                  namespace={phone.namespace}
                  stamp={birthdayStamp}
                  onOpen={setPad}
                />
              ) : null}
            </div>
            {phone ? <MusicPlayer namespace={phone.namespace} onSettings={() => setPlayerSheet(true)} /> : null}
          </div>
          {phone ? <PageFill namespace={phone.namespace} decors={home.decors} onDecor={paintDecor} /> : null}
        </div>
      </section>
      <section className="home-page relative z-10">
        <div className="launcher-col launcher-apps">
          {phone ? <Page2Fill namespace={phone.namespace} decors={home.decors} onDecor={paintDecor} /> : null}
          <div className="launcher-board">
            {page2.map((app) => (
              <AppButton key={app.id} app={app} badge={app.id === 'messages' ? unread : 0} onClick={() => openApp(app.id)} />
            ))}
          </div>
        </div>
      </section>
      {page3.length > 0 ? (
        <section className="home-page relative z-10">
          <div className="launcher-col launcher-apps">
            <p className="mb-3 text-xs" style={{ color: 'var(--m-text-secondary)' }}>还有这些</p>
            <div className="launcher-board" style={{ marginTop: 0, alignContent: 'start' }}>
              {page3.map((app) => (
                <AppButton key={app.id} app={app} badge={app.id === 'messages' ? unread : 0} onClick={() => openApp(app.id)} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-12 z-20 flex flex-col items-center gap-2.5">
        <div className="pointer-events-auto w-[min(440px,calc(100%-2rem))]">
          <SearchBar onSearch={runSearch} />
        </div>
        <div className="pointer-events-auto flex items-center justify-center gap-1">
          {Array.from({ length: pageCount }, (_, dot) => (
            <button key={dot} type="button" aria-label={`第 ${dot + 1} 页`} className="grid h-6 w-6 place-items-center" onClick={() => setIndex(dot)}>
              <span className="block rounded-full" style={{ width: dot === page ? 7 : 5, height: dot === page ? 7 : 5, background: dot === page ? 'var(--m-text)' : 'rgba(58,58,58,0.28)' }} />
            </button>
          ))}
        </div>
        <div className="dock-bar pointer-events-auto">
          {dock.map((app) => (
            <AppButton key={app.id} app={app} badge={app.id === 'messages' ? unread : 0} compact onClick={() => openApp(app.id)} />
          ))}
        </div>
      </div>
      {browser ? (
        <SimBrowser
          query={browser}
          identity={phone}
          onSearch={runSearch}
          onClose={() => setBrowser(null)}
          onSent={(chatId) => {
            touchData()
            setBrowser(null)
            if (phone) requestOpenChat({ chatId, identityId: phone.id })
          }}
        />
      ) : null}
      {pendingSearch !== null ? (
        <div className="absolute inset-0 z-40" onPointerDown={(event) => event.stopPropagation()}>
          <SecretLock
            hash={searchHash}
            onCancel={() => setPendingSearch(null)}
            onPass={() => {
              const query = pendingSearch
              grantApp('search')
              setPendingSearch(null)
              if (phone) void rememberSearch(phone.namespace, phone.id, query)
              setBrowser(query)
            }}
          />
        </div>
      ) : null}
      {playerSheet ? <PlayerSheet onClose={() => setPlayerSheet(false)} /> : null}
      {pad !== null && phone ? (
        <BirthdayPad
          initial={pad}
          onClose={() => setPad(null)}
          onSave={(value) => {
            const namespace = phone.namespace
            void storage.getBag<Record<string, string>>(namespace, 'profile').then(async (row) => {
              await storage.setBag(namespace, 'profile', { ...(row ?? {}), birthday: value })
              setBirthdayStamp((current) => current + 1)
              setPad(null)
            })
          }}
        />
      ) : null}
      {identitySheet ? (
        <IdentitySheet
          onClose={() => setIdentitySheet(false)}
          activeId={activeIdentityId}
          identities={identities}
          onPick={(id) => void switchIdentity(id)}
        />
      ) : null}
    </div>
  )
}

function ClockBlock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000)
    return () => window.clearInterval(timer)
  }, [])
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const week = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][now.getDay()]
  return (
    <div>
      <p className="clock-face tabular text-[clamp(3rem,13vw,3.8rem)] leading-[0.9]">{formatClock(now)}</p>
      <p className="clock-date mt-2 text-[15px]" style={{ color: 'var(--m-text-secondary)' }}>{month}/{day} {week}</p>
    </div>
  )
}

function todayKey(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function WaterWidget(props: { namespace: string }) {
  const [count, setCount] = useState(0)
  const [loaded, setLoaded] = useState('')
  if (loaded !== props.namespace) {
    setLoaded(props.namespace)
    void storage.getBag<{ day: string; count: number }>(props.namespace, 'water').then((row) => {
      setCount(row?.day === todayKey() ? row.count : 0)
    })
  }
  const save = (next: number) => {
    const value = Math.max(0, Math.min(8, next))
    setCount(value)
    void storage.setBag(props.namespace, 'water', { day: todayKey(), count: value })
  }
  return (
    <div className="mt-4 flex items-center gap-1.5">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-white/80 shadow-sm">
        <CupIcon />
      </span>
      <button type="button" aria-label="加一杯" className="grid h-6 w-6 place-items-center rounded-full bg-white/80 text-sm leading-none" onClick={() => save(count + 1)}>+</button>
      <button type="button" aria-label="减一杯" className="grid h-6 w-6 place-items-center rounded-full bg-white/80 text-sm leading-none" onClick={() => save(count - 1)}>−</button>
      <span className="pl-1 text-[12px]">喝水 {count}/8</span>
    </div>
  )
}

function CupIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6.5 8.2h9.2V14a3.4 3.4 0 0 1-3.4 3.4H9.9A3.4 3.4 0 0 1 6.5 14V8.2Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M15.7 10.1h1.8a1.9 1.9 0 0 1 0 3.8h-1.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

function BirthdayLine(props: { namespace: string; stamp: number; onOpen: (birthday: string) => void }) {
  const [birthday, setBirthday] = useState('')
  const [left, setLeft] = useState<number | null>(null)
  const [loaded, setLoaded] = useState('')
  const token = `${props.namespace}:${props.stamp}`
  if (loaded !== token) {
    setLoaded(token)
    void storage.getBag<{ birthday?: string }>(props.namespace, 'profile').then((row) => {
      const value = row?.birthday ?? ''
      setBirthday(value)
      setLeft(daysUntilBirthday(value))
    })
  }
  const label = left === null ? '—' : String(left).padStart(3, '0')
  return (
    <button type="button" onClick={() => props.onOpen(birthday)} className="mt-3 block max-w-full text-left text-[13px] leading-5">
      <span className="mr-1">☆</span>
      <span className="clock-date text-[15px] tracking-normal">距离生日还有 {label} 天</span>
    </button>
  )
}

function SearchBar(props: { onSearch: (query: string) => void }) {
  const [query, setQuery] = useState('')
  return (
    <form
      className="flex items-center gap-2 rounded-full bg-white/80 px-4 py-3 shadow-[0_8px_20px_rgba(90,70,80,0.05)]"
      onSubmit={(event) => {
        event.preventDefault()
        const text = query.trim()
        if (text) props.onSearch(text)
      }}
    >
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="搜索或输入网址"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
      />
      <button type="submit" aria-label="搜索" className="grid h-8 w-8 place-items-center rounded-full bg-white">
        <Search size={16} />
      </button>
    </form>
  )
}

function PageFill(props: { namespace: string; decors: DecorCard[]; onDecor: (id: string, image: string) => void }) {
  const photo = props.decors.find((item) => item.id === 'decor-1-square-top')
  return (
    <div className="mt-4 grid min-h-[11rem] flex-1 grid-cols-3 grid-rows-2 gap-2.5">
      <MemoWidget namespace={props.namespace} className="col-span-2" />
      <PhotoFrame
        image={photo?.image ?? ''}
        tilt={photo?.tilt ?? 0}
        wash="color-mix(in srgb, var(--m-secondary) 32%, white)"
        onPick={(image) => props.onDecor('decor-1-square-top', image)}
      />
      <MoodWidget namespace={props.namespace} />
      <StampWidget namespace={props.namespace} className="col-span-2" />
    </div>
  )
}

function Page2Fill(props: { namespace: string; decors: DecorCard[]; onDecor: (id: string, image: string) => void }) {
  const image = props.decors.find((item) => item.id === 'decor-2-slim')?.image ?? ''
  return (
    <div className="page2-stage">
      <TodoWidget namespace={props.namespace} className="rounded-[30px]" />
      <PhotoFrame image={image} wash="color-mix(in srgb, var(--m-secondary) 38%, white)" className="rounded-[30px]" onPick={(next) => props.onDecor('decor-2-slim', next)} />
    </div>
  )
}

function AppButton(props: { app: PhoneApp; badge: number; compact?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={props.onClick} className="flex flex-col items-center gap-1.5">
      <span className="relative">
        <AppGlyph id={props.app.id} tint={props.app.tint} size={props.compact ? 48 : 52} />
        {props.badge > 0 ? (
          <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full px-1 text-[10px] text-white" style={{ background: 'var(--m-accent)', height: 16 }}>
            {props.badge > 9 ? '9+' : props.badge}
          </span>
        ) : null}
      </span>
      {props.compact ? null : <span className="max-w-full truncate text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{props.app.name}</span>}
    </button>
  )
}

function Face(props: { value: string }) {
  if (props.value.startsWith('data:')) return <img src={props.value} alt="" className="h-9 w-9 rounded-full object-cover" />
  return <span className="grid h-9 w-9 place-items-center rounded-full bg-white/60 text-base">{props.value}</span>
}

function daysUntilBirthday(value: string): number | null {
  const text = value.trim()
  if (!text) return null
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text)
  const loose = /^(\d{1,2})\D(\d{1,2})/.exec(text)
  const month = Number(iso?.[2] ?? loose?.[1])
  const day = Number(iso?.[3] ?? loose?.[2])
  if (!month || !day || month > 12 || day > 31) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(now.getFullYear(), month - 1, day)
  if (Number.isNaN(target.getTime())) return null
  if (target < today) target.setFullYear(target.getFullYear() + 1)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

function digitsOf(value: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  return iso ? `${iso[1]}${iso[2]}${iso[3]}` : ''
}

function BirthdayPad(props: { initial: string; onClose: () => void; onSave: (iso: string) => void }) {
  const [digits, setDigits] = useState(() => digitsOf(props.initial))
  const [hint, setHint] = useState('')
  const slots = Array.from({ length: 8 }, (_, index) => digits[index] ?? '')
  const mark = (index: number) => slots[index] || '·'
  const push = (digit: string) => {
    setHint('')
    setDigits((current) => (current.length >= 8 ? current : current + digit))
  }
  const confirm = () => {
    if (digits.length !== 8) {
      setHint('请写满年月日')
      return
    }
    const year = Number(digits.slice(0, 4))
    const month = Number(digits.slice(4, 6))
    const day = Number(digits.slice(6, 8))
    const date = new Date(year, month - 1, day)
    if (year < 1900 || month < 1 || month > 12 || date.getMonth() !== month - 1 || date.getDate() !== day) {
      setHint('这个日子不存在')
      return
    }
    const iso = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
    props.onSave(iso)
  }
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-black/10 px-6" onPointerDown={(event) => event.stopPropagation()} onClick={props.onClose}>
      <div className="w-full max-w-[300px] rounded-[26px] bg-[#f4f1ee]/95 p-4 shadow-[var(--m-shadow)] backdrop-blur" onClick={(event) => event.stopPropagation()}>
        <p className="clock-pad text-center text-[20px] leading-8">
          {mark(0)} {mark(1)} {mark(2)} {mark(3)}
          <span className="mx-1 text-[13px] tracking-normal">年</span>
          {mark(4)} {mark(5)}
          <span className="mx-1 text-[13px] tracking-normal">月</span>
          {mark(6)} {mark(7)}
          <span className="ml-1 text-[13px] tracking-normal">日</span>
        </p>
        <div className="mt-3 grid grid-cols-5 gap-1.5 text-center text-[15px]">
          {['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button key={digit} type="button" className="rounded-xl py-2.5" onClick={() => push(digit)}>{digit}</button>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between px-1">
          <button type="button" className="px-2 py-2 text-sm" onClick={() => { setHint(''); setDigits((current) => current.slice(0, -1)) }}>删除</button>
          <button type="button" className="rounded-full bg-white px-4 py-1.5 text-sm" onClick={confirm}>确定</button>
        </div>
        {hint ? <p className="pt-1 text-center text-xs" style={{ color: 'var(--m-text-secondary)' }}>{hint}</p> : null}
      </div>
    </div>
  )
}

function IdentitySheet(props: {
  identities: Array<{ id: string; name: string; avatar: string; persona: string }>
  activeId: string
  onPick: (id: string) => void
  onClose: () => void
}) {
  return (
    <div className="absolute inset-0 z-30 bg-black/10" onClick={props.onClose}>
      <div className="absolute left-3 right-3 top-16 max-w-md rounded-[28px] bg-[var(--m-surface)] p-3 shadow-[var(--m-shadow)]" onClick={(event) => event.stopPropagation()}>
        <p className="px-2 pb-2 text-xs" style={{ color: 'var(--m-text-secondary)' }}>换一张手机。角色和短信不会跟着走。</p>
        {props.identities.map((identity) => (
          <button key={identity.id} type="button" onClick={() => props.onPick(identity.id)} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left" style={{ background: identity.id === props.activeId ? 'var(--m-primary)' : 'transparent' }}>
            <Face value={identity.avatar} />
            <span className="min-w-0">
              <span className="block text-sm">{identity.name}</span>
              <span className="block truncate text-xs" style={{ color: 'var(--m-text-secondary)' }}>{identity.persona || '没有写自己'}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
