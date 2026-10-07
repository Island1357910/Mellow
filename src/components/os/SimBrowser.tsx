import { useEffect, useRef, useState } from 'react'
import { isAiJobRunning, jobKey, runAiJob } from '../../engine/aiJobs.ts'
import { postUserText } from '../../domain/messaging.ts'
import { loadSearchArticle, loadSearchHits, runSearchArticle, runSearchHits, type SearchHit } from '../../lib/browserAi.ts'
import { chatTitle, sortChats } from '../../lib/chats.ts'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import type { Chat, Identity } from '../../types/index.ts'
import { candyStyle } from '../../lib/candy.ts'
import { PillNote } from '../ui/primitives.tsx'

interface Article {
  hit: SearchHit
  body: string
}

export function SimBrowser(props: {
  query: string
  identity?: Identity
  onClose: () => void
  onSearch?: (query: string) => void
  onSent: (chatId: string) => void
}) {
  const dataRevision = useMellow((state) => state.dataRevision)
  const namespace = props.identity?.namespace ?? 'global'
  const [query, setQuery] = useState(props.query)
  const [draft, setDraft] = useState(props.query)
  const [hits, setHits] = useState<SearchHit[]>([])
  const [error, setError] = useState('')
  const [article, setArticle] = useState<Article | null>(null)
  const [picking, setPicking] = useState(false)
  const [chats, setChats] = useState<Chat[]>([])
  const [sending, setSending] = useState(false)
  const [forwardError, setForwardError] = useState('')
  const wantForward = useRef(false)
  const [detailHit, setDetailHit] = useState<SearchHit | null>(null)

  useEffect(() => {
    if (!query.trim()) return
    let alive = true
    void (async () => {
      const cached = await loadSearchHits(namespace, query)
      if (!alive) return
      if (cached) {
        setHits(cached)
        setError('')
        return
      }
      setHits([])
      setError('')
      runAiJob(jobKey(namespace, 'browser', `search-${query}`), async () => {
        try {
          await runSearchHits(namespace, query)
        } catch (reason) {
          await storage.setBag(namespace, `browser_error_${query.slice(0, 24)}`, reason instanceof Error ? reason.message : '搜索没有写成')
        }
      })
    })()
    return () => {
      alive = false
    }
  }, [query, namespace, dataRevision])

  useEffect(() => {
    if (!query.trim()) return
    void storage.getBag<string>(namespace, `browser_error_${query.slice(0, 24)}`).then((message) => {
      if (message) {
        setError(message)
        void storage.setBag(namespace, `browser_error_${query.slice(0, 24)}`, '')
      }
    })
  }, [query, namespace, dataRevision])

  useEffect(() => {
    if (!detailHit) return
    let alive = true
    void (async () => {
      const cached = await loadSearchArticle(namespace, query, detailHit)
      if (!alive) return
      if (cached?.body) {
        setArticle({ hit: detailHit, body: cached.body })
        if (wantForward.current && props.identity) {
          wantForward.current = false
          setPicking(true)
          void storage.listChats(props.identity.namespace).then((rows) => setChats(sortChats(rows)))
        }
        return
      }
      setArticle({ hit: detailHit, body: '' })
      runAiJob(jobKey(namespace, 'browser', `detail-${query}-${detailHit.title}`), async () => {
        try {
          await runSearchArticle(namespace, query, detailHit)
        } catch (reason) {
          await storage.setBag(namespace, `browser_detail_error_${detailHit.title.slice(0, 16)}`, reason instanceof Error ? reason.message : '这一页没有写成')
        }
      })
    })()
    return () => {
      alive = false
    }
  }, [detailHit, query, namespace, dataRevision, props.identity])

  useEffect(() => {
    if (!detailHit) return
    void loadSearchArticle(namespace, query, detailHit).then((cached) => {
      if (cached?.body) setArticle({ hit: detailHit, body: cached.body })
    })
    void storage.getBag<string>(namespace, `browser_detail_error_${detailHit.title.slice(0, 16)}`).then((message) => {
      if (message) {
        setForwardError(message)
        void storage.setBag(namespace, `browser_detail_error_${detailHit.title.slice(0, 16)}`, '')
      }
    })
  }, [detailHit, query, namespace, dataRevision])

  const busy = isAiJobRunning(jobKey(namespace, 'browser', `search-${query}`))
  const articleBusy = detailHit ? isAiJobRunning(jobKey(namespace, 'browser', `detail-${query}-${detailHit.title}`)) : false

  const openDetail = (hit: SearchHit, forward = false) => {
    wantForward.current = forward
    setForwardError('')
    setPicking(false)
    setDetailHit(hit)
  }

  const openForward = () => {
    if (!props.identity || !article?.body) return
    setPicking(true)
    setForwardError('')
    void storage.listChats(props.identity.namespace).then((rows) => setChats(sortChats(rows)))
  }

  const sendTo = (chat: Chat) => {
    if (!props.identity || !article?.body || sending) return
    setSending(true)
    setForwardError('')
    const text = `转发自搜索「${query}」\n${article.hit.title}\n${article.hit.site}\n\n${article.body}`
    void postUserText({ namespace: props.identity.namespace, identity: props.identity, chat, text })
      .then(() => props.onSent(chat.id))
      .catch((reason: unknown) => {
        setSending(false)
        setForwardError(reason instanceof Error ? reason.message : '没有发进聊天')
      })
  }

  return (
    <div className="candy-shell absolute inset-0 z-30 flex flex-col" style={candyStyle('#E7E0D8', '#F8D0DC', '#D7E7F8')} onPointerDown={(event) => event.stopPropagation()}>
      <div className="flex items-center gap-2 px-3 pb-2 pt-12">
        <button
          type="button"
          aria-label="返回"
          className="grid h-9 w-9 place-items-center rounded-full bg-white/70"
          onClick={() => {
            if (picking) {
              setPicking(false)
              return
            }
            if (article) {
              setArticle(null)
              setDetailHit(null)
              return
            }
            props.onClose()
          }}
        >
          ‹
        </button>
        <form
          className="flex min-w-0 flex-1 items-center rounded-full bg-white/80 px-3 py-2"
          onSubmit={(event) => {
            event.preventDefault()
            const text = draft.trim()
            if (!text) return
            setQuery(text)
            setArticle(null)
            setDetailHit(null)
            props.onSearch?.(text)
          }}
        >
          <input value={draft} onChange={(event) => setDraft(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </form>
      </div>
      <div className="scroll min-h-0 flex-1 px-4 pb-10">
        {article ? (
          <article className="rounded-[24px] bg-white/85 p-4 shadow-[0_10px_20px_rgba(120,80,100,0.05)]">
            <p className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{article.hit.site}</p>
            <h2 className="mt-2 text-lg">{article.hit.title}</h2>
            {articleBusy ? <PillNote tone="sky" compact>正在写这一页</PillNote> : null}
            {!articleBusy && !article.body && forwardError ? <PillNote tone="peach" inline>{forwardError}</PillNote> : null}
            {!articleBusy
              ? article.body.split('\n').filter((line) => line.trim()).map((line, index) => (
                  <p key={`${index}-${line}`} className="mt-3 text-sm leading-7">{line}</p>
                ))
              : null}
            <div className="mt-5 flex items-center gap-3">
              <button type="button" className="chip" onClick={() => { setArticle(null); setDetailHit(null) }}>返回结果</button>
              <button
                type="button"
                className="chip chip-pink"
                disabled={!props.identity || articleBusy || !article.body}
                onClick={openForward}
              >
                转发到聊天
              </button>
            </div>
            {!props.identity ? <PillNote tone="lilac" compact>还没有身份，没法转发</PillNote> : null}
          </article>
        ) : (
          <div>
            <p className="mb-2 w-fit rounded-full bg-[#F8E6C0] px-3 py-1 text-xs">搜索「{query}」</p>
            <PillNote tone="sky" compact>这一页由当前接口写成，不会打开外面的网站</PillNote>
            {busy ? <PillNote tone="lilac">正在写搜索结果</PillNote> : null}
            {error ? (
              <div className="mt-3 rounded-[22px] bg-[#FFF6F8] p-4">
                <p className="text-sm leading-6">{error}</p>
                <button type="button" className="chip chip-pink mt-3" onClick={() => setQuery(`${query} `)}>再试一次</button>
              </div>
            ) : null}
            {hits.map((hit, index) => (
              <div key={`${index}-${hit.title}`} className="mb-2 mt-3 rounded-[22px] p-3 shadow-[0_8px_16px_rgba(120,80,100,0.04)]" style={{ background: ['#FFF6F8', '#F4FBF7', '#FFF8EC', '#F6F3FC'][index % 4] }}>
                <button type="button" className="block w-full text-left" onClick={() => openDetail(hit)}>
                  <p className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{hit.site}</p>
                  <p className="mt-1 text-sm">{hit.title}</p>
                  <p className="mt-1 text-xs leading-5" style={{ color: 'var(--m-text-secondary)' }}>{hit.snippet}</p>
                </button>
                <div className="mt-3 flex gap-2">
                  <button type="button" className="chip" onClick={() => openDetail(hit)}>查看详情</button>
                  <button type="button" className="chip chip-pink" disabled={!props.identity} onClick={() => openDetail(hit, true)}>转发到聊天</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {picking && article ? (
          <div className="mt-3 rounded-[24px] bg-white/85 p-3">
            <p className="px-1 pb-2 text-sm">转发到哪个聊天</p>
            {chats.length === 0 ? <PillNote tone="pink" compact>还没有聊天，先在短信里找一个人</PillNote> : null}
            {chats.map((chat) => (
              <button key={chat.id} type="button" className="block w-full rounded-2xl px-2 py-2 text-left text-sm" onClick={() => sendTo(chat)} disabled={sending}>
                {chatTitle(chat)}
              </button>
            ))}
            {forwardError ? <p className="px-1 pt-2 text-xs">{forwardError}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
