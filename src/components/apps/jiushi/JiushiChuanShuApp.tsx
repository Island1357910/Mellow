import { ChevronLeft } from 'lucide-react'
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
import { PillNote } from '../../ui/primitives.tsx'

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
      <div className="flex h-full flex-col bg-[#F5F0E6] px-4 pt-14">
        <button type="button" className="mb-4 self-start rounded-full bg-white/85 px-3 py-1.5 text-xs" onClick={props.onBack}>← 返回</button>
        <PillNote tone="lilac">尚无旧世人物，请先到「人物」纳入。</PillNote>
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-[#F5F0E6]">
      <header className="flex items-center gap-2 px-3 pb-2 pt-10">
        <button type="button" aria-label="返回" className="grid h-9 w-9 place-items-center rounded-full bg-white/85" onClick={props.onBack}>
          <ChevronLeft size={18} />
        </button>
        <select
          value={charId}
          onChange={(event) => setCharId(event.target.value)}
          className="soft-select min-w-0 flex-1 text-sm"
          style={{ fontFamily: '"Songti SC", "Noto Serif SC", serif' }}
        >
          {chars.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </header>

      <div className="scroll min-h-0 flex-1 space-y-3 px-4 pb-4">
        {(thread?.lines ?? []).map((row) => (
          <div
            key={row.at}
            className={`max-w-[90%] rounded-[20px] px-3 py-2 text-sm leading-6 ${row.role === 'user' ? 'ml-auto bg-[#E8DCC8]' : 'bg-white/92'}`}
            style={{ fontFamily: '"Songti SC", "Noto Serif SC", serif' }}
          >
            {row.content}
          </div>
        ))}
        {!thread?.lines.length ? <PillNote tone="lilac">尚无传书，写第一笺吧</PillNote> : null}
      </div>

      <div className="flex items-end gap-2 px-4 pb-4 pt-2">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={2}
          placeholder="落笔…"
          className="soft-input min-h-11 flex-1 resize-none leading-6"
          style={{ fontFamily: '"Songti SC", "Noto Serif SC", serif' }}
        />
        <button type="button" className="chip chip-mint shrink-0 py-2.5" onClick={() => void send()} disabled={!draft.trim() || busy}>
          {busy ? '候笺…' : '寄出'}
        </button>
      </div>
      {note ? <p className="pointer-events-none absolute bottom-16 left-0 right-0 text-center text-xs">{note}</p> : null}
    </div>
  )
}
