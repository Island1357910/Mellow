import { useState } from 'react'
import { deliverSms } from '../../domain/messaging.ts'
import { modePresetId } from '../../lib/defaults.ts'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import type { Notice } from '../../types/index.ts'

export function NotificationLayer() {
  const notices = useMellow((state) => state.notices)
  if (notices.length === 0) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 top-12 z-50 space-y-2 px-3">
      {notices.map((notice) => (
        <Banner key={notice.id} notice={notice} />
      ))}
    </div>
  )
}

function Banner(props: { notice: Notice }) {
  const dismissNotice = useMellow((state) => state.dismissNotice)
  const requestOpenChat = useMellow((state) => state.requestOpenChat)
  const refreshInbox = useMellow((state) => state.refreshInbox)
  const [replying, setReplying] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const notice = props.notice

  const dismiss = async (markRead: boolean) => {
    if (markRead && notice.chatId && notice.identityId) {
      const identity = useMellow.getState().identities.find((item) => item.id === notice.identityId)
      if (identity) {
        await storage.markChatRead(identity.namespace, notice.chatId)
        await refreshInbox()
      }
    }
    dismissNotice(notice.id)
  }

  return (
    <article className="pointer-events-auto rounded-3xl bg-white/90 p-3 shadow-[var(--m-shadow)] backdrop-blur">
      <button
        type="button"
        className="block w-full text-left"
        onClick={() => {
          if (notice.chatId) requestOpenChat({ chatId: notice.chatId, identityId: notice.identityId })
          dismissNotice(notice.id)
        }}
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-medium">{notice.title}</span>
          <span className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>
            刚刚
          </span>
        </span>
        <span className="mt-1 line-clamp-2 block text-xs leading-5" style={{ color: 'var(--m-text-secondary)' }}>
          {notice.body}
        </span>
      </button>
      <div className="mt-2 flex items-center gap-2">
        {notice.kind === 'message' && notice.chatId ? (
          <button type="button" className="rounded-full bg-[var(--m-primary)] px-3 py-1 text-xs" onClick={() => setReplying((value) => !value)}>
            回复
          </button>
        ) : null}
        <button type="button" className="rounded-full bg-black/5 px-3 py-1 text-xs" onClick={() => void dismiss(notice.kind === 'message')}>
          {notice.kind === 'message' ? '已读' : '知道了'}
        </button>
      </div>
      {replying ? (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const value = text.trim()
            if (!value || sending) return
            setSending(true)
            void quickReply(notice, value)
              .then(() => dismissNotice(notice.id))
              .finally(() => setSending(false))
          }}
        >
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={sending ? '正在送出' : '写一句'}
            className="min-w-0 flex-1 rounded-full bg-[#f6f1ea] px-3 py-2 text-sm outline-none"
          />
          <button type="submit" className="rounded-full px-3 text-sm" style={{ background: 'var(--m-accent)' }}>
            送出
          </button>
        </form>
      ) : null}
    </article>
  )
}

async function quickReply(notice: Notice, text: string): Promise<void> {
  const state = useMellow.getState()
  const identity = state.identities.find((item) => item.id === notice.identityId)
  if (!identity || !notice.chatId || !notice.charId) return
  const character = await storage.getCharacter(identity.namespace, notice.charId)
  const chat = await storage.getChat(identity.namespace, notice.chatId)
  if (!character || !chat) return
  state.beginReply(chat.id)
  try {
    const reply = await deliverSms({
      namespace: identity.namespace,
      identity,
      character,
      chat,
      text,
      presets: state.presets,
      activePresetId: modePresetId(state.settings, 'sms'),
      fourthWall: state.settings.fourthWall,
    })
    await state.refreshInbox()
    if (reply.kind === 'system') {
      await state.pushNotice({
        kind: 'toast',
        title: '没送出去',
        body: reply.content,
        appId: 'messages',
        identityId: identity.id,
        priority: 3,
      })
      return
    }
    await state.pushNotice({
      kind: 'message',
      title: character.name,
      body: reply.content,
      appId: 'messages',
      identityId: identity.id,
      chatId: chat.id,
      charId: character.id,
      priority: 4,
    })
  } finally {
    useMellow.getState().endReply()
  }
}
