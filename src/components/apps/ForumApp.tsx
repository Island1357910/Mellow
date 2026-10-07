import { Heart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { isAiJobRunning, jobKey, runAiJob } from '../../engine/aiJobs.ts'
import { candyStyle } from '../../lib/candy.ts'
import { modePresetId } from '../../lib/defaults.ts'
import { generatePlotForumPost, generateRandomForumPost, replyForumCommentAi, type ForumThread } from '../../lib/forumAi.ts'
import { uid } from '../../lib/id.ts'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import { PillNote, Screen } from '../ui/primitives.tsx'

function clock(): number {
  return Date.now()
}

function usePhone() {
  const identities = useMellow((state) => state.identities)
  const activeIdentityId = useMellow((state) => state.activeIdentityId)
  return identities.find((item) => item.id === activeIdentityId) ?? null
}

const BOARDS = ['树洞', '日常', '提问', '剧情']

export function ForumApp(props: { onBack: () => void }) {
  const phone = usePhone()
  const presets = useMellow((state) => state.presets)
  const settings = useMellow((state) => state.settings)
  const voice = presets.find((item) => item.id === modePresetId(settings, 'forum'))?.data.prompts.find((item) => item.enabled)?.content ?? ''
  const dataRevision = useMellow((state) => state.dataRevision)
  const [rows, setRows] = useState<ForumThread[] | null>(null)
  const [tab, setTab] = useState<'all' | 'mine'>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [plot, setPlot] = useState('')
  const [comment, setComment] = useState('')
  const [board, setBoard] = useState(BOARDS[0] ?? '树洞')

  const persist = (next: ForumThread[]) => {
    if (!phone) return
    setRows(next)
    void storage.setBag(phone.namespace, 'forum', next.slice(0, 40))
  }

  const publish = () => {
    if (!phone || !rows) return
    const text = body.trim()
    if (!title.trim() || !text) return
    persist([{
      id: uid('topic'),
      title: title.trim().slice(0, 24),
      board,
      author: phone.name,
      text: text.slice(0, 400),
      at: clock(),
      likes: 0,
      liked: false,
      replies: [],
      mine: true,
    }, ...rows])
    setTitle('')
    setBody('')
    setTab('mine')
  }

  const growRandom = (baseRows: ForumThread[] = rows ?? []) => {
    if (!phone) return
    const key = jobKey(phone.namespace, 'forum', 'random')
    if (isAiJobRunning(key)) return
    runAiJob(key, async () => {
      await generateRandomForumPost(phone.namespace, voice, baseRows)
    })
  }

  useEffect(() => {
    if (!phone) return
    let stop = false
    void (async () => {
      const saved = (await storage.getBag<ForumThread[]>(phone.namespace, 'forum')) ?? []
      if (stop) return
      setRows(saved)
      if (saved.length === 0) {
        const seeded = await storage.getBag<boolean>(phone.namespace, 'forum_seeded')
        if (!seeded) {
          await storage.setBag(phone.namespace, 'forum_seeded', true)
          growRandom(saved)
        }
      }
    })()
    return () => {
      stop = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, dataRevision])

  if (!phone || !rows) return null
  const opened = rows.find((item) => item.id === openId) ?? null
  const visible = rows.filter((item) => (tab === 'mine' ? item.mine : true))
  const busy =
    isAiJobRunning(jobKey(phone.namespace, 'forum', 'random'))
    || isAiJobRunning(jobKey(phone.namespace, 'forum', 'plot'))
    || (opened ? isAiJobRunning(jobKey(phone.namespace, 'forum', `reply-${opened.id}`)) : false)

  const grow = () => {
    const text = plot.trim()
    if (!text || busy || !phone || !rows) return
    const key = jobKey(phone.namespace, 'forum', 'plot')
    if (isAiJobRunning(key)) return
    runAiJob(key, async () => {
      await generatePlotForumPost(phone.namespace, voice, text, rows)
    })
    setPlot('')
  }

  const likeThread = (id: string) => {
    persist(rows.map((item) => (item.id === id ? { ...item, liked: !item.liked, likes: item.likes + (item.liked ? -1 : 1) } : item)))
  }

  const sendComment = () => {
    if (!opened || !comment.trim() || !phone) return
    const mine = { id: uid('reply'), author: phone.name, text: comment.trim().slice(0, 120), at: clock(), likes: 0, liked: false }
    persist(rows.map((item) => (item.id === opened.id ? { ...item, likes: item.likes + 1, replies: [...item.replies, mine] } : item)))
    const threadId = opened.id
    setComment('')
    runAiJob(jobKey(phone.namespace, 'forum', `reply-${threadId}`), async () => {
      await replyForumCommentAi({ namespace: phone.namespace, threadId, player: phone.name, voice })
    })
  }

  return (
    <div className="sms-shell h-full min-h-0" style={candyStyle('#F0C56A', '#F8D0DC', '#D5F0E4')}>
      <Screen title={opened ? opened.board : '论坛'} subtitle={opened ? opened.author : '帖子、跟帖、吃瓜'} onBack={() => (opened ? setOpenId(null) : props.onBack())}>
        {opened ? (
          <div className="space-y-3">
            <article className="menu-card">
              <p className="text-base font-semibold">{opened.title}</p>
              <p className="mt-1 text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{opened.author} · {opened.board}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{opened.text}</p>
              <button type="button" className="chip mt-3" onClick={() => likeThread(opened.id)}><Heart size={13} fill={opened.liked ? 'currentColor' : 'none'} /> {opened.likes}</button>
            </article>
            <div className="space-y-2">
              {opened.replies.map((item) => (
                <article key={item.id} className="menu-card">
                  <p className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{item.author}</p>
                  <p className="mt-1 text-sm leading-6">{item.text}</p>
                </article>
              ))}
            </div>
            <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); sendComment() }}>
              <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="跟一帖" className="soft-input" />
              <button type="submit" className="chip chip-solid shrink-0" disabled={!comment.trim()}>发送</button>
            </form>
          </div>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-2 gap-1 rounded-full bg-white/70 p-1 text-xs">
              <button type="button" className="rounded-full py-1.5" style={{ background: tab === 'all' ? '#F0C56A' : 'transparent' }} onClick={() => setTab('all')}>广场</button>
              <button type="button" className="rounded-full py-1.5" style={{ background: tab === 'mine' ? '#F0C56A' : 'transparent' }} onClick={() => setTab('mine')}>我的</button>
            </div>
            <div className="menu-card mb-3 space-y-2">
              <p className="text-xs" style={{ color: 'var(--m-text-secondary)' }}>根据当前剧情随机来帖，或指定想看的内容</p>
              <button type="button" className="chip chip-butter w-full" disabled={busy} onClick={() => void growRandom()}>{busy ? '正在写…' : '随机生成帖子'}</button>
            </div>
            <form className="menu-card mb-3 space-y-2" onSubmit={(event) => { event.preventDefault(); void grow() }}>
              <textarea value={plot} rows={3} onChange={(event) => setPlot(event.target.value)} placeholder="可选：指定想看的内容，比如有人在电梯里认出了前桌" className="soft-input resize-none" />
              <button type="submit" className="chip chip-solid" disabled={busy || !plot.trim()}>{busy ? '正在写…' : '按指定内容生成'}</button>
            </form>
            <form className="menu-card mb-3 space-y-2" onSubmit={(event) => { event.preventDefault(); publish() }}>
              <div className="flex flex-wrap gap-1.5">
                {BOARDS.map((item) => (
                  <button key={item} type="button" className="chip" style={board === item ? { background: '#F0C56A' } : undefined} onClick={() => setBoard(item)}>{item}</button>
                ))}
              </div>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="标题" className="soft-input" />
              <textarea value={body} rows={3} onChange={(event) => setBody(event.target.value)} placeholder="自己发一帖" className="soft-input resize-none" />
              <button type="submit" className="chip chip-solid" disabled={!title.trim() || !body.trim()}>发布</button>
            </form>
            <div className="space-y-2">
              {visible.length === 0 ? <PillNote tone="butter">版面还是空的</PillNote> : visible.map((item) => (
                <button key={item.id} type="button" className="menu-card w-full text-left" onClick={() => setOpenId(item.id)}>
                  <p className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{item.board} · {item.author}</p>
                  <p className="mt-1 text-sm font-medium">{item.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm leading-6">{item.text}</p>
                  <p className="mt-2 text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{item.likes} 赞 · {item.replies.length} 回复</p>
                </button>
              ))}
            </div>
          </>
        )}
      </Screen>
    </div>
  )
}
