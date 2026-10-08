import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, ChevronLeft, Copy, Ellipsis, Pencil, Plus, RotateCcw, SendHorizontal, Trash2, Upload } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { isAiJobRunning, jobKey, runAiJob } from '../../engine/aiJobs.ts'
import { runStoryGeneration } from '../../domain/storyRunner.ts'
import { pickPreset } from '../../engine/prompt.ts'
import { modePresetId } from '../../lib/defaults.ts'
import {
  applyRegex,
  deleteSave,
  displayRules,
  focusChars,
  frameDoc,
  FONT_STACK,
  hasHtml,
  line,
  unwrapHtmlFence,
  listSaves,
  loadConfig,
  loadSave,
  lorebookFromUnknown,
  newSave,
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
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import type { Character, Identity, Lorebook } from '../../types/index.ts'
import { PillNote } from '../ui/primitives.tsx'
import { StoryMenu } from './StoryMenu.tsx'

const THEME: Record<StoryMode, { tint: string; deep: string; title: string; candy: [string, string, string] }> = {
  offline: { tint: '#D5F0E4', deep: '#5fae93', title: '线下', candy: ['#9ED9C4', '#F8D0DC', '#F8E6C0'] },
  side: { tint: '#E6DDF8', deep: '#8a72c4', title: '番外', candy: ['#C9B6E8', '#F8D0DC', '#D7E7F8'] },
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
  const namespace = phone ? (props.mode === 'side' ? `${phone.namespace}__side` : phone.namespace) : ''
  const [chars, setChars] = useState<Character[]>([])
  const [config, setConfig] = useState<StoryConfig | null>(null)
  const [saves, setSaves] = useState<SaveIndexRow[]>([])
  const [save, setSave] = useState<StorySave | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!phone) return
    let alive = true
    void (async () => {
      const [people, nextConfig, rows] = await Promise.all([storage.listCharacters(phone.namespace), loadConfig(namespace), listSaves(namespace)])
      let current: StorySave | null = null
      if (props.mode === 'offline') {
        current = nextConfig.activeSaveId ? await loadSave(namespace, nextConfig.activeSaveId) : null
        if (!current && rows[0]) current = await loadSave(namespace, rows[0].id)
        if (!current) current = await putSave(namespace, newSave('存档 1'))
        nextConfig.activeSaveId = current.id
      }
      if (!alive) return
      setChars(people)
      setConfig(nextConfig)
      setSaves(await listSaves(namespace))
      setSave(current)
      setReady(true)
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

  if (!phone || !config || !ready) return <div className="sms-shell h-full" />
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
  const preset = pickPreset(presets, modePresetId(settings, props.mode === 'side' ? 'side' : 'offline'), props.mode === 'side' ? lead?.presetId ?? null : null, null)

  if (!save) {
    return (
      <SideLobby
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
      presetId={modePresetId(settings, props.mode === 'side' ? 'side' : 'offline')}
      presets={presets}
      onBack={() => {
        if (props.mode === 'side') setSave(null)
        else props.onBack()
      }}
      onConfig={patchConfig}
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
        if (props.mode === 'side') {
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
  if (avatar.startsWith('data:')) return <img src={avatar} alt="" className="shrink-0 rounded-full object-cover" style={{ width: props.size, height: props.size }} />
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
  onSave: (save: StorySave) => Promise<StorySave>
  onSwitch: (id: string) => void
  onNew: (save: StorySave) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const { config, save } = props
  const [draft, setDraft] = useState('')
  const dataRevision = useMellow((state) => state.dataRevision)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [menu, setMenu] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const boxRef = useRef<HTMLTextAreaElement | null>(null)
  const reading = config.reading
  const rules = useMemo(() => displayRules(props.mode, config, props.chars, save), [props.mode, config, props.chars, save])
  const present = props.mode === 'offline' ? focusChars(props.chars, save).slice(0, 4) : props.lead ? [props.lead] : []
  const userName = props.mode === 'side' ? save.persona?.name || props.identity.name : props.identity.name
  const storyJobKey = jobKey(props.namespace, 'story', props.save.id)
  const aiBusy = isAiJobRunning(storyJobKey)
  const busy = aiBusy

  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [save.lines.length, aiBusy])

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`
  }, [draft])

  const run = async (base: StorySave, nudge?: string) => {
    if (aiBusy) return
    setError('')
    setNote('')
    const started = runAiJob(storyJobKey, async () => {
      try {
        await runStoryGeneration({
          namespace: props.namespace,
          saveId: base.id,
          mode: props.mode,
          identity: props.identity,
          presetId: props.presetId,
          presets: props.presets,
          nudge,
        })
      } catch (reason) {
        await storage.setBag(props.namespace, `story_error_${base.id}`, errorText(reason))
      }
    })
    if (!started) setError('上一段还在写')
  }

  useEffect(() => {
    if (!aiBusy) {
      void storage.getBag<string>(props.namespace, `story_error_${props.save.id}`).then((message) => {
        if (message) {
          setError(message)
          void storage.setBag(props.namespace, `story_error_${props.save.id}`, '')
        }
      })
      setNote('')
      return
    }
    setNote('正在写…')
  }, [aiBusy, props.namespace, props.save.id, dataRevision])

  const send = async () => {
    const text = draft.trim()
    if (!text || busy) return
    setDraft('')
    const base = await props.onSave({ ...save, lines: [...save.lines, line('user', text)] })
    await run(base)
  }

  const reroll = async (lineId: string) => {
    if (busy) return
    const index = save.lines.findIndex((item) => item.id === lineId)
    if (index < 0 || save.lines[index]?.role !== 'assistant') return
    setPicked(null)
    const base = await props.onSave({ ...save, lines: save.lines.slice(0, index) })
    await run(base)
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
    if (!window.confirm('清空这段聊天记录？摘也会保留，如需一并清空请在设置里操作。')) return
    setPicked(null)
    await props.onSave({ ...save, lines: [] })
  }
  const remove = async (id: string) => {
    setPicked(null)
    await props.onSave({ ...save, lines: save.lines.filter((item) => item.id !== id) })
  }
  const commitEdit = async () => {
    if (!editing) return
    await props.onSave({ ...save, lines: save.lines.map((item) => (item.id === editing.id ? { ...item, content: editing.text } : item)) })
    setEditing(null)
    setPicked(null)
  }

  const backdrop = reading.backgroundImage ? `center / cover no-repeat url(${reading.backgroundImage})` : reading.background || undefined
  const candy = { '--candy': props.theme.candy[0], '--candy-2': props.theme.candy[1], '--candy-3': props.theme.candy[2] } as CSSProperties
  const subtitle = busy ? '正在写…' : note || (props.mode === 'offline' ? (present.length ? `在场：${present.map((item) => item.nickname || item.name).join('、')}` : '想找谁，直接说') : `${save.name} · ${userName}`)
  const sc = (part: string, extra = '') => storyCssClass(props.mode, part, extra)

  return (
    <div className={sc('shell', 'sms-shell relative flex h-full min-h-0 flex-col')} style={{ ...candy, background: backdrop }}>
      {reading.customCss.trim() ? <style>{reading.customCss}</style> : null}
      <header className={sc('header', 'flex items-center gap-2 px-3 pb-2 pt-12')}>
        <button type="button" aria-label="返回" className="grid h-9 w-9 place-items-center rounded-full bg-white/85 shadow-[0_4px_12px_rgba(120,80,100,0.08)]" onClick={props.onBack}>
          <ChevronLeft size={18} />
        </button>
        {present.length ? (
          <span className="flex -space-x-2">
            {present.map((person) => <span key={person.id} className="rounded-full ring-2 ring-white"><Face person={person} size={30} /></span>)}
          </span>
        ) : (
          <span className="grid h-[30px] w-[30px] place-items-center rounded-full text-sm" style={{ background: props.theme.tint }}><BookOpen size={14} /></span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{props.mode === 'side' ? props.lead?.name || save.name : props.theme.title}</p>
          <p className="truncate text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{subtitle}</p>
        </div>
        <button type="button" aria-label="详情设置" className="grid h-9 w-9 place-items-center rounded-full bg-white/85 shadow-[0_4px_12px_rgba(120,80,100,0.08)]" onClick={() => setMenu(true)}>
          <Ellipsis size={16} />
        </button>
      </header>

      <div ref={scrollRef} className={sc('scroll', 'scroll min-h-0 flex-1 space-y-3 px-4 pb-3 pt-1')}>
        {save.lines.length === 0 ? (
          <div className={sc('empty', 'mx-auto mt-10 max-w-[18rem] rounded-[26px] bg-white/85 p-5 text-center shadow-[0_10px_24px_rgba(120,80,100,0.07)]')}>
            <p className="text-2xl">{props.mode === 'offline' ? '🚪' : '📖'}</p>
            <p className="mt-2 text-sm font-medium">{props.mode === 'offline' ? '推开门，走进去' : '这条线还没开始'}</p>
            <p className="mt-1 text-xs leading-5" style={{ color: 'var(--m-text-secondary)' }}>
              {props.mode === 'offline' ? '写下你在哪、想做什么、要找谁。提到谁，谁的设定就会连上。' : `从第一句开始写你和 ${props.lead?.name ?? 'TA'} 的番外。`}
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
                  <textarea value={editing.text} rows={6} onChange={(event) => setEditing({ id: item.id, text: event.target.value })} className="soft-input resize-none text-sm leading-6" />
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" className="chip" onClick={() => setEditing(null)}>取消</button>
                    <button type="button" className="chip chip-solid" onClick={() => void commitEdit()}>保存</button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="block max-w-full text-left"
                  style={mine ? { maxWidth: reading.layout === 'novel' ? '86%' : '80%' } : reading.layout === 'novel' ? { width: '100%' } : { maxWidth: '88%' }}
                  onClick={() => setPicked(isPicked ? null : item.id)}
                >
                  <LineBody mode={props.mode} line={item} rules={rules} config={config} mine={mine} theme={props.theme} userName={userName} />
                </button>
              )}
              <AnimatePresence>
                {isPicked && !isEditing ? (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-1.5 flex flex-wrap gap-1.5">
                    <button type="button" className="chip" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setEditing({ id: item.id, text: item.content })}><Pencil size={11} />编辑</button>
                    <button type="button" className="chip" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => void navigator.clipboard?.writeText(item.content)}><Copy size={11} />复制</button>
                    {item.role === 'assistant' ? (
                      <>
                        <button type="button" className="chip chip-mint" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => void reroll(item.id)}><RotateCcw size={11} />重说</button>
                        <button type="button" className="chip chip-lilac" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => void continueLine(item.id)}>续写</button>
                      </>
                    ) : null}
                    <button type="button" className="chip chip-danger" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => void remove(item.id)}><Trash2 size={11} />删除</button>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </article>
          )
        })}
        {busy ? (
          <div className="flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-2 text-xs" style={{ width: 'fit-content', color: 'var(--m-text-secondary)' }}>
            {[0, 1, 2].map((dot) => <motion.span key={dot} className="h-1.5 w-1.5 rounded-full" style={{ background: props.theme.deep }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: dot * 0.18 }} />)}
            正在写下一段
          </div>
        ) : null}
        {error ? <PillNote tone="peach" inline>{error}</PillNote> : null}
      </div>

      <form
        className={sc('composer', 'flex items-end gap-1.5 px-3 pb-14 pt-1')}
        onSubmit={(event) => {
          event.preventDefault()
          void send()
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
        <button type="submit" aria-label="发送" disabled={busy || !draft.trim()} className={sc('send', 'grid h-11 w-11 shrink-0 place-items-center rounded-full shadow-[0_4px_10px_rgba(243,168,186,0.35)] disabled:opacity-55')} style={{ background: 'var(--m-primary)' }}>
          <SendHorizontal size={17} />
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
    </div>
  )
}

function Prose(props: { text: string; quote: string }) {
  const parts = props.text.split(/(“[^”]*”|「[^」]*」|"[^"\n]*")/)
  return (
    <>
      {parts.map((part, index) => (/^(“|「|")/.test(part) ? <span key={index} style={{ color: props.quote }}>{part}</span> : <span key={index}>{part}</span>))}
    </>
  )
}

function LineBody(props: { mode: StoryMode; line: StoryLine; rules: ReturnType<typeof displayRules>; config: StoryConfig; mine: boolean; theme: (typeof THEME)[StoryMode]; userName: string }) {
  const reading = props.config.reading
  const shown = unwrapHtmlFence(applyRegex(props.line.content, props.rules, 'display', props.line.role))
  const text = { fontFamily: FONT_STACK[reading.font], fontSize: reading.fontSize, lineHeight: reading.lineHeight }
  const html = props.config.renderHtml && hasHtml(shown)
  const sc = (part: string, extra = '') => storyCssClass(props.mode, part, extra)
  const inner = html ? <HtmlFrame mode={props.mode} html={shown} reading={reading} color="#3a3a3a" /> : <p className={sc('prose', 'whitespace-pre-wrap')} style={text}><Prose text={shown} quote={reading.quoteColor} /></p>
  if (html) {
    return (
      <span className={sc('bubble', `block overflow-hidden p-0 shadow-none ${props.mine ? 'is-mine' : 'is-theirs'}`)} style={{ background: 'transparent' }}>
        {inner}
      </span>
    )
  }
  if (props.mine) {
    return (
      <span className={sc('bubble', 'is-mine block rounded-[20px] rounded-br-[6px] px-3.5 py-2 shadow-[0_6px_14px_rgba(243,168,186,0.2)]')} style={{ background: '#FBE0E8' }}>
        {reading.layout === 'novel' ? <span className="mb-0.5 block text-[10px]" style={{ color: 'var(--m-text-secondary)' }}>{props.userName}</span> : null}
        {inner}
      </span>
    )
  }
  return (
    <span className={sc('bubble', `is-theirs ${reading.layout === 'novel' ? 'block rounded-[24px] px-4 py-3 shadow-[0_8px_20px_rgba(120,80,100,0.06)]' : 'block rounded-[20px] rounded-bl-[6px] px-3.5 py-2 shadow-[0_6px_14px_rgba(120,80,100,0.06)]'}`)} style={{ background: reading.paper }}>
      {inner}
    </span>
  )
}

function HtmlFrame(props: { mode: StoryMode; html: string; reading: ReadingStyle; color: string }) {
  const id = useId()
  const [height, setHeight] = useState(48)
  const doc = useMemo(() => frameDoc(id, props.html, props.reading, props.color), [id, props.html, props.reading, props.color])
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { mellowFrame?: string; h?: number } | null
      if (data && data.mellowFrame === id && typeof data.h === 'number') setHeight(Math.min(2400, Math.max(24, Math.ceil(data.h))))
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [id])
  return (
    <iframe
      title="渲染内容"
      sandbox="allow-scripts"
      srcDoc={doc}
      className={storyCssClass(props.mode, 'html-frame', 'block w-full overflow-hidden border-0')}
      style={{ height, minHeight: 24, maxHeight: 2400, display: 'block', verticalAlign: 'top', background: 'transparent' }}
    />
  )
}

function SideLobby(props: {
  identity: Identity
  chars: Character[]
  saves: SaveIndexRow[]
  onBack: () => void
  onOpen: (id: string) => void
  onCreate: (save: StorySave) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [creating, setCreating] = useState(props.saves.length === 0)
  const [charId, setCharId] = useState(props.chars[0]?.id ?? '')
  const [name, setName] = useState('')
  const [personaName, setPersonaName] = useState(props.identity.name)
  const [persona, setPersona] = useState(props.identity.persona)
  const [bookIds, setBookIds] = useState<string[]>([])
  const [books, setBooks] = useState<Lorebook[]>([])
  const [warn, setWarn] = useState('')
  const lead = props.chars.find((item) => item.id === charId)
  const withBooks = props.chars.filter((item) => item.characterBook)
  const candy = { '--candy': '#C9B6E8', '--candy-2': '#F8D0DC', '--candy-3': '#D7E7F8' } as CSSProperties
  const create = async () => {
    if (!lead) {
      setWarn('先选一个角色')
      return
    }
    const opener = lead.firstMes.trim().replaceAll('{{char}}', lead.name).replaceAll('{{user}}', personaName || props.identity.name)
    await props.onCreate(
      newSave(name.trim() || `${lead.name} 的番外`, {
        charId: lead.id,
        persona: { name: personaName.trim() || props.identity.name, persona },
        bookCharIds: bookIds.length ? bookIds : lead.characterBook ? [lead.id] : [],
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
          <h1 className="text-[22px] font-semibold tracking-tight">番外</h1>
          <p className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>每一档都是独立的世界线，不影响主线手机</p>
        </div>
        <button type="button" className="chip chip-lilac" onClick={() => setCreating((value) => !value)}><Plus size={13} />{creating ? '收起' : '新建'}</button>
      </header>
      <div className="scroll min-h-0 flex-1 px-4 pb-16 pt-2">
        {creating ? (
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="menu-card mb-4 space-y-4">
            <div>
              <p className="mb-2 text-xs" style={{ color: 'var(--m-text-secondary)' }}>这一档的主角</p>
              {props.chars.length === 0 ? <PillNote tone="lilac" compact>还没有角色，先去创作或短信里导入</PillNote> : null}
              <div className="flex flex-wrap gap-2">
                {props.chars.map((person) => (
                  <button key={person.id} type="button" className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-xs" style={{ background: charId === person.id ? '#E6DDF8' : 'white', boxShadow: charId === person.id ? 'inset 0 0 0 1.5px #B9A3E3' : 'none' }} onClick={() => setCharId(person.id)}>
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
            <div className="rounded-[20px] bg-[#F7F3FD] p-3">
              <p className="text-xs font-medium">这一档里的我</p>
              <p className="mt-0.5 text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>只在这一档生效，可以和主线身份完全不同</p>
              <input value={personaName} onChange={(event) => setPersonaName(event.target.value)} placeholder="名字" className="soft-input mt-2" />
              <textarea value={persona} rows={3} onChange={(event) => setPersona(event.target.value)} placeholder="身份、性格、和 TA 的关系……" className="soft-input mt-2 resize-none leading-6" />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs" style={{ color: 'var(--m-text-secondary)' }}>世界书（可多选）</p>
                <label className="chip chip-sky" style={{ fontSize: 11, padding: '3px 10px' }}>
                  <Upload size={11} />导入
                  <input type="file" accept="application/json,.json" className="hidden" onChange={(event) => void importBook(event.target.files?.[0])} />
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {withBooks.map((person) => {
                  const on = bookIds.includes(person.id)
                  return (
                    <button key={person.id} type="button" className={on ? 'chip chip-lilac' : 'chip'} style={{ fontSize: 12 }} onClick={() => setBookIds((current) => (on ? current.filter((id) => id !== person.id) : [...current, person.id]))}>
                      📘 {person.characterBook?.name || `${person.name} 的世界书`}
                    </button>
                  )
                })}
                {books.map((book, index) => (
                  <button key={`${book.name}-${index}`} type="button" className="chip chip-sky" style={{ fontSize: 12 }} onClick={() => setBooks((current) => current.filter((_, at) => at !== index))}>📗 {book.name} ×</button>
                ))}
                {withBooks.length === 0 && books.length === 0 ? <span className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>角色卡里没有世界书，可以导入 SillyTavern 世界书 JSON</span> : null}
              </div>
            </div>
            {warn ? <p className="text-xs text-[#b0505c]">{warn}</p> : null}
            <button type="button" className="w-full rounded-full py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(160,130,210,0.3)]" style={{ background: 'linear-gradient(120deg,#B9A3E3,#F3A8BA)' }} onClick={() => void create()}>开始这条番外</button>
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
                      <span className="shrink-0 rounded-full bg-[#E6DDF8] px-2 py-0.5 text-[10px]">{row.count} 段</span>
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
        {props.saves.length === 0 && !creating ? <PillNote tone="lilac">还没有番外，点右上角新建</PillNote> : null}
      </div>
    </div>
  )
}
