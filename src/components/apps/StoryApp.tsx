import { isImageAvatar } from '../../lib/avatar.ts'
import { phoneFontSize } from '../../lib/phoneFont.ts'
import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, ChevronLeft, Copy, Ellipsis, Pencil, Plus, RotateCcw, SendHorizontal, Square, Trash2, Upload } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { isAiJobRunning, jobKey, runAiJob, stopAiJob } from '../../engine/aiJobs.ts'
import { runStoryGeneration } from '../../domain/storyRunner.ts'
import { ReplyAssist } from './ReplyAssist.tsx'
import { pickPreset } from '../../engine/prompt.ts'
import { modePresetId } from '../../lib/defaults.ts'
import {
  applyRegex,
  deleteSave,
  DEFAULT_READING,
  displayRules,
  editStoryLine,
  focusChars,
  frameDoc,
  FONT_STACK,
  hasHtml,
  storyDisplayParts,
  line,
  unwrapHtmlFence,
  listSaves,
  loadConfig,
  loadSave,
  lorebookFromUnknown,
  newSave,
  normalizeStoryParagraphs,
  putSave,
  saveConfig,
  storyCssClass,
  type ReadingStyle,
  type SaveIndexRow,
  type StoryConfig,
  type StoryLine,
  type StoryMode,
  type StorySave,
} from '../../engine/story.ts'
import { initialOf } from '../../lib/format.ts'
import { stripReasoning } from '../../lib/reasoning.ts'
import { ThoughtSheet } from './ThoughtSheet.tsx'
import { isJiushiCharacter, loadJiushiConfig } from '../../lib/jiushi.ts'
import { touchImmersive } from '../../lib/smsGuard.ts'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import type { Character, Identity, Lorebook } from '../../types/index.ts'
import { PillNote } from '../ui/primitives.tsx'
import { StoryMenu } from './StoryMenu.tsx'
import { CharacterWorldBookScreen, CharacterWorldBookShortcut } from './WorldBookApp.tsx'

const THEME: Record<StoryMode, { tint: string; deep: string; title: string; candy: [string, string, string] }> = {
  offline: { tint: '#D5F0E4', deep: '#5fae93', title: '线下', candy: ['#9ED9C4', '#F8D0DC', '#F8E6C0'] },
  side: { tint: '#E6DDF8', deep: '#8a72c4', title: '番外', candy: ['#C9B6E8', '#F8D0DC', '#D7E7F8'] },
  jiushi: { tint: '#E8DCC8', deep: '#8a7355', title: '旧世', candy: ['#E8DCC8', '#F5F0E6', '#D4C4A8'] },
}

function errorText(reason: unknown) {
  return reason instanceof Error ? reason.message : '没写出来'
}

