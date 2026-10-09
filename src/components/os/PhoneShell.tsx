import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { ChengfengApp } from '../apps/ChengfengApp.tsx'
import { CreateApp } from '../apps/CreateApp.tsx'
import { ForumApp } from '../apps/ForumApp.tsx'
import { WorldBookApp } from '../apps/WorldBookApp.tsx'
import { DiaryApp } from '../apps/LifeApps.tsx'
import { HuizhenApp } from '../apps/HuizhenApp.tsx'
import { MapApp } from '../apps/MapApp.tsx'
import { MessagesApp } from '../apps/MessagesApp.tsx'
import { BodyApp, DreamApp, MusicApp, PetApp, PlantApp, SparkApp, WriteApp } from '../apps/PocketApps.tsx'
import { MarketApp, OfflineApp, SideApp } from '../apps/QuietApps.tsx'
import { SettingsApp } from '../apps/SettingsApp.tsx'
import { DuotaoApp, FlashApp } from '../apps/ShopApps.tsx'
import { StarApp } from '../apps/StarFeed.tsx'
import { JiushiApp } from '../apps/JiushiApp.tsx'
import { TableApp } from '../apps/TableApp.tsx'
import { WorldForgeApp } from '../apps/WorldForgeApp.tsx'
import { APP_BY_ID } from '../../data/apps.ts'
import { maybeAskAboutLock } from '../../domain/locks.ts'
import { importDroppedJson } from '../../domain/importing.ts'
import { findIdentity, resolveIdentityId } from '../../engine/identity.ts'
import { tickDeliveries } from '../../lib/delivery.ts'
import { tickNearbyLife } from '../../lib/nearbyLife.ts'
import { tickProactive } from '../../lib/proactive.ts'
import { storage } from '../../storage/StorageService.ts'
import { formatClock } from '../../lib/format.ts'
import { themeOf, useMellow } from '../../store/useMellow.ts'
import { themeStyle } from '../../theme/applyTheme.ts'
import { ControlCenter } from './ControlCenter.tsx'
import { HomeScreen } from './HomeScreen.tsx'
import { LockScreen } from './LockScreen.tsx'
import { NotificationLayer } from './NotificationLayer.tsx'
import { SecretLock } from './SecretLock.tsx'

