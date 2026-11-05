import { Search } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { APP_BY_ID, HOME_PAGE_CAP, type PhoneApp } from '../../data/apps.ts'
import { uid } from '../../lib/id.ts'
import { chunkBoard, ejectTo, mergeCell, moveCell, placeCell, renameFolder, resolveBoard } from '../../lib/homeBoard.ts'
import type { HomeCell } from '../../types/index.ts'
import { rememberSearch } from '../../domain/glance.ts'
import { DEFAULT_DECORS } from '../../lib/defaults.ts'
import { storage } from '../../storage/StorageService.ts'
import { formatClock } from '../../lib/format.ts'
import { useMellow } from '../../store/useMellow.ts'
import type { DecorCard } from '../../types/index.ts'
import { AppGlyph } from './AppGlyph.tsx'
import { DesktopPet } from './DesktopPet.tsx'
import { MemoWidget, MoodWidget, PhotoFrame, StampWidget, TodoWidget } from './HomeWidgets.tsx'
import { MusicPlayer, PlayerSheet } from './MusicPlayer.tsx'
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
  const home = settings.home
  const board = resolveBoard(settings.installedApps, home.board)
  const appPages = chunkBoard(board)
  const dock = board.flatMap((cell) => (cell.kind === 'app' ? [cell.id] : cell.kind === 'folder' ? cell.appIds : [])).flatMap((id) => {
    const app = APP_BY_ID[id]
    return app?.dock ? [app] : []
  })
  const pageCount = 1 + appPages.length
  const pagerRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ x: number; y: number; id: number; active: boolean; t: number } | null>(null)
  const suppressClick = useRef(false)
  const [index, setIndex] = useState(0)
  const [dragX, setDragX] = useState(0)
  const [settling, setSettling] = useState(true)
  const [browser, setBrowser] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [pendingSearch, setPendingSearch] = useState<string | null>(null)
  const [pad, setPad] = useState<string | null>(null)
  const [birthdayStamp, setBirthdayStamp] = useState(0)
  const [playerSheet, setPlayerSheet] = useState(false)
  const [openFolder, setOpenFolder] = useState<string | null>(null)
  const [liftFolder, setLiftFolder] = useState(false)
  const [ghost, setGhost] = useState<{ x: number; y: number; name: string; tint: string; merge: boolean; empty: boolean; over: number | null } | null>(null)
  const boardRef = useRef(board)
  boardRef.current = board
  const pageCountRef = useRef(pageCount)
  pageCountRef.current = pageCount
  const flipAt = useRef(0)
  const activeApp = useMellow((state) => state.activeApp)
  if (index > pageCount - 1) setIndex(pageCount - 1)
  const page = Math.min(index, pageCount - 1)

  useEffect(() => {
    const node = pagerRef.current
    if (!node) return
    let cool = false
    const onWheel = (event: WheelEvent) => {
      if (identitySheet || activeApp || browser || searchOpen || pad !== null) return
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
  }, [activeApp, browser, identitySheet, searchOpen, pad, pageCount])

  useEffect(() => {
    if (activeApp || identitySheet || browser || searchOpen || pad !== null) return
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

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || identitySheet || browser || searchOpen || pad !== null || playerSheet) return
    const target = event.target
    if (target instanceof Element && target.closest('input, textarea, select, [data-no-swipe]')) return
    dragRef.current = { x: event.clientX, y: event.clientY, id: event.pointerId, active: false, t: performance.now() }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.id !== event.pointerId) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    if (!drag.active) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.05) return
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
    const next = atStart || atEnd ? dx * 0.35 : dx
    setDragX(next)
  }

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
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
    const dy = event.clientY - drag.y
    const speed = dx / Math.max(16, performance.now() - drag.t)
    const flick = Math.abs(dx) >= 16 && Math.abs(dx) > Math.abs(dy) && Math.abs(speed) >= 0.42
    setSettling(true)
    setDragX(0)
    if (dx <= -28 || (flick && dx < 0)) setIndex((current) => Math.min(pageCount - 1, current + 1))
    else if (dx >= 28 || (flick && dx > 0)) setIndex((current) => Math.max(0, current - 1))
  }

  const saveBoard = (next: HomeCell[]) => {
    const current = useMellow.getState().settings.home
    void patchSettings({ home: { ...current, board: next } })
  }

  const openCell = (cell: HomeCell) => {
    if (suppressClick.current || cell.kind === 'gap') return
    if (cell.kind === 'folder') {
      setOpenFolder(cell.id)
      return
    }
    openApp(cell.id)
  }

  const cellLabel = (cell: HomeCell) => {
    if (cell.kind === 'folder') return { name: cell.name, tint: APP_BY_ID[cell.appIds[0] ?? '']?.tint ?? '#E7B7C9' }
    if (cell.kind === 'gap') return { name: '空位', tint: '#E7B7C9' }
    const app = APP_BY_ID[cell.id]
    return { name: app?.name ?? '应用', tint: app?.tint ?? '#E7B7C9' }
  }

  const holdCell = (event: ReactPointerEvent<HTMLButtonElement>, index: number, cell: HomeCell) => {
    if (event.button !== 0) return
    event.stopPropagation()
    const pointerId = event.pointerId
    const startX = event.clientX
    const startY = event.clientY
    let active = false
    const label = cellLabel(cell)
    const finish = (ev: PointerEvent) => {
      window.clearTimeout(timer)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      if (!active || ev.pointerId !== pointerId) return
      suppressClick.current = true
      const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-home-index]')
      const over = hit ? Number(hit.dataset.homeIndex) : null
      setGhost(null)
      if (over === null || over === index || Number.isNaN(over)) return
      const current = boardRef.current
      const target = current[over]
      if (!target || target.kind === 'gap') {
        saveBoard(placeCell(current, index, over))
        return
      }
      const rect = hit!.getBoundingClientRect()
      const lx = (ev.clientX - rect.left) / rect.width
      const ly = (ev.clientY - rect.top) / rect.height
      const merge = lx > 0.2 && lx < 0.8 && ly > 0.08 && ly < 0.82
      saveBoard(merge ? mergeCell(current, index, over, uid('folder')) : moveCell(current, index, over))
    }
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!active) {
        if (Math.hypot(dx, dy) > 10) {
          window.clearTimeout(timer)
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', finish)
          window.removeEventListener('pointercancel', finish)
        }
        return
      }
      ev.preventDefault()
      const pager = pagerRef.current?.getBoundingClientRect()
      if (pager && performance.now() - flipAt.current > 680) {
        const localX = ev.clientX - pager.left
        if (localX < 28) {
          flipAt.current = performance.now()
          setIndex((current) => Math.max(0, current - 1))
        } else if (pager.width - localX < 28) {
          flipAt.current = performance.now()
          setIndex((current) => Math.min(pageCountRef.current - 1, current + 1))
        }
      }
      const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-home-index]')
      const over = hit ? Number(hit.dataset.homeIndex) : null
      const target = over === null ? undefined : boardRef.current[over]
      const empty = over !== null && over !== index && (!target || target.kind === 'gap')
      let merge = false
      if (hit && target && target.kind !== 'gap' && over !== null && over !== index) {
        const rect = hit.getBoundingClientRect()
        const lx = (ev.clientX - rect.left) / rect.width
        const ly = (ev.clientY - rect.top) / rect.height
        merge = lx > 0.2 && lx < 0.8 && ly > 0.08 && ly < 0.82
      }
      const size = 68
      const x = pager ? Math.min(Math.max(0, ev.clientX - pager.left - size / 2), pager.width - size) : 0
      const y = pager ? Math.min(Math.max(0, ev.clientY - pager.top - 28), pager.height - size) : 0
      setGhost({ x, y, name: label.name, tint: label.tint, merge, empty, over })
    }
    const timer = window.setTimeout(() => {
      active = true
      suppressClick.current = true
      const pager = pagerRef.current?.getBoundingClientRect()
      const size = 68
      const x = pager ? Math.min(Math.max(0, startX - pager.left - size / 2), pager.width - size) : 0
      const y = pager ? Math.min(Math.max(0, startY - pager.top - 28), pager.height - size) : 0
      setGhost({ x, y, name: label.name, tint: label.tint, merge: false, empty: false, over: null })
    }, 460)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
  }

  const holdFolderApp = (event: ReactPointerEvent<HTMLButtonElement>, appId: string) => {
    if (event.button !== 0 || !openFolder) return
    event.stopPropagation()
    const folderId = openFolder
    const pointerId = event.pointerId
    const startX = event.clientX
    const startY = event.clientY
    let active = false
    const app = APP_BY_ID[appId]
    const label = { name: app?.name ?? '应用', tint: app?.tint ?? '#E7B7C9' }
    const finish = (ev: PointerEvent) => {
      window.clearTimeout(timer)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      setLiftFolder(false)
      if (!active || ev.pointerId !== pointerId) return
      suppressClick.current = true
      const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-home-index]')
      const over = hit ? Number(hit.dataset.homeIndex) : null
      setGhost(null)
      const current = boardRef.current
      const folderIndex = current.findIndex((cell) => cell.kind === 'folder' && cell.id === folderId)
      if (over === null || Number.isNaN(over) || over === folderIndex) return
      const next = ejectTo(current, folderId, appId, over)
      saveBoard(next)
      if (!next.some((cell) => cell.kind === 'folder' && cell.id === folderId)) setOpenFolder(null)
    }
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      if (!active) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 10) {
          window.clearTimeout(timer)
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', finish)
          window.removeEventListener('pointercancel', finish)
        }
        return
      }
      ev.preventDefault()
      const pager = pagerRef.current?.getBoundingClientRect()
      if (pager && performance.now() - flipAt.current > 680) {
        const localX = ev.clientX - pager.left
        if (localX < 28) {
          flipAt.current = performance.now()
          setIndex((current) => Math.max(0, current - 1))
        } else if (pager.width - localX < 28) {
          flipAt.current = performance.now()
          setIndex((current) => Math.min(pageCountRef.current - 1, current + 1))
        }
      }
      const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-home-index]')
      const over = hit ? Number(hit.dataset.homeIndex) : null
      const target = over === null ? undefined : boardRef.current[over]
      const folderIndex = boardRef.current.findIndex((cell) => cell.kind === 'folder' && cell.id === folderId)
      const empty = over !== null && over !== folderIndex && (!target || target.kind === 'gap')
      const size = 68
      const x = pager ? Math.min(Math.max(0, ev.clientX - pager.left - size / 2), pager.width - size) : 0
      const y = pager ? Math.min(Math.max(0, ev.clientY - pager.top - 28), pager.height - size) : 0
      setGhost({ x, y, name: label.name, tint: label.tint, merge: false, empty, over })
    }
    const timer = window.setTimeout(() => {
      active = true
      suppressClick.current = true
      setLiftFolder(true)
      const pager = pagerRef.current?.getBoundingClientRect()
      const size = 68
      const x = pager ? Math.min(Math.max(0, startX - pager.left - size / 2), pager.width - size) : 0
      const y = pager ? Math.min(Math.max(0, startY - pager.top - 28), pager.height - size) : 0
      setGhost({ x, y, name: label.name, tint: label.tint, merge: false, empty: false, over: null })
    }, 460)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
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
      <div
        className={settling ? 'home-track is-settle' : 'home-track'}
        style={{ transform: `translate3d(calc(${-page * 100}% + ${dragX}px), 0, 0)` }}
      >
      <section className="home-page relative z-10">
        <div className="launcher-col flex h-full min-h-full flex-col">
          <button type="button" data-no-swipe aria-label={phone?.name ?? '切换身份'} onClick={() => setIdentitySheet(true)} className="mb-2 w-fit origin-left scale-90">
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
      {appPages.map((cells, pageIndex) => (
        <section key={pageIndex} className="home-page relative z-10">
          <div className="launcher-col launcher-apps">
            {pageIndex === 0 && phone ? <Page2Fill namespace={phone.namespace} decors={home.decors} onDecor={paintDecor} /> : null}
            <div className={pageIndex === 0 ? 'launcher-board page2-board' : 'launcher-board'} style={pageIndex === 0 ? undefined : { marginTop: 0, alignContent: 'start' }}>
              {Array.from({ length: HOME_PAGE_CAP }, (_, offset) => {
                const index = pageIndex * HOME_PAGE_CAP + offset
                const cell = cells[offset]
                if (!cell || cell.kind === 'gap') {
                  return <div key={`gap-${index}`} data-home-index={index} className={ghost?.over === index ? 'home-gap is-over' : 'home-gap'} />
                }
                return (
                  <HomeSlot
                    key={cell.id}
                    cell={cell}
                    index={index}
                    badge={cell.kind === 'app' && cell.id === 'messages' ? unread : 0}
                    merging={ghost?.merge === true && ghost.over === index}
                    onOpen={() => openCell(cell)}
                    onHold={(event) => holdCell(event, index, cell)}
                  />
                )
              })}
            </div>
          </div>
        </section>
      ))}
      </div>
      {!activeApp && home.pet?.shown ? <DesktopPet /> : null}
      <div className="home-toolbar pointer-events-none absolute inset-x-0 bottom-12 z-[26] flex flex-col items-center gap-2.5">
        <div className="home-search-wrap pointer-events-auto">
          <button type="button" data-no-swipe className="home-search-trigger" aria-label="搜索或输入网址" onClick={() => setSearchOpen(true)}><span>搜索或输入网址</span><Search size={18}/></button>
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
      {ghost ? (
        <div className="home-ghost" style={{ transform: `translate3d(${ghost.x}px, ${ghost.y}px, 0)` }}>
          <span className="home-ghost-face" style={{ background: ghost.tint }} />
          <span>{ghost.merge ? '松手放进组里' : ghost.empty ? '松手放到这里' : ghost.name}</span>
        </div>
      ) : null}
      {openFolder ? (
        <FolderSheet
          board={board}
          folderId={openFolder}
          unread={unread}
          onClose={() => setOpenFolder(null)}
          onOpen={(id) => { setOpenFolder(null); openApp(id) }}
          onRename={(name) => saveBoard(renameFolder(board, openFolder, name))}
          onHold={holdFolderApp}
          lifted={liftFolder}
        />
      ) : null}
      {searchOpen && <HomeSearchPanel onClose={() => setSearchOpen(false)} onSearch={query => { setSearchOpen(false); runSearch(query) }}/>}
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

