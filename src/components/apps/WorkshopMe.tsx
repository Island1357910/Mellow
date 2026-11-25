import { useEffect, useState } from 'react'
import { Archive, Bell, ChevronRight, Settings2, ShieldCheck, UsersRound } from 'lucide-react'
import { readWorkshopAvatar, workshop, workshopKinds, workshopURL, workshopWithTimeout, type CreatorProfile, type PublicWork, type WorkshopActivity, type WorkshopUser } from '../../lib/workshop.ts'
import { Screen } from '../ui/primitives.tsx'
import { WorkshopCover } from './WorkshopCommunity.tsx'

type Following = { items: CreatorProfile[]; next: boolean }

function CreatorAvatar({ profile, pending }: { profile?: CreatorProfile; pending?: string | null }) {
  const src = pending === undefined && profile?.avatarVersion
    ? workshopURL + '/creators/' + profile.id + '/avatar?v=' + profile.avatarVersion
    : pending
  return <span className="workshop-avatar" aria-hidden="true">
    {src ? <img src={src} alt="" /> : Array.from(profile?.name ?? '我')[0]}
  </span>
}

export function WorkshopMe({ user, activity, onCreator, onOpen, onView, onRead, signOut }: {
  user: WorkshopUser
  activity: WorkshopActivity
  onCreator: (id: number) => void
  onOpen: (id: string) => Promise<void>
  onView: (view: 'library' | 'review' | 'admin') => void
  onRead: (time: number) => Promise<void>
  signOut: () => Promise<void>
}) {
  const [profile, setProfile] = useState<CreatorProfile>()
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [editing, setEditing] = useState(false)
  const [avatar, setAvatar] = useState<string | null>()
  const [following, setFollowing] = useState<Following>()
  const [page, setPage] = useState(1)
  const [note, setNote] = useState('')
  const [profileNotice, setProfileNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [readingAvatar, setReadingAvatar] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileAttempt, setProfileAttempt] = useState(0)
  const busy = saving || readingAvatar

  useEffect(() => {
    const controller = new AbortController()
    let live = true
    workshopWithTimeout<CreatorProfile>('/profile', 'GET', undefined, controller)
      .then(value => { if (live) setProfile(value) })
      .catch(error => { if (live) setProfileError(error.message === 'Failed to fetch' ? '主页加载失败，请检查网络。' : error.message) })
    return () => { live = false; controller.abort() }
  }, [user.id, profileAttempt])

  useEffect(() => {
    const controller = new AbortController()
    let live = true
    workshopWithTimeout<Following>('/following?page=' + page, 'GET', undefined, controller)
      .then(value => { if (live) setFollowing(value) }).catch(() => { if (live) setNote('关注列表暂时无法加载。') })
    return () => { live = false; controller.abort() }
  }, [page, user.id])

  async function saveProfile() {
    if (busy) return
    const nickname = name.trim()
    if (!nickname) { setProfileError('请填写公开昵称。'); return }
    setProfileError('')
    setProfileNotice('')
    setSaving(true)
    try {
      setProfile(await workshopWithTimeout<CreatorProfile>('/profile', 'PUT', { name: nickname, bio: bio.trim(), avatar }))
      setEditing(false)
      setProfileNotice('主页已更新。')
    } catch (error) {
      setProfileError(error instanceof Error && error.message !== 'Failed to fetch' ? error.message : '保存失败，请检查网络后重试。')
    } finally { setSaving(false) }
  }

  return <>
    <section className="workshop-preview workshop-profile">
      <div className="workshop-profile-heading">
        <CreatorAvatar profile={profile} pending={editing ? avatar : undefined} />
        <div><h2>{profile?.name ?? '我的主页'}</h2>{profile && <p>{profile.followers} 位关注者</p>}</div>
      </div>
      {profile?.bio && <p>{profile.bio}</p>}
      <div className="workshop-row workshop-profile-actions">
        <button className="workshop-primary" onClick={() => onCreator(user.id)}>查看公开主页</button>
        <button disabled={!profile || editing} onClick={() => {
          setName(profile?.name ?? '')
          setBio(profile?.bio ?? '')
          setAvatar(undefined)
          setProfileError('')
          setProfileNotice('')
          setEditing(true)
        }}>编辑主页</button>
        {!profile && profileError && <button type="button" onClick={() => { setProfileError(''); setProfileAttempt(value => value + 1) }}>重新加载</button>}
      </div>
      {editing && <form onSubmit={event => {
        event.preventDefault()
        void saveProfile()
      }}>
        <label>公开昵称<input maxLength={36} disabled={saving} value={name} onChange={event => setName(event.target.value)} /></label>
        <label>个人简介<textarea maxLength={600} disabled={saving} value={bio} onChange={event => setBio(event.target.value)} /></label>
        <label>主页头像<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (!file) return
          setProfileError('')
          setReadingAvatar(true)
          void readWorkshopAvatar(file).then(setAvatar)
            .catch(error => setProfileError(error.message)).finally(() => setReadingAvatar(false))
        }} /></label>
        {(avatar || (avatar === undefined && profile?.avatarVersion)) && <button type="button" disabled={busy} onClick={() => setAvatar(null)}>移除头像</button>}
        {profileError && <p role="alert">{profileError}</p>}
        <div className="workshop-row"><button className="workshop-primary" disabled={busy}>{saving ? '保存中…' : readingAvatar ? '处理头像中…' : '保存主页'}</button>
          <button type="button" disabled={busy} onClick={() => { setEditing(false); setProfileError('') }}>取消</button></div>
      </form>}
      {!editing && profileError && <p role="alert">{profileError}</p>}
      {profileNotice && <p role="status">{profileNotice}</p>}
    </section>
    <nav className="workshop-folders" aria-label="个人工具">
      <button className="workshop-folder-link" onClick={() => onView('library')}>
        <Archive size={20} strokeWidth={1.6} aria-hidden="true" /><strong>安装记录</strong><ChevronRight size={15} aria-hidden="true" />
      </button>
      {user.reviewer && <>
        <button className="workshop-folder-link" onClick={() => onView('review')}>
          <ShieldCheck size={20} strokeWidth={1.6} aria-hidden="true" /><strong>作品审核</strong><ChevronRight size={15} aria-hidden="true" />
        </button>
        <button className="workshop-folder-link" onClick={() => onView('admin')}>
          <Settings2 size={20} strokeWidth={1.6} aria-hidden="true" /><strong>管理账号</strong><ChevronRight size={15} aria-hidden="true" />
        </button>
      </>}
    </nav>
    <section className="workshop-shelf workshop-personal-section">
      <div className="workshop-section-top"><h3><Bell size={17} aria-hidden="true" /> 评论、点赞与更新提醒</h3>{activity.unread > 0 && activity.items.length > 0 &&
        <button onClick={() => void onRead(activity.items[0].time)}>标为已读</button>}</div>
      {!activity.items.length && <p>暂无互动消息或更新提醒。</p>}
      {activity.items.map(item => <article className="workshop-activity" key={item.kind + ':' + item.workId + ':' + item.ref}>
        <strong>{item.kind === 'comment' ? '新评论' : item.kind === 'like' ? '收到点赞' : '关注的创作者发布了更新'}{item.unread ? ' · 未读' : ''}</strong>
        {item.body && <p>{item.body}</p>}
        <div className="workshop-section-top">
          <button className="workshop-text-button" onClick={() => void onOpen(item.workId)}>{item.title}</button>
          {item.time > 0 && <small>{new Date(item.time).toLocaleDateString()}</small>}
        </div>
      </article>)}
    </section>
    <section className="workshop-shelf workshop-personal-section">
      <h3><UsersRound size={17} aria-hidden="true" /> 关注的创作者</h3>
      {following?.items.length === 0 && <p>还没有关注创作者。</p>}
      {following?.items.map(item => <article key={item.id} className="workshop-section-top">
        <button onClick={() => onCreator(item.id)}>{item.name}</button>
        <small>{item.reminders ? '更新提醒已开启' : '更新提醒已关闭'}</small>
      </article>)}
      {following && (following.next || page > 1) && <div className="workshop-row">
        <button disabled={page === 1} onClick={() => setPage(page - 1)}>上一页</button>
        <button disabled={!following.next} onClick={() => setPage(page + 1)}>下一页</button>
      </div>}
    </section>
    <details className="workshop-account"><summary>当前账号</summary><div className="workshop-row"><span>{user.email}</span><button onClick={() => void signOut()}>退出登录</button></div></details>
    <p role="status">{note}</p>
  </>
}

