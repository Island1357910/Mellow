import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, BookOpen, ChevronRight, Compass, Folder, Gamepad2, IdCard, Layers3, PencilLine, Search, UserRound } from 'lucide-react'
import { workshop, workshopWithTimeout, workshopCategories, workshopKinds, type OwnWork, type PublicWork, type WorkCategory, type WorkshopActivity } from '../../lib/workshop.ts'
import { useAccount } from '../os/AccountGate.tsx'
import { Screen } from '../ui/primitives.tsx'
import { WorkshopPlay } from './WorkshopPlay.tsx'
import { WorkshopAdmin, WorkshopCommunity, WorkshopCover } from './WorkshopCommunity.tsx'
import { WorkshopCreator, WorkshopFolder } from './WorkshopCreator.tsx'
import { CreatorPage, WorkshopMe } from './WorkshopMe.tsx'
import { WorkshopOracle } from './WorkshopOracle.tsx'
import { WorkshopReview, type ReviewSummary } from './WorkshopReview.tsx'
import { applyWorkshopWork, openWorkshopContact, openWorkshopStory } from '../../domain/workshopPhone.ts'
import { readAppliedWorkshopWorks, setWorkshopWorkApplied } from '../../lib/workshopPhone.ts'
import { useMellow } from '../../store/useMellow.ts'

type Tab = 'plaza' | 'create' | 'me'
type Catalog = { items: PublicWork[]; next: boolean }
const tabs = { plaza: ['广场', Compass], create: ['创作', PencilLine], me: ['我的', UserRound] } as const
type View = 'library' | 'review' | 'admin'
const categoryIcons = { character: IdCard, world: BookOpen, simulator: Gamepad2, mod: Layers3 }
const categoryDescriptions = { character: '角色、关系与开场', world: '地图、人物与世界规则', simulator: '玩法、事件与场景', mod: '上传扩展文件与封面' }

function readThrough(activity: WorkshopActivity, time: number) {
  if (!time) return activity
  const items = activity.items.map(item => item.unread && item.time <= time ? { ...item, unread: false } : item)
  return { items, unread: items.filter(item => item.unread).length }
}