export function HomeSearchPanel(props: { onSearch: (query: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const back = (event: Event) => { event.preventDefault(); input.current?.blur(); props.onClose() }
    window.addEventListener('mellow-home-back', back)
    return () => window.removeEventListener('mellow-home-back', back)
  }, [props.onClose])
  const close = () => { input.current?.blur(); props.onClose() }
  return <section className="home-search-panel" role="dialog" aria-modal="true" aria-label="桌面搜索" data-no-swipe onPointerDown={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'Escape') close() }}>
    <header><strong>搜索</strong><button type="button" className="chip" onClick={close}>取消</button></header>
    <form className="home-search-form" onSubmit={event => {
      event.preventDefault(); const text = query.trim()
      if (text) { input.current?.blur(); props.onSearch(text) }
    }}><input ref={input} autoFocus aria-label="搜索内容或网址" type="search" enterKeyHint="search" value={query} maxLength={2000} onChange={event => setQuery(event.target.value)} placeholder="搜索或输入网址"/><button type="submit" aria-label="提交搜索" disabled={!query.trim()}><Search size={20}/></button></form>
    <p className="text-xs mt-3" style={{ color: 'var(--m-text-secondary)' }}>输入想了解的内容或网址，再点击搜索。</p>
  </section>
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

function HomeSlot(props: {
  cell: HomeCell
  index: number
  badge: number
  merging: boolean
  onOpen: () => void
  onHold: (event: ReactPointerEvent<HTMLButtonElement>) => void
}) {
  const cell = props.cell
  if (cell.kind === 'gap') return null
  const app = cell.kind === 'app' ? APP_BY_ID[cell.id] : null
  const tint = app?.tint ?? (cell.kind === 'folder' ? APP_BY_ID[cell.appIds[0] ?? '']?.tint : undefined) ?? '#E7B7C9'
  const name = cell.kind === 'folder' ? cell.name : app?.name ?? '应用'
  return (
    <button
      type="button"
      data-home-index={props.index}
      data-no-swipe
      className={props.merging ? 'app-launch is-merge flex flex-col items-center gap-1.5' : 'app-launch flex flex-col items-center gap-1.5'}
      aria-label={cell.kind === 'folder' ? `${name}，${cell.appIds.length} 个应用` : name}
      onPointerDown={props.onHold}
      onClick={props.onOpen}
    >
      <span className="relative">
        {cell.kind === 'folder' ? (
          <span className="app-folder">
            {Array.from({ length: 4 }, (_, slot) => {
              const id = cell.appIds[slot]
              if (!id) return <span key={slot} className="app-folder-slot is-empty" />
              return (
                <span key={id} className="app-folder-slot">
                  <AppGlyph id={id} tint={APP_BY_ID[id]?.tint ?? tint} size={18} />
                </span>
              )
            })}
          </span>
        ) : (
          <AppGlyph id={cell.id} tint={tint} size={52} />
        )}
        {props.badge > 0 ? (
          <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full px-1 text-[10px] text-white" style={{ background: 'var(--m-accent)', height: 16 }}>
            {props.badge > 9 ? '9+' : props.badge}
          </span>
        ) : null}
      </span>
      <span className="max-w-full truncate text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{name}</span>
    </button>
  )
}