export function StoryApp(props: { mode: StoryMode; onBack: () => void }) {
  const identities = useMellow((state) => state.identities)
  const activeIdentityId = useMellow((state) => state.activeIdentityId)
  const presets = useMellow((state) => state.presets)
  const settings = useMellow((state) => state.settings)
  const phone = identities.find((item) => item.id === activeIdentityId)
  const dataRevision = useMellow((state) => state.dataRevision)
  const namespace = phone
    ? props.mode === 'side'
      ? `${phone.namespace}__side`
      : props.mode === 'jiushi'
        ? `${phone.namespace}__jiushi`
        : phone.namespace
    : ''
  const [chars, setChars] = useState<Character[]>([])
  const [config, setConfig] = useState<StoryConfig | null>(null)
  const [saves, setSaves] = useState<SaveIndexRow[]>([])
  const [save, setSave] = useState<StorySave | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!phone) return
    let alive = true
    void (async () => {
      const all = await storage.listCharacters(phone.namespace)
      const people = props.mode === 'jiushi' ? all.filter(isJiushiCharacter) : all.filter(c => !isJiushiCharacter(c))
      const [nextConfig, rows] = await Promise.all([loadConfig(namespace), listSaves(namespace)])
      const request = useMellow.getState().openStoryRequest
      const target = request?.mode === props.mode && request.identityId === phone.id ? request : null
      let current = target ? await loadSave(namespace, target.saveId) : null
      if (props.mode === 'offline') {
        if (!current && nextConfig.activeSaveId) current = await loadSave(namespace, nextConfig.activeSaveId)
        if (!current && rows[0]) current = await loadSave(namespace, rows[0].id)
        if (!current) current = await putSave(namespace, newSave('存档 1'))
      }
      if (current) {
        nextConfig.activeSaveId = current.id
        await saveConfig(namespace, nextConfig)
      }
      const nextSaves = await listSaves(namespace)
      if (!alive) return
      setChars(people)
      setConfig(nextConfig)
      setSaves(nextSaves)
      setSave(current)
      setReady(true)
      if (target) useMellow.getState().consumeOpenStory(target.token)
    })()
    return () => {
      alive = false
    }
  }, [phone, namespace, props.mode])

  useEffect(() => {
    if (!save?.id) return
    let alive = true
    void loadSave(namespace, save.id).then((next) => {
      if (alive && next) setSave(next)
    })
    return () => {
      alive = false
    }
  }, [dataRevision, namespace, save?.id])

  if (!phone || !config || !ready) return <div className={`${props.mode === 'jiushi' ? 'sms-shell' : 'sms-shell'} h-full`} />
  const theme = THEME[props.mode]
  const patchConfig = (patch: Partial<StoryConfig>) => {
    const next = { ...config, ...patch }
    setConfig(next)
    void saveConfig(namespace, next)
  }
  const refresh = async () => setSaves(await listSaves(namespace))
  const open = async (id: string) => {
    const next = await loadSave(namespace, id)
    if (!next) return
    setSave(next)
    patchConfig({ activeSaveId: id })
  }
  const lead = save?.charId ? chars.find((item) => item.id === save.charId) : undefined
  const presetMode = props.mode
  const preset = pickPreset(presets, modePresetId(settings, presetMode), props.mode === 'side' || props.mode === 'jiushi' ? lead?.presetId ?? null : null, null)

  if (!save) {
    return (
      <SideLobby
        mode={props.mode}
        identity={phone}
        chars={chars}
        saves={saves}
        onBack={props.onBack}
        onOpen={(id) => void open(id)}
        onCreate={async (draft) => {
          const created = await putSave(namespace, draft)
          await refresh()
          setSave(created)
          patchConfig({ activeSaveId: created.id })
        }}
        onDelete={async (id) => {
          await deleteSave(namespace, id)
          await refresh()
        }}
      />
    )
  }

  return (
    <StoryView
      key={save.id}
      mode={props.mode}
      theme={theme}
      identity={phone}
      namespace={namespace}
      chars={chars}
      lead={lead}
      config={config}
      save={save}
      saves={saves}
      preset={preset}
      presetId={modePresetId(settings, presetMode)}
      presets={presets}
      onBack={() => {
        if (props.mode === 'side' || props.mode === 'jiushi') setSave(null)
        else props.onBack()
      }}
      onConfig={patchConfig}
      onCharacterSaved={(character) => setChars((current) => current.map((person) => person.id === character.id ? character : person))}
      onSave={async (next) => {
        const stored = await putSave(namespace, next)
        setSave(stored)
        await refresh()
        return stored
      }}
      onSwitch={(id) => void open(id)}
      onNew={async (draft) => {
        const created = await putSave(namespace, draft)
        await refresh()
        setSave(created)
        patchConfig({ activeSaveId: created.id })
      }}
      onDelete={async (id) => {
        await deleteSave(namespace, id)
        const rows = await listSaves(namespace)
        setSaves(rows)
        if (id !== save.id) return
        if (props.mode === 'side' || props.mode === 'jiushi') {
          setSave(null)
          return
        }
        const fallback = rows[0] ? await loadSave(namespace, rows[0].id) : await putSave(namespace, newSave('存档 1'))
        if (fallback) {
          setSave(fallback)
          patchConfig({ activeSaveId: fallback.id })
          await refresh()
        }
      }}
    />
  )
}

function Face(props: { person: Character | undefined; size: number }) {
  const avatar = props.person?.avatar ?? ''
  if (isImageAvatar(avatar)) return <img src={avatar} alt="" className="shrink-0 rounded-full object-cover" style={{ width: props.size, height: props.size }} />
  return <span className="grid shrink-0 place-items-center rounded-full bg-white text-xs" style={{ width: props.size, height: props.size }}>{avatar || initialOf(props.person?.name ?? '?')}</span>
}