export function WorkshopApp({ onBack }: { onBack: () => void }) {
  const account = useAccount()
  const user = account?.user
  const phone = useMellow(state => state.identities.find(person => person.id === state.activeIdentityId))
  const [appliedWorks, setAppliedWorks] = useState<{ namespace: string; ids: string[] }>()
  const applied = appliedWorks?.namespace === phone?.namespace ? appliedWorks?.ids ?? [] : []
  const [tab, setTab] = useState<Tab>('plaza')
  const [view, setView] = useState<View>()
  const [kind, setKind] = useState<WorkCategory>()
  const [folder, setFolder] = useState<WorkCategory>()
  const [editor, setEditor] = useState<{ category: WorkCategory; work?: OwnWork }>()
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [catalog, setCatalog] = useState<Catalog>()
  const [recommended, setRecommended] = useState<Partial<Record<WorkCategory, PublicWork[]>>>({})
  const [library, setLibrary] = useState<PublicWork[]>([])
  const [installationKind, setInstallationKind] = useState<WorkCategory>('character')
  const [own, setOwn] = useState<OwnWork[]>([])
  const [review, setReview] = useState<ReviewSummary[]>([])
  const [reviewItem, setReviewItem] = useState<ReviewSummary>()
  const [after, setAfter] = useState('')
  const [active, setActive] = useState<PublicWork>()
  const [manualPlay, setManualPlay] = useState<PublicWork>()
  const [detail, setDetail] = useState<PublicWork>()
  const [creator, setCreator] = useState<number>()
  const [activity, setActivity] = useState<WorkshopActivity>({ items: [], unread: 0 })
  const seenThrough = useRef(0)
  const [revision, refresh] = useState(0)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function action(operation: () => Promise<void>) {
    setBusy(true)
    setNote('')
    try { await operation() }
    catch (error) { setNote(error instanceof Error ? error.message : '操作失败') }
    finally { setBusy(false) }
  }

  useEffect(() => {
    if (!phone) return
    let live = true
    const { namespace } = phone
    readAppliedWorkshopWorks(namespace)
      .then(ids => { if (live) setAppliedWorks({ namespace, ids }) })
      .catch(error => { if (live) setNote(error instanceof Error ? error.message : '无法读取应用记录') })
    return () => { live = false }
  }, [phone?.namespace])

  useEffect(() => {
    if (!user?.id) return
    seenThrough.current = 0
    let live = true
    let pending: AbortController | undefined
    const sync = () => {
      if (document.hidden || pending) return
      pending = new AbortController()
      void workshopWithTimeout<WorkshopActivity>('/activity', 'GET', undefined, pending)
        .then(value => { if (live) setActivity(readThrough(value, seenThrough.current)) })
        .catch(() => {}).finally(() => { pending = undefined })
    }
    sync()
    const timer = window.setInterval(sync, 60_000)
    document.addEventListener('visibilitychange', sync)
    return () => {
      live = false
      pending?.abort()
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    const controller = new AbortController()
    let live = true
    workshopWithTimeout<PublicWork[]>('/library', 'GET', undefined, controller)
      .then(value => { if (live) setLibrary(value) }).catch(error => { if (live) setNote(error.message) })
    return () => { live = false; controller.abort() }
  }, [user?.id, revision])

  useEffect(() => {
    if (!user?.id) return
    const controller = new AbortController()
    let current = true
    const report = (error: Error) => { if (current) setNote(error.message) }
    const load = <T,>(path: string, apply: (value: T) => void) =>
      workshopWithTimeout<T>(path, 'GET', undefined, controller).then(value => { if (current) apply(value) }).catch(report)
    if (tab === 'plaza') {
      if (kind || query) {
        setCatalog(undefined)
        const params = new URLSearchParams({ page: String(page), ...(kind ? { category: kind } : {}), ...(query ? { q: query } : {}) })
        void load<Catalog>('/works?' + params, setCatalog)
      } else void load<Record<WorkCategory, PublicWork[]>>('/recommendations', setRecommended)
    }
    if (tab === 'create') void load<OwnWork[]>('/mine', setOwn)
    if (tab === 'me' && view === 'review' && user.reviewer) void load<ReviewSummary[]>('/review?after=' + encodeURIComponent(after), setReview)
    return () => { current = false; controller.abort() }
  }, [tab, kind, query, page, user?.id, user?.reviewer, revision, after, view])

  function mutate(path: string, method: string, body?: unknown) {
    return action(async () => {
      await workshop(path, method, body)
      refresh(value => value + 1)
    })
  }

  function openWork(id: string) {
    return action(async () => setDetail(await workshop<PublicWork>('/works/' + id)))
  }

  function readActivity(time: number) {
    return action(async () => {
      await workshop('/activity/read', 'POST', { time })
      seenThrough.current = Math.max(seenThrough.current, time)
      setActivity(current => readThrough(current, seenThrough.current))
    })
  }

  function openCategory(category: WorkCategory) {
    setKind(category)
    setQuery('')
    setCatalog(undefined)
    setPage(1)
    setNote('')
  }

  function closeCatalog() {
    setKind(undefined)
    setSearch('')
    setQuery('')
    setPage(1)
    setNote('')
  }

  function openOnPhone(item: PublicWork, mode: 'sms' | 'offline' | 'side') {
    return action(async () => {
      const state = useMellow.getState()
      if (!phone) throw new Error('请先打开一个小手机身份。')
      if (mode === 'sms') {
        const chat = await openWorkshopContact(phone.namespace, item)
        if (useMellow.getState().activeIdentityId !== phone.id) return
        state.requestOpenChat({ identityId: phone.id, phoneIdentityId: phone.id, chatId: chat.id })
      } else {
        const save = await openWorkshopStory(phone.namespace, item, mode)
        if (useMellow.getState().activeIdentityId !== phone.id) return
        state.requestOpenStory({ identityId: phone.id, mode, saveId: save.id })
      }
    })
  }

  function phoneActions(item: PublicWork) {
    if (!phone) return null
    if (!applied.includes(item.id) || (item.type === 'dlc' && !item.enabled)) return <button type="button" className="workshop-primary" disabled={busy}
      onClick={() => void action(async () => {
        const ids = await applyWorkshopWork(phone.namespace, item.id)
        setAppliedWorks({ namespace: phone.namespace, ids })
        refresh(value => value + 1)
      })}>应用到「{phone.name}」</button>
    return <>
      <small>已应用到「{phone.name}」</small>
      {item.type === 'character' ? <>
        <button type="button" disabled={busy} onClick={() => setManualPlay(item)}>自选 API 游玩</button>
        {item.category === 'character' && <button type="button" className="workshop-primary" disabled={busy} onClick={() => void openOnPhone(item, 'sms')}>用在短信</button>}
        <button type="button" className={item.category === 'character' ? undefined : 'workshop-primary'} disabled={busy} onClick={() => void openOnPhone(item, 'offline')}>用在线下</button>
        <button type="button" disabled={busy} onClick={() => void openOnPhone(item, 'side')}>用在番外</button>
        {item.launchExample && <button type="button" onClick={() => setActive(item)}>公开简介试玩</button>}
      </> : <>
        {item.enabled && item.display.app === 'oracle' && <button type="button" className="workshop-primary" onClick={() => setActive(item)}>打开占卜</button>}
        <button type="button" disabled={busy} onClick={() => void action(async () => {
          const ids = await setWorkshopWorkApplied(phone.namespace, item.id, false)
          setAppliedWorks({ namespace: phone.namespace, ids })
        })}>在当前身份停用</button>
      </>}
    </>
  }

  function card(item: PublicWork, manage = false) {
    const installed = library.find(work => work.id === item.id)
    return <article key={item.id} className="workshop-work">
      <button className="workshop-cover-button" aria-label={'打开' + item.title} onClick={() => setDetail(item)}><WorkshopCover item={item} /></button>
      <div className="workshop-work-copy">
        <h3><button className="workshop-text-button" onClick={() => setDetail(item)}>{item.title}</button></h3>
        <button className="workshop-text-button workshop-byline" onClick={() => setCreator(item.creatorId)}>{item.creatorName}</button>
        {item.summary && <p>{item.summary}</p>}
      </div>
      <div className="workshop-row workshop-work-actions">
        {!installed && <button className="workshop-primary" disabled={busy} onClick={() => void mutate('/library/' + item.id, 'POST')}>{item.type === 'dlc' ? '放入工具箱' : '放入书架'}</button>}
        {installed && phoneActions(installed)}
        {manage && item.installedAt ? <small>安装于 {new Date(item.installedAt).toLocaleDateString()}</small> : null}
        {manage && installed && <button disabled={busy} onClick={() => void mutate('/library/' + item.id, 'DELETE')}>移除</button>}
      </div>
    </article>
  }

  if (!user || !account) return null
  if (reviewItem && user.reviewer) return <WorkshopReview key={reviewItem.id + ':' + reviewItem.revision} item={reviewItem} user={user}
    onBack={() => setReviewItem(undefined)} onDecision={() => {
      setReviewItem(undefined)
      refresh(value => value + 1)
    }} />
  if (active?.display.app === 'oracle') return <WorkshopOracle item={active} onBack={() => setActive(undefined)} />
  if (manualPlay) return <WorkshopPlay key={manualPlay.id} item={manualPlay} user={user} library={library} fullPlay onBack={() => setManualPlay(undefined)} />
  if (active?.launchExample) return <WorkshopPlay key={active.id} item={active} user={user} library={[]} onBack={() => setActive(undefined)} />
  if (creator) return <CreatorPage id={creator} userId={user.id} onBack={() => { setCreator(undefined); refresh(value => value + 1) }} onOpen={item => {
    setCreator(undefined)
    setDetail(item)
  }} />
  if (detail) {
    const installed = library.find(item => item.id === detail.id)
    return <WorkshopCommunity item={detail} user={user} phoneActions={installed ? phoneActions(installed) : undefined} note={note}
      onBack={() => { setDetail(undefined); setNote(''); refresh(value => value + 1) }}
      onCreator={() => setCreator(detail.creatorId)}
      onInstall={!installed ? async () => {
        await workshop('/library/' + detail.id, 'POST')
        refresh(value => value + 1)
      } : undefined} />
  }

  const footer = <nav className="workshop-bottom" aria-label="工坊主导航">
    {(Object.keys(tabs) as Tab[]).map(key => {
      const [label, Icon] = tabs[key]
      return <button key={key} type="button" aria-current={tab === key ? 'page' : undefined} onClick={() => {
        setTab(key)
        setView(undefined)
        if (key === 'plaza') closeCatalog()
        if (key === 'create') setFolder(undefined)
        setNote('')
      }}><span className="workshop-nav-icon"><Icon size={19} strokeWidth={1.65} aria-hidden="true" /></span><span>{label}</span>{key === 'me' && activity.unread > 0 && <small aria-label={activity.unread + ' 条未读'}>{activity.unread}</small>}</button>
    })}
  </nav>
  if (tab === 'create' && editor) {
    return <Screen className="workshop-screen" title={(editor.work ? '编辑' : '新建') + workshopKinds[editor.category]}
      onBack={() => { if (!busy) { setEditor(undefined); setNote('') } }}>
      <div className="workshop workshop-market">
        <p role="status">{note}</p>
        <WorkshopCreator category={editor.category} work={editor.work} busy={busy} action={action} changed={() => refresh(value => value + 1)} />
      </div>
    </Screen>
  }
  if (tab === 'create' && folder) {
    return <Screen className="workshop-screen" title={workshopKinds[folder] + '文件夹'} onBack={() => { setFolder(undefined); setNote('') }} footer={footer}>
      <div className="workshop workshop-market">
        <p role="status">{note}</p>
        <WorkshopFolder works={own.filter(work => work.category === folder)} busy={busy}
          onEdit={work => void action(async () => {
            setEditor({ category: folder, work: await workshop<OwnWork>('/mine/' + work.id) })
          })} mutate={mutate} />
      </div>
    </Screen>
  }
  if (tab === 'plaza' && (kind || query)) {
    return <Screen key={kind ?? 'search'} className="workshop-screen" title={kind ? workshopKinds[kind] : '搜索结果'} onBack={closeCatalog} footer={footer}>
      <div className="workshop workshop-market">
        <p role="status">{note}</p>
        {query && <p className="workshop-empty">搜索「{query}」</p>}
        {!catalog ? !note && <p role="status">正在加载作品…</p> : !catalog.items.length
          ? <p className="workshop-empty">没有找到已上架的作品。</p>
          : <div className="workshop-grid">{catalog.items.map(item => card(item))}</div>}
        {(page > 1 || catalog?.next) && <div className="workshop-row">
          <button disabled={page <= 1} onClick={() => { setCatalog(undefined); setPage(page - 1) }}>上一页</button>
          <button disabled={!catalog?.next} onClick={() => { setCatalog(undefined); setPage(page + 1) }}>下一页</button>
        </div>}
      </div>
    </Screen>
  }
  const toolkitColor = library.find(item => item.enabled && applied.includes(item.id) && !item.display.app && /^#[a-f0-9]{6}$/i.test(item.display.theme_color ?? ''))?.display.theme_color
  return (
    <Screen key={tab + (view ?? '')} className="workshop-screen" title={view === 'library' ? '安装记录' : tab === 'create' ? '创作' : tab === 'me' ? '我的' : '创意工坊'} onBack={view ? () => setView(undefined) : onBack} footer={footer}>
      <div className="workshop workshop-market">
        <p role="status">{note}</p>
        {tab === 'plaza' && <>
          <form className="workshop-search" role="search" onSubmit={event => { event.preventDefault(); setCatalog(undefined); setQuery(search.trim()); setPage(1); setNote('') }}>
            <label><Search size={17} aria-hidden="true" /><input aria-label="搜索工坊" placeholder="搜索作品或创作者" maxLength={80} value={search} onChange={event => setSearch(event.target.value)} /></label>
            <button type="submit">搜索</button>
          </form>
          <header className="workshop-poster workshop-announcement" style={toolkitColor ? { borderColor: toolkitColor } : undefined}>
            <div className="workshop-announcement-art" aria-hidden="true"><span /><span /><span /></div>
            <div className="workshop-announcement-copy">
              <span>工坊公告</span><h2>把想象做成<br />一件作品</h2><p>新作通过审核后，将在广场展出。</p>
            </div>
          </header>
          <nav className="workshop-tabs workshop-modules" aria-label="作品分类">
            {workshopCategories.map(category => {
              const Icon = categoryIcons[category]
              return <button key={category} onClick={() => openCategory(category)}><Icon size={17} strokeWidth={1.6} aria-hidden="true" />{workshopKinds[category]}</button>
            })}
          </nav>
          {workshopCategories.map(category => <section className="workshop-shelf" key={category}>
            <div className="workshop-section-top workshop-shelf-heading"><h3>{workshopKinds[category]}推荐</h3><button onClick={() => openCategory(category)}>全部 <ArrowUpRight size={14} aria-hidden="true" /></button></div>
            {recommended[category]?.length ? <div className="workshop-grid">{recommended[category].map(item => card(item))}</div> : <p>{recommended[category] ? '暂无已上架作品。' : '正在加载作品…'}</p>}
          </section>)}
        </>}
        {tab === 'create' && <>
          <section className="workshop-shelf" aria-labelledby="workshop-new-heading">
            <h2 id="workshop-new-heading" className="workshop-display-title">新建作品</h2>
            <div className="workshop-launch-grid">
              {workshopCategories.map(category => {
                const Icon = categoryIcons[category]
                return <button key={category} data-category={category} className="workshop-launch" onClick={() => {
                  setNote(''); setEditor({ category })
                }}>
                  <span className="workshop-launch-top"><Icon size={24} strokeWidth={1.5} aria-hidden="true" /><ArrowUpRight size={15} aria-hidden="true" /></span>
                  <strong>{workshopKinds[category]}</strong><small>{categoryDescriptions[category]}</small>
                </button>
              })}
            </div>
          </section>
          <section className="workshop-shelf" aria-labelledby="workshop-folders-heading">
            <h2 id="workshop-folders-heading" className="workshop-display-title">作品文件夹</h2>
            <div className="workshop-folders">
              {workshopCategories.map(category => <button className="workshop-folder-link" key={category}
                onClick={() => { setNote(''); setFolder(category) }}>
                <Folder size={20} strokeWidth={1.55} aria-hidden="true" />
                <strong>{workshopKinds[category]}文件夹</strong>
                <small>{own.filter(work => work.category === category).length} 件</small>
                <ChevronRight size={15} aria-hidden="true" />
              </button>)}
            </div>
          </section>
        </>}
        {tab === 'me' && !view && <WorkshopMe user={user} activity={activity} onCreator={setCreator} onOpen={openWork}
          onView={setView} onRead={readActivity} signOut={() => action(account.signOut)} />}
        {tab === 'me' && view === 'library' && <>
          <nav className="workshop-tabs workshop-modules" aria-label="安装记录分类">
            {workshopCategories.map(category => <button key={category} aria-pressed={installationKind === category}
              onClick={() => setInstallationKind(category)}>{workshopKinds[category]}</button>)}
          </nav>
          {library.some(item => item.category === installationKind)
            ? <div className="workshop-grid">{library.filter(item => item.category === installationKind).map(item => card(item, true))}</div>
            : <p>还没有安装{workshopKinds[installationKind]}。</p>}
        </>}
        {tab === 'me' && view === 'admin' && user.reviewer && <WorkshopAdmin />}
        {tab === 'me' && view === 'review' && user.reviewer && <>
          <h2>审核队列</h2>
          {!review.length && <p>暂无待审核作品。</p>}
          <div className="workshop-folders">{review.map(item =>
            <button key={item.id} type="button" className="workshop-folder-link" onClick={() => setReviewItem(item)}>
              <strong>{item.title}</strong><span>{workshopKinds[item.category]}</span><ChevronRight size={16} aria-hidden="true" />
            </button>)}</div>
          <div className="workshop-row">
            <button disabled={!after} onClick={() => setAfter('')}>回到首批</button>
            <button disabled={review.length < 20} onClick={() => setAfter(review[review.length - 1].id)}>下一批</button>
          </div>
        </>}
      </div>
    </Screen>
  )
}
