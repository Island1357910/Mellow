import { useEffect, useState } from 'react'
import { isAiJobRunning } from '../../engine/aiJobs.ts'
import { chatMemoryJobKey, normalizeChatMemory, patchChatMemory, pendingChatTurns, readChatMemory, scheduleChatMemory } from '../../lib/chatMemory.ts'
import { useMellow } from '../../store/useMellow.ts'
import type { ChatMessage } from '../../types/index.ts'
import { NumericInput } from '../ui/NumericInput.tsx'
import { Toggle } from '../ui/primitives.tsx'

export function ChatMemoryPanel(props: { namespace: string; chatId: string; messages: ChatMessage[]; group: boolean }) {
  const revision = useMellow(state => state.dataRevision)
  const [memory, setMemory] = useState(() => normalizeChatMemory(null))
  const [loadedAt, setLoadedAt] = useState(Date.now)
  const [draft, setDraft] = useState<string | null>(null)
  const [note, setNote] = useState('')
  useEffect(() => {
    let alive = true
    void readChatMemory(props.namespace, props.chatId).then(value => { if (alive) { setMemory(value); setLoadedAt(Date.now()) } }).catch(() => { if (alive) setNote('长期记忆读取失败，请重新打开会话。') })
    return () => { alive = false }
  }, [props.namespace, props.chatId, revision])
  const pending = pendingChatTurns(props.messages, memory).length
  const busy = isAiJobRunning(chatMemoryJobKey(props.namespace, props.chatId)) || Boolean(memory.running && memory.running.until > loadedAt)
  const update = async (patch: Parameters<typeof patchChatMemory>[2]) => {
    try {
      await patchChatMemory(props.namespace, props.chatId, patch)
      setMemory(await readChatMemory(props.namespace, props.chatId))
      setNote('已保存')
      return true
    } catch { setNote('保存失败，请重试'); return false }
  }
  return <section className="menu-card mt-3 space-y-3">
    <h3 className="text-sm font-medium">长期记忆整理</h3>
    <Toggle label="按轮数自动整理" on={memory.enabled} onChange={enabled => void update({ enabled })}
      hint="默认每 10 轮后台整理一次，使用本会话的短信 API，会额外产生一次整理请求。关闭后仍会使用已保存的记忆。"/>
    <label className="block text-xs">每满多少轮整理一次
      <NumericInput className="soft-input mt-1" aria-label="记忆整理轮数" min={1} max={100} value={memory.interval} onValueChange={interval => void update({ interval })}/>
    </label>
    <p className="text-xs leading-5" style={{ color: 'var(--m-text-secondary)' }}>玩家发言后获得角色回复计 1 轮，连发和主动消息不额外计数。待整理 {pending} 轮 · 已整理 {memory.rounds} 轮。历史积压每次按一批整理。</p>
    <button type="button" className="chip chip-solid" disabled={busy || pending === 0} onClick={() => {
      if (scheduleChatMemory(props.namespace, props.chatId, true)) { setNote('正在整理，退出页面后仍会继续'); useMellow.getState().touchData() }
    }}>{busy ? '正在整理…' : memory.error ? '重试整理' : '立即整理'}</button>
    {memory.updatedAt && <p className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>上次整理：{new Date(memory.updatedAt).toLocaleString('zh-CN')}</p>}
    <label className="block text-xs">自动整理的长期记忆（每次回复都会带上）
      <textarea aria-label="自动整理的长期记忆" className="soft-input mt-2 leading-6" rows={8} maxLength={6000}
        value={draft ?? memory.text} placeholder="聊天满设定轮数后，会把关系变化、偏好、约定和重要事件整理到这里，也可以手动修改。"
        onChange={event => {
          if (draft === null) void update({}) // Invalidate a pending automatic write before editing.
          setDraft(event.target.value)
        }} onBlur={() => {
          if (draft !== null) void update({ text: draft }).then(saved => { if (saved) setDraft(null) })
        }}/>
    </label>
    <p className="text-[11px] leading-5" style={{ color: 'var(--m-text-secondary)' }}>{props.group ? '只来自本群公开聊天，保留每个人的姓名和经历归属。' : '只来自当前身份的这段私聊。'}整理会合并旧记忆，不改写上方手填的过往与关系；删聊天记录不会自动清空已整理的记忆。</p>
    <button type="button" className="chip chip-danger text-xs" disabled={!memory.text && !draft} onClick={() => {
      void update({ text: '' }).then(saved => { if (saved) setDraft(null) })
    }}>清空长期记忆</button>
    {(memory.error || note) && <p role="status" className="text-xs leading-5" style={{ color: memory.error ? 'var(--m-error)' : 'var(--m-text-secondary)' }}>{memory.error || note}</p>}
  </section>
}
