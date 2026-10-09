import { ChevronLeft, Feather, Scroll, Upload, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { isAiJobRunning, jobKey, runAiJob } from '../../engine/aiJobs.ts'
import {
  defaultJiushiConfig,
  importJiushiCardFile,
  isJiushiCharacter,
  listJiushiLetters,
  loadJiushiConfig,
  replyJiushiLetter,
  saveJiushiConfig,
  type JiushiConfig,
  type JiushiLetter,
} from '../../lib/jiushi.ts'
import { touchImmersive } from '../../lib/smsGuard.ts'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import type { Character } from '../../types/index.ts'
import { Field, PillNote, Screen } from '../ui/primitives.tsx'
import { StoryApp } from './StoryApp.tsx'

type HubView = 'hub' | 'play' | 'letters' | 'letter' | 'roster' | 'setup'

export function JiushiApp(props: { onBack: () => void }) {
  const identities = useMellow((state) => state.identities)
  const activeIdentityId = useMellow((state) => state.activeIdentityId)
  const dataRevision = useMellow((state) => state.dataRevision)
  const touchData = useMellow((state) => state.touchData)
  const phone = identities.find((item) => item.id === activeIdentityId)
  const [view, setView] = useState<HubView>('hub')
  const [config, setConfig] = useState<JiushiConfig>(defaultJiushiConfig())
  const [chars, setChars] = useState<Character[]>([])
  const [letters, setLetters] = useState<JiushiLetter[]>([])
  const [letterCharId, setLetterCharId] = useState('')
  const [letterDraft, setLetterDraft] = useState('')
  const [note, setNote] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!phone) return
    let alive = true
    void (async () => {
      const [cfg, all, rows] = await Promise.all([
        loadJiushiConfig(phone.namespace),
        storage.listCharacters(phone.namespace),
        listJiushiLetters(phone.namespace),
      ])
      if (!alive) return
      setConfig(cfg)
      setChars(all.filter(isJiushiCharacter))
      setLetters(rows)
      if (!cfg.setupDone) setView('setup')
    })()
    return () => {
      alive = false
    }
  }, [phone, dataRevision])

  if (!phone) return null
  if (view === 'play') return <StoryApp mode="jiushi" onBack={() => setView('hub')} />

  const letterChar = chars.find((item) => item.id === letterCharId)
  const letterThread = letters.find((item) => item.charId === letterCharId)
  const importBusy = isAiJobRunning(jobKey(phone.namespace, 'jiushi-import'))

  const refreshChars = async () => {
    const all = await storage.listCharacters(phone.namespace)
    setChars(all.filter(isJiushiCharacter))
    touchData()
  }

  const importCard = async (file: File | undefined) => {
    if (!file) return
    setNote('正在纳入旧世…')
    runAiJob(jobKey(phone.namespace, 'jiushi-import'), async () => {
      try {
        const created = await importJiushiCardFile(file, phone)
        setNote(created.length ? `已纳入 ${created.map((item) => item.name).join('、')}` : '没有读出来')
        await refreshChars()
      } catch (error) {
        setNote(error instanceof Error ? error.message : '导入失败')
      }
    })
  }

  const finishSetup = async () => {
    const next = await saveJiushiConfig(phone.namespace, {
      ...config,
      setupDone: true,
      roleName: config.roleName.trim() || phone.name,
    })
    setConfig(next)
    setView('hub')
  }

  const sendLetter = async () => {
    if (!letterChar || !letterDraft.trim()) return
    touchImmersive('jiushi')
    setNote('正在回信…')
    runAiJob(jobKey(phone.namespace, 'jiushi-letter', letterChar.id), async () => {
      try {
        await replyJiushiLetter({
          namespace: phone.namespace,
          character: letterChar,
          config,
          userText: letterDraft.trim(),
        })
        setLetterDraft('')
        setLetters(await listJiushiLetters(phone.namespace))
        setNote('')
      } catch (error) {
        setNote(error instanceof Error ? error.message : '传书失败')
      }
    })
  }

  if (view === 'setup') {
    return (
      <div className="sms-shell relative h-full min-h-0">
        <Screen title="穿书" subtitle="定下来，再入旧世" onBack={props.onBack}>
          <div className="space-y-3">
            <Field label="所入世界 / 书名" value={config.worldTitle} onChange={(value) => setConfig({ ...config, worldTitle: value })} />
            <Field label="在此世的身份名" value={config.roleName} onChange={(value) => setConfig({ ...config, roleName: value })} placeholder={phone.name} />
            <Field label="来历与处境" value={config.roleStory} onChange={(value) => setConfig({ ...config, roleStory: value })} multiline />
            <button
              type="button"
              className={`w-full rounded-[22px] px-4 py-3 text-left text-sm ${config.hasMemory ? 'bg-[#E8DCC8]' : 'bg-white/90'}`}
              onClick={() => setConfig({ ...config, hasMemory: !config.hasMemory })}
            >
              <p className="font-medium">保留现代记忆</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--m-text-secondary)' }}>
                {config.hasMemory ? '开：仍记得穿书前的事，用到才提' : '关：在此世醒来，只有当前身份'}
              </p>
            </button>
            <button type="button" className="chip chip-mint w-full py-2.5" onClick={() => void finishSetup()}>进入旧世</button>
          </div>
        </Screen>
      </div>
    )
  }

  if (view === 'letter' && letterChar) {
    return (
      <div className="sms-shell relative flex h-full min-h-0 flex-col bg-[#F5F0E6]">
        <header className="flex items-center gap-2 px-3 pb-2 pt-12">
          <button type="button" aria-label="返回" className="grid h-9 w-9 place-items-center rounded-full bg-white/85" onClick={() => setView('letters')}><ChevronLeft size={18} /></button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">传书 · {letterChar.name}</p>
            <p className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>短笺往来，如古人书信</p>
          </div>
        </header>
        <div className="scroll min-h-0 flex-1 space-y-3 px-4 pb-4">
          {(letterThread?.lines ?? []).map((row) => (
            <div key={row.at} className={`max-w-[90%] rounded-[20px] px-3 py-2 text-sm leading-6 ${row.role === 'user' ? 'ml-auto bg-[#E8DCC8]' : 'bg-white/92'}`}>
              {row.content}
            </div>
          ))}
          {!letterThread?.lines.length ? <PillNote tone="lilac">尚无传书，写第一笺吧</PillNote> : null}
        </div>
        <div className="flex items-end gap-2 px-4 pb-14 pt-2">
          <textarea
            value={letterDraft}
            onChange={(event) => setLetterDraft(event.target.value)}
            rows={2}
            placeholder="落笔…"
            className="soft-input min-h-11 flex-1 resize-none leading-6"
            style={{ fontFamily: '"Songti SC", "Noto Serif SC", serif' }}
          />
          <button type="button" className="chip chip-mint shrink-0 py-2.5" onClick={() => void sendLetter()} disabled={!letterDraft.trim()}>寄出</button>
        </div>
        {note ? <p className="pointer-events-none absolute bottom-[5.5rem] left-0 right-0 text-center text-xs">{note}</p> : null}
      </div>
    )
  }

  const hubRows: Array<{ id: HubView; title: string; hint: string; icon: typeof Scroll }> = [
    { id: 'play', title: '入幕', hint: '主线古风演绎，话本长篇', icon: Scroll },
    { id: 'letters', title: '传书', hint: '短笺往来，模拟旧世联系', icon: Feather },
    { id: 'roster', title: '人物', hint: '导入与管理古风角色', icon: Users },
    { id: 'setup', title: '穿书设定', hint: '记忆、身份、世界名', icon: Scroll },
  ]

  return (
    <div className="sms-shell relative h-full min-h-0">
      <Screen title="旧世" subtitle={config.worldTitle || '穿书入境'} onBack={props.onBack}>
        <div className="mb-3 rounded-[24px] p-4" style={{ background: 'linear-gradient(135deg,#F5F0E6,#EDE4D3)' }}>
          <p className="text-sm font-medium">{config.roleName || phone.name}</p>
          <p className="mt-1 text-xs leading-5" style={{ color: 'var(--m-text-secondary)' }}>
            {config.hasMemory ? '携现代记忆穿书' : '在此世醒来'} · {chars.length} 位旧世人物
          </p>
        </div>
        <div className="space-y-2">
          {hubRows.map((row) => (
            <button
              key={row.id}
              type="button"
              className="flex w-full items-center gap-3 rounded-[22px] bg-white/90 px-4 py-3 text-left shadow-[0_8px_18px_rgba(120,90,60,0.06)]"
              onClick={() => {
                if (row.id === 'letters' && chars.length === 0) {
                  setNote('先导入一位旧世人物')
                  return
                }
                setView(row.id)
              }}
            >
              <span className="grid h-10 w-10 place-items-center rounded-2xl" style={{ background: '#E8DCC8' }}><row.icon size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{row.title}</span>
                <span className="block text-xs" style={{ color: 'var(--m-text-secondary)' }}>{row.hint}</span>
              </span>
            </button>
          ))}
        </div>

        {view === 'letters' ? (
          <div className="mt-4 space-y-2">
            <p className="ml-1 text-xs" style={{ color: 'var(--m-text-secondary)' }}>择一人传书</p>
            {chars.map((person) => (
              <button
                key={person.id}
                type="button"
                className="flex w-full items-center justify-between rounded-[20px] bg-white/90 px-4 py-3 text-sm"
                onClick={() => {
                  setLetterCharId(person.id)
                  setView('letter')
                }}
              >
                <span>{person.name}</span>
                <span className="text-xs" style={{ color: 'var(--m-text-secondary)' }}>
                  {letters.find((item) => item.charId === person.id)?.lines.length ?? 0} 笺
                </span>
              </button>
            ))}
            <button type="button" className="chip w-full" onClick={() => setView('hub')}>返回</button>
          </div>
        ) : null}

        {view === 'roster' ? (
          <div className="mt-4 space-y-2">
            <input ref={fileRef} type="file" accept="application/json,.json,image/png,.png" className="hidden" onChange={(event) => void importCard(event.target.files?.[0])} />
            <button type="button" className="chip chip-sky flex w-full items-center justify-center gap-1 py-2.5" onClick={() => fileRef.current?.click()} disabled={importBusy}>
              <Upload size={14} />{importBusy ? '正在纳入…' : '导入古风卡'}
            </button>
            {chars.map((person) => (
              <div key={person.id} className="rounded-[20px] bg-white/90 px-4 py-3">
                <p className="text-sm font-medium">{person.name}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5" style={{ color: 'var(--m-text-secondary)' }}>{person.description || person.personality}</p>
              </div>
            ))}
            {!chars.length ? <PillNote tone="lilac">导入 JSON 或 PNG 角色卡，会自动打上「旧世」标签</PillNote> : null}
            <button type="button" className="chip w-full" onClick={() => setView('hub')}>返回</button>
          </div>
        ) : null}

        {note ? <p className="mt-3 text-center text-xs">{note}</p> : null}
      </Screen>
    </div>
  )
}
