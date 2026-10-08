import { AnimatePresence, motion } from 'framer-motion'
import { AudioLines, ChevronLeft, Ellipsis, Gift, Image, Keyboard, Mail, MessageCircleReply, Mic, Music, PartyPopper, Pause, Phone, Play, Plus, SendHorizontal, Smile, VenetianMask, Wallet } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AIError } from '../../engine/AIAdapter.ts'
import { postUserText, replyInChat, replyRange } from '../../domain/messaging.ts'
import { readWorld, type WorldEntry } from '../../lib/worldbook.ts'
import { isTrustedVoiceCache, minimaxSpeak, resolveCharacterVoiceId, voiceLabel, voiceOptions } from '../../engine/minimax.ts'
import { modePresetId } from '../../lib/defaults.ts'
import { downloadJson } from '../../lib/download.ts'
import { formatChatTime, initialOf } from '../../lib/format.ts'
import { messagePreview, voiceDurationSec } from '../../lib/messagePreview.ts'
import { normalizeMinimaxKey } from '../../engine/minimax.ts'
import { decryptSecret } from '../../storage/crypto.ts'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import type { BubbleStyle, Character, Chat, ChatMessage, Identity, MessageKind } from '../../types/index.ts'
import { PillNote } from '../ui/primitives.tsx'
import { VoiceSelect } from './SettingsPanels.tsx'
import { ALL_SMS_STICKERS } from '../../data/stickers.ts'
import { CallScreen, CardBubble, GiftSheet, MoneySheet } from './ChatExtras.tsx'

type ToolId = 'album' | 'sticker' | 'redpacket' | 'transfer' | 'party' | 'anon' | 'music' | 'gift'

const DM_TOOLS: Array<{ id: ToolId; label: string; tint: string; icon: ReactNode }> = [
  { id: 'album', label: '相册', tint: '#D7E7F8', icon: <Image size={20} /> },
  { id: 'sticker', label: '表情包', tint: '#F8E6C0', icon: <Smile size={20} /> },
  { id: 'redpacket', label: '红包', tint: '#FBD5D5', icon: <Mail size={20} /> },
  { id: 'transfer', label: '转账', tint: '#F8DCC8', icon: <Wallet size={20} /> },
]

const GROUP_TOOLS: Array<{ id: ToolId; label: string; tint: string; icon: ReactNode }> = [
  ...DM_TOOLS,
  { id: 'party', label: '群派对', tint: '#E6DDF8', icon: <PartyPopper size={20} /> },
  { id: 'anon', label: '匿名', tint: '#E7E3EC', icon: <VenetianMask size={20} /> },
  { id: 'music', label: '一起听歌', tint: '#D5F0E4', icon: <Music size={20} /> },
  { id: 'gift', label: '群礼物', tint: '#F3E3FB', icon: <Gift size={20} /> },
]