export function PhoneShell() {
  const boot = useMellow((state) => state.boot)
  const ready = useMellow((state) => state.ready)
  const bootError = useMellow((state) => state.bootError)
  const locked = useMellow((state) => state.locked)
  const activeApp = useMellow((state) => state.activeApp)
  const closeApp = useMellow((state) => state.closeApp)
  const brightness = useMellow((state) => state.brightness)
  const veil = useMellow((state) => state.veil)
  const themes = useMellow((state) => state.themes)
  const settings = useMellow((state) => state.settings)
  const presets = useMellow((state) => state.presets)
  const [dragging, setDragging] = useState(false)
  const [backupAsk, setBackupAsk] = useState(false)
  const patchSettings = useMellow((state) => state.patchSettings)
  const identities = useMellow((state) => state.identities)
  const activeIdentityId = useMellow((state) => state.activeIdentityId)
  const touchData = useMellow((state) => state.touchData)
  const theme = themeOf({ themes, settings })
  const dismissBackup = () => {
    setBackupAsk(false)
    const backup = settings.backup
    void patchSettings({ backup: { ...backup, lastRemindedAt: Date.now() } })
  }

  useEffect(() => {
    if (!ready || locked) return
    const backup = settings.backup
    if (!backup.enabled) return
    if (!backup.lastSavedAt && !backup.lastRemindedAt) {
      void patchSettings({ backup: { ...backup, lastRemindedAt: Date.now() } })
      return
    }
    const interval = Math.max(1, backup.intervalHours) * 3_600_000
    const due = Date.now() - (backup.lastSavedAt || backup.lastRemindedAt) > interval
    const quietMs = Math.min(interval, 3_600_000)
    const quiet = Date.now() - backup.lastRemindedAt < quietMs
    if (due && !quiet) {
      const timer = window.setTimeout(() => setBackupAsk(true), 0)
      return () => window.clearTimeout(timer)
    }
    return
  }, [ready, locked, settings.backup, patchSettings])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!useMellow.getState().ready) {
        useMellow.setState({
          ready: true,
          bootError: '启动偏慢或本地存储被浏览器拦住了。请刷新一次；仍不行就换 Chrome/Edge，或在 Cursor 内置浏览器里打开。',
        })
      }
    }, 12_000)
    void boot().finally(() => window.clearTimeout(timer))
    return () => window.clearTimeout(timer)
  }, [boot])

  useEffect(() => {
    if (!ready || locked) return
    const phone = identities.find((item) => item.id === activeIdentityId)
    if (!phone) return
    let stop = false
    void storage.listCharacters(phone.namespace).then(async (chars) => {
      const changed = await tickDeliveries(phone.namespace, chars)
      if (!stop && changed) touchData()
    })
    return () => {
      stop = true
    }
  }, [ready, locked, identities, activeIdentityId, touchData])

  useEffect(() => {
    if (!ready || locked) return
    const phone = identities.find((item) => item.id === activeIdentityId)
    if (!phone) return
    const run = () => {
      if (settings.proactiveMinutes > 0) {
        void tickProactive({ identity: phone, settings, presets }).catch(() => undefined)
      }
      void tickNearbyLife({ namespace: phone.namespace, identity: phone, settings, presets }).catch(() => undefined)
    }
    run()
    const timer = window.setInterval(run, 60_000)
    return () => window.clearInterval(timer)
  }, [ready, locked, identities, activeIdentityId, settings, presets])

  return (
    <div className="stage">
      <div
        className="device"
        style={themeStyle(theme)}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          const file = event.dataTransfer.files[0]
          if (file) void acceptDrop(file)
        }}
      >
        <div className="relative min-h-0 flex-1">
          {!ready ? <Splash title="半糖" body="正在把这台小手机打开" /> : null}
          {ready && bootError ? <Splash title="开不了机" body={bootError} /> : null}
          {ready && !bootError && locked ? <LockScreen /> : null}
          {ready && !bootError && !locked ? (
            <>
              <HomeScreen />
              <AnimatePresence>
                {activeApp ? (
                  <motion.div
                    key={activeApp}
                    className="absolute inset-0 z-20 bg-[var(--m-background)]"
                    initial={{ y: 28, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <AppHost id={activeApp} onBack={closeApp} />
                  </motion.div>
                ) : null}
              </AnimatePresence>
              <ControlCenter />
            </>
          ) : null}
          <StatusBar showClock={(!locked || !ready) && activeApp !== 'messages'} />
          <div
            className="pointer-events-none absolute inset-0 z-[15]"
            style={{ background: '#2c2628', opacity: (1 - brightness) * 0.62 }}
          />
          <NotificationLayer />
          {ready && !bootError ? <HomeBar /> : null}
          {veil ? (
            <div className="absolute inset-0 z-[70] grid place-items-center bg-[var(--m-background)]">
              <p className="text-sm">换到「{veil}」</p>
            </div>
          ) : null}
          {dragging ? (
            <div className="absolute inset-0 z-[70] grid place-items-center bg-[var(--m-primary)]/80 text-sm">松开，放进这台手机</div>
          ) : null}
          {backupAsk ? (
            <div className="absolute inset-x-4 bottom-16 z-[60] rounded-3xl bg-white/90 p-4 shadow-[var(--m-shadow)]">
              <p className="text-sm">到了该备份的时候。文件只下载到这台设备。</p>
              <div className="mt-3 flex gap-2">
                <button type="button" className="rounded-full bg-[var(--m-primary)] px-3 py-1.5 text-sm" onClick={() => { dismissBackup(); closeApp(); useMellow.getState().openApp('settings') }}>去设置</button>
                <button type="button" className="rounded-full bg-white px-3 py-1.5 text-sm" onClick={dismissBackup}>稍后</button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function AppHost(props: { id: string; onBack: () => void }) {
  const settings = useMellow((state) => state.settings)
  const sessionApps = useMellow((state) => state.sessionApps)
  const grantApp = useMellow((state) => state.grantApp)
  const identities = useMellow((state) => state.identities)
  const activeIdentityId = useMellow((state) => state.activeIdentityId)
  const phone = identities.find((item) => item.id === activeIdentityId)
  const appHash = settings.privacy.appHashes[props.id] ?? ''
  const locked = Boolean(settings.privacy.enabled && appHash && settings.privacy.appLocks[props.id] && !sessionApps.includes(props.id))

  useEffect(() => {
    if (!locked || !phone) return
    void maybeAskAboutLock(phone.namespace, APP_BY_ID[props.id]?.name ?? '这个应用')
  }, [locked, phone, props.id])

  if (locked) {
    return (
      <SecretLock hash={appHash} onPass={() => grantApp(props.id)} onCancel={props.onBack} />
    )
  }

  switch (props.id) {
    case 'messages':
      return <MessagesApp onBack={props.onBack} />
    case 'offline':
      return <OfflineApp onBack={props.onBack} />
    case 'side':
      return <SideApp onBack={props.onBack} />
    case 'market':
      return <MarketApp onBack={props.onBack} />
    case 'chengfeng':
      return <ChengfengApp onBack={props.onBack} />
    case 'create':
      return <CreateApp onBack={props.onBack} />
    case 'worldbook':
      return <WorldBookApp onBack={props.onBack} />
    case 'forum':
      return <ForumApp onBack={props.onBack} />
    case 'diary':
      return <DiaryApp onBack={props.onBack} />
    case 'star':
      return <StarApp onBack={props.onBack} />
    case 'duotao':
      return <DuotaoApp onBack={props.onBack} />
    case 'flash':
      return <FlashApp onBack={props.onBack} />
    case 'huizhen':
      return <HuizhenApp onBack={props.onBack} />
    case 'map':
      return <MapApp onBack={props.onBack} />
    case 'table':
      return <TableApp onBack={props.onBack} />
    case 'pet':
      return <PetApp onBack={props.onBack} />
    case 'plant':
      return <PlantApp onBack={props.onBack} />
    case 'body':
      return <BodyApp onBack={props.onBack} />
    case 'dream':
      return <DreamApp onBack={props.onBack} />
    case 'spark':
      return <SparkApp onBack={props.onBack} />
    case 'write':
      return <WriteApp onBack={props.onBack} />
    case 'music':
      return <MusicApp onBack={props.onBack} />
    case 'settings':
      return <SettingsApp onBack={props.onBack} />
    case 'jiushi':
      return <JiushiApp onBack={props.onBack} />
    case 'worldforge':
      return <WorldForgeApp onBack={props.onBack} />
    default:
      return null
  }
}

function StatusBar(props: { showClock: boolean }) {
  const [now, setNow] = useState(() => formatClock(new Date()))
  const [battery, setBattery] = useState<number | null>(null)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(formatClock(new Date())), 15_000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<{
        level: number
        addEventListener: (type: string, fn: () => void) => void
        removeEventListener: (type: string, fn: () => void) => void
      }>
    }
    if (!nav.getBattery) return
    let stop = () => {}
    void nav.getBattery().then((cell) => {
      const update = () => setBattery(Math.round(cell.level * 100))
      update()
      cell.addEventListener('levelchange', update)
      stop = () => cell.removeEventListener('levelchange', update)
    })
    return () => stop()
  }, [])

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-6 pt-3 text-[12px]">
      <span className="tabular">{props.showClock ? now : ''}</span>
      <span style={{ color: 'var(--m-text-secondary)' }}>{battery === null ? '' : `${battery}%`}</span>
    </div>
  )
}