function FolderSheet(props: {
  board: HomeCell[]
  folderId: string
  unread: number
  lifted: boolean
  onClose: () => void
  onOpen: (id: string) => void
  onRename: (name: string) => void
  onHold: (event: ReactPointerEvent<HTMLButtonElement>, appId: string) => void
}) {
  const folder = props.board.find((cell) => cell.kind === 'folder' && cell.id === props.folderId)
  const [name, setName] = useState(folder && folder.kind === 'folder' ? folder.name : '应用组')
  const [folderPage, setFolderPage] = useState(0)
  const dragX = useRef(0)
  if (!folder || folder.kind !== 'folder') return null
  const pageCount = Math.max(1, Math.ceil(folder.appIds.length / 4))
  const page = Math.min(folderPage, pageCount - 1)
  const visible = folder.appIds.slice(page * 4, page * 4 + 4)
  return (
    <div className={props.lifted ? 'folder-sheet is-lifted' : 'folder-sheet'} role="dialog" aria-modal="true" aria-label={folder.name} data-no-swipe onPointerDown={(event) => event.stopPropagation()} onClick={props.onClose}>
      <div className="folder-card" onClick={(event) => event.stopPropagation()}>
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); props.onRename(name) }}>
          <input aria-label="应用组名称" className="soft-input" maxLength={12} value={name} onChange={(event) => setName(event.target.value)} />
          <button type="submit" className="chip chip-solid shrink-0">改名</button>
        </form>
        <p className="folder-hint">长按图标，拖到桌面上放下</p>
        <div
          className="folder-grid"
          onPointerDown={(event) => {
            if ((event.target as Element).closest('button')) return
            dragX.current = event.clientX
          }}
          onPointerUp={(event) => {
            if ((event.target as Element).closest('button')) return
            const dx = event.clientX - dragX.current
            if (dx <= -36) setFolderPage((current) => Math.min(pageCount - 1, current + 1))
            else if (dx >= 36) setFolderPage((current) => Math.max(0, current - 1))
          }}
        >
          {Array.from({ length: 4 }, (_, slot) => {
            const id = visible[slot]
            const app = id ? APP_BY_ID[id] : undefined
            if (!app || !id) return <div key={slot} className="folder-grid-empty" />
            return (
              <div key={id} className="folder-grid-item">
                <AppButton app={app} badge={id === 'messages' ? props.unread : 0} onPointerDown={(event) => props.onHold(event, id)} onClick={() => props.onOpen(id)} />
              </div>
            )
          })}
        </div>
        {pageCount > 1 ? (
          <div className="folder-dots">
            {Array.from({ length: pageCount }, (_, dot) => (
              <button key={dot} type="button" aria-label={`应用组第 ${dot + 1} 页`} className={dot === page ? 'is-on' : ''} onClick={() => setFolderPage(dot)} />
            ))}
          </div>
        ) : null}
        <button type="button" className="chip mt-3" onClick={props.onClose}>完成</button>
      </div>
    </div>
  )
}

function AppButton(props: { app: PhoneApp; badge: number; compact?: boolean; onClick: () => void; onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void }) {
  return (
    <button type="button" onClick={props.onClick} onPointerDown={props.onPointerDown} className="app-launch flex flex-col items-center gap-1.5">
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
