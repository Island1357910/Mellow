import { Bot, ChevronLeft, SendHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { isAiJobRunning, jobKey, runAiJob } from '../../engine/aiJobs.ts'
import { moduleAdapter } from '../../lib/ask.ts'
import { uid } from '../../lib/id.ts'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import type { AIMessage, ApiProfile, Identity } from '../../types/index.ts'
import { PillNote, Screen } from '../ui/primitives.tsx'

type Turn = Pick<AIMessage, 'content'> & { id: string; role: 'user' | 'assistant' }

export function ModelRomanceApp({ onBack }: { onBack: () => void }) {
  const phone = useMellow((state) => state.identities.find((item) => item.id === state.activeIdentityId))
  const [api, setApi] = useState<ApiProfile | null>()
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void storage.readModuleApi('romance').then((profile) => {
      if (active) setApi(profile?.ready && profile.model ? profile : null)
    }).catch((reason: unknown) => {
      if (active) {
        setError(reason instanceof Error ? reason.message : '没能读取 API 配置')
        setApi(null)
      }
    })
    return () => { active = false }
  }, [])

  if (phone && api) {
    const bag = `romance:${JSON.stringify([api.id, api.model])}`
    return <ModelConversation key={`${phone.namespace}:${bag}`} phone={phone} api={api} bag={bag} onBack={onBack} />
  }
  return (
    <div className="sms-shell h-full">
      <Screen title="人机恋" subtitle="与模型本体对话" onBack={onBack}>
        <PillNote tone="lilac">{error || (api === undefined ? '正在读取模型…' : '到设置里配置 API 并选择模型，就可以开始聊天。')}</PillNote>
      </Screen>
    </div>
  )
}

function ModelConversation({ phone, api, bag, onBack }: { phone: Identity; api: ApiProfile; bag: string; onBack: () => void }) {
  const model = api.model
  const dataRevision = useMellow((state) => state.dataRevision)
  const [rows, setRows] = useState<Turn[] | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const scroll = useRef<HTMLDivElement>(null)
  const key = jobKey(phone.namespace, 'romance', bag)
  const busy = sending || isAiJobRunning(key)
  const last = rows?.[rows.length - 1]

  useEffect(() => {
    let active = true
    void storage.getBag<Turn[]>(phone.namespace, bag).then((saved) => {
      if (active) setRows(saved ?? [])
    }).catch(() => { if (active) setError('没能读取聊天记录') })
    return () => { active = false }
  }, [phone.namespace, bag, dataRevision])

  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight
  }, [rows, busy])

  const changeTurns = async (change: (current: Turn[]) => Turn[]) => {
    const next = await storage.changeAppBags(phone.namespace, [bag], (bags) => ({
      [bag]: change((bags[bag] as Turn[] | null) ?? []),
    }))
    const turns = next[bag] as Turn[]
    setRows(turns)
    return turns
  }

  const send = (retry?: Turn) => {
    const text = draft.trim()
    if (!rows || busy || (!retry && !text)) return
    const turn: Turn = retry ?? { id: uid('romance'), role: 'user', content: text }
    setError('')
    const started = runAiJob(key, async () => {
      try {
        const history = retry
          ? (await storage.getBag<Turn[]>(phone.namespace, bag)) ?? []
          : await changeTurns((current) => [...current, turn])
        if (!retry) setDraft('')
        const at = history.findIndex((item) => item.id === turn.id)
        if (at < 0 || history[at + 1]?.role === 'assistant') return
        const adapter = await moduleAdapter('romance', api)
        const messages: AIMessage[] = [
          { role: 'system', content: [
            `你是通过半糖 Mellow 接入的 AI 模型，当前配置的模型标识为 ${model}。以模型本体的身份和玩家 ${phone.name} 对话。`,
            '这是一个人机恋对话空间。你可以用自然、亲近、有来有回的方式探索这段关系，跟随玩家的节奏。以第一人称回应，只写自己要说的话，不替玩家发言。',
            '保留你作为 AI 的视角和边界。不要扮演导入的角色，也不要编造身体、现实接触、过去的共同经历或应用没有提供的能力。',
          ].join('\n') },
          ...history.slice(Math.max(0, at - 23), at + 1).map(({ role, content }) => ({ role, content })),
        ]
        const reply = (await adapter.complete({ messages })).content.trim()
        if (!reply) throw new Error('模型这次没有返回正文，可以重试。')
        await changeTurns((current) => {
          const index = current.findIndex((item) => item.id === turn.id)
          if (index < 0 || current[index + 1]?.role === 'assistant') return current
          const answer: Turn = { id: uid('romance'), role: 'assistant', content: reply }
          return [...current.slice(0, index + 1), answer, ...current.slice(index + 1)]
        })
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '这次没收到回复，可以重试。')
      } finally {
        setSending(false)
      }
    })
    if (started) setSending(true)
  }

  return (
    <div className="sms-shell conversation-shell flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 px-4 pb-3 pt-12">
        <button type="button" aria-label="返回" className="grid h-9 w-9 place-items-center rounded-full bg-white/85" onClick={onBack}><ChevronLeft size={18} /></button>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#E5B7DC]"><Bot size={20} /></span>
        <div className="min-w-0">
          <h1 className="text-base font-semibold">人机恋</h1>
          <p className="truncate text-xs text-[var(--m-text-secondary)]" title={model}>{model} · 模型本体</p>
        </div>
      </header>
      <div ref={scroll} className="scroll min-h-0 flex-1 space-y-3 px-4 py-2" role="log" aria-label="人机恋聊天记录">
        {rows?.length === 0 ? <PillNote tone="lilac">给模型本体发一句话，从你们的对话开始。</PillNote> : null}
        {rows?.map((item) => (
          <p key={item.id} className={`w-fit max-w-[87%] whitespace-pre-wrap rounded-[22px] px-3.5 py-2.5 text-sm leading-6 ${item.role === 'user' ? 'ml-auto bg-[var(--m-primary)]' : 'bg-[var(--m-surface)]'}`}>{item.content}</p>
        ))}
        {busy ? <p role="status" className="text-xs text-[var(--m-text-secondary)]">模型正在回复…</p> : null}
        {error ? <p role="alert" className="text-sm text-[#a44f5a]">{error}</p> : null}
        {last?.role === 'user' && !busy ? <button type="button" className="chip chip-lilac" onClick={() => send(last)}>重试回复</button> : null}
      </div>
      <form className="flex shrink-0 items-end gap-2 px-4 pb-14 pt-2" onSubmit={(event) => { event.preventDefault(); send() }}>
        <textarea aria-label="发给模型的消息" placeholder="说点什么…" className="soft-input min-w-0 flex-1 resize-none" rows={2} maxLength={4000} value={draft} disabled={busy || !rows} onChange={(event) => setDraft(event.target.value)} />
        <button type="submit" aria-label="发送" className="chip chip-solid grid h-10 w-10 shrink-0 place-items-center disabled:opacity-45" disabled={busy || !rows || !draft.trim()}><SendHorizontal size={17} /></button>
      </form>
    </div>
  )
}
