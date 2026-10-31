import { Heart, MessageCircle, Search, UserPlus, Check, Bookmark, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { isAiJobRunning, jobKey, runAiJob } from '../../engine/aiJobs.ts'
import { modePresetId } from '../../lib/defaults.ts'
import { loadFeed, needsAiStarSeed, normalizeFeedPosts, saveFeed, STAR_POST_MAX, type FeedComment, type FeedPost } from '../../lib/feed.ts'
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
  const starVoice = presets.find((item) => item.id === modePresetId(settings, 'star'))?.data.prompts.filter(item => item.enabled).map(item => item.content).join('\n') ?? ''
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [tab, setTab] = useState<'all' | 'follow' | 'saved' | 'mine'>('all')
  const [query, setQuery] = useState('')
  const [follows, setFollows] = useState<string[]>([])
  const [bookmarks, setBookmarks] = useState<string[]>([])
  const [blogger, setBlogger] = useState<string | null>(null)
  const [socialReady, setSocialReady] = useState(false)
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
      const chars = await storage.listModernCharacters(phone.namespace)
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
    void storage.getBag(phone.namespace, 'star_feed').then((rows) => {
      const normalized = normalizeFeedPosts(rows)
      if (!stop && normalized.length) setPosts(normalized)
    })
    return () => {
      stop = true
    }
  }, [phone, dataRevision])

  useEffect(() => {
    let alive = true
    setSocialReady(false); setFollows([]); setBookmarks([]); setBlogger(null); setQuery('')
    if (phone) void Promise.all([storage.getBag<string[]>(phone.namespace, 'star_follows'), storage.getBag<string[]>(phone.namespace, 'star_bookmarks')]).then(([following, saved]) => {
      if (alive) {setFollows(following ?? []); setBookmarks(saved ?? []); setSocialReady(true)}
    })
    return () => { alive = false }
  }, [phone?.namespace])

  if (!phone) return null
  const persist = (next: FeedPost[]) => {
    setPosts(next)
    void saveFeed(phone.namespace, next)
  }
  const visible = posts.filter(item => (blogger ? item.handle === blogger : tab === 'mine' ? item.mine : tab === 'follow' ? follows.includes(item.handle) : tab === 'saved' ? bookmarks.includes(item.id) : true) && (!query.trim() || [item.text,item.author,item.handle].join(' ').toLowerCase().includes(query.trim().toLowerCase())))
  const bloggers = Array.from(new Map(posts.filter(p => !p.mine).map(p => [p.handle, p])).values())
  const profile = blogger ? bloggers.find(p => p.handle === blogger) : null
  const toggleFollow = (handle: string) => {
    if (!socialReady) return
    const next = follows.includes(handle) ? follows.filter(h=>h!==handle) : [...follows,handle]
    setFollows(next); void storage.setBag(phone.namespace,'star_follows',next)
  }
  const bookmark = (id: string) => {
    if (!socialReady) return
    const next=bookmarks.includes(id)?bookmarks.filter(i=>i!==id):[...bookmarks,id]
    setBookmarks(next);void storage.setBag(phone.namespace,'star_bookmarks',next)
  }
  const followButton = (handle: string) => <button type="button" className="chip star-follow" aria-pressed={follows.includes(handle)} disabled={!socialReady} onClick={()=>toggleFollow(handle)}>{follows.includes(handle)?<Check size={13}/>:<UserPlus size={13}/>} {follows.includes(handle)?'已关注':'关注'}</button>
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
        const chars = await storage.listModernCharacters(phone.namespace)
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
    if (blogger) { setBlogger(null); return }
    props.onBack()
  }

  return (
    <div className="sms-shell star-shell h-full min-h-0" style={candyStyle('#F0B7A8', '#F8D0DC', '#F8E6C0')}>
      <Screen
        title={opened ? opened.author : writing ? '写一条' : '星博'}
        subtitle={opened ? `@${opened.handle}` : `关注 ${follows.length} 位博主 · 发现生活的新鲜事`}
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
            <div className="mb-4 flex items-center justify-between gap-2"><button className="text-sm font-semibold" onClick={()=>{setBlogger(opened.handle);setOpenId(null)}}>@{opened.handle}</button>{!opened.mine&&followButton(opened.handle)}</div><p className="whitespace-pre-wrap text-sm leading-7">{opened.text}</p>
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
            <label className="star-search mb-3 flex items-center gap-2 rounded-2xl border border-current/10 px-3 py-2"><Search size={17}/><input aria-label="搜索星博" className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none" placeholder="搜索内容、话题、博主" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button className="text-xs" onClick={()=>setQuery('')}>清除</button>}</label>
            {profile ? <section className="menu-card mb-3"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">{profile.author}</h2><p className="mt-1 text-xs">@{profile.handle} · {posts.filter(p=>p.handle===profile.handle).length} 条动态</p></div>{followButton(profile.handle)}</div><button className="chip mt-3" onClick={()=>setBlogger(null)}>返回信息流</button></section> : <div className="mb-3 flex gap-2 overflow-x-auto text-xs"><span className="flex shrink-0 items-center gap-1"><TrendingUp size={14}/>热门话题</span>{['今日碎片','城市夜话','生活'].map(topic=><button key={topic} className="shrink-0" onClick={()=>{setTab('all');setQuery(topic)}}>#{topic}#</button>)}</div>}
            <div className="mb-3 grid grid-cols-4 gap-1 rounded-full bg-white/70 p-1 text-xs">
              {([['all', '推荐'], ['follow', '关注'], ['saved', '收藏'], ['mine', '我']] as const).map(([id, label]) => (
                <button key={id} type="button" className="rounded-full py-1.5" style={{ background: tab === id ? '#F0B7A8' : 'transparent' }} aria-pressed={tab===id} onClick={() => {setTab(id);setBlogger(null)}}>{label}</button>
              ))}
            </div>
            <button type="button" className="chip mb-3" disabled={refreshing} onClick={() => void refresh()}>{refreshing ? '正在看…' : '刷一刷'}</button>
            {note ? <PillNote tone="pink" compact>{note}</PillNote> : null}
            <div className="mb-3 flex items-center justify-between text-xs"><span>{query ? '当前信息流搜索结果' : tab === 'follow' ? '已关注博主的动态' : tab === 'saved' ? '收藏的动态' : '最新动态'} · {visible.length} 条</span></div>
            {tab === 'follow' && !blogger && !query && <section className="menu-card mb-3"><h3 className="mb-3 text-xs font-semibold">发现博主</h3><div className="space-y-3">{bloggers.slice(0,6).map(person=><div key={person.handle} className="flex items-center justify-between gap-2"><button className="min-w-0 truncate text-sm" onClick={()=>setBlogger(person.handle)}>{person.author} <span className="text-xs opacity-70">@{person.handle}</span></button>{followButton(person.handle)}</div>)}</div></section>}
            <div className="space-y-2">
              {visible.length === 0 ? <PillNote tone="pink">{query?'没有找到匹配的内容或博主':tab==='follow'?'关注博主后，这里会出现他们的动态':tab==='saved'?'收藏喜欢的动态，留着以后再看':'这里还安静'}</PillNote> : visible.map((item) => (
                <article key={item.id} className="menu-card star-post">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <button className="flex min-w-0 items-center gap-2 text-left" onClick={()=>setBlogger(item.handle)}>
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F8D0DC] text-sm">{item.author.slice(0,1)}</span>
                      <span className="min-w-0"><span className="block truncate text-sm font-semibold">{item.author}</span><span className="block truncate text-[11px]" style={{color:'var(--m-text-secondary)'}}>@{item.handle} · {when(item.at)}</span></span>
                    </button>
                    {!item.mine&&followButton(item.handle)}
                  </div>
                  <button type="button" className="block w-full whitespace-pre-wrap break-words text-left text-sm leading-7" onClick={()=>setOpenId(item.id)}>{item.text}</button>
                  <div className="star-actions mt-3 grid grid-cols-3 gap-2 border-t border-current/10 pt-3">
                    <button type="button" className="chip" style={item.liked ? { background: '#F8D0DC' } : undefined} onClick={() => like(item.id)}><Heart size={12} /> {item.likes}</button>
                    <button type="button" className="chip" onClick={() => setOpenId(item.id)}><MessageCircle size={14} /> {item.comments.length}</button>
                    <button className="chip" aria-pressed={bookmarks.includes(item.id)} onClick={()=>bookmark(item.id)}><Bookmark size={14} fill={bookmarks.includes(item.id)?'currentColor':'none'}/>{bookmarks.includes(item.id)?'已收藏':'收藏'}</button>
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
