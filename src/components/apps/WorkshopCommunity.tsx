import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { BookOpen, Gamepad2, Image, Layers3 } from 'lucide-react'
import { workshop, workshopURL, type PublicWork, type WorkshopUser } from '../../lib/workshop.ts'
import { Screen } from '../ui/primitives.tsx'

type Comment = { id: number; body: string; status: 'pending' | 'approved' | 'rejected'; createdAt: number; author: number }
type Social = { liked: boolean; likes: number; comments: Comment[]; next: number | null }

export function WorkshopCover({ item }: { item: PublicWork }) {
  const [broken, setBroken] = useState(false)
  const Icon = { character: Image, world: BookOpen, simulator: Gamepad2, mod: Layers3 }[item.category] ?? Image
  return <div className="workshop-cover" data-kind={item.category}>
    {item.hasCover && !broken
      ? <img src={workshopURL + '/works/' + encodeURIComponent(item.id) + '/cover'} alt={item.title + '的封面'} loading="lazy" onError={() => setBroken(true)} />
      : <Icon size={29} aria-hidden="true" />}
  </div>
}

export function DlcPreview({ item }: { item: PublicWork }) {
  const [pressed, press] = useState('')
  const color = item.display.theme_color
  return <section className="workshop-preview" style={color && /^#[a-f0-9]{6}$/i.test(color) ? { borderTop: '4px solid ' + color } : undefined}>
    <h3>{item.title} · DLC 预览</h3>
    <p>{item.summary}</p>
    {item.display.app === 'oracle' && <p>支持单张占卜和三张牌阵。放入工具箱并启用后即可打开。</p>}
    {color && <p>主题色 <span className="workshop-swatch" style={{ backgroundColor: /^#[a-f0-9]{6}$/i.test(color) ? color : undefined }} /> {color}</p>}
    <div className="workshop-row">
      {item.display.buttons?.map((label, index) => <button key={index} type="button" onClick={() => press(label)}>{label}</button>)}
    </div>
    {pressed && <p role="status">已预览「{pressed}」按钮。</p>}
  </section>
}

export function WorkshopCommunity({ item, user, onBack, onCreator, onInstall, phoneActions, note: phoneNote }: {
  item: PublicWork; user: WorkshopUser; onBack: () => void; onCreator: () => void; onInstall?: () => Promise<void>; phoneActions?: ReactNode; note?: string
}) {
  const [social, setSocial] = useState<Social>()
  const [body, setBody] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const path = '/works/' + item.id + '/social'

  useEffect(() => {
    let current = true
    workshop<Social>(path).then(value => { if (current) setSocial(value) }).catch(error => { if (current) setNote(error.message) })
    return () => { current = false }
  }, [path])

  async function update(operation: () => Promise<void>) {
    setBusy(true)
    setNote('')
    try { await operation(); setSocial(await workshop<Social>(path)) }
    catch (error) { setNote(error instanceof Error ? error.message : '操作失败') }
    finally { setBusy(false) }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void update(async () => {
      await workshop(path + '/comments', 'POST', { body })
      setBody('')
      setNote('评论已发布。')
    })
  }

  return <Screen title={item.title} subtitle="作品详情" onBack={onBack}>
    <div className="workshop">
      {item.hasCover && <WorkshopCover item={item} />}
      <button onClick={onCreator}>{item.creatorName}的主页</button>
      {item.type === 'dlc' ? <DlcPreview item={item} /> : <article><p>{item.summary}</p>{item.display.greeting && <p className="whitespace-pre-wrap break-words">{item.display.greeting}</p>}</article>}
      <div className="workshop-row">
        {onInstall && <button type="button" className="workshop-primary" disabled={busy}
          onClick={() => void update(onInstall)}>{item.type === 'dlc' ? '放入工具箱' : '放入书架'}</button>}
        {phoneActions}
      </div>
      {social && <button type="button" aria-pressed={social.liked} disabled={busy} onClick={() => void update(() =>
        workshop(path + '/like', 'PUT', { liked: !social.liked }))}>{social.liked ? '已赞' : '点赞'} · {social.likes}</button>}
      <h3>评论</h3>
      <form onSubmit={submit}>
        <label>发表评论<textarea required maxLength={1000} value={body} onChange={event => setBody(event.target.value)} /></label>
        <button className="workshop-primary" disabled={busy}>提交评论</button>
      </form>
      {social?.comments.map(comment => <article key={comment.id}>
        <strong>{comment.author === user.id ? '我' : '玩家 ' + comment.author}</strong>
        {comment.status !== 'approved' && <span> · {comment.status === 'pending' ? '待审核' : '已退回'}</span>}
        <p>{comment.body}</p>
        {(comment.author === user.id || user.reviewer) && <button disabled={busy} onClick={() => {
          if (comment.author !== user.id && !window.confirm('删除这条评论？')) return
          void update(() => workshop(path + '/comments/' + comment.id, 'DELETE'))
        }}>删除评论</button>}
      </article>)}
      {social?.next && <button disabled={busy} onClick={() => {
        setBusy(true)
        workshop<Social>(path + '?before=' + social.next).then(next => setSocial({ ...next, comments: [...social.comments, ...next.comments] }))
          .catch(error => setNote(error.message)).finally(() => setBusy(false))
      }}>查看更多评论</button>}
      <p role="status">{phoneNote || note}</p>
    </div>
  </Screen>
}

type ManagedAccount = { id: number; email: string; banned: boolean; administrator: boolean }

export function WorkshopAdmin() {
  const [email, setEmail] = useState('')
  const [account, setAccount] = useState<ManagedAccount>()
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(operation: () => Promise<void>) {
    setBusy(true)
    setNote('')
    try { await operation() }
    catch (error) { setNote(error instanceof Error ? error.message : '操作失败') }
    finally { setBusy(false) }
  }

  return <>
    <h3>账号管理</h3>
    <form onSubmit={event => {
      event.preventDefault()
      setAccount(undefined)
      void run(async () => setAccount(await workshop<ManagedAccount>('/admin/accounts?email=' + encodeURIComponent(email))))
    }}>
      <label>按邮箱查找<input required type="email" value={email} onChange={event => { setEmail(event.target.value); setAccount(undefined) }} /></label>
      <button disabled={busy}>查找账号</button>
    </form>
    {account && <article>
      <strong>{account.email} · {account.administrator ? '管理员' : account.banned ? '已封禁' : '正常'}</strong>
      {!account.administrator && <>
        <label>原因<textarea value={reason} maxLength={500} onChange={event => setReason(event.target.value)} /></label>
        <div className="workshop-row">
          {(['warn', account.banned ? 'unban' : 'ban'] as const).map(action => <button key={action} disabled={busy || !reason.trim()} onClick={() => {
            if (action === 'ban' && !window.confirm('封禁将使该账号立即退出。确认封禁？')) return
            void run(async () => {
              await workshop('/admin/accounts/' + account.id, 'POST', { action, reason })
              if (action !== 'warn') setAccount({ ...account, banned: action === 'ban' })
              setReason('')
              setNote(action === 'warn' ? '已发送账号警告。' : '已更新账号状态。')
            })
          }}>{action === 'warn' ? '发送警告' : action === 'ban' ? '封禁' : '解除封禁'}</button>)}
        </div>
      </>}
    </article>}
    <p>在作品详情页可以删除评论。</p>
    <p role="status">{note}</p>
  </>
}