type CreatorCatalog = CreatorProfile & { items: PublicWork[]; next: boolean }

export function CreatorPage({ id, userId, onBack, onOpen }: {
  id: number
  userId: number
  onBack: () => void
  onOpen: (item: PublicWork) => void
}) {
  const [page, setPage] = useState(1)
  const [profile, setProfile] = useState<CreatorCatalog>()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    workshop<CreatorCatalog>('/creators/' + id + '?page=' + page).then(value => { if (live) setProfile(value) })
      .catch(error => { if (live) setNote(error.message) })
    return () => { live = false }
  }, [id, page])

  function update(following: boolean, reminders: boolean) {
    setBusy(true)
    setNote('')
    workshop<CreatorProfile>('/creators/' + id + '/follow', 'PUT', { following, reminders })
      .then(value => setProfile(current => current && { ...current, ...value }))
      .catch(error => setNote(error.message)).finally(() => setBusy(false))
  }

  return <Screen title={profile?.name ?? '创作者主页'} onBack={onBack}>
    <div className="workshop">
      {profile && <>
        <header className="workshop-poster">
          <div className="workshop-profile-heading"><CreatorAvatar profile={profile} /></div>
          <h2>{profile.name}</h2>
          {profile.bio && <p>{profile.bio}</p>}
          <span>{profile.followers} 位关注者</span>
        </header>
        {id !== userId && <div className="workshop-row">
          <button className="workshop-primary" disabled={busy} onClick={() => update(!profile.following, false)}>{profile.following ? '取消关注' : '关注创作者'}</button>
          {profile.following && <button disabled={busy} aria-pressed={profile.reminders} onClick={() => update(true, !profile.reminders)}>
            {profile.reminders ? '关闭更新提醒' : '开启更新提醒'}
          </button>}
        </div>}
        <h3>已发布作品</h3>
        {!profile.items.length && <p>暂无已上架作品。</p>}
        <div className="workshop-grid">{profile.items.map(item => <article className="workshop-work" key={item.id}>
          <button className="workshop-cover-button" aria-label={'打开' + item.title} onClick={() => onOpen(item)}><WorkshopCover item={item} /></button>
          <span className="workshop-kind">{workshopKinds[item.category]}</span>
          <h3><button className="workshop-text-button" onClick={() => onOpen(item)}>{item.title}</button></h3><p>{item.summary}</p>
        </article>)}</div>
        {(page > 1 || profile.next) && <div className="workshop-row">
          <button disabled={page === 1} onClick={() => setPage(page - 1)}>上一页</button>
          <button disabled={!profile.next} onClick={() => setPage(page + 1)}>下一页</button>
        </div>}
      </>}
      <p role="status">{note}</p>
    </div>
  </Screen>
}
