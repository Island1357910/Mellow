import { ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react'

import { useEffect, useState, type CSSProperties } from 'react'

import { PHONE_APPS } from '../../data/apps.ts'

import { isAiJobRunning, jobKey, runAiJob } from '../../engine/aiJobs.ts'
import { assessCharOpen } from '../../lib/peekAssess.ts'
import { loadPeek, refreshPeek, type PeekThread } from '../../lib/peek.ts'

import type { FeedPost } from '../../lib/feed.ts'

import { initialOf } from '../../lib/format.ts'

import { candyStyle } from '../../lib/candy.ts'

import { storage } from '../../storage/StorageService.ts'

import { useMellow } from '../../store/useMellow.ts'

import type { Character, Chat, ChatMessage } from '../../types/index.ts'

import { BindStrip } from '../ui/BindStrip.tsx'

import { PickCard } from '../ui/PickCard.tsx'

import { PillNote, Screen } from '../ui/primitives.tsx'



const CHAR_APPS = [

  { id: 'sms', name: '短信', need: 0, blurb: '你和 TA 的聊天', emoji: '💬', tint: '#F8D0DC', accent: '#EE9AB0' },

  { id: 'moments', name: '朋友圈', need: 3, blurb: '动态与碎碎念', emoji: '🌿', tint: '#F8E6C0', accent: '#E9B949' },

  { id: 'star', name: '星博', need: 8, blurb: '公开发过的内容', emoji: '✨', tint: '#F8DCC8', accent: '#F0B7A8' },

  { id: 'album', name: '相册', need: 12, blurb: '没删的照片', emoji: '🖼️', tint: '#D7E7F8', accent: '#7FB8E0' },

  { id: 'diary', name: '日记', need: 20, blurb: '只写给自己的页', emoji: '📔', tint: '#E6DDF8', accent: '#B9A3E3' },

] as const



const ALBUM_ITEMS = [

  { id: 'album-1', name: '窗台', blurb: '下午的光', emoji: '🪟', tint: '#D7E7F8' },

  { id: 'album-2', name: '晚饭', blurb: '还冒着热气', emoji: '🍲', tint: '#F8E6C0' },

  { id: 'album-3', name: '一张没发出去的照片', blurb: '留在相册里', emoji: '📷', tint: '#F8D0DC' },

]



function phoneAppCard(app: (typeof PHONE_APPS)[number], allowed: boolean) {

  return {

    id: app.id,

    name: app.name,

    blurb: app.blurb,

    emoji: initialOf(app.name),

    tint: app.tint,

    accent: app.tint,

    badge: allowed ? '可见' : '隐藏',

  }

}



function diaryWhen(at: number) {

  const date = new Date(at)

  return `${date.getMonth() + 1}月${date.getDate()}日 · ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`

}



function usePhone() {

  const identities = useMellow((state) => state.identities)

  const activeIdentityId = useMellow((state) => state.activeIdentityId)

  return identities.find((item) => item.id === activeIdentityId) ?? null

}



function ThreadRow(props: { title: string; preview: string; mark: string; onClick: () => void }) {

  return (

    <button type="button" className="hz-thread-row" onClick={props.onClick}>

      <span className="hz-thread-avatar">{props.mark}</span>

      <span className="hz-thread-body">

        <span className="hz-thread-title">{props.title}</span>

        <span className="hz-thread-preview">{props.preview}</span>

      </span>

      <ChevronRight size={16} className="hz-thread-chevron" />

    </button>

  )

}



function PeekInbox(props: { namespace: string; person: Character; chats: Chat[] }) {

  const [others, setOthers] = useState<PeekThread[]>([])

  const [open, setOpen] = useState<{ title: string; lines: Array<{ id: string; author: string; text: string }> } | null>(null)

  const dataRevision = useMellow((state) => state.dataRevision)

  const peekBusy = isAiJobRunning(jobKey(props.namespace, 'peek', props.person.id))

  useEffect(() => {

    let stop = false

    void loadPeek(props.namespace, props.person).then((rows) => {

      if (!stop) setOthers(rows)

    })

    return () => {

      stop = true

    }

  }, [props.namespace, props.person, dataRevision])

  const openReal = async (chat: Chat) => {

    const messages = await storage.listMessages(props.namespace, chat.id)

    const lines = messages

      .filter((item) => item.kind !== 'system')

      .slice(-24)

      .map((item: ChatMessage) => ({

        id: item.id,

        author: item.role === 'user' ? '你' : item.charId === props.person.id ? props.person.name : chat.title,

        text: item.content,

      }))

    setOpen({ title: chat.kind === 'dm' ? '你' : chat.title, lines })

  }

  if (open) {

    return (

      <div>

        <button type="button" className="chip chip-sky mb-3" onClick={() => setOpen(null)}>

          <ChevronLeft size={14} />

          返回列表

        </button>

        <div className="hz-chat-head">

          <span className="hz-thread-avatar">{initialOf(open.title)}</span>

          <span className="hz-chat-head-title">{open.title}</span>

        </div>

        {open.lines.length === 0 ? (

          <PillNote tone="mint">这条还没有字</PillNote>

        ) : (

          <div className="hz-msg-list">

            {open.lines.map((item) => (

              <article key={item.id} className={`hz-msg${item.author === '你' ? ' is-me' : ' is-them'}`}>

                {item.author !== '你' ? <span className="hz-msg-author">{item.author}</span> : null}

                {item.text}

              </article>

            ))}

          </div>

        )}

      </div>

    )

  }

  const withYou = props.chats.filter((chat) => chat.kind === 'dm')

  const groups = props.chats.filter((chat) => chat.kind === 'group')

  return (

    <div className="space-y-4">

      <section>

        <p className="hz-section-head">和你</p>

        {withYou.length === 0 ? (

          <PillNote tone="mint">还没有和你的短信</PillNote>

        ) : (

          withYou.map((chat) => (

            <ThreadRow

              key={chat.id}

              title="你"

              mark="你"

              preview={chat.lastMessage || '还没有字'}

              onClick={() => void openReal(chat)}

            />

          ))

        )}

      </section>

      <section>

        <p className="hz-section-head">和其他人</p>

        {groups.map((chat) => (

          <ThreadRow

            key={chat.id}

            title={chat.title}

            mark={initialOf(chat.title)}

            preview={chat.lastMessage || '还没有字'}

            onClick={() => void openReal(chat)}

          />

        ))}

        {others.map((chat) => (

          <ThreadRow

            key={chat.id}

            title={chat.title}

            mark={initialOf(chat.title)}

            preview={chat.preview}

            onClick={() => setOpen({ title: chat.title, lines: chat.lines })}

          />

        ))}

        <button

          type="button"

          className="chip chip-solid mt-3 w-full"

          disabled={peekBusy}

          onClick={() => {

            runAiJob(jobKey(props.namespace, 'peek', props.person.id), async () => {

              await refreshPeek(props.namespace, props.person)

            })

          }}

        >

          {peekBusy ? '正在看…' : '让这些对话再真实一点'}

        </button>

      </section>

    </div>

  )

}



export function HuizhenApp(props: { onBack: () => void }) {

  const phone = usePhone()

  const [chars, setChars] = useState<Character[]>([])

  const [bound, setBound] = useState('')

  const [open, setOpen] = useState<string[]>([])

  const [, setCount] = useState(0)

  const [chats, setChats] = useState<Chat[]>([])

  const [moments, setMoments] = useState<Array<{ id: string; author: string; text: string }>>([])

  const [posts, setPosts] = useState<FeedPost[]>([])

  const [pages, setPages] = useState<Array<{ text: string; at: number }>>([])

  const [seen, setSeen] = useState<string[]>([])

  const [page, setPage] = useState<string | null>(null)

  const [sheet, setSheet] = useState(false)

  const [reason, setReason] = useState('')

  const dataRevision = useMellow((state) => state.dataRevision)

  const assessBusy = phone && bound ? isAiJobRunning(jobKey(phone.namespace, 'assess', bound)) : false



  useEffect(() => {

    if (!phone) return

    let stop = false

    void storage.listCharacters(phone.namespace).then((rows) => {

      if (!stop) setChars(rows)

    })

    void storage.getBag<string>(phone.namespace, 'huizhen').then((id) => {

      if (!stop && id) setBound(id)

    })

    return () => {

      stop = true

    }

  }, [phone])



  useEffect(() => {

    if (!phone || !bound) return

    let stop = false

    void (async () => {

      const [people, allChats, stored, momentRows, feed] = await Promise.all([

        storage.listCharacters(phone.namespace),

        storage.listChats(phone.namespace),

        storage.getBag<Record<string, string[]>>(phone.namespace, 'char_open'),

        storage.getBag<Array<{ id: string; author: string; text: string }>>(phone.namespace, 'moments'),

        storage.getBag<FeedPost[]>(phone.namespace, 'star_feed'),

      ])

      const glance = await storage.getBag<Record<string, string[]>>(phone.namespace, 'glance')

      const mine = allChats.filter((chat) => chat.memberIds.includes(bound))

      let messages = 0

      for (const chat of mine) messages += (await storage.listMessages(phone.namespace, chat.id)).length

      const personRow = people.find((item) => item.id === bound)

      const prev = stored?.[bound]

      let nextApps = prev ?? ['sms']

      if (!prev && personRow) {

        runAiJob(jobKey(phone.namespace, 'assess', bound), async () => {

          const assessed = await assessCharOpen({ namespace: phone.namespace, character: personRow })

          await storage.setBag(phone.namespace, 'char_open', { ...(stored ?? {}), [bound]: assessed.apps })

          await storage.setBag(phone.namespace, `assess_reason_${bound}`, assessed.line)

        })

      }

      if (stop) return

      setChars(people)

      setChats(mine)

      setCount(messages)

      setOpen(nextApps)

      setMoments(momentRows ?? [])

      setPosts(feed ?? [])

      setSeen(glance?.[bound] ?? [])

    })()

    return () => {

      stop = true

    }

  }, [phone, bound, dataRevision])



  useEffect(() => {

    if (!phone || !bound) return

    void storage.getBag<Record<string, string[]>>(phone.namespace, 'char_open').then((stored) => {

      const apps = stored?.[bound]

      if (apps) setOpen(apps)

    })

    void storage.getBag<string>(phone.namespace, `assess_reason_${bound}`).then((line) => {

      if (line) setReason(line)

    })

  }, [phone, bound, dataRevision])



  useEffect(() => {

    if (!phone || page !== 'diary' || !bound) return

    const person = chars.find((item) => item.id === bound)

    if (!person) return

    let stop = false

    void storage.getBag<Array<{ text: string; at: number }>>(phone.namespace, `char_diary_${bound}`).then(async (rows) => {

      const ready = rows ?? [

        { text: `${person.personality.trim().slice(0, 40) || '普通的一天'}。这页没有给别人看。`, at: Date.now() - 86_400_000 },

        { text: '把手机扣过去，看了一会儿窗外。', at: Date.now() - 7_200_000 },

      ]

      if (!rows) await storage.setBag(phone.namespace, `char_diary_${bound}`, ready)

      if (!stop) setPages(ready)

    })

    return () => {

      stop = true

    }

  }, [phone, page, bound, chars])



  if (!phone) return null

  const person = chars.find((item) => item.id === bound)

  const bind = (id: string) => {

    setBound(id)

    setPage(null)

    void storage.setBag(phone.namespace, 'huizhen', id)

  }

  const toggle = (appId: string) => {

    if (!bound) return

    const next = seen.includes(appId) ? seen.filter((id) => id !== appId) : [...seen, appId]

    setSeen(next)

    void storage.getBag<Record<string, string[]>>(phone.namespace, 'glance').then((row) => {

      void storage.setBag(phone.namespace, 'glance', { ...(row ?? {}), [bound]: next })

    })

  }

  const decide = () => {

    if (!person || !phone || !bound || assessBusy) return

    runAiJob(jobKey(phone.namespace, 'assess', bound), async () => {

      try {

        const assessed = await assessCharOpen({ namespace: phone.namespace, character: person })

        const stored = (await storage.getBag<Record<string, string[]>>(phone.namespace, 'char_open')) ?? {}

        await storage.setBag(phone.namespace, 'char_open', { ...stored, [bound]: assessed.apps })

        await storage.setBag(phone.namespace, `assess_reason_${bound}`, assessed.line)

      } catch {

        await storage.setBag(phone.namespace, `assess_reason_${bound}`, '按你们最近的相处重新看过了。')

      }

    })

  }



  const back = () => {

    if (sheet) {

      setSheet(false)

      return

    }

    if (page) {

      setPage(null)

      return

    }

    props.onBack()

  }

  const current = CHAR_APPS.find((item) => item.id === page)

  const personMoments = person ? moments.filter((item) => item.author === person.name) : []

  const personPosts = person ? posts.filter((item) => item.charId === person.id || item.author === person.name) : []



  return (

    <div className="sms-shell relative h-full min-h-0" style={candyStyle('#B7C9E8', '#D5F0E4', '#F8D0DC')}>

      <Screen

        title={current?.name ?? '回针'}

        subtitle={person ? `${person.name} 的手机 · 按感情决定可见范围` : '先绑定一个人'}

        onBack={back}

        right={<button type="button" aria-label="权限" className="grid h-9 w-9 place-items-center rounded-full bg-white/80 shadow-[0_4px_12px_rgba(120,80,100,0.08)]" onClick={() => setSheet(true)}><SlidersHorizontal size={16} /></button>}

      >

        {!person ? (

          <div className="space-y-3">

            <BindStrip characters={chars} onPick={bind} />

            <PillNote tone={chars.length ? 'sky' : 'pink'}>{chars.length ? '点上方名字，绑定后才能看 TA 的手机' : '还没有角色。先在创作或短信里放进一个人'}</PillNote>

          </div>

        ) : page === 'sms' ? (

          <PeekInbox namespace={phone.namespace} person={person} chats={chats} />

        ) : page === 'moments' ? (

          <div>

            {personMoments.length === 0 ? (

              <PillNote tone="butter">朋友圈还是空的</PillNote>

            ) : (

              personMoments.map((item) => (

                <article key={item.id} className="hz-moment-card">

                  <p className="hz-moment-text">{item.text}</p>

                </article>

              ))

            )}

          </div>

        ) : page === 'star' ? (

          <div>

            {personPosts.length === 0 ? (

              <PillNote tone="pink">星博上还没有 TA</PillNote>

            ) : (

              personPosts.map((item) => (

                <article key={item.id} className="hz-star-card">

                  <p className="hz-star-text">{item.text}</p>

                  <div className="hz-star-meta">

                    <span className="hz-stat-pill">{item.likes} 赞</span>

                    <span className="hz-stat-pill">{item.comments.length} 评论</span>

                  </div>

                </article>

              ))

            )}

          </div>

        ) : page === 'album' ? (

          <div className="hz-album-grid">

            {ALBUM_ITEMS.map((item) => (

              <article

                key={item.id}

                className="hz-album-tile"

                style={{ '--album-tint': item.tint } as CSSProperties}

              >

                <span className="hz-album-emoji" aria-hidden>{item.emoji}</span>

                <div className="hz-album-caption">

                  <span className="hz-album-name">{item.name}</span>

                  <span className="hz-album-blurb">{item.blurb}</span>

                </div>

              </article>

            ))}

          </div>

        ) : page === 'diary' ? (

          <div>

            {pages.map((item) => (

              <article key={item.at} className="hz-diary-sheet">

                <p className="hz-diary-date">{diaryWhen(item.at)}</p>

                <p className="hz-diary-text">{item.text}</p>

              </article>

            ))}

          </div>

        ) : (

          <>

            <BindStrip characters={chars} bound={bound} onPick={bind} />

            {reason ? <div className="mt-3"><PillNote tone="lilac" compact>{reason}</PillNote></div> : null}

            <div className="hz-divider"><span>TA 愿意给你看</span></div>

            <div className="pick-card-grid">

              {CHAR_APPS.map((item) => {

                const allowed = open.includes(item.id)

                return (

                  <PickCard

                    key={item.id}

                    item={{ ...item, badge: allowed ? '可看' : '未开放' }}

                    selected={false}

                    disabled={!allowed}

                    onClick={() => setPage(item.id)}

                  />

                )

              })}

            </div>

            <button type="button" className="chip chip-solid mt-3 w-full" disabled={assessBusy} onClick={decide}>{assessBusy ? 'TA 在想…' : '让 TA 重新决定'}</button>

            <p className="mt-2 text-[11px] leading-5" style={{ color: 'var(--m-text-secondary)' }}>相处变多，会自己多开一些。感情变了，TA 也可以关掉。</p>

          </>

        )}

      </Screen>

      {sheet ? (

        <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/25">

          <button type="button" aria-label="关闭" className="min-h-16 flex-1" onClick={() => setSheet(false)} />

          <div className="rounded-t-[28px] bg-[#fffaf7] px-4 pb-16 pt-4 shadow-[0_-12px_32px_rgba(120,80,100,0.12)]">

            <p className="text-lg font-semibold">给 TA 看的</p>

            <p className="mt-1 text-xs" style={{ color: 'var(--m-text-secondary)' }}>这些是你手机里的应用，{person?.name ?? 'TA'} 能不能看见</p>

            <div className="mt-3 pick-card-grid max-h-[52vh] overflow-y-auto">

              {PHONE_APPS.filter((item) => item.id !== 'search').map((app) => {

                const allowed = seen.includes(app.id)

                return (

                  <PickCard

                    key={app.id}

                    item={phoneAppCard(app, allowed)}

                    selected={allowed}

                    onClick={() => toggle(app.id)}

                  />

                )

              })}

            </div>

          </div>

        </div>

      ) : null}

    </div>

  )

}


