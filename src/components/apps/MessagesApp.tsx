import { Ellipsis } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createGroupChat, ensureDirectChat } from '../../domain/messaging.ts'
import { importCardFile, writeCharacter } from '../../domain/importing.ts'
import { resolveIdentityId } from '../../engine/identity.ts'
import { chatTitle } from '../../lib/chats.ts'
import { initialOf } from '../../lib/format.ts'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import type { Character, Chat, ContactFolder, Identity } from '../../types/index.ts'
import { CharacterSettingsSheet } from './CharacterSettings.tsx'
import { ChatThread } from './ChatThread.tsx'
import { Field, PillNote, Screen } from '../ui/primitives.tsx'
import { FeedHub, MeTab, MomentsPage, NearbyPage, PeopleTab, type Moment, type NearPerson, type Profile } from './SmsSocial.tsx'
import { GamesPage } from './SmsGames.tsx'

const EMPTY_PROFILE: Profile = { nickname: '', signature: '', gender: '', region: '', birthday: '' }

type Tab = 'messages' | 'people' | 'feed' | 'me'
type Social = 'moments' | 'nearby' | 'games' | null

export function MessagesApp(props: { onBack: () => void }) {
  const identities = useMellow((state) => state.identities)
  const activeIdentityId = useMellow((state) => state.activeIdentityId)
  const revision = useMellow((state) => state.dataRevision)
  const openChatRequest = useMellow((state) => state.openChatRequest)
  const touchData = useMellow((state) => state.touchData)
  const refreshInbox = useMellow((state) => state.refreshInbox)
  const setAppOverride = useMellow((state) => state.setAppOverride)
  const phone = identities.find((item) => item.id === activeIdentityId)
  const resolvedId = phone ? resolveIdentityId(phone, 'messages', identities) : ''
  const identity = identities.find((item) => item.id === resolvedId) ?? phone
  const [tab, setTab] = useState<Tab>('messages')
  const [chars, setChars] = useState<Character[]>([])
  const [chats, setChats] = useState<Chat[]>([])
  const [folders, setFolders] = useState<ContactFolder[]>([])
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE)
  const [moments, setMoments] = useState<Moment[]>([])
  const [onlineMs, setOnlineMs] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const [handled, setHandled] = useState('')
  const [notice, setNotice] = useState('')
  const [loadedKey, setLoadedKey] = useState('')
  const [menu, setMenu] = useState(false)
  const [adding, setAdding] = useState(false)
  const [social, setSocial] = useState<Social>(null)
  const [settingsCharId, setSettingsCharId] = useState<string | null>(null)
  const [nearbyVisit, setNearbyVisit] = useState(0)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const load = async (who: Identity) => {
    const [nextChars, nextChats, nextFolders, nextProfile, nextMoments, online] = await Promise.all([
      storage.listCharacters(who.namespace),
      storage.listChats(who.namespace),
      storage.getBag<ContactFolder[]>(who.namespace, 'folders'),
      storage.getBag<Profile>(who.namespace, 'profile'),
      storage.getBag<Moment[]>(who.namespace, 'moments'),
      storage.getBag<{ ms: number }>(who.namespace, 'online'),
    ])
    const samples = nextChars.filter((item) => item.name === '小满')
    for (const sample of samples) await storage.deleteCharacter(who.namespace, sample.id)
    const kept = samples.length > 0 ? await storage.listCharacters(who.namespace) : nextChars
    const keptChats = samples.length > 0 ? await storage.listChats(who.namespace) : nextChats
    setChars(kept)
    setChats(keptChats)
    setFolders(nextFolders ?? [])
    setProfile({ ...EMPTY_PROFILE, nickname: who.name, ...(nextProfile ?? {}) })
    setMoments(nextMoments ?? [])
    setOnlineMs(online?.ms ?? 0)
  }

  const loadKey = identity ? `${identity.id}:${revision}` : ''
  if (identity && loadedKey !== loadKey) {
    setLoadedKey(loadKey)
    void load(identity)
  }

  const onlineNamespace = identity?.namespace ?? ''
  useEffect(() => {
    if (!onlineNamespace) return
    const timer = window.setInterval(() => {
      setOnlineMs((current) => {
        const next = current + 15_000
        void storage.setBag(onlineNamespace, 'online', { ms: next })
        return next
      })
    }, 15_000)
    return () => window.clearInterval(timer)
  }, [onlineNamespace])

  if (openChatRequest && identity && openChatRequest.identityId === identity.id && handled !== openChatRequest.token) {
    setHandled(openChatRequest.token)
    setOpenId(openChatRequest.chatId)
    setTab('messages')
    setSocial(null)
  }

  if (!identity || !phone) return null
  const chat = chats.find((item) => item.id === openId) ?? null
  if (chat) {
    return (
      <ChatThread
        identity={identity}
        chat={chat}
        characters={chars}
        onBack={() => {
          setOpenId(null)
          void load(identity)
        }}
        onChat={(next) => setChats((current) => current.map((item) => (item.id === next.id ? next : item)))}
        onPeople={() => void storage.listCharacters(identity.namespace).then(setChars)}
      />
    )
  }

  const openNearby = () => {
    setNearbyVisit((value) => value + 1)
    setSocial('nearby')
  }
  const talkTo = async (person: NearPerson) => {
    const created = await writeCharacter({
      identity,
      name: person.name,
      personality: [person.gender, person.age, person.city].filter(Boolean).join('，'),
      description: person.bio || person.signature,
      firstMes: person.signature || '嗨。',
    })
    const thread = await ensureDirectChat(identity.namespace, created)
    touchData()
    await load(identity)
    setSocial(null)
    setTab('messages')
    setOpenId(thread.id)
  }

  return (
    <div className="sms-shell relative h-full min-h-0">
      <Screen
        title="短信"
        subtitle={identity.id === phone.id ? undefined : `这一页是 ${identity.name}`}
        onBack={props.onBack}
        right={
          <div className="relative">
            <button type="button" aria-label="更多" className="grid h-9 w-9 place-items-center rounded-full bg-white/80" onClick={() => setMenu((value) => !value)}>
              <Ellipsis size={18} />
            </button>
            {menu ? (
              <div className="absolute right-0 top-11 z-20 w-40 overflow-hidden rounded-2xl bg-white py-1 text-sm shadow-[0_12px_30px_rgba(90,70,80,0.12)]">
                <button type="button" className="block w-full px-3 py-2 text-left" onClick={() => { setMenu(false); fileRef.current?.click() }}>导入</button>
                <button type="button" className="block w-full px-3 py-2 text-left" onClick={() => { setMenu(false); setAdding(true); setTab('messages') }}>手写</button>
                {identities.length > 1 ? identities.map((item) => (
                  <button key={item.id} type="button" className="block w-full truncate px-3 py-2 text-left" onClick={() => { setMenu(false); void setAppOverride('messages', item.id === phone.id ? null : item.id) }}>
                    {item.id === phone.id ? '这台手机 · ' : ''}{item.name}
                  </button>
                )) : null}
              </div>
            ) : null}
          </div>
        }
      >
        <input
          ref={fileRef}
          type="file"
          accept=".json,.png,application/json,image/png"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            void importCardFile(file, identity)
              .then(() => load(identity))
              .then(() => refreshInbox())
              .then(() => touchData())
              .catch((error: unknown) => setNotice(error instanceof Error ? error.message : '没放进来'))
          }}
        />
        <div className="mb-3 grid grid-cols-4 gap-1 rounded-full bg-white/55 p-1 text-xs shadow-[0_8px_18px_rgba(120,80,100,0.05)]">
          {(
            [
              ['messages', '消息', '#F3A8BA'],
              ['people', '联系人', '#F0D48A'],
              ['feed', '动态', '#9ED9C4'],
              ['me', '我', '#C9B6E8'],
            ] as Array<[Tab, string, string]>
          ).map(([id, label, color]) => (
            <button key={id} type="button" className="rounded-full py-1.5" style={{ background: tab === id ? color : 'transparent' }} onClick={() => { setTab(id); setMenu(false) }}>
              {label}
            </button>
          ))}
        </div>
        {tab === 'messages' ? (
          <MessageList
            chats={chats}
            chars={chars}
            notice={notice}
            adding={adding}
            onOpen={setOpenId}
            onWrite={async (input) => {
              const created = await writeCharacter({ identity, ...input })
              await load(identity)
              setAdding(false)
              setOpenId((await ensureDirectChat(identity.namespace, created)).id)
            }}
            onCancelAdd={() => setAdding(false)}
          />
        ) : null}
        {tab === 'people' ? (
          <PeopleTab
            chars={chars}
            chats={chats}
            folders={folders}
            onlineMs={onlineMs}
            nickname={profile.nickname || identity.name}
            avatar={profile.avatar || identity.avatar}
            onTalk={(person) => {
              void ensureDirectChat(identity.namespace, person).then((thread) => {
                setTab('messages')
                setOpenId(thread.id)
              })
            }}
            onOpenChat={(id) => { setTab('messages'); setOpenId(id) }}
            onChange={async (next) => {
              await storage.setBag(identity.namespace, 'folders', next)
              setFolders(next)
            }}
            onSettings={(character) => setSettingsCharId(character.id)}
            onDelete={async (ids) => {
              for (const id of ids) await storage.deleteCharacter(identity.namespace, id)
              await load(identity)
              await refreshInbox()
              if (openId && ids.some((id) => chats.find((chat) => chat.id === openId)?.memberIds.includes(id))) setOpenId(null)
            }}
            onGroup={async (name, ids) => {
              const group = await createGroupChat(identity.namespace, name, ids, identity.id)
              await load(identity)
              setTab('messages')
              setOpenId(group.id)
            }}
          />
        ) : null}
        {tab === 'feed' ? <FeedHub onOpen={(page) => (page === 'nearby' ? openNearby() : setSocial(page))} /> : null}
        {tab === 'me' ? (
          <MeTab
            profile={profile}
            avatar={identity.avatar}
            moments={moments}
            chats={chats}
            onSave={async (next) => {
              await storage.setBag(identity.namespace, 'profile', next)
              setProfile(next)
            }}
            onOpenChat={(id) => { setTab('messages'); setOpenId(id) }}
            onOpen={(page) => (page === 'nearby' ? openNearby() : setSocial(page))}
          />
        ) : null}
      </Screen>
      {social === 'moments' ? (
        <MomentsPage
          namespace={identity.namespace}
          profile={profile}
          avatar={identity.avatar}
          chars={chars}
          moments={moments}
          onBack={() => setSocial(null)}
          onPost={async (moment) => {
            const next = [moment, ...moments]
            await storage.setBag(identity.namespace, 'moments', next)
            setMoments(next)
          }}
        />
      ) : null}
      {social === 'nearby' ? <NearbyPage key={nearbyVisit} visit={nearbyVisit} namespace={identity.namespace} onBack={() => setSocial(null)} onChat={talkTo} /> : null}
      {social === 'games' ? <GamesPage namespace={identity.namespace} chars={chars} onBack={() => setSocial(null)} /> : null}
      {settingsCharId ? (() => {
        const person = chars.find((item) => item.id === settingsCharId)
        if (!person) return null
        return (
          <CharacterSettingsSheet
            identity={identity}
            character={person}
            onClose={() => setSettingsCharId(null)}
            onSaved={(next) => {
              setChars((current) => current.map((item) => (item.id === next.id ? next : item)))
              setSettingsCharId(null)
            }}
            onDeleted={() => {
              setSettingsCharId(null)
              void load(identity)
              void refreshInbox()
            }}
          />
        )
      })() : null}
    </div>
  )
}