export function ChatThread(props: { identity: Identity; chat: Chat; characters: Character[]; onBack: () => void; onChat: (chat: Chat) => void; onPeople?: () => void }) {
  const presets = useMellow((state) => state.presets)
  const settings = useMellow((state) => state.settings)
  const pending = useMellow((state) => state.pendingReplyChatId)
  const dataRevision = useMellow((state) => state.dataRevision)
  const beginReply = useMellow((state) => state.beginReply)
  const endReply = useMellow((state) => state.endReply)
  const refreshInbox = useMellow((state) => state.refreshInbox)
  const setViewingChat = useMellow((state) => state.setViewingChat)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [panel, setPanel] = useState<'tools' | 'stickers' | null>(null)
  const [menu, setMenu] = useState(false)
  const [voice, setVoice] = useState(false)
  const [anon, setAnon] = useState(false)
  const [sheet, setSheet] = useState<'redpacket' | 'transfer' | 'gift' | null>(null)
  const [calling, setCalling] = useState(false)
  const [query, setQuery] = useState('')
  const [speaking, setSpeaking] = useState<string | null>(null)
  const [revealedVoice, setRevealedVoice] = useState<Record<string, boolean>>({})
  const [quote, setQuote] = useState<{ id: string; text: string } | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [worldRows, setWorldRows] = useState<WorldEntry[]>([])
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const replyLock = useRef(false)
  const chat = props.chat
  const people = chat.memberIds.map((id) => props.characters.find((item) => item.id === id)).filter((item): item is Character => Boolean(item))
  const primary = people[0]
  const typing = pending === chat.id
  const title = chat.remark?.trim() || (chat.kind === 'dm' ? primary?.nickname : '') || chat.title
  const tools = chat.kind === 'group' ? GROUP_TOOLS : DM_TOOLS
  const status = typing ? '正在输入中……' : chat.kind === 'group' ? `${people.length} 人` : primary?.signature || primary?.personality.split(/[。\n]/)[0] || '在线'
  const scope = `chat-${chat.id.replace(/[^a-zA-Z0-9_-]/g, '')}`

  const reload = async () => {
    setMessages(await storage.listMessages(props.identity.namespace, chat.id))
    await refreshInbox()
  }

  useEffect(() => {
    setViewingChat(chat.id)
    void reload().then(() => storage.markChatRead(props.identity.namespace, chat.id).then(() => refreshInbox()))
    return () => setViewingChat(null)
    // 打开会话时拉一次记录
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.id, props.identity.namespace])

  useEffect(() => {
    void reload().then(() => storage.markChatRead(props.identity.namespace, chat.id).then(() => refreshInbox()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataRevision, chat.id])

  useEffect(() => {
    if (pending !== chat.id) return
    const timer = window.setInterval(() => {
      void reload().then(() => storage.markChatRead(props.identity.namespace, chat.id).then(() => refreshInbox()))
    }, 450)
    return () => window.clearInterval(timer)
  }, [pending, chat.id, props.identity.namespace, refreshInbox])

  const toBottom = () => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }

  useEffect(toBottom, [messages, typing])

  useEffect(() => {
    if (!menu) return
    void readWorld(props.identity.namespace).then(setWorldRows)
  }, [menu, props.identity.namespace])

  const saveChat = async (patch: Partial<Chat>) => {
    const fresh = (await storage.getChat(props.identity.namespace, chat.id)) ?? chat
    const next = { ...fresh, ...patch, updatedAt: Date.now() }
    await storage.putChat(props.identity.namespace, next)
    props.onChat(next)
  }

  const send = async (text: string, kind: MessageKind = 'text') => {
    const body = text.trim()
    if (!body) return
    if (kind === 'text' || kind === 'voice') setDraft('')
    await postUserText({
      namespace: props.identity.namespace,
      identity: props.identity,
      chat,
      text: anon && kind === 'text' ? `匿名：${body}` : body,
      kind: anon && kind === 'text' ? 'anon' : kind,
      quoteOf: quote?.id ?? null,
      quoteText: quote?.text ?? null,
    })
    setQuote(null)
    await reload()
  }

  const patchMessage = async (message: ChatMessage) => {
    await storage.updateMessage(props.identity.namespace, message)
    await reload()
  }

  const removeMessage = async (messageId: string) => {
    await storage.deleteMessage(props.identity.namespace, messageId)
    await reload()
  }

  const hideMessage = async (message: ChatMessage) => {
    await patchMessage({ ...message, hidden: true, content: '' })
  }

  const reply = async () => {
    if (replyLock.current || typing) return
    const speaker = nextSpeaker(chat, people, messages)
    if (!speaker) return
    replyLock.current = true
    beginReply(chat.id)
    try {
      await replyInChat({
        namespace: props.identity.namespace,
        identity: props.identity,
        character: speaker,
        chat,
        presets,
        activePresetId: modePresetId(settings, 'sms'),
        fourthWall: settings.fourthWall,
        voiceReady: settings.minimax.ready,
      })
      await reload()
      const fresh = await storage.getChat(props.identity.namespace, chat.id)
      if (fresh) props.onChat(fresh)
      props.onPeople?.()
    } catch (error) {
      if (error instanceof AIError && error.message === 'BUSY') return
      throw error
    } finally {
      replyLock.current = false
      endReply()
    }
  }

  const saveCharacter = async (patch: Partial<Character>) => {
    if (!primary || chat.kind !== 'dm') return
    const fresh = (await storage.getCharacter(props.identity.namespace, primary.id)) ?? primary
    const next = { ...fresh, ...patch, updatedAt: Date.now() }
    await storage.putCharacter(props.identity.namespace, next)
    props.onPeople?.()
  }

  const speak = (message: ChatMessage) => {
    if (!settings.minimax.ready) return
    if (speaking === message.id) {
      setSpeaking(null)
      return
    }
    setSpeaking(message.id)
    void (async () => {
      const raw = settings.minimax.encryptedKey ? await decryptSecret(settings.minimax.encryptedKey) : ''
      const speaker = message.charId ? people.find((item) => item.id === message.charId) : primary
      const voice =
        message.role === 'user'
          ? settings.minimax.userVoiceId?.trim() || settings.minimax.voiceId || 'female-shaonv'
          : resolveCharacterVoiceId(speaker ?? primary, settings.minimax)
      const url = await minimaxSpeak(settings.minimax, normalizeMinimaxKey(raw), message.content, voice)
      const audio = new Audio(url)
      audio.onended = () => setSpeaking((current) => (current === message.id ? null : current))
      await audio.play()
    })().catch(() => setSpeaking(null))
  }

  const bubble = chat.bubble ?? 'soft'
  const radius = bubble === 'square' ? 10 : bubble === 'line' ? 18 : 22
  const backdrop = chat.backgroundImage ? `center / cover no-repeat url(${chat.backgroundImage})` : chat.background || undefined

  return (
    <div className={`sms-shell relative flex h-full min-h-0 flex-col ${scope}`} style={{ background: backdrop }}>
      <style>{bubbleSheet(scope, radius, bubble, chat.bubbleCss)}</style>
      <header className="flex items-center gap-2 px-3 pb-2 pt-12">
        <button type="button" aria-label="返回" className="grid h-9 w-9 place-items-center rounded-full bg-white/85 shadow-[0_4px_12px_rgba(120,80,100,0.08)]" onClick={props.onBack}>
          <ChevronLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{title}</p>
          <p className="truncate text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{status}</p>
        </div>
        <button type="button" aria-label="语音通话" className="grid h-9 w-9 place-items-center rounded-full bg-white/85 shadow-[0_4px_12px_rgba(120,80,100,0.08)]" onClick={() => setCalling(true)}>
          <Phone size={15} />
        </button>
        <button type="button" aria-label="会话设置" className="grid h-9 w-9 place-items-center rounded-full bg-white/85 shadow-[0_4px_12px_rgba(120,80,100,0.08)]" onClick={() => setMenu(true)}>
          <Ellipsis size={16} />
        </button>
      </header>
      <div ref={scrollRef} className="scroll min-h-0 flex-1 space-y-2 px-4 pb-2" onClick={() => setPanel(null)}>
        {messages.filter((item) => !item.hidden).map((message) => (
          <Bubble
            key={message.id}
            message={message}
            people={people}
            canSpeak={settings.minimax.ready}
            speaking={speaking === message.id}
            voiceRevealed={Boolean(revealedVoice[message.id])}
            menuOpen={actionId === message.id}
            onMenu={() => setActionId((current) => (current === message.id ? null : message.id))}
            onRevealVoice={() => setRevealedVoice((current) => ({ ...current, [message.id]: true }))}
            onSpeak={() => speak(message)}
            onQuote={() => {
              setQuote({ id: message.id, text: messagePreview(message.content, message.kind).slice(0, 80) })
              setActionId(null)
            }}
            onStar={() => void patchMessage({ ...message, starred: !message.starred }).then(() => setActionId(null))}
            onDelete={() => void hideMessage(message).then(() => setActionId(null))}
            onRemove={() => void removeMessage(message.id).then(() => setActionId(null))}
          />
        ))}
      </div>
      <div className="shrink-0">
        {quote ? (
          <div className="mx-3 mb-1 flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 text-xs ring-1 ring-black/5">
            <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--m-text-secondary)' }}>引用：{quote.text}</span>
            <button type="button" className="chip chip-pink shrink-0 px-2 py-0.5 text-[10px]" onClick={() => setQuote(null)}>取消</button>
          </div>
        ) : null}
        <form
          className="flex items-center gap-1.5 px-3 pt-1 transition-[padding]"
          style={{ paddingBottom: panel ? 8 : 56 }}
          onSubmit={(event) => {
            event.preventDefault()
            void send(draft, voice ? 'voice' : 'text')
          }}
        >
          <button
            type="button"
            aria-label={panel ? '收起功能' : '更多功能'}
            aria-expanded={Boolean(panel)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/90 shadow-[0_4px_10px_rgba(120,80,100,0.08)] transition-transform"
            style={{ transform: panel ? 'rotate(45deg)' : 'none' }}
            onClick={() => setPanel((value) => (value ? null : 'tools'))}
          >
            <Plus size={18} />
          </button>
          <div className="flex h-11 min-w-0 flex-1 items-center gap-1.5 rounded-full bg-white/92 pl-3 pr-1 ring-1 ring-black/5" style={voice ? { boxShadow: 'inset 0 0 0 1.5px #9ED9C4' } : undefined}>
            {voice ? <AudioLines size={16} className="shrink-0 text-[#5fae93]" /> : null}
            <input
              value={draft}
              maxLength={2000}
              placeholder={voice ? '输入要说的话，会以语音发出' : anon ? '匿名发送' : '写一条短信'}
              onChange={(event) => setDraft(event.target.value)}
              onFocus={() => setPanel(null)}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            {chat.voiceEnabled && settings.minimax.ready ? (
              <button
                type="button"
                aria-label={voice ? '切回文字' : '切成语音'}
                aria-pressed={voice}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors"
                style={{ background: voice ? '#D5F0E4' : 'transparent' }}
                onClick={() => setVoice((value) => !value)}
              >
                {voice ? <Keyboard size={15} /> : <Mic size={15} />}
              </button>
            ) : null}
          </div>
          <button type="button" aria-label="让对方回复" disabled={typing} className="grid h-10 w-10 shrink-0 place-items-center rounded-full shadow-[0_4px_10px_rgba(120,80,100,0.1)] disabled:opacity-50" style={{ background: 'var(--m-accent)' }} onClick={() => void reply()}>
            <MessageCircleReply size={17} />
          </button>
          <button type="submit" aria-label="发送" className="grid h-10 w-10 shrink-0 place-items-center rounded-full shadow-[0_4px_10px_rgba(243,168,186,0.35)]" style={{ background: 'var(--m-primary)' }}>
            <SendHorizontal size={17} />
          </button>
        </form>
        <AnimatePresence initial={false}>
          {panel ? (
            <motion.div
              key="panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              onUpdate={toBottom}
              className="overflow-hidden"
            >
              <div className="mx-3 mb-12 mt-1 rounded-[26px] bg-white/88 p-3 shadow-[0_-6px_20px_rgba(120,80,100,0.06)]">
                {panel === 'stickers' ? (
                  <>
                    <div className="mb-2 flex items-center justify-between">
                      <button type="button" className="chip px-2.5 py-1 text-[11px]" onClick={() => setPanel('tools')}>‹ 返回</button>
                      <span className="text-xs" style={{ color: 'var(--m-text-secondary)' }}>点一下就发出</span>
                    </div>
                    <div className="grid max-h-52 grid-cols-4 gap-2 overflow-y-auto">
                      {ALL_SMS_STICKERS.map((item) => (
                        <button key={item.url} type="button" title={item.label} className="overflow-hidden rounded-2xl bg-[#FFF8EC] transition-transform active:scale-95" onClick={() => void send(item.url, 'sticker')}>
                          <img src={item.url} alt={item.label} className="aspect-square w-full object-contain p-1" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-4 gap-x-2 gap-y-3">
                      {tools.map((tool) => {
                        const on = tool.id === 'anon' && anon
                        return (
                          <button key={tool.id} type="button" className="flex flex-col items-center gap-1.5 text-[11px]" onClick={() => void runTool(tool.id)}>
                            <span className="grid h-12 w-12 place-items-center rounded-[18px] transition-transform active:scale-90" style={{ background: tool.tint, boxShadow: on ? 'inset 0 0 0 2px #8a7ca8' : 'none' }}>{tool.icon}</span>
                            {on ? '匿名中' : tool.label}
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      {sheet === 'redpacket' || sheet === 'transfer' ? (
        <MoneySheet mode={sheet} group={chat.kind === 'group'} people={people} onClose={() => setSheet(null)} onSend={(content) => void send(content, sheet)} />
      ) : null}
      {sheet === 'gift' ? <GiftSheet namespace={props.identity.namespace} people={people} onClose={() => setSheet(null)} onSend={(content) => void send(content, 'gift')} /> : null}
      {calling ? (
        <CallScreen
          title={title}
          person={chat.kind === 'dm' ? primary : undefined}
          group={chat.kind === 'group'}
          onEnd={(content) => {
            setCalling(false)
            void send(content, 'call')
          }}
        />
      ) : null}
      {menu ? (
        <ChatMenu
          chat={chat}
          people={people}
          character={chat.kind === 'dm' ? primary : undefined}
          voices={voiceOptions(settings.minimax)}
          voiceReady={isTrustedVoiceCache(settings.minimax.fetchedVoices)}
          globalVoiceId={settings.minimax.voiceId || 'female-shaonv'}
          messages={messages}
          query={query}
          onQuery={setQuery}
          onClose={() => setMenu(false)}
          onPatch={(patch) => void saveChat(patch)}
          onPatchCharacter={(patch) => void saveCharacter(patch)}
          worldRows={worldRows}
          onClear={async () => {
            await storage.clearChat(props.identity.namespace, chat.id)
            await reload()
            setMenu(false)
          }}
          onExport={() => downloadJson(`${title}.json`, { chat, messages })}
          onImport={async (file) => {
            const raw = JSON.parse(await file.text()) as { messages?: ChatMessage[] }
            for (const message of raw.messages ?? []) {
              await storage.putMessage(props.identity.namespace, { ...message, chatId: chat.id, id: `${message.id}-in` })
            }
            await reload()
          }}
        />
      ) : null}
    </div>
  )

  async function runTool(id: ToolId) {
    if (id === 'album') {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = () => {
        const file = input.files?.[0]
        if (!file || file.size > 900_000) return
        const reader = new FileReader()
        reader.onload = () => void send(String(reader.result ?? ''), 'image')
        reader.readAsDataURL(file)
      }
      input.click()
      return
    }
    if (id === 'sticker') {
      setPanel('stickers')
      return
    }
    if (id === 'anon') {
      setAnon((value) => !value)
      return
    }
    if (id === 'redpacket' || id === 'transfer' || id === 'gift') {
      setPanel(null)
      setSheet(id)
      return
    }
    if (id === 'party') return send('发起了群派对，大家快来', 'party')
    if (id === 'music') return send('邀请大家一起听：晚风', 'music')
  }
}

function cleanCss(value: string | undefined) {
  return (value ?? '').replace(/[{}<>]/g, '')
}

function bubbleSheet(scope: string, radius: number, shape: BubbleStyle, custom: Chat['bubbleCss']) {
  const line = shape === 'line' ? 'border: 1px solid rgba(0,0,0,0.08);' : ''
  return [
    `.${scope} .b-mine{border-radius:${radius}px;background:var(--m-accent);${line}}`,
    `.${scope} .b-theirs{border-radius:${radius}px;background:#F4FBF7;${line}}`,
    `.${scope} .b-mine{${cleanCss(custom?.mine)}}`,
    `.${scope} .b-theirs{${cleanCss(custom?.theirs)}}`,
  ].join('\n')
}

function nextSpeaker(chat: Chat, people: Character[], messages: ChatMessage[]): Character | undefined {
  if (chat.kind === 'dm') return people[0]
  const last = [...messages].reverse().find((item) => item.role === 'assistant' && item.charId)
  const index = people.findIndex((item) => item.id === last?.charId)
  return people[(index + 1) % people.length] ?? people[0]
}

function waveOf(text: string) {
  return Array.from({ length: 16 }, (_, index) => 30 + (((text.charCodeAt(index % Math.max(1, text.length)) || 7) * (index + 3)) % 70))
}

function VoiceBubble(props: {
  content: string
  seconds: number
  canSpeak: boolean
  speaking: boolean
  revealed: boolean
  onPlay: () => void
  onReveal: () => void
}) {
  const timer = useRef<number | null>(null)
  const longPress = useRef(false)

  const clearTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }

  return (
    <div className="voice-bar">
      <button
        type="button"
        className="voice-bar-btn"
        disabled={!props.canSpeak}
        aria-label={props.canSpeak ? (props.speaking ? '停止播放' : '播放语音') : '配置 MiniMax 后可播放'}
        onPointerDown={() => {
          longPress.current = false
          clearTimer()
          timer.current = window.setTimeout(() => {
            longPress.current = true
            props.onReveal()
          }, 480)
        }}
        onPointerUp={clearTimer}
        onPointerLeave={clearTimer}
        onPointerCancel={clearTimer}
        onClick={() => {
          if (longPress.current) {
            longPress.current = false
            return
          }
          props.onPlay()
        }}
      >
        <span className="voice-bar-play" style={{ opacity: props.canSpeak ? 1 : 0.45 }}>
          {props.speaking ? <Pause size={12} /> : <Play size={12} className="translate-x-px" />}
        </span>
        <span className="voice-bar-track">
          {waveOf(props.content).map((height, index) => (
            <span key={index} className={props.speaking ? 'voice-wave is-on' : 'voice-wave'} style={{ height: `${height}%`, animationDelay: `${index * 0.05}s` }} />
          ))}
        </span>
        <span className="voice-bar-duration">{props.seconds}″</span>
      </button>
      {props.revealed ? (
        <p className="voice-bar-transcript">{props.content}</p>
      ) : (
        <p className="voice-bar-hint">长按转文字</p>
      )}
    </div>
  )
}

function Bubble(props: {
  message: ChatMessage
  people: Character[]
  canSpeak: boolean
  speaking: boolean
  voiceRevealed: boolean
  menuOpen: boolean
  onMenu: () => void
  onRevealVoice: () => void
  onSpeak: () => void
  onQuote: () => void
  onStar: () => void
  onDelete: () => void
  onRemove: () => void
}) {
  const person = props.people.find((item) => item.id === props.message.charId)
  const kind = props.message.kind
  if (kind === 'system') {
    return <div className="flex justify-center"><PillNote tone="lilac" compact>{props.message.content}</PillNote></div>
  }
  const mine = props.message.role === 'user'
  const cls = mine ? 'b-mine' : 'b-theirs'
  const quoteBlock = props.message.quoteText ? (
    <p className="mb-1 rounded-xl bg-black/5 px-2 py-1 text-[11px] leading-5 opacity-75">{props.message.quoteText}</p>
  ) : null
  const image = kind === 'image' && props.message.content.startsWith('data:')
  let body: ReactNode
  if (image) {
    body = <img src={props.message.content} alt="" className="max-w-[200px] rounded-2xl" />
  } else if (kind === 'sticker') {
    body = props.message.content.startsWith('http') || props.message.content.startsWith('/stickers/') ? (
      <img src={props.message.content} alt="" className="max-w-[140px] rounded-2xl" loading="lazy" />
    ) : (
      <span className="block px-1 text-5xl leading-none">{props.message.content}</span>
    )
  } else if (kind === 'redpacket' || kind === 'transfer' || kind === 'gift') {
    body = <CardBubble message={props.message} />
  } else if (kind === 'call' || kind === 'party' || kind === 'music') {
    body = (
      <span className={`${cls} flex items-center gap-2 px-3 py-2 text-sm`}>
        {kind === 'call' ? <Phone size={14} /> : kind === 'party' ? <PartyPopper size={14} /> : <Music size={14} />}
        {props.message.content}
      </span>
    )
  } else if (kind === 'voice') {
    body = (
      <div className={cls}>
        {quoteBlock}
        <VoiceBubble
          content={props.message.content}
          seconds={voiceDurationSec(props.message.content)}
          canSpeak={props.canSpeak}
          speaking={props.speaking}
          revealed={props.voiceRevealed}
          onPlay={props.onSpeak}
          onReveal={props.onRevealVoice}
        />
      </div>
    )
  } else {
    body = (
      <div className={`${cls} readable max-w-[70vw] px-3 py-2 md:max-w-sm`}>
        {quoteBlock}
        <p className="whitespace-pre-wrap text-sm leading-6">{props.message.content}</p>
      </div>
    )
  }
  return (
    <div className={mine ? 'flex justify-end' : 'flex justify-start gap-2'}>
      {!mine ? <MiniFace name={person?.nickname || person?.name || '群'} avatar={person?.avatar ?? ''} /> : null}
      <div className={mine ? 'flex flex-col items-end' : ''}>
        {!mine && person ? <p className="mb-0.5 text-[10px]" style={{ color: 'var(--m-text-secondary)' }}>{person.nickname || person.name}{props.message.starred ? ' · 已收藏' : ''}</p> : null}
        <button type="button" className="text-left" onClick={props.onMenu} onContextMenu={(event) => { event.preventDefault(); props.onMenu() }}>
          {body}
        </button>
        {props.menuOpen ? (
          <div className="mt-1 flex flex-wrap gap-1">
            <button type="button" className="chip px-2 py-0.5 text-[10px]" onClick={props.onQuote}>引用</button>
            <button type="button" className="chip chip-mint px-2 py-0.5 text-[10px]" onClick={props.onStar}>{props.message.starred ? '取消收藏' : '收藏'}</button>
            <button type="button" className="chip chip-danger px-2 py-0.5 text-[10px]" onClick={props.onDelete}>删除</button>
            <button type="button" className="chip px-2 py-0.5 text-[10px]" onClick={props.onRemove}>彻底移除</button>
          </div>
        ) : null}
        <p className="mt-0.5 text-[10px]" style={{ color: 'var(--m-text-secondary)' }}>{formatChatTime(props.message.createdAt)}</p>
      </div>
    </div>
  )
}

type MenuTab = 'basic' | 'look' | 'talk' | 'bond'

const MENU_TABS: Array<[MenuTab, string]> = [
  ['basic', '基本'],
  ['look', '外观'],
  ['talk', '聊天'],
  ['bond', '关系'],
]

const CSS_PRESETS: Array<{ label: string; css: string }> = [
  { label: '果冻', css: 'background: linear-gradient(135deg, #FFD1DC, #FFB3C6); box-shadow: 0 6px 14px rgba(243,168,186,.35); color: #5a2a3a;' },
  { label: '描边', css: 'background: #fff; border: 1.5px solid #F3A8BA;' },
  { label: '薄荷', css: 'background: #D5F0E4; border-radius: 6px 18px 18px 18px;' },
  { label: '奶油', css: 'background: #FFF3D6; box-shadow: inset 0 -3px 0 rgba(0,0,0,.05);' },
  { label: '夜色', css: 'background: #2A2730; color: #fff;' },
  { label: '清空', css: '' },
]

function ChatMenu(props: {
  chat: Chat
  people: Character[]
  character?: Character
  voices: ReturnType<typeof voiceOptions>
  voiceReady: boolean
  globalVoiceId: string
  messages: ChatMessage[]
  query: string
  onQuery: (value: string) => void
  onClose: () => void
  onPatch: (patch: Partial<Chat>) => void
  onPatchCharacter: (patch: Partial<Character>) => void
  worldRows: WorldEntry[]
  onClear: () => Promise<void>
  onExport: () => void
  onImport: (file: File) => Promise<void>
}) {
  const [tab, setTab] = useState<MenuTab>('basic')
  const [voiceQuery, setVoiceQuery] = useState('')
  const charVoice = props.character?.voiceId?.trim() || ''
  const [target, setTarget] = useState<'mine' | 'theirs'>('mine')
  const found = props.query.trim() ? props.messages.filter((item) => item.content.includes(props.query.trim())) : []
  const range = replyRange(props.chat)
  const css = props.chat.bubbleCss ?? {}
  const scope = `preview-${props.chat.id.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const radius = props.chat.bubble === 'square' ? 10 : props.chat.bubble === 'line' ? 18 : 22
  const switches: Array<[string, boolean, Partial<Chat>]> = [
    ['置顶', Boolean(props.chat.pinned), { pinned: !props.chat.pinned }],
    ['特别关心', Boolean(props.chat.specialCare), { specialCare: !props.chat.specialCare }],
    ['消息免打扰', Boolean(props.chat.muted), { muted: !props.chat.muted }],
    ['现实时间', props.chat.realTime !== false, { realTime: props.chat.realTime === false }],
    ['允许主动消息', props.chat.allowProactive !== false, { allowProactive: props.chat.allowProactive === false }],
    ['MiniMax 语音', Boolean(props.chat.voiceEnabled), { voiceEnabled: !props.chat.voiceEnabled }],
    ['拉黑', Boolean(props.chat.blocked), { blocked: !props.chat.blocked }],
  ]
  const label = 'block text-xs'
  const dim = { color: 'var(--m-text-secondary)' }

  return (
    <div className="sms-shell absolute inset-0 z-30 flex flex-col pt-12">
      <div className="flex items-center justify-between px-4">
        <h2 className="text-[22px] font-semibold tracking-tight">会话设置</h2>
        <button type="button" className="chip chip-pink" onClick={props.onClose}>完成</button>
      </div>
      <div className="mx-4 mt-3 grid grid-cols-4 gap-1 rounded-full bg-white/85 p-1 shadow-[0_6px_16px_rgba(120,80,100,0.06)]" role="tablist">
        {MENU_TABS.map(([id, text]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className="rounded-full py-1.5 text-xs transition-colors" style={{ background: tab === id ? '#F3A8BA' : 'transparent', color: tab === id ? '#fff' : 'var(--m-text-secondary)', fontWeight: tab === id ? 600 : 400 }} onClick={() => setTab(id)}>
            {text}
          </button>
        ))}
      </div>
      <div className="scroll min-h-0 flex-1 px-4 pb-16 pt-3">
        {tab === 'basic' ? (
          <>
            <section className="menu-card">
              <label className={label} style={dim}>
                备注
                <input value={props.chat.remark ?? ''} onChange={(event) => props.onPatch({ remark: event.target.value })} placeholder={props.chat.title} className="soft-input mt-1" />
              </label>
            </section>
            <section className="menu-card mt-3 divide-y divide-black/5 py-1">
              {switches.map(([text, on, patch]) => (
                <SwitchRow key={text} label={text} on={on} onClick={() => props.onPatch(patch)} />
              ))}
            </section>
            <section className="menu-card mt-3">
              <label className={label} style={dim}>
                主动发消息间隔（分钟）
                <input
                  type="number"
                  min={0}
                  max={10080}
                  value={props.chat.proactiveMinutes ?? ''}
                  placeholder="留空则用全局设置"
                  onChange={(event) => {
                    const raw = event.target.value.trim()
                    props.onPatch({ proactiveMinutes: raw ? Math.max(1, Math.min(10080, Number(raw) || 0)) : undefined })
                  }}
                  className="soft-input mt-1"
                />
              </label>
            </section>
            {props.character ? (
              <section className="menu-card mt-3 min-w-0">
                <p className="text-xs font-medium">角色 MiniMax 音色</p>
                {props.voiceReady ? (
                  <>
                    <VoiceSelect
                      label="音色"
                      voices={[{ id: '', name: `跟随全局 · ${voiceLabel(props.voices, props.globalVoiceId)}` }, ...props.voices]}
                      value={charVoice}
                      query={voiceQuery}
                      onQuery={setVoiceQuery}
                      onChange={(value) => props.onPatchCharacter({ voiceId: value.trim() || null })}
                    />
                    <p className="mt-1 text-[10px] leading-4" style={dim}>
                      当前：{charVoice ? voiceLabel(props.voices, charVoice) : `跟随全局（${voiceLabel(props.voices, props.globalVoiceId)}）`}
                    </p>
                  </>
                ) : (
                  <PillNote tone="sky" compact>请先在设置里拉取音色</PillNote>
                )}
              </section>
            ) : null}
            {props.chat.kind === 'group' ? (
              <section className="menu-card mt-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs" style={dim}>头衔与管理员</p>
                  <label className="chip chip-lilac">
                    群头像
                    <input type="file" accept="image/*" className="hidden" onChange={(event) => readImage(event.target.files?.[0], 1_200_000, (groupAvatar) => props.onPatch({ groupAvatar }))} />
                  </label>
                </div>
                {props.people.map((person) => {
                  const admin = (props.chat.adminIds ?? []).includes(person.id)
                  return (
                    <div key={person.id} className="mt-2 flex items-center gap-2 text-sm">
                      <MiniFace name={person.name} avatar={person.avatar} />
                      <span className="w-14 truncate">{person.name}</span>
                      <input
                        value={props.chat.titles?.[person.id] ?? ''}
                        placeholder="头衔"
                        className="soft-input min-w-0 flex-1 py-1.5 text-xs"
                        onChange={(event) => props.onPatch({ titles: { ...props.chat.titles, [person.id]: event.target.value } })}
                      />
                      <button type="button" className={admin ? 'chip chip-butter' : 'chip'} onClick={() => {
                        const admins = new Set(props.chat.adminIds ?? [])
                        if (admins.has(person.id)) admins.delete(person.id)
                        else admins.add(person.id)
                        props.onPatch({ adminIds: [...admins] })
                      }}>
                        {admin ? '管理员' : '设管理'}
                      </button>
                    </div>
                  )
                })}
              </section>
            ) : null}
          </>
        ) : null}

        {tab === 'look' ? (
          <>
            <section className={`menu-card ${scope}`}>
              <style>{bubbleSheet(scope, radius, props.chat.bubble ?? 'soft', css)}</style>
              <p className="text-xs" style={dim}>预览</p>
              <div className="mt-2 space-y-2 rounded-2xl p-3" style={{ background: props.chat.backgroundImage ? `center / cover url(${props.chat.backgroundImage})` : props.chat.background || '#FBF7F4' }}>
                <div className="flex justify-start"><p className="b-theirs px-3 py-2 text-sm">今天的晚风好舒服</p></div>
                <div className="flex justify-end"><p className="b-mine px-3 py-2 text-sm">那我们出去走走吧</p></div>
              </div>
            </section>
            <section className="menu-card mt-3">
              <p className="text-xs" style={dim}>气泡形状</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(['soft', 'square', 'line'] as BubbleStyle[]).map((style) => (
                  <button key={style} type="button" className={(props.chat.bubble ?? 'soft') === style ? 'chip chip-pink' : 'chip'} onClick={() => props.onPatch({ bubble: style })}>
                    {style === 'soft' ? '圆润' : style === 'square' ? '方一点' : '细线'}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs" style={dim}>气泡 CSS</p>
                <div className="grid grid-cols-2 gap-1 rounded-full bg-black/[0.04] p-0.5">
                  {(['mine', 'theirs'] as const).map((id) => (
                    <button key={id} type="button" className="rounded-full px-3 py-1 text-[11px]" style={{ background: target === id ? 'white' : 'transparent', fontWeight: target === id ? 600 : 400 }} onClick={() => setTarget(id)}>
                      {id === 'mine' ? '我的' : '对方'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {CSS_PRESETS.map((preset) => (
                  <button key={preset.label} type="button" className={preset.css ? 'chip px-2.5 py-1 text-[11px]' : 'chip chip-danger px-2.5 py-1 text-[11px]'} onClick={() => props.onPatch({ bubbleCss: { ...css, [target]: preset.css } })}>
                    {preset.label}
                  </button>
                ))}
              </div>
              <textarea
                value={css[target] ?? ''}
                rows={4}
                spellCheck={false}
                placeholder={'background: #FFD1DC;\nborder-radius: 18px 18px 4px 18px;\ncolor: #5a2a3a;'}
                onChange={(event) => props.onPatch({ bubbleCss: { ...css, [target]: event.target.value } })}
                className="soft-input mt-2 resize-none font-mono text-xs leading-5"
              />
              <p className="mt-1 text-[10px]" style={dim}>写 CSS 声明即可，不用写选择器和花括号</p>
            </section>
            <section className="menu-card mt-3">
              <p className="text-xs" style={dim}>聊天背景</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {['', '#F8E7EA', '#E7F4EE', '#F8F1D8', '#E7EEF8', '#2A2730'].map((color) => (
                  <button
                    key={color || 'none'}
                    type="button"
                    aria-label={color ? `背景 ${color}` : '默认背景'}
                    className="h-9 w-9 rounded-full shadow-[0_4px_10px_rgba(120,80,100,0.08)]"
                    style={{ background: color || 'white', outline: !props.chat.backgroundImage && (props.chat.background ?? '') === color ? '2px solid #F3A8BA' : '1px solid rgba(0,0,0,0.06)', outlineOffset: 2 }}
                    onClick={() => props.onPatch({ background: color, backgroundImage: '' })}
                  />
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="chip chip-sky py-2">
                  <Image size={13} />
                  上传背景图
                  <input type="file" accept="image/*" className="hidden" onChange={(event) => readImage(event.target.files?.[0], 2_500_000, (backgroundImage) => props.onPatch({ backgroundImage }))} />
                </label>
                <button type="button" className="chip py-2" disabled={!props.chat.backgroundImage} onClick={() => props.onPatch({ backgroundImage: '' })}>移除背景图</button>
              </div>
              {props.chat.backgroundImage ? <img src={props.chat.backgroundImage} alt="" className="mt-3 h-24 w-full rounded-2xl object-cover" /> : null}
            </section>
          </>
        ) : null}

        {tab === 'talk' ? (
          <WorldBookSmsPanel chat={props.chat} people={props.people} rows={props.worldRows} onPatch={props.onPatch} />
        ) : null}

        {tab === 'talk' ? (
          <section className="menu-card mt-3">
            <p className="mb-2 text-sm font-medium">回复</p>
            <div className="grid grid-cols-3 gap-2">
              <Num label="记忆条数" value={props.chat.contextLimit ?? 30} min={1} max={200} onChange={(value) => props.onPatch({ contextLimit: value })} />
              <Num label="最少几条" value={range.min} min={1} max={10} onChange={(value) => props.onPatch({ replyMin: value, replyMax: Math.max(value, range.max) })} />
              <Num label="最多几条" value={range.max} min={1} max={10} onChange={(value) => props.onPatch({ replyMax: value, replyMin: Math.min(value, range.min) })} />
            </div>
            <p className="mt-3 text-[11px] leading-5" style={dim}>每次让对方回复时，会像真人一样连发 {range.min === range.max ? range.max : `${range.min}～${range.max}`} 条消息。记忆条数是带给模型的历史消息数量。</p>
          </section>
        ) : null}

        {tab === 'bond' ? (
          <section className="menu-card">
            <p className="text-sm font-medium">过往与关系</p>
            <p className="mt-1 text-[11px] leading-5" style={dim}>补充你和 {props.people.map((item) => item.name).join('、') || '对方'} 的相识经过、关系、共同回忆或约定。每次回复都会带上，当作你们共同的记忆。</p>
            <textarea
              value={props.chat.backstory ?? ''}
              rows={9}
              maxLength={2000}
              placeholder={'例如：\n我们是大学同一个社团认识的，毕业后各自去了不同城市。\n去年冬天一起去看过海，约好明年还要再去一次。'}
              onChange={(event) => props.onPatch({ backstory: event.target.value })}
              className="soft-input mt-3 resize-none leading-6"
            />
            <p className="mt-1 text-right text-[10px]" style={dim}>{(props.chat.backstory ?? '').length} / 2000</p>
          </section>
        ) : null}

        {tab === 'talk' ? (
          <>
            <section className="menu-card mt-3">
              <p className="mb-2 text-sm font-medium">聊天记录</p>
              <label className={label} style={dim}>
                查找聊天记录
                <input value={props.query} onChange={(event) => props.onQuery(event.target.value)} placeholder="输入关键词" className="soft-input mt-1" />
              </label>
              {found.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {found.slice(0, 12).map((item) => (
                    <li key={item.id} className="truncate rounded-xl bg-[#FFF6F8] px-3 py-1.5 text-xs">{item.content}</li>
                  ))}
                </ul>
              ) : props.query.trim() ? <div className="mt-2"><PillNote tone="sky" compact>没有找到</PillNote></div> : null}
            </section>
            <section className="menu-card mt-3 grid grid-cols-3 gap-2">
              <button type="button" className="chip chip-mint" onClick={props.onExport}>导出</button>
              <label className="chip chip-sky">
                导入
                <input type="file" accept="application/json,.json" className="hidden" onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void props.onImport(file)
                }} />
              </label>
              <button type="button" className="chip chip-danger" onClick={() => {
                if (window.confirm('清空这段聊天记录？')) void props.onClear()
              }}>清空记录</button>
            </section>
            <p className="mt-2 px-1 text-[11px]" style={dim}>共 {props.messages.length} 条消息</p>
          </>
        ) : null}
      </div>
    </div>
  )
}

function readImage(file: File | undefined, limit: number, onData: (data: string) => void) {
  if (!file || file.size > limit) return
  const reader = new FileReader()
  reader.onload = () => onData(String(reader.result ?? ''))
  reader.readAsDataURL(file)
}

function WorldBookSmsPanel(props: {
  chat: Chat
  people: Character[]
  rows: WorldEntry[]
  onPatch: (patch: Partial<Chat>) => void
}) {
  const dim = { color: 'var(--m-text-secondary)' }
  const memberIds = new Set(props.people.map((item) => item.id))
  const entries = props.rows.filter((item) => item.charId && memberIds.has(item.charId) && item.content.trim())
  const off = new Set(props.chat.smsWorldOff ?? [])
  const toggle = (id: string) => {
    const next = new Set(off)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    props.onPatch({ smsWorldOff: [...next] })
  }
  const setAll = (smsOn: boolean) => {
    const enabledIds = entries.filter((item) => item.enabled).map((item) => item.id)
    props.onPatch({ smsWorldOff: smsOn ? [] : enabledIds })
  }
  const smsActive = entries.filter((item) => item.enabled && !off.has(item.id)).length

  if (entries.length === 0) {
    return (
      <section className="menu-card">
        <p className="text-sm font-medium">短信里的世界书</p>
        <p className="preset-desc mt-1">这个会话里的角色还没有世界书条目。可在世界书 App 里写，或导入带 character_book 的角色卡。</p>
      </section>
    )
  }

  const byChar = new Map<string, WorldEntry[]>()
  for (const entry of entries) {
    const id = entry.charId ?? ''
    byChar.set(id, [...(byChar.get(id) ?? []), entry])
  }

  return (
    <section className="menu-card">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">短信里的世界书</p>
          <p className="preset-desc mt-1">只影响这条短信会话；世界书 App 里的总开关不变。</p>
        </div>
        <span className="chip chip-lilac shrink-0 text-[10px]">{smsActive}/{entries.filter((item) => item.enabled).length} 条在用</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button type="button" className="chip chip-sky text-[11px]" onClick={() => setAll(true)}>短信全启用</button>
        <button type="button" className="chip text-[11px]" onClick={() => setAll(false)}>短信全停用</button>
      </div>
      <div className="mt-3 space-y-3">
        {[...byChar.entries()].map(([charId, list]) => {
          const person = props.people.find((item) => item.id === charId)
          return (
            <div key={charId}>
              {props.people.length > 1 ? <p className="mb-1 text-[11px] font-medium" style={dim}>{person?.remark || person?.name || '角色'}</p> : null}
              <div className="divide-y divide-black/5 rounded-2xl bg-black/[0.02] px-2">
                {list.map((entry) => {
                  const globalOn = entry.enabled
                  const smsPaused = globalOn && off.has(entry.id)
                  const smsActive = globalOn && !smsPaused
                  return (
                    <div key={entry.id} className="flex w-full items-center justify-between gap-2 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{entry.title.trim() || '未命名'}</span>
                        {entry.keys ? <span className="preset-desc block truncate">{entry.keys}</span> : null}
                        {!globalOn ? <span className="preset-desc block">世界书里已停用</span> : <span className="preset-desc block">{smsActive ? '短信在用' : '短信已停用'}</span>}
                      </span>
                      <button
                        type="button"
                        disabled={!globalOn}
                        className="chip shrink-0 text-[11px] disabled:opacity-45"
                        style={smsActive ? undefined : { background: '#D5F0E4' }}
                        onClick={() => globalOn && toggle(entry.id)}
                      >
                        {smsActive ? '点此停用' : '点此启用'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function SwitchRow(props: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={props.on} onClick={props.onClick} className="flex w-full items-center justify-between py-2.5 text-left text-sm">
      <span>{props.label}</span>
      <span className="relative h-6 w-10 rounded-full transition-colors" style={{ background: props.on ? '#F3A8BA' : '#ebe5df' }}>
        <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: props.on ? 18 : 2 }} />
      </span>
    </button>
  )
}

function Num(props: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <label className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>
      {props.label}
      <input
        type="number"
        min={props.min}
        max={props.max}
        value={props.value}
        className="soft-input mt-1 px-2 py-1.5 text-center"
        onChange={(event) => props.onChange(Math.max(props.min, Math.min(props.max, Number(event.target.value) || props.min)))}
      />
    </label>
  )
}

function MiniFace(props: { name: string; avatar: string }) {
  if (props.avatar.startsWith('data:')) return <img src={props.avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
  return <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs" style={{ background: 'var(--m-secondary)' }}>{initialOf(props.name)}</span>
}