function HomeBar() {
  const activeApp = useMellow((state) => state.activeApp)
  const closeApp = useMellow((state) => state.closeApp)
  const controlOpen = useMellow((state) => state.controlOpen)
  const setControl = useMellow((state) => state.setControl)
  const startY = useRef<number | null>(null)
  return (
    <div
      className="absolute bottom-1 left-0 right-0 z-40 flex justify-center py-3"
      onPointerDown={(event) => {
        startY.current = event.clientY
      }}
      onPointerUp={(event) => {
        if (startY.current === null) return
        const delta = event.clientY - startY.current
        startY.current = null
        if (delta < -28) setControl(true)
        else if (Math.abs(delta) < 12 && controlOpen) setControl(false)
        else if (Math.abs(delta) < 12 && activeApp) closeApp()
      }}
    >
      <div className="h-1.5 w-28 rounded-full bg-black/25" />
    </div>
  )
}

function Splash(props: { title: string; body: string }) {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center px-8 text-center">
      <div>
        <p className="text-4xl font-semibold tracking-tight">{props.title}</p>
        <p className="mt-3 text-sm leading-6" style={{ color: 'var(--m-text-secondary)' }}>
          {props.body}
        </p>
        <div className="mt-5 flex justify-center gap-1.5">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="h-2 w-2 animate-pulse rounded-full"
              style={{ background: 'var(--m-primary)', animationDelay: `${dot * 0.18}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

async function acceptDrop(file: File): Promise<void> {
  const state = useMellow.getState()
  const phone = state.identities.find((item) => item.id === state.activeIdentityId)
  if (!phone) return
  try {
    const identity = findIdentity(state.identities, resolveIdentityId(phone, 'messages', state.identities))
    const result = await importDroppedJson(file, identity)
    if (result.kind === 'theme') {
      await state.reloadLibraries()
      await state.patchSettings({ themeId: result.id })
    } else if (result.kind === 'preset') {
      await state.reloadLibraries()
      await state.patchSettings({ activePresetId: result.id })
    } else {
      state.touchData()
      await state.refreshInbox()
    }
    const title = result.kind === 'character' ? '角色已放入' : result.kind === 'preset' ? '预设已放入' : '主题已换上'
    await state.pushNotice({
      kind: 'toast',
      title,
      body: result.name,
      appId: 'messages',
      identityId: identity.id,
      priority: 2,
    })
  } catch (error) {
    await state.pushNotice({
      kind: 'toast',
      title: '没放进去',
      body: error instanceof Error ? error.message : '这个文件认不出',
      appId: 'messages',
      identityId: phone.id,
      priority: 3,
    })
  }
}
