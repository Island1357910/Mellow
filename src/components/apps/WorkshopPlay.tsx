import { useState, type FormEvent } from 'react'
import { modelEndpoint, workshop, workshopEndpointPolicy, type PublicWork, type WorkshopUser } from '../../lib/workshop.ts'
import { decryptSecret } from '../../storage/crypto.ts'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import { Screen } from '../ui/primitives.tsx'

type Turn = { role: 'user' | 'assistant'; content: string; receipt?: string }

export function WorkshopPlay({ item, library, user, onBack, reviewRevision, fullPlay = false }: {
  item: PublicWork; library: PublicWork[]; user: WorkshopUser; onBack: () => void; reviewRevision?: number; fullPlay?: boolean
}) {
  const profiles = useMellow(state => state.apiProfiles)
  const identity = useMellow(state => state.activeIdentityId)
  const localKey = ['mellow-workshop', user.id, identity, item.id, ...(fullPlay ? ['full'] : [])].join(':')
  const [turns, setTurns] = useState<Turn[]>(() => {
    if (reviewRevision !== undefined) return []
    try { return JSON.parse(localStorage.getItem(localKey) ?? '[]') }
    catch { return [] }
  })
  const [selected, setSelected] = useState(() => library.filter(work => work.type === 'dlc' && work.enabled).slice(0, 4).map(work => work.id))
  const [configuration, setConfiguration] = useState('')
  const [manualEndpoint, setManualEndpoint] = useState('')
  const [manualKey, setManualKey] = useState('')
  const [manualModel, setManualModel] = useState('')
  const [approvedDestination, approveDestination] = useState('')
  const [message, setMessage] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const extensions = library.filter(work => work.type === 'dlc' && work.enabled)
  const active = extensions.filter(work => selected.includes(work.id))
  const policy = workshopEndpointPolicy([item, ...active.filter(work => work.display.usesModel)])
  const allowed = policy ?? []
  const freeEndpoint = policy === null
  const allowedDestination = (url: string) => /^https:\/\//i.test(url) && (freeEndpoint || allowed.includes(url))
  const matchingProfiles = profiles.filter(row => row.ready && row.hasKey && allowedDestination(modelEndpoint(row.endpoint)))
  const profile = matchingProfiles.find(row => row.id === configuration)
  const destination = profile ? modelEndpoint(profile.endpoint) : configuration === 'manual' && manualEndpoint.trim() ? modelEndpoint(manualEndpoint.trim()) : ''
  const theme = active.find(work => /^#[a-fA-F0-9]{6}$/.test(work.display.theme_color ?? ''))?.display.theme_color
  const ready = allowedDestination(destination) && approvedDestination === destination &&
    Boolean(profile || (configuration === 'manual' && manualKey.trim() && manualModel.trim()))

  function saveHistory(history: Turn[]) {
    setTurns(history)
    if (reviewRevision !== undefined) return
    try { localStorage.setItem(localKey, JSON.stringify(history)) }
    catch { setNote('本地存储空间不足，这次对话只能保留在当前页面。') }
  }

  async function send(text: string, button?: { id: string; index: number }) {
    if (!ready || busy || !text.trim()) return
    setBusy(true)
    setNote('')
    try {
      let key = manualKey.trim()
      const model = profile?.model ?? manualModel.trim()
      if (profile) {
        const saved = await storage.readApi(profile.id)
        if (!saved?.ready || !saved.encryptedKey || modelEndpoint(saved.endpoint) !== destination || saved.model !== model) {
          throw new Error('已保存的接口设置有改动，请重新打开工坊后再选择。')
        }
        key = await decryptSecret(saved.encryptedKey)
      }
      const pending: Turn[] = [...turns, { role: 'user', content: text }]
      const context = pending.slice(-23).map(turn => ({ ...turn, content: turn.content.slice(0, 8000) }))
      while (JSON.stringify(context).length > 45_000) context.shift()
      const request = {
        endpoint: destination, key, model, dlc: selected, messages: context, button,
      }
      const { reply, receipt } = reviewRevision === undefined
        ? await workshop<{ reply: string; receipt?: string }>('/play/' + item.id + (fullPlay ? '/protected' : ''), 'POST', request)
        : await workshop<{ reply: string; receipt?: string }>('/review/' + item.id + '/test', 'POST', { revision: reviewRevision, simulation: request })
      const next: Turn[] = [...pending, { role: 'assistant', content: reply, ...(receipt ? { receipt } : {}) }]
      saveHistory(next.slice(-160))
      if (!button) setMessage('')
    } catch (error) {
      setNote(error instanceof Error ? error.message : '发送失败')
    } finally { setBusy(false) }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void send(message.trim())
  }

  return <Screen title={item.title} subtitle={reviewRevision === undefined ? '工坊对话' : '首发试玩'} onBack={onBack}>
    <div className="workshop" style={{ borderTop: theme ? '4px solid ' + theme : undefined }}>
      {extensions.length > 0 && <fieldset>
        <legend>本次使用的已启用 DLC · 最多 4 个</legend>
        {extensions.map(work => <label className="workshop-row" key={work.id}>
          <input type="checkbox" checked={selected.includes(work.id)} disabled={busy || (selected.length >= 4 && !selected.includes(work.id))}
            onChange={event => setSelected(event.target.checked ? [...selected, work.id] : selected.filter(id => id !== work.id))} />{work.title}
        </label>)}
      </fieldset>}
      <label>使用自己的模型 API<select value={configuration} disabled={busy} onChange={event => setConfiguration(event.target.value)}>
        <option value="">选择接口</option>
        {matchingProfiles.map(row => <option key={row.id} value={row.id}>{row.name} · {row.model}</option>)}
        <option value="manual">手动填写</option>
      </select></label>
      {freeEndpoint && <p>创作者未限制接口和模型，可手动填写，也可使用已保存的 API。</p>}
      {!freeEndpoint && !allowed.length && <p>这些作品目前没有共同授权的接口。可以取消选用部分 DLC 后再试。</p>}
      {configuration === 'manual' && <>
        <label>模型请求地址{freeEndpoint ? <input type="url" maxLength={500} value={manualEndpoint} disabled={busy} onChange={event => setManualEndpoint(event.target.value)} placeholder="OpenAI 兼容的公网 HTTPS 接口" /> : <select value={manualEndpoint} disabled={busy} onChange={event => setManualEndpoint(event.target.value)}>
          <option value="">选择创作者授权的地址</option>
          {allowed.map(address => <option key={address}>{address}</option>)}
        </select>}</label>
        <label>模型名<input maxLength={120} value={manualModel} disabled={busy} onChange={event => setManualModel(event.target.value)} /></label>
        <label>模型 API 密钥<input type="password" maxLength={1024} autoComplete="off" value={manualKey} disabled={busy} onChange={event => setManualKey(event.target.value)} /></label>
      </>}
      {allowedDestination(destination) && <label className="workshop-destination">
        <span>{destination}</span>
        <span><input type="checkbox" checked={approvedDestination === destination} disabled={busy} onChange={event => approveDestination(event.target.checked ? destination : '')} />
          我信任这个接口，允许半糖将我的密钥、本轮对话{fullPlay ? '和作品设定' : ''}发给它。</span>
      </label>}
      {item.display.greeting && <article className="whitespace-pre-wrap break-words">{item.display.greeting}</article>}
      <div role="log" aria-label="聊天记录">
        {turns.map((turn, index) => <article key={index}><strong>{turn.role === 'user' ? '我' : item.title}</strong><p className="whitespace-pre-wrap break-words">{turn.content}</p></article>)}
      </div>
      <div className="workshop-row">
        {active.flatMap(work => (work.display.buttons ?? []).map((label, index) => (
          <button key={work.id + index} disabled={busy || !ready} onClick={() => void send(label, { id: work.id, index })}>{label}</button>
        )))}
      </div>
      <form onSubmit={submit}>
        <label>说点什么<textarea required maxLength={8000} value={message} disabled={busy} onChange={event => setMessage(event.target.value)} /></label>
        <div className="workshop-row">
          <button disabled={busy || !ready}>{busy ? '等待回复…' : '发送'}</button>
          <button type="button" disabled={busy || !turns.length} onClick={() => {
            if (window.confirm('清空这段对话？')) saveHistory([])
          }}>清空对话</button>
        </div>
      </form>
      <p role="status">{note}</p>
    </div>
  </Screen>
}
