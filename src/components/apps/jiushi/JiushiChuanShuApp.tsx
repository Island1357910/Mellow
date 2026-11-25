import { useEffect, useRef, useState } from 'react'
import { isAiJobRunning, jobKey, runAiJob } from '../../../engine/aiJobs.ts'
import {
  isJiushiCharacter,
  listJiushiLetters,
  loadJiushiConfig,
  replyJiushiLetter,
  type JiushiConfig,
  type JiushiLetter,
} from '../../../lib/jiushi.ts'
import { touchImmersive } from '../../../lib/smsGuard.ts'
import { storage } from '../../../storage/StorageService.ts'
import { useMellow } from '../../../store/useMellow.ts'
import type { Character, Identity } from '../../../types/index.ts'
import { JiushiNote, JiushiScreen } from './JiushiShell.tsx'
import { ReplyAssist } from '../ReplyAssist.tsx'

export function JiushiChuanShuApp(props: { phone: Identity; onBack: () => void }) {
  const dataRevision = useMellow((state) => state.dataRevision)
  const [chars, setChars] = useState<Character[]>([])
  const [letters, setLetters] = useState<JiushiLetter[]>([])
  const [config, setConfig] = useState<JiushiConfig | null>(null)
  const [charId, setCharId] = useState('')
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      const [all, rows, cfg] = await Promise.all([
        storage.listCharacters(props.phone.namespace),
        listJiushiLetters(props.phone.namespace),
        loadJiushiConfig(props.phone.namespace),
      ])
      if (!alive) return
      const people = all.filter(isJiushiCharacter)
      setChars(people)
      setLetters(rows)
      setConfig(cfg)
      setCharId((current) => people.some(person => person.id === current) ? current : people[0]?.id || '')
    })()
    return () => {
      alive = false
    }
  }, [props.phone.namespace, dataRevision])

  const person = chars.find((item) => item.id === charId)
  const thread = letters.find((item) => item.charId === charId)
  const busy = person ? isAiJobRunning(jobKey(props.phone.namespace, 'jiushi-letter', person.id)) : false
  const letterCount = thread?.lines.length ?? 0

  useEffect(() => {
    const scroll = scrollRef.current
    if (scroll) scroll.scrollTop = scroll.scrollHeight
  }, [charId, letterCount])

  const send = async (text = draft, clearDraft = true) => {
    if (!person || !config || !text.trim() || busy) return
    touchImmersive('jiushi')
    setNote('正在回信…')
    await new Promise<void>((resolve, reject) => {
      const started = runAiJob(jobKey(props.phone.namespace, 'jiushi-letter', person.id), async () => {
        try {
          await replyJiushiLetter({
            namespace: props.phone.namespace,
            character: person,
            config,
            userText: text.trim(),
          })
          if (clearDraft) setDraft(current => current === text ? '' : current)
          setLetters(await listJiushiLetters(props.phone.namespace))
          setNote('')
          resolve()
        } catch (error) {
          const message = error instanceof Error ? error.message : '传书失败'
          setNote(message)
          reject(new Error(message))
        }
      })
      if (!started) reject(new Error('上一封信还在写'))
    })
  }
  const last = thread?.lines.at(-1)
  const turnId = !busy && last?.role === 'assistant' ? `${charId}:${last.at}` : ''
  const context = (thread?.lines ?? []).slice(-6).map(row => `${row.role === 'user' ? '我的来信' : person?.name ?? '对方'}：${row.content.slice(-900)}`).join('\n')

  if (!chars.length) {
    return (
      <JiushiScreen title="传书" subtitle="短笺往来" onBack={props.onBack}>
        <JiushiNote>尚无旧世人物，请先到「人物」纳入。</JiushiNote>
      </JiushiScreen>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <header className="jiushi-screen-head jiushi-letter-head shrink-0">
        <button type="button" aria-label="返回" className="jiushi-back" onClick={props.onBack}>←</button>
        <div className="jiushi-screen-title">
          <h1>传书</h1>
          <p>与 {person?.name ?? '…'} 短笺往来</p>
        </div>
        <select
          value={charId}
          onChange={(event) => setCharId(event.target.value)}
          className="soft-select jiushi-letter-recipient"
          style={{ fontFamily: 'var(--js-serif)' }}
          aria-label="选择收信人"
        >
          {chars.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </header>

      <div ref={scrollRef} className="scroll min-h-0 min-w-0 flex-1 space-y-3 px-4 pb-4">
        {(thread?.lines ?? []).map((row, index) => (
          <div key={`${row.role}:${row.at}:${index}`} className={row.role === 'user' ? 'jiushi-msg-user' : 'jiushi-msg-theirs'}>
            {row.content}
          </div>
        ))}
        {!thread?.lines.length ? <JiushiNote compact>尚无传书，写第一笺吧</JiushiNote> : null}
      </div>

      <ReplyAssist key={charId} namespace={props.phone.namespace} mode="jiushi" turnId={turnId}
        context={context} draft={draft} disabled={!person || !config || busy} onRewrite={setDraft} onSend={text => send(text, false)} />
      {note ? <p role="status" className="mx-4 mb-1 max-h-20 shrink-0 overflow-y-auto rounded-lg bg-white/90 px-3 py-1.5 text-xs leading-5 [overflow-wrap:anywhere]" style={{ color: 'var(--js-ink-muted)' }}>{note}</p> : null}
      <div className="jiushi-letter-composer flex min-w-0 shrink-0 items-end gap-2 border-t px-4 pt-3" style={{ borderColor: 'var(--js-border-light)' }}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={2}
          placeholder="落笔…"
          className="soft-input min-h-11 min-w-0 flex-1 resize-none leading-6"
          style={{ fontFamily: 'var(--js-serif)' }}
        />
        <button type="button" className="jiushi-btn jiushi-btn-primary shrink-0 px-4 py-2.5" onClick={() => void send().catch(error => setNote(error.message))} disabled={!draft.trim() || busy}>
          {busy ? '候笺…' : '寄出'}
        </button>
      </div>
    </div>
  )
}
