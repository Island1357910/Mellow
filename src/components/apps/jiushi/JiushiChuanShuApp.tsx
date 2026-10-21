import { useEffect, useState } from 'react'
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

export function JiushiChuanShuApp(props: { phone: Identity; onBack: () => void }) {
  const dataRevision = useMellow((state) => state.dataRevision)
  const [chars, setChars] = useState<Character[]>([])
  const [letters, setLetters] = useState<JiushiLetter[]>([])
  const [config, setConfig] = useState<JiushiConfig | null>(null)
  const [charId, setCharId] = useState('')
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState('')

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
      setCharId((current) => current || people[0]?.id || '')
    })()
    return () => {
      alive = false
    }
  }, [props.phone.namespace, dataRevision])

  const person = chars.find((item) => item.id === charId)
  const thread = letters.find((item) => item.charId === charId)
  const busy = person ? isAiJobRunning(jobKey(props.phone.namespace, 'jiushi-letter', person.id)) : false

  const send = async () => {
    if (!person || !config || !draft.trim()) return
    touchImmersive('jiushi')
    setNote('正在回信…')
    runAiJob(jobKey(props.phone.namespace, 'jiushi-letter', person.id), async () => {
      try {
        await replyJiushiLetter({
          namespace: props.phone.namespace,
          character: person,
          config,
          userText: draft.trim(),
        })
        setDraft('')
        setLetters(await listJiushiLetters(props.phone.namespace))
        setNote('')
      } catch (error) {
        setNote(error instanceof Error ? error.message : '传书失败')
      }
    })
  }

  if (!chars.length) {
    return (
      <JiushiScreen title="传书" subtitle="短笺往来" onBack={props.onBack}>
        <JiushiNote>尚无旧世人物，请先到「人物」纳入。</JiushiNote>
      </JiushiScreen>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <header className="jiushi-screen-head">
        <button type="button" aria-label="返回" className="jiushi-back" onClick={props.onBack}>←</button>
        <div className="jiushi-screen-title">
          <h1>传书</h1>
          <p>与 {person?.name ?? '…'} 短笺往来</p>
        </div>
        <select
          value={charId}
          onChange={(event) => setCharId(event.target.value)}
          className="soft-select max-w-[5.5rem] shrink-0 text-xs"
          style={{ fontFamily: 'var(--js-serif)' }}
          aria-label="选择收信人"
        >
          {chars.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </header>

      <div className="scroll min-h-0 flex-1 space-y-3 px-4 pb-4">
        {(thread?.lines ?? []).map((row) => (
          <div key={row.at} className={row.role === 'user' ? 'jiushi-msg-user' : 'jiushi-msg-theirs'}>
            {row.content}
          </div>
        ))}
        {!thread?.lines.length ? <JiushiNote compact>尚无传书，写第一笺吧</JiushiNote> : null}
      </div>

      <div className="flex items-end gap-2 border-t px-4 pb-4 pt-3" style={{ borderColor: 'var(--js-border-light)' }}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={2}
          placeholder="落笔…"
          className="soft-input min-h-11 flex-1 resize-none leading-6"
          style={{ fontFamily: 'var(--js-serif)' }}
        />
        <button type="button" className="jiushi-btn jiushi-btn-primary shrink-0 px-4 py-2.5" onClick={() => void send()} disabled={!draft.trim() || busy}>
          {busy ? '候笺…' : '寄出'}
        </button>
      </div>
      {note ? <p className="pointer-events-none absolute bottom-16 left-0 right-0 text-center text-xs" style={{ color: 'var(--js-ink-muted)' }}>{note}</p> : null}
    </div>
  )
}