function StoryView(props: {
  mode: StoryMode
  theme: (typeof THEME)[StoryMode]
  identity: Identity
  namespace: string
  chars: Character[]
  lead: Character | undefined
  config: StoryConfig
  save: StorySave
  saves: SaveIndexRow[]
  preset: ReturnType<typeof pickPreset>
  presetId: string
  presets: import('../../types/index.ts').Preset[]
  onBack: () => void
  onConfig: (patch: Partial<StoryConfig>) => void
  onCharacterSaved: (character: Character) => void
  onSave: (save: StorySave) => Promise<StorySave>
  onSwitch: (id: string) => void
  onNew: (save: StorySave) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const { config, save } = props
  const [draft, setDraft] = useState('')
  const sending = useRef(false)
  const dataRevision = useMellow((state) => state.dataRevision)
  const [error, setError] = useState('')
  const [interruptedReply, setInterruptedReply] = useState(false)
  const [replySaved, setReplySaved] = useState(false)
  const [menu, setMenu] = useState(false)
  const [worldBookOpen, setWorldBookOpen] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [thought, setThought] = useState<string | null>(null)
  const hold = useRef(0)
  const skipClick = useRef(false)
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const boxRef = useRef<HTMLTextAreaElement | null>(null)
  const reading = config.reading
  const rules = useMemo(() => displayRules(props.mode, config, props.chars, save), [props.mode, config, props.chars, save])
  const present = props.mode === 'offline' ? focusChars(props.chars, save) : props.chars.filter(c => (save.charIds ?? [save.charId]).includes(c.id))
  const faces = props.mode === 'offline' ? present.slice(0, 6) : present
  const userName = props.mode === 'side' || props.mode === 'jiushi' ? save.persona?.name || props.identity.name : props.identity.name
  const storyJobKey = jobKey(props.namespace, 'story', props.save.id)
  const aiBusy = isAiJobRunning(storyJobKey)
  const busy = aiBusy

  useEffect(() => {
    if (props.mode === 'offline') touchImmersive('offline')
    if (props.mode === 'jiushi') touchImmersive('jiushi')
  }, [props.mode])

  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [save.lines.length, aiBusy])

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const follow = el.scrollHeight - el.scrollTop - el.clientHeight < 28
    el.style.height = 'auto'
    const next = Math.min(el.scrollHeight, 96)
    el.style.height = `${next}px`
    if (follow) el.scrollTop = el.scrollHeight
  }, [draft])

  const run = async (base: StorySave, nudge?: string, replaceLineId?: string) => {
    if (savingEdit || isAiJobRunning(storyJobKey)) return
    setError('')
    setInterruptedReply(false)
    setReplySaved(false)
    const controller = new AbortController()
    const started = runAiJob(storyJobKey, async () => {
      try {
        await storage.setBag(props.namespace, `story_error_${base.id}`, '').catch(() => {})
        await runStoryGeneration({
          namespace: props.namespace,
          saveId: base.id,
          mode: props.mode,
          identity: props.identity,
          presetId: props.presetId,
          presets: props.presets,
          nudge,
          replaceLineId,
          signal: controller.signal,
          onReplySaved: (interrupted) => {
            setReplySaved(true)
            setInterruptedReply(interrupted)
            useMellow.getState().touchData()
          },
        })
      } catch (reason) {
        if (controller.signal.aborted) return
        const message = errorText(reason)
        setError(message)
        await storage.setBag(props.namespace, `story_error_${base.id}`, message).catch(() => {})
      }
    }, controller)
    if (started) useMellow.getState().touchData()
    else setError('上一段还在写')
  }

  useEffect(() => {
    if (aiBusy) return
    let active = true
    void storage.getBag<string>(props.namespace, `story_error_${props.save.id}`).then((message) => {
      if (!active || !message || isAiJobRunning(storyJobKey)) return
      setError(message)
    }).catch(() => {})
    return () => { active = false }
  }, [aiBusy, props.namespace, props.save.id, dataRevision, storyJobKey])

  const send = async (value = draft, clearDraft = true) => {
    const text = value.trim()
    if (!text || savingEdit || isAiJobRunning(storyJobKey) || sending.current) return
    sending.current = true
    try {
      if (props.mode === 'offline') touchImmersive('offline')
      if (props.mode === 'jiushi') touchImmersive('jiushi')
      const base = await props.onSave({ ...save, lines: [...save.lines, line('user', text)] })
      if (clearDraft) setDraft('')
      await run(base)
    } finally { sending.current = false }
  }
  const lastLine = save.lines.at(-1)
  const retryLast = !draft.trim() && lastLine?.role === 'user'
  const assistTurn = !busy && lastLine?.role === 'assistant' ? lastLine.id : ''
  const assistContext = save.lines.slice(-6).map(item => `${item.role === 'user' ? userName : '剧情'}：${item.content.slice(-1400)}`).join('\n')

  const reroll = async (lineId: string) => {
    if (busy || savingEdit || sending.current) return
    setPicked(null)
    await run(save, undefined, lineId)
  }
  const continueLine = async (lineId: string) => {
    if (busy) return
    const index = save.lines.findIndex((item) => item.id === lineId)
    if (index < 0) return
    setPicked(null)
    const base = save.lines[index]
    await run(save, base?.role === 'assistant' ? '从上一段剧情自然续写，不要重复已经写过的内容。' : undefined)
  }
  const clearLines = async () => {
    if (isAiJobRunning(storyJobKey)) return
    if (!window.confirm('清空这段聊天记录？摘也会保留，如需一并清空请在设置里操作。')) return
    setPicked(null)
    await props.onSave({ ...save, lines: [] })
  }
  const remove = async (id: string) => {
    if (isAiJobRunning(storyJobKey) || savingEdit) return
    const index = save.lines.findIndex(item => item.id === id)
    if (index < 0) return
    setPicked(null)
    await props.onSave({ ...save, lines: save.lines.filter(item => item.id !== id), summaries: save.summaries.filter(summary => summary.upTo <= index) })
  }
  const commitEdit = async () => {
    if (!editing?.text.trim() || savingEdit || sending.current || isAiJobRunning(storyJobKey)) return
    setSavingEdit(true)
    try {
      const current = await loadSave(props.namespace, save.id)
      if (!current) throw new Error('找不到当前剧情存档。')
      const updated = editStoryLine(current, editing.id, editing.text)
      if (updated !== current) await props.onSave(updated)
      setEditing(null)
      setPicked(null)
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setSavingEdit(false)
    }
  }

  const backdrop = reading.backgroundImage ? `center / cover no-repeat url("${reading.backgroundImage}")` : reading.background || undefined
  const candy = props.mode === 'jiushi'
    ? ({} as CSSProperties)
    : ({ '--candy': props.theme.candy[0], '--candy-2': props.theme.candy[1], '--candy-3': props.theme.candy[2] } as CSSProperties)
  const subtitle = busy
    ? (replySaved ? '正在整理剧情…' : '正在写…')
    : (props.mode === 'offline'
      ? (present.length ? `在场：${present.map((item) => item.nickname || item.name).join('、')}` : '想找谁，直接说')
      : `${save.name} · ${userName}`)
  const sc = (part: string, extra = '') => storyCssClass(props.mode, part, extra)

  return (
    <div className={sc('shell', 'sms-shell conversation-shell relative flex h-full min-h-0 flex-col')} data-custom-backdrop={backdrop ? '' : undefined} style={{ ...candy, '--conversation-backdrop': backdrop } as CSSProperties}>
      {reading.customCss.trim() ? <style>{reading.customCss}</style> : null}
      <header className={sc('header', 'flex items-center gap-2 px-3 pb-2 pt-12')}>
        <button type="button" aria-label="返回" className="grid h-9 w-9 place-items-center rounded-full bg-white/85 shadow-[0_4px_12px_rgba(120,80,100,0.08)]" onClick={props.onBack}>
          <ChevronLeft size={18} />
        </button>
        {present.length ? (
          <span className="flex -space-x-2">
            {faces.map((person) => <span key={person.id} className="rounded-full ring-2 ring-white"><Face person={person} size={30} /></span>)}
          </span>
        ) : (
          <span className="grid h-[30px] w-[30px] place-items-center rounded-full text-sm" style={{ background: props.theme.tint }}><BookOpen size={14} /></span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{props.mode === 'side' || props.mode === 'jiushi' ? props.lead?.name || save.name : props.theme.title}</p>
          <p className="truncate text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{subtitle}</p>
        </div>
        {props.mode !== 'jiushi' && props.chars.length ? <CharacterWorldBookShortcut onOpen={() => setWorldBookOpen(true)} /> : null}
        <button type="button" aria-label="详情设置" className="grid h-9 w-9 place-items-center rounded-full bg-white/85 shadow-[0_4px_12px_rgba(120,80,100,0.08)]" onClick={() => setMenu(true)}>
          <Ellipsis size={16} />
        </button>
      </header>

      <div ref={scrollRef} className={sc('scroll', 'scroll min-h-0 flex-1 space-y-3 px-4 pb-3 pt-1')}>
        {save.lines.length === 0 ? (
          <div className={sc('empty', 'mx-auto mt-10 max-w-[18rem] rounded-[26px] bg-white/85 p-5 text-center shadow-[0_10px_24px_rgba(120,80,100,0.07)]')}>
            <p className="text-2xl">{props.mode === 'offline' ? '🚪' : props.mode === 'jiushi' ? '📜' : '📖'}</p>
            <p className="mt-2 text-sm font-medium">{props.mode === 'offline' ? '推开门，走进去' : props.mode === 'jiushi' ? '幕启，待君落笔' : '这条线还没开始'}</p>
            <p className="mt-1 text-xs leading-5" style={{ color: 'var(--m-text-secondary)' }}>
              {props.mode === 'offline'
                ? '写下你在哪、想做什么、要找谁。提到谁，谁的设定就会连上。'
                : props.mode === 'jiushi'
                  ? `从此处起笔，写你与 ${props.lead?.name ?? 'TA'} 在此世的长篇。`
                  : `从第一句开始写你和 ${props.lead?.name ?? 'TA'} 的番外。`}
            </p>
          </div>
        ) : null}
        {save.lines.map((item) => {
          const mine = item.role === 'user'
          const isPicked = picked === item.id
          const isEditing = editing?.id === item.id
          return (
            <article key={item.id} className={mine ? sc('msg', 'is-mine flex flex-col items-end') : sc('msg', 'is-theirs flex flex-col items-start')}>
              {isEditing ? (
                <div className="w-full rounded-[22px] bg-white/95 p-3 shadow-[0_8px_18px_rgba(120,80,100,0.08)]">
                  <textarea autoFocus aria-label="编辑剧情消息" value={editing.text} rows={6} disabled={savingEdit} onChange={(event) => setEditing({ id: item.id, text: event.target.value })} className="soft-input composer-input resize-none text-sm leading-6" />
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" className="chip" disabled={savingEdit} onClick={() => setEditing(null)}>取消</button>
                    <button type="button" className="chip chip-solid" disabled={busy || savingEdit || !editing.text.trim()} onClick={() => void commitEdit()}>{savingEdit ? '保存中…' : '保存'}</button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="block max-w-full text-left"
                  style={mine ? { maxWidth: reading.layout === 'novel' ? '86%' : '80%' } : reading.layout === 'novel' ? { width: '100%' } : { maxWidth: '88%' }}
                  onPointerDown={() => {
                    window.clearTimeout(hold.current)
                    hold.current = window.setTimeout(() => {
                      skipClick.current = true
                      setPicked(item.id)
                    }, 480)
                  }}
                  onPointerUp={() => window.clearTimeout(hold.current)}
                  onPointerLeave={() => window.clearTimeout(hold.current)}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    skipClick.current = true
                    setPicked(item.id)
                  }}
                  onClick={() => {
                    if (skipClick.current) {
                      skipClick.current = false
                      return
                    }
                    setPicked(isPicked ? null : item.id)
                  }}
                >
                  <LineBody mode={props.mode} line={item} rules={rules} config={config} plain={Boolean(save.workshopWorkId || item.workshopReply)} mine={mine} theme={props.theme} userName={userName} />
                </button>
              )}
              {props.mode === 'jiushi' && !isEditing ? (
                <button
                  type="button"
                  className="chip mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 text-xs"
                  aria-expanded={isPicked}
                  onClick={() => setPicked(isPicked ? null : item.id)}
                >
                  <Ellipsis size={13} />消息操作
                </button>
              ) : null}
              <AnimatePresence>
                {isPicked && !isEditing ? (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-1.5 flex flex-wrap gap-1.5">
                    <button type="button" className="chip" disabled={busy || savingEdit} style={{ fontSize: phoneFontSize(11), padding: '3px 10px' }} onClick={() => setEditing({ id: item.id, text: item.content })}><Pencil size={11} />编辑</button>
                    <button type="button" className="chip" style={{ fontSize: phoneFontSize(11), padding: '3px 10px' }} onClick={() => void navigator.clipboard?.writeText(item.content)}><Copy size={11} />复制</button>
                    {item.role === 'assistant' ? (
                      <button type="button" className="chip" style={{ fontSize: phoneFontSize(11), padding: '3px 10px' }} onClick={() => setThought(item.reasoning ?? '')}>思维链</button>
                    ) : null}
                    {item.role === 'assistant' ? (
                      <>
                        <button type="button" className="chip chip-mint" disabled={busy || savingEdit} style={{ fontSize: phoneFontSize(11), padding: '3px 10px' }} onClick={() => void reroll(item.id)}><RotateCcw size={11} />重说</button>
                        <button type="button" className="chip chip-lilac" disabled={busy || savingEdit} style={{ fontSize: phoneFontSize(11), padding: '3px 10px' }} onClick={() => void continueLine(item.id)}>续写</button>
                      </>
                    ) : null}
                    <button type="button" className="chip chip-danger" disabled={busy || savingEdit} style={{ fontSize: phoneFontSize(11), padding: '3px 10px' }} onClick={() => void remove(item.id)}><Trash2 size={11} />删除</button>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </article>
          )
        })}
        {busy && !replySaved ? (
          <div className="flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-2 text-xs" style={{ width: 'fit-content', color: 'var(--m-text-secondary)' }}>
            {[0, 1, 2].map((dot) => <motion.span key={dot} className="h-1.5 w-1.5 rounded-full" style={{ background: props.theme.deep }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: dot * 0.18 }} />)}
            正在写下一段
          </div>
        ) : null}
      </div>

      {thought !== null ? <ThoughtSheet text={thought} onClose={() => setThought(null)} /> : null}
      {error && !busy ? (
        <div className={sc('error', 'mx-3 mb-1 flex min-w-0 shrink-0 items-start gap-2 rounded-2xl bg-white/95 px-3 py-2 text-xs leading-5 text-[#854935]')}>
          <div role="alert" className="max-h-20 min-w-0 flex-1 overflow-y-auto whitespace-pre-wrap [overflow-wrap:anywhere]">{error}</div>
        </div>
      ) : null}
      {interruptedReply && !busy && <p className="mx-3 mb-1 text-xs" role="status">连接中断，已保存收到的正文。</p>}
      <ReplyAssist namespace={props.identity.namespace} mode={props.mode} turnId={assistTurn}
        context={assistContext} draft={draft} disabled={busy} onRewrite={setDraft} onSend={text => send(text, false)} />
      <form
        className={sc('composer', 'conversation-composer flex shrink-0 items-end gap-1.5 px-3 pb-14 pt-1')}
        onSubmit={(event) => {
          event.preventDefault()
          if (isAiJobRunning(storyJobKey)) {
            stopAiJob(storyJobKey)
            return
          }
          if (retryLast && !sending.current) {
            void run(save)
            return
          }
          void send().catch(reason => {
            setError(errorText(reason))
          })
        }}
      >
        <div className="flex min-h-11 min-w-0 flex-1 items-center rounded-[22px] bg-white/92 px-3 py-1.5 ring-1 ring-black/5">
          <textarea
            ref={boxRef}
            value={draft}
            rows={1}
            maxLength={4000}
            placeholder={props.mode === 'offline' ? '说一句' : '写一句'}
            onChange={(event) => setDraft(event.target.value)}
            className={sc('composer-input', 'composer-input readable max-h-24 min-w-0 flex-1 bg-transparent py-1 text-sm leading-6 outline-none')}
          />
        </div>
        <button type="submit" aria-label={busy ? '停止生成' : retryLast ? '重试生成' : '发送'} title={busy ? '停止生成' : retryLast ? '重试上一条消息' : '发送'} disabled={!busy && (savingEdit || (!draft.trim() && !retryLast))} className={sc('send', 'grid h-11 w-11 shrink-0 place-items-center rounded-full shadow-[0_4px_10px_rgba(243,168,186,0.35)] disabled:opacity-55')} style={{ background: 'var(--m-primary)' }}>
          {busy ? <Square size={14} fill="currentColor" /> : <SendHorizontal size={17} />}
        </button>
      </form>

      {menu ? (
        <StoryMenu
          mode={props.mode}
          namespace={props.namespace}
          identity={props.identity}
          chars={props.chars}
          config={config}
          save={save}
          saves={props.saves}
          tint={props.theme.deep}
          onClose={() => setMenu(false)}
          onConfig={props.onConfig}
          onSave={props.onSave}
          onSwitch={(id) => {
            setMenu(false)
            props.onSwitch(id)
          }}
          onNew={async (draftSave) => {
            setMenu(false)
            await props.onNew(draftSave)
          }}
          onDelete={props.onDelete}
          onClear={() => void clearLines()}
        />
      ) : null}
      {worldBookOpen ? <CharacterWorldBookScreen people={present.length ? present : props.chars} onCharacterSaved={props.onCharacterSaved} onBack={() => setWorldBookOpen(false)} /> : null}
    </div>
  )
}

