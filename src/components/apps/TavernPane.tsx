import { useState } from 'react'
import { ensureDirectChat, postUserText, replyInChat } from '../../domain/messaging.ts'
import { modePresetId } from '../../lib/defaults.ts'
import { initialOf } from '../../lib/format.ts'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import type { Character, Chat, ChatMessage, Identity } from '../../types/index.ts'
import { candyStyle } from '../../lib/candy.ts'
import { PillNote } from '../ui/primitives.tsx'

export function TavernPane(props: { identity: Identity; namespace: string; title: string; onBack: () => void }) {
  const presets = useMellow((state) => state.presets)
  const settings = useMellow((state) => state.settings)
  const [chars, setChars] = useState<Character[]>([])
  const [chat, setChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loadedNs, setLoadedNs] = useState('')
  if (loadedNs !== props.namespace) {
    setLoadedNs(props.namespace)
    void storage.listCharacters(props.namespace).then(setChars)
  }

  const openChar = async (character: Character) => {
    const thread = await ensureDirectChat(props.namespace, character)
    setChat(thread)
    setMessages(await storage.listMessages(props.namespace, thread.id))
  }

  const send = async () => {
    if (!chat || !draft.trim() || busy) return
    const character = chars.find((item) => item.id === chat.memberIds[0])
    if (!character) return
    setBusy(true)
    setError('')
    const text = draft.trim()
    setDraft('')
    try {
      await postUserText({ namespace: props.namespace, identity: props.identity, chat, text })
      await replyInChat({
        namespace: props.namespace,
        identity: props.identity,
        character,
        chat,
        presets,
        activePresetId: modePresetId(settings, 'sms'),
        fourthWall: settings.fourthWall,
        voiceReady: settings.minimax.ready,
      })
      setMessages(await storage.listMessages(props.namespace, chat.id))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '没说出来')
    } finally {
      setBusy(false)
    }
  }

  const wash = props.title === '番外' ? '#C9B6E8' : '#9ED9C4'
  return (
    <div className="candy-shell flex h-full min-h-0" style={candyStyle(wash, '#F8D0DC', '#F8E6C0')}>
      <aside className="hidden w-56 shrink-0 flex-col md:flex">
        <div className="flex items-center gap-2 px-3 pb-2 pt-12">
          <button type="button" className="rounded-full bg-white/80 px-3 py-1 text-sm" onClick={props.onBack}>返回</button>
          <span className="text-sm font-medium">{props.title}</span>
        </div>
        <div className="scroll min-h-0 flex-1 px-2 pb-4">
          {chars.map((character) => (
            <button key={character.id} type="button" className="mb-1.5 flex w-full items-center gap-2 rounded-2xl px-2 py-2 text-left text-sm shadow-[0_6px_14px_rgba(120,80,100,0.04)]" style={{ background: chat?.memberIds[0] === character.id ? '#F8D0DC' : 'rgba(255,255,255,0.78)' }} onClick={() => void openChar(character)}>
              <Face avatar={character.avatar} name={character.name} />
              <span className="truncate">{character.name}</span>
            </button>
          ))}
          {chars.length === 0 ? <PillNote tone="butter">这里还没有角色</PillNote> : null}
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 px-3 pb-2 pt-12 md:pt-4">
          <button type="button" className="rounded-full bg-white/80 px-3 py-1 text-sm md:hidden" onClick={props.onBack}>返回</button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{chat?.title || props.title}</p>
            <p className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{busy ? '正在输入中……' : '面对面的记录'}</p>
          </div>
          <select className="soft-select max-w-36 text-xs md:hidden" value={chat?.memberIds[0] ?? ''} onChange={(event) => {
            const character = chars.find((item) => item.id === event.target.value)
            if (character) void openChar(character)
          }}>
            <option value="">选角色</option>
            {chars.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
          </select>
        </header>
        <div className="scroll min-h-0 flex-1 space-y-3 px-4 py-4">
          {messages.map((message) => {
            const mine = message.role === 'user'
            return (
              <article key={message.id} className={mine ? 'flex justify-end' : 'flex justify-start'}>
                <div className="max-w-[82%] rounded-[20px] px-3 py-2 shadow-[0_8px_16px_rgba(120,80,100,0.05)]" style={{ background: mine ? '#F8D0DC' : 'rgba(255,255,255,0.88)' }}>
                  <p className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{mine ? props.identity.name : chars.find((item) => item.id === message.charId)?.name || '旁白'}</p>
                  <p className="readable mt-1 whitespace-pre-wrap text-sm leading-7">{message.content}</p>
                </div>
              </article>
            )
          })}
          {messages.length === 0 ? <PillNote tone={props.title === '番外' ? 'lilac' : 'mint'}>选一个角色，从下面写一句</PillNote> : null}
        </div>
        {error ? <div className="px-4"><PillNote tone="peach" inline>{error}</PillNote></div> : null}
        <form className="flex gap-2 px-3 pb-4" onSubmit={(event) => { event.preventDefault(); void send() }}>
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={2} placeholder={chat ? '写一句' : '先选一个人'} className="readable min-w-0 flex-1 resize-none rounded-[22px] bg-white/85 px-3 py-2 text-sm shadow-[0_8px_16px_rgba(120,80,100,0.05)] outline-none" />
          <button type="submit" disabled={!chat || busy} className="rounded-full px-4 text-sm" style={{ background: wash }}>{busy ? '…' : '发送'}</button>
        </form>
      </section>
    </div>
  )
}

function Face(props: { avatar: string; name: string }) {
  if (props.avatar.startsWith('data:')) return <img src={props.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
  return <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-xs">{props.avatar || initialOf(props.name)}</span>
}
