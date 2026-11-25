import { useEffect, useState, type FormEvent } from 'react'
import { BookOpen, FlaskConical } from 'lucide-react'
import { workshop, workshopKinds, workshopURL, type OwnWork, type PublicWork, type WorkshopUser } from '../../lib/workshop.ts'
import { Screen } from '../ui/primitives.tsx'
import { DlcPreview } from './WorkshopCommunity.tsx'
import { WorkshopOracle } from './WorkshopOracle.tsx'
import { WorkshopPlay } from './WorkshopPlay.tsx'

export type ReviewSummary = Pick<OwnWork, 'id' | 'title' | 'summary' | 'category' | 'revision' | 'hasCover'>
type ReviewDraft = OwnWork & { canTest: boolean; launchExample: boolean }
type Turn = { role: 'user' | 'assistant'; content: string }

function sections(title: string, text: string | undefined) {
  if (!text?.trim()) return []
  const parts = text.trim().split(/(?:^|\n\s*\n)【([^\r\n】]{1,50})】[ \t]*\r?\n/)
  const result = parts[0].trim() ? [{ title, body: parts[0].trim() }] : []
  for (let index = 1; index < parts.length; index += 2) {
    if (parts[index + 1].trim()) result.push({ title: parts[index], body: parts[index + 1].trim() })
  }
  return result
}

export function WorkshopReview({ item, user, onBack, onDecision }: {
  item: ReviewSummary; user: WorkshopUser; onBack: () => void; onDecision: () => void
}) {
  const [draft, setDraft] = useState<ReviewDraft>()
  const [tab, setTab] = useState<'reading' | 'testing' | 'sample' | 'oracle'>('reading')
  const [turns, setTurns] = useState<Turn[]>([])
  const [message, setMessage] = useState('')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const path = '/review/' + item.id
  useEffect(() => {
    const controller = new AbortController()
    workshop<ReviewDraft>(path + '?revision=' + item.revision, 'GET', undefined, controller.signal)
      .then(setDraft).catch(error => { if (!controller.signal.aborted) setStatus(error.message) })
    return () => controller.abort()
  }, [path, item.revision])

  async function run(task: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setStatus('')
    try { await task() }
    catch (error) { setStatus(error instanceof Error ? error.message : '操作失败。') }
    finally { setBusy(false) }
  }

  function send(text: string, action?: number) {
    if (!draft?.canTest || !text.trim()) return
    void run(async () => {
      const pending: Turn[] = [...turns, { role: 'user', content: text.trim() }]
      const messages = pending.slice(-15).map(turn => ({ ...turn, content: turn.content.slice(0, 8000) }))
      while (JSON.stringify(messages).length > 45_000) messages.shift()
      const { reply } = await workshop<{ reply: string }>(path + '/test', 'POST', { revision: item.revision, messages, action })
      setTurns([...pending, { role: 'assistant' as const, content: reply }].slice(-30))
      if (action === undefined) setMessage('')
    })
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    send(message)
  }

  const preview: PublicWork | undefined = draft && {
    id: draft.id, type: draft.type, category: draft.category, creatorId: user.id, creatorName: '',
    title: draft.title, summary: draft.summary, endpoints: draft.endpoints, launchExample: draft.launchExample,
    display: { app: draft.content.app, theme_color: draft.content.theme_color, greeting: draft.content.greeting, buttons: draft.content.custom_buttons?.map(button => button.label) },
  }
  if (tab === 'sample' && preview) return <WorkshopPlay item={preview} user={user} library={[]} reviewRevision={item.revision} onBack={() => setTab('testing')} />
  if (tab === 'oracle' && preview) return <WorkshopOracle item={preview} onBack={() => setTab('testing')} />
  const entries = draft ? [
    ...sections('角色设定', draft.content.persona),
    ...sections('世界设定', draft.content.world),
    ...sections('公开开场', draft.content.greeting),
    ...sections('扩展规则', draft.content.system_prompt_addon),
    ...(draft.content.custom_buttons ?? []).map(button => ({ title: button.label, body: button.instruction })),
  ] : []

  return <Screen className="workshop-screen" title={item.title} subtitle={workshopKinds[item.category] + ' · 版本 ' + item.revision} onBack={onBack}>
    <div className="workshop workshop-market">
      {!draft && !status && <p role="status">正在读取待审核内容…</p>}
      {draft && <><nav className="workshop-tabs" aria-label="审核内容">
        <button type="button" aria-pressed={tab === 'reading'} onClick={() => setTab('reading')}><BookOpen size={15} /> 内容与世界书</button>
        <button type="button" aria-pressed={tab === 'testing'} onClick={() => setTab('testing')}><FlaskConical size={15} /> 测试效果</button>
      </nav>
      {tab === 'reading' ? <>
        {item.hasCover && <img className="workshop-review-cover" src={workshopURL + path + '/cover?revision=' + item.revision} alt={item.title + '的待审封面'} />}
        {item.summary && <p>{item.summary}</p>}
        {entries.map((entry, index) => <details key={index} className="workshop-review-entry">
          <summary>{entry.title}</summary>
          <p className="whitespace-pre-wrap break-words">{entry.body}</p>
        </details>)}
        {!entries.length && <p>没有附加世界书条目。</p>}
      </> : <>
        {draft.type === 'dlc' && preview && <DlcPreview item={preview} />}
        {preview?.display.app === 'oracle' && <button type="button" className="workshop-primary" onClick={() => setTab('oracle')}>试用占卜室</button>}
        {draft.content.greeting && <p className="whitespace-pre-wrap break-words">{draft.content.greeting}</p>}
        {draft.launchExample && <button type="button" onClick={() => setTab('sample')}>用自己的接口测试公开试玩版</button>}
        {(draft.type === 'character' || draft.content.system_prompt_addon || draft.content.custom_buttons?.length) ? draft.canTest ? <>
          <div role="log" aria-label="审核测试对话">{turns.map((turn, index) => <article key={index}>
            <strong>{turn.role === 'user' ? '我' : item.title}</strong>
            <p className="whitespace-pre-wrap break-words">{turn.content}</p>
          </article>)}</div>
          <div className="workshop-row">
            {draft.content.custom_buttons?.map((button, index) => <button key={index} type="button" disabled={busy} onClick={() => send(button.label, index)}>{button.label}</button>)}
          </div>
          <form onSubmit={submit}>
            <label>测试输入<textarea required maxLength={8000} value={message} disabled={busy} onChange={event => setMessage(event.target.value)} /></label>
            <button className="workshop-primary" disabled={busy || !message.trim()}>{busy ? '生成中…' : '用审核模型测试完整设定'}</button>
          </form>
        </> : <p>测试完整设定需要服务器配置受信任的审核模型。</p> : null}
      </>}
      <label>审核意见<textarea maxLength={800} value={note} onChange={event => setNote(event.target.value)} /></label>
      <div className="workshop-row">
        {(['approved', 'rejected'] as const).map(decision => <button key={decision} type="button" disabled={busy}
          className={decision === 'approved' ? 'workshop-primary' : undefined} onClick={() => void run(async () => {
            await workshop(path, 'POST', { decision, revision: item.revision, note })
            onDecision()
          })}>{decision === 'approved' ? '通过并上架' : '退回'}</button>)}
      </div></>}
      <p role="status">{status}</p>
    </div>
  </Screen>
}