function MessageList(props: {
  chats: Chat[]
  chars: Character[]
  notice: string
  adding: boolean
  onOpen: (id: string) => void
  onWrite: (input: { name: string; personality: string; description: string; firstMes: string }) => Promise<void>
  onCancelAdd: () => void
}) {
  const [name, setName] = useState('')
  const [personality, setPersonality] = useState('')
  return (
    <div>
      {props.adding ? (
        <div className="mb-3 space-y-2">
          <Field label="名字" value={name} onChange={setName} />
          <Field label="性格" value={personality} onChange={setPersonality} multiline />
          <div className="flex gap-2">
            <button type="button" className="rounded-full bg-[var(--m-secondary)] px-3 py-1.5 text-sm" onClick={() => void props.onWrite({ name, personality, description: personality, firstMes: '' })}>写成卡</button>
            <button type="button" className="rounded-full bg-white px-3 py-1.5 text-sm" onClick={props.onCancelAdd}>取消</button>
          </div>
        </div>
      ) : null}
      {props.notice ? <p className="mb-2 text-xs">{props.notice}</p> : null}
      {props.chats.length === 0 ? <PillNote tone="pink">还没有会话，右上角可以导入或手写</PillNote> : null}
      <div className="space-y-2">
        {props.chats.map((chat, index) => {
          const members = chat.memberIds.map((id) => props.chars.find((item) => item.id === id)).filter((item): item is Character => Boolean(item))
          const wash = ['#FFF6F8', '#F4FBF7', '#FFF8EC', '#F6F3FC'][index % 4]
          return (
            <button key={chat.id} type="button" onClick={() => props.onOpen(chat.id)} className="flex w-full items-center gap-3 rounded-[22px] px-2.5 py-2 text-left shadow-[0_8px_16px_rgba(120,80,100,0.04)]" style={{ background: wash }}>
              <RosterFace chat={chat} members={members} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1">
                  {chat.pinned ? <i className="text-[10px] not-italic">顶</i> : null}
                  {chat.specialCare ? <i className="text-[10px] not-italic">♡</i> : null}
                  <span className="truncate text-sm font-medium">{chatTitle(chat)}</span>
                </span>
                <span className="block truncate text-xs" style={{ color: 'var(--m-text-secondary)' }}>{chat.lastMessage || '还没有字'}</span>
              </span>
              {chat.unread > 0 ? <span className="grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] text-white" style={{ background: 'var(--m-accent)' }}>{chat.unread}</span> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function RosterFace(props: { chat: Chat; members: Character[] }) {
  if (props.chat.kind === 'dm') {
    const person = props.members[0]
    if (person?.avatar.startsWith('data:')) return <img src={person.avatar} alt="" className="h-12 w-12 rounded-2xl object-cover" />
    return <span className="grid h-12 w-12 place-items-center rounded-2xl text-sm" style={{ background: 'var(--m-secondary)' }}>{initialOf(person?.name ?? props.chat.title)}</span>
  }
  if (props.chat.groupAvatar?.startsWith('data:')) return <img src={props.chat.groupAvatar} alt="" className="h-12 w-12 rounded-2xl object-cover" />
  const shown = props.members.slice(0, 4)
  return (
    <span className="grid h-12 w-12 grid-cols-2 overflow-hidden rounded-2xl bg-white">
      {shown.map((person) => (
        <span key={person.id} className="grid place-items-center text-[10px]" style={{ background: 'var(--m-primary)' }}>{initialOf(person.name)}</span>
      ))}
    </span>
  )
}
