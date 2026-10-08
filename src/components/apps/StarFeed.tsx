import { Heart, MessageCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { isAiJobRunning, jobKey, runAiJob } from '../../engine/aiJobs.ts'
import { modePresetId } from '../../lib/defaults.ts'
import { loadFeed, needsAiStarSeed, saveFeed, STAR_POST_MAX, type FeedComment, type FeedPost } from '../../lib/feed.ts'
import { refreshStarFeedAi, replyStarCommentAi, seedStarFeedAi } from '../../lib/starAi.ts'
import { candyStyle } from '../../lib/candy.ts'
import { uid } from '../../lib/id.ts'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import { PillNote, Screen } from '../ui/primitives.tsx'

function usePhone() {
  const identities = useMellow((state) => state.identities)
  const activeIdentityId = useMellow((state) => state.activeIdentityId)
  return identities.find((item) => item.id === activeIdentityId) ?? null
}

function clock(): number {
  return Date.now()
}

function when(at: number): string {
  const diff = Date.now() - at
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return new Date(at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

export function StarApp(props: { onBack: () => void }) {
  const phone = usePhone()
  const presets = useMellow((state) => state.presets)
  const settings = useMellow((state) => state.settings)
  const starVoice = presets.find((item) => item.id === modePresetId(settings, 'star'))?.data.prompts.find((item) => item.enabled)?.content ?? ''
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [tab, setTab] = useState<'all' | 'follow' | 'mine'>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [writing, setWriting] = useState(false)
  const [draft, setDraft] = useState('')
  const [comment, setComment] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [note, setNote] = useState('')
  const dataRevision = useMellow((state) => state.dataRevision)

  useEffect(() => {
    if (!phone) return
    let stop = false
    void (async () => {
      const chars = await storage.listCharacters(phone.namespace)
      const brief = chars.map((item) => ({
        id: item.id,
        name: item.name,
        personality: item.personality,
        signature: item.signature,
        description: item.description,
      }))
      const rows = await loadFeed(phone.namespace, phone.name, brief)
      if (stop) return
      setPosts(rows)
      if (!needsAiStarSeed(rows)) return
      setNote('正在写广场…')
      runAiJob(jobKey(phone.namespace, 'star', 'seed'), async () => {
        try {
          await seedStarFeedAi(phone.namespace, phone.name, brief)
          if (!stop) setNote('')
        } catch (reason) {
          if (!stop) setNote(reason instanceof Error ? reason.message : '这次没有写成，稍后再试')
        }
      })
    })()
    return () => {
      stop = true
    }
  }, [phone, starVoice])

  useEffect(() => {
    if (!phone) return
    let stop = false
    void storage.getBag<FeedPost[]>(phone.namespace, 'star_feed').then((rows) => {
      if (!stop && rows?.length) setPosts(rows)
    })
    return () => {
      stop = true
    }
  }, [phone, dataRevision])

  if (!phone) return null
  const persist = (next: FeedPost[]) => {
    setPosts(next)
    void saveFeed(phone.namespace, next)
  }
  const visible = posts.filter((item) => (tab === 'mine' ? item.mine : tab === 'follow' ? Boolean(item.charId) : true))
  const opened = posts.find((item) => item.id === openId) ?? null
  const commentBusy = opened ? isAiJobRunning(jobKey(phone.namespace, 'star', `reply-${opened.id}`)) : false

  const publish = () => {
    const text = draft.trim()
    if (!text) return
    persist([{
      id: uid('post'),
      author: phone.name,
      handle: '我',
      text: text.slice(0, STAR_POST_MAX),
      at: Date.now(),
      likes: 0,
      liked: false,
      comments: [],
      mine: true,
    }, ...posts])
    setDraft('')
    setWriting(false)
    setTab('mine')
  }

  const like = (id: string) => {
    persist(posts.map((item) => (item.id === id ? { ...item, liked: !item.liked, likes: item.likes + (item.liked ? -1 : 1) } : item)))
  }

  const sendComment = () => {
    if (!opened || !comment.trim() || commentBusy) return
    const mine: FeedComment = { id: uid('cmt'), author: phone.name, text: comment.trim(), at: clock() }
    const next = posts.map((item) => (item.id === opened.id ? { ...item, likes: item.likes + 1, comments: [...item.comments, mine] } : item))
    persist(next)
    const postId = opened.id
    setComment('')
    runAiJob(jobKey(phone.namespace, 'star', `reply-${postId}`), async () => {
      await replyStarCommentAi({ namespace: phone.namespace, postId, player: phone.name, starVoice })
    })
  }

  const refresh = () => {
    if (refreshing) return
    setRefreshing(true)
    setTab('all')
    const key = jobKey(phone.namespace, 'star', 'refresh')
    const started = runAiJob(key, async () => {
      try {
        const chars = await storage.listCharacters(phone.namespace)
        const next = await refreshStarFeedAi(phone.namespace, chars.map((item) => ({
          id: item.id,
          name: item.name,
          personality: item.personality,
          signature: item.signature,
          description: item.description,
        })))
        setPosts(next)
        setNote('')
      } catch (reason) {
        setNote(reason instanceof Error ? reason.message : '这次没有写成，稍后再试')
      } finally {
        setRefreshing(false)
      }
    })
    if (!started) setRefreshing(false)
  }

  const back = () => {
    if (opened) {
      setOpenId(null)
      return
    }
    if (writing) {
      setWriting(false)
      return
    }
    props.onBack()
  }

  return (
    <div className="sms-shell h-full min-h-0" style={candyStyle('#F0B7A8', '#F8D0DC', '#F8E6C0')}>
      <Screen
        title={opened ? opened.author : writing ? '写一条' : '星博'}
        subtitle={opened ? `@${opened.handle}` : '很多人的生活'}
        onBack={back}
        right={opened || writing ? null : <button type="button" className="chip chip-solid" onClick={() => setWriting(true)}>写</button>}
      >
        {writing ? (
          <div className="menu-card">
            <textarea value={draft} maxLength={STAR_POST_MAX} rows={5} onChange={(event) => setDraft(event.target.value)} placeholder="今天" className="soft-input resize-none" />
            <button type="button" className="chip chip-solid mt-3" disabled={!draft.trim()} onClick={publish}>发出</button>
          </div>
        ) : null}
        {opened ? (
          <article className="menu-card">
            <p className="whitespace-pre-wrap text-sm leading-6">{opened.text}</p>
            <p className="mt-2 text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{when(opened.at)}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="chip" style={opened.liked ? { background: '#F8D0DC' } : undefined} onClick={() => like(opened.id)}><Heart size={12} /> {opened.likes}</button>
              <span className="chip"><MessageCircle size={12} /> {opened.comments.length}</span>
            </div>
            <div className="mt-3 space-y-2">
              {opened.comments.map((item) => (
                <p key={item.id} className="text-sm leading-6"><span className="font-medium">{item.author}</span> {item.text}</p>
              ))}
            </div>
            <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); void sendComment() }}>
              <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder={commentBusy ? '正在回…' : '写评论'} className="soft-input" />
              <button type="submit" className="chip chip-solid shrink-0" disabled={commentBusy || !comment.trim()}>发送</button>
            </form>
          </article>
        ) : null}
        {!opened && !writing ? (
          <>
            <div className="mb-3 grid grid-cols-3 gap-1 rounded-full bg-white/70 p-1 text-xs">
              {([['all', '广场'], ['follow', '关注'], ['mine', '我']] as const).map(([id, label]) => (
                <button key={id} type="button" className="rounded-full py-1.5" style={{ background: tab === id ? '#F0B7A8' : 'transparent' }} onClick={() => setTab(id)}>{label}</button>
              ))}
            </div>
            <button type="button" className="chip mb-3" disabled={refreshing} onClick={() => void refresh()}>{refreshing ? '正在看…' : '刷一刷'}</button>
            {note ? <PillNote tone="pink" compact>{note}</PillNote> : null}
            <div className="space-y-2">
              {visible.length === 0 ? <PillNote tone="pink">这里还安静</PillNote> : visible.map((item) => (
                <article key={item.id} className="menu-card">
                  <button type="button" className="block w-full text-left" onClick={() => setOpenId(item.id)}>
                    <span className="flex items-center gap-2">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-[#F8D0DC] text-sm">{item.author.slice(0, 1)}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{item.author}</span>
                        <span className="block text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>@{item.handle} · {when(item.at)}</span>
                      </span>
                    </span>
                    <span className="mt-2 block text-sm leading-6">{item.text}</span>
                  </button>
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="chip" style={item.liked ? { background: '#F8D0DC' } : undefined} onClick={() => like(item.id)}><Heart size={12} /> {item.likes}</button>
                    <button type="button" className="chip" onClick={() => setOpenId(item.id)}><MessageCircle size={12} /> {item.comments.length}</button>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : null}
      </Screen>
    </div>
  )
}