function Prose(props: { text: string; quote: string }) {
  const parts = props.text.split(/(“[^”]*”|「[^」]*」|"[^"\n]*")/)
  return (
    <>
      {parts.map((part, index) => (/^(“|「|")/.test(part) ? <span key={index} style={{ color: `var(--m-quote-ink, ${props.quote})` }}>{part}</span> : <span key={index}>{part}</span>))}
    </>
  )
}

function LineBody(props: { mode: StoryMode; line: StoryLine; rules: ReturnType<typeof displayRules>; config: StoryConfig; plain: boolean; mine: boolean; theme: (typeof THEME)[StoryMode]; userName: string }) {
  const reading = props.config.reading
  const assistant = props.line.role === 'assistant'
  const text = { fontFamily: FONT_STACK[reading.font], fontSize: phoneFontSize(reading.fontSize), lineHeight: reading.lineHeight }
  const sc = (part: string, extra = '') => storyCssClass(props.mode, part, extra)
  const formatProse = (value: string) => {
    if (!assistant) return value.trim()
    const prose = stripReasoning(value)
    return props.mode === 'jiushi' ? prose : normalizeStoryParagraphs(prose)
  }
  const parts = !props.plain && props.config.renderHtml ? storyDisplayParts(props.line.content, props.rules, props.line.role) : null
  if (parts?.some(part => part.card || hasHtml(part.text))) {
    return (
      <span className={sc('bubble', `grid grid-cols-1 gap-2 overflow-hidden p-0 shadow-none ${props.mine ? 'is-mine' : 'is-theirs'}`)} style={{ background: 'transparent' }}>
        {parts.map((part, index) => part.card || hasHtml(part.text)
          ? <HtmlFrame key={index} mode={props.mode} html={part.text.trim()} reading={reading} color="#3a3a3a" />
          : <span key={index} className={sc('prose', 'whitespace-pre-wrap rounded-[20px] px-3.5 py-2')} style={{ ...text, background: props.mine ? '#FBE0E8' : reading.paper }}><Prose text={formatProse(part.text)} quote={reading.quoteColor} /></span>)}
      </span>
    )
  }
  const content = assistant ? stripReasoning(props.line.content) : props.line.content
  const rendered = unwrapHtmlFence(parts ? parts[0]?.text ?? '' : applyRegex(content, props.rules, 'display', props.line.role))
  const inner = <p className={sc('prose', 'whitespace-pre-wrap')} style={text}><Prose text={formatProse(rendered)} quote={reading.quoteColor} /></p>
  if (props.mine) {
    return (
      <span className={sc('bubble', 'is-mine block rounded-[20px] rounded-br-[6px] px-3.5 py-2 shadow-[0_6px_14px_rgba(243,168,186,0.2)]')} style={{ background: '#FBE0E8' }}>
        {reading.layout === 'novel' ? <span className="mb-0.5 block text-[10px]" style={{ color: 'var(--m-text-secondary)' }}>{props.userName}</span> : null}
        {inner}
      </span>
    )
  }
  return (
    <span className={sc('bubble', `is-theirs ${reading.layout === 'novel' ? 'block rounded-[24px] px-4 py-3 shadow-[0_8px_20px_rgba(120,80,100,0.06)]' : 'block rounded-[20px] rounded-bl-[6px] px-3.5 py-2 shadow-[0_6px_14px_rgba(120,80,100,0.06)]'}`)} data-theme-preserve={reading.paper !== DEFAULT_READING.paper ? '' : undefined} style={{ background: reading.paper }}>
      {inner}
    </span>
  )
}

function HtmlFrame(props: { mode: StoryMode; html: string; reading: ReadingStyle; color: string }) {
  const id = useId()
  const frame = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(48)
  const doc = useMemo(() => frameDoc(id, props.html, props.reading, props.color), [id, props.html, props.reading, props.color])
  useLayoutEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { mellowFrame?: string; h?: number } | null
      if (event.source === frame.current?.contentWindow && data?.mellowFrame === id && typeof data.h === 'number' && Number.isFinite(data.h)) {
        setHeight(Math.max(24, Math.ceil(data.h)))
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [id])
  return (
    <iframe
      ref={frame}
      title="渲染内容"
      sandbox="allow-scripts"
      srcDoc={doc}
      className={storyCssClass(props.mode, 'html-frame', 'block w-full overflow-hidden border-0')}
      style={{ height, minHeight: 24, display: 'block', verticalAlign: 'top', background: 'transparent' }}
    />
  )
}

function SideLobby(props: {
  mode: StoryMode
  identity: Identity
  chars: Character[]
  saves: SaveIndexRow[]
  onBack: () => void
  onOpen: (id: string) => void
  onCreate: (save: StorySave) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const ancient = props.mode === 'jiushi'
  const [creating, setCreating] = useState(props.saves.length === 0)
  const [charIds, setCharIds] = useState<string[]>(props.chars[0] ? [props.chars[0].id] : [])
  const charId = charIds[0] ?? ''
  const [name, setName] = useState('')
  const [personaName, setPersonaName] = useState(ancient ? '此世之人' : props.identity.name)
  const [persona, setPersona] = useState(ancient ? '此世土生土长的古代居民' : props.identity.persona)
  const [bookIds, setBookIds] = useState<string[]>([])
  const [books, setBooks] = useState<Lorebook[]>([])
  const [warn, setWarn] = useState('')
  useEffect(() => { if (!ancient) return; let alive=true; void loadJiushiConfig(props.identity.namespace).then(c => { if(alive){setPersonaName(c.roleName || '此世之人');setPersona(c.roleStory || '此世土生土长的古代居民')} }); return()=>{alive=false} }, [ancient,props.identity.namespace])
  const lead = props.chars.find((item) => item.id === charId)
  const withBooks = props.chars.filter((item) => item.characterBook)
  const candy = ancient
    ? ({} as CSSProperties)
    : ({ '--candy': '#C9B6E8', '--candy-2': '#F8D0DC', '--candy-3': '#D7E7F8' } as CSSProperties)
  const create = async () => {
    if (!lead) {
      setWarn('先选一个角色')
      return
    }
    const opener = lead.firstMes.trim().replaceAll('{{char}}', lead.name).replaceAll('{{user}}', personaName || props.identity.name)
    await props.onCreate(
      newSave(name.trim() || `${lead.name} 的${ancient ? '旧世线' : '番外'}`, {
        charId: lead.id,
        charIds,
        persona: { name: personaName.trim() || props.identity.name, persona },
        bookCharIds: bookIds.length ? bookIds : charIds,
        books,
        lines: opener ? [line('assistant', opener)] : [],
      }),
    )
  }
  const importBook = async (file: File | undefined) => {
    if (!file) return
    try {
      const book = lorebookFromUnknown(JSON.parse(await file.text()), file.name.replace(/\.json$/i, ''))
      if (!book) throw new Error('认不出这是世界书')
      setBooks((current) => [...current, book])
      setWarn('')
    } catch (reason) {
      setWarn(errorText(reason))
    }
  }
  return (
    <div className="sms-shell flex h-full min-h-0 flex-col" style={candy}>
      <header className="flex items-center gap-2 px-3 pb-2 pt-12">
        <button type="button" aria-label="返回" className="grid h-9 w-9 place-items-center rounded-full bg-white/85 shadow-[0_4px_12px_rgba(120,80,100,0.08)]" onClick={props.onBack}><ChevronLeft size={18} /></button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold tracking-tight">{ancient ? '入幕' : '番外'}</h1>
          <p className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{ancient ? '话本长篇 · 穿书后的主线演绎' : '每一档都是独立的世界线，不影响主线手机'}</p>
        </div>
        <button type="button" className={ancient ? 'jiushi-btn' : 'chip chip-lilac'} onClick={() => setCreating((value) => !value)}><Plus size={13} />{creating ? '收起' : '新建'}</button>
      </header>
      <div className="scroll min-h-0 flex-1 px-4 pb-16 pt-2">
        {creating ? (
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="menu-card mb-4 space-y-4">
            <div>
              <p className="mb-2 text-xs" style={{ color: 'var(--m-text-secondary)' }}>这一档的角色（可多选，第一位为开场角色）</p>
              {props.chars.length === 0 ? (
                ancient
                  ? <p className="jiushi-note-compact">还没有旧世角色，请先在「人物」纳入古风卡</p>
                  : <PillNote tone="lilac" compact>还没有角色，先去创作或短信里导入</PillNote>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {props.chars.map((person) => (
                  <button key={person.id} type="button" className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-xs" style={{ background: charIds.includes(person.id) ? (ancient ? 'rgba(184,149,106,0.22)' : '#E6DDF8') : 'white', boxShadow: charIds.includes(person.id) ? (ancient ? 'inset 0 0 0 1.5px rgba(107,83,68,0.35)' : 'inset 0 0 0 1.5px #B9A3E3') : 'none' }} aria-pressed={charIds.includes(person.id)} onClick={() => setCharIds(ids => ids.includes(person.id) ? ids.filter(id => id !== person.id) : [...ids, person.id])}>
                    <Face person={person} size={24} />
                    {person.name}
                  </button>
                ))}
              </div>
            </div>
            <label className="block text-xs" style={{ color: 'var(--m-text-secondary)' }}>
              存档名
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder={lead ? `${lead.name} 的番外` : '比如：如果那年没有分开'} className="soft-input mt-1" />
            </label>
            <div className={`story-persona-card rounded-[20px] p-3 ${ancient ? 'jiushi-card' : 'bg-[#F7F3FD]'}`}>
              <p className="text-xs font-medium">{ancient ? '此世中的我' : '这一档里的我'}</p>
              <p className="mt-0.5 text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>只在这一档生效，可以和主线身份完全不同</p>
              <input value={personaName} onChange={(event) => setPersonaName(event.target.value)} placeholder="名字" className="soft-input mt-2" />
              <textarea value={persona} rows={3} onChange={(event) => setPersona(event.target.value)} placeholder="身份、性格、和 TA 的关系……" className="soft-input composer-input mt-2 resize-none leading-6" />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs" style={{ color: 'var(--m-text-secondary)' }}>世界书（可多选）</p>
                <label className="chip chip-sky" style={{ fontSize: phoneFontSize(11), padding: '3px 10px' }}>
                  <Upload size={11} />导入
                  <input type="file" accept="application/json,.json" className="hidden" onChange={(event) => void importBook(event.target.files?.[0])} />
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {withBooks.map((person) => {
                  const on = bookIds.includes(person.id)
                  return (
                    <button key={person.id} type="button" className={on ? 'chip chip-lilac' : 'chip'} style={{ fontSize: phoneFontSize(12) }} onClick={() => setBookIds((current) => (on ? current.filter((id) => id !== person.id) : [...current, person.id]))}>
                      📘 {person.characterBook?.name || `${person.name} 的世界书`}
                    </button>
                  )
                })}
                {books.map((book, index) => (
                  <button key={`${book.name}-${index}`} type="button" className="chip chip-sky" style={{ fontSize: phoneFontSize(12) }} onClick={() => setBooks((current) => current.filter((_, at) => at !== index))}>📗 {book.name} ×</button>
                ))}
                {withBooks.length === 0 && books.length === 0 ? <span className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>角色卡里没有世界书，可以导入 SillyTavern 世界书 JSON</span> : null}
              </div>
            </div>
            {warn ? <p className="text-xs text-[#b0505c]">{warn}</p> : null}
            <button type="button" className={ancient ? 'jiushi-btn jiushi-btn-primary jiushi-btn-block py-3 text-sm font-semibold' : 'story-start-button w-full rounded-full py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(160,130,210,0.3)]'} style={ancient ? undefined : { background: 'linear-gradient(120deg,#B9A3E3,#F3A8BA)' }} onClick={() => void create()}>{ancient ? '开卷入幕' : '开始这条番外'}</button>
          </motion.section>
        ) : null}
        <p className="mb-2 px-1 text-xs font-medium" style={{ color: 'var(--m-text-secondary)' }}>存档 · {props.saves.length}</p>
        <ul className="space-y-2.5">
          {props.saves.map((row) => {
            const person = props.chars.find((item) => item.id === row.charId)
            return (
              <li key={row.id} className="flex items-center gap-3 rounded-[24px] bg-white/88 p-3 shadow-[0_8px_18px_rgba(120,80,100,0.06)]">
                <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => props.onOpen(row.id)}>
                  <Face person={person} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{row.name}</span>
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px]" style={{ background: ancient ? 'rgba(184,149,106,0.22)' : '#E6DDF8' }}>{row.count} 段</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{row.preview || '还没开始'}</span>
                  </span>
                </button>
                <button type="button" aria-label="删除存档" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#FBE3E3] text-[#b0505c]" onClick={() => {
                  if (window.confirm(`删除「${row.name}」？`)) void props.onDelete(row.id)
                }}><Trash2 size={13} /></button>
              </li>
            )
          })}
        </ul>
        {props.saves.length === 0 && !creating ? (
          ancient
            ? <p className="jiushi-note mt-6">还没有话本，点右上角「新建」开卷</p>
            : <PillNote tone="lilac">还没有番外，点右上角新建</PillNote>
        ) : null}
      </div>
    </div>
  )
}
