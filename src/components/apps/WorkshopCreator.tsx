import { useEffect, useState, type FormEvent } from 'react'
import { ImagePlus, Sparkles } from 'lucide-react'
import { moduleAi, readJson } from '../../lib/ask.ts'
import { workshop, readWorkshopCover, workshopImageSource, workshopKinds, workshopURL, type Draft, type OwnWork, type PublicWork, type WorkCategory } from '../../lib/workshop.ts'
import { DlcPreview } from './WorkshopCommunity.tsx'
import { WorkshopCoverCrop } from './WorkshopCoverCrop.tsx'
import { previewWorkshopDraft } from '../../domain/workshopPhone.ts'
import { useMellow } from '../../store/useMellow.ts'
import { uid } from '../../lib/id.ts'
import type { WorkshopPhoneChannel } from '../../lib/workshopPhone.ts'
import { storage } from '../../storage/StorageService.ts'

const statuses = { draft: '草稿', pending: '待审核', approved: '已发布', rejected: '已退回' } as const
const emptyDraft = (): Draft => ({ title: '', summary: '', endpoints: [], content: { version: 1 } })
const ai = moduleAi('create')
const fields = {
  character: ['隐藏角色设定', '隐藏世界观', '公开开场白'],
  world: ['隐藏世界规则与核心设定', '隐藏地点、势力与人物', '公开探索入口'],
  simulator: ['隐藏玩法机制与状态规则', '隐藏事件与场景', '公开开始说明'],
} as const

function generatedDraft(raw: unknown): Draft {
  if (!raw || typeof raw !== 'object') throw new Error('AI 没有返回有效草稿，原稿已保留。')
  const data = raw as Record<string, unknown>
  const field = (value: unknown, limit: number) => typeof value === 'string' ? value.trim().slice(0, limit) : ''
  const title = field(data.title, 80)
  const persona = field(data.persona, 24000)
  if (!title || !persona) throw new Error('AI 没有返回标题或核心设定，原稿已保留。')
  return { title, summary: field(data.summary, 800), endpoints: [], content: { version: 1, persona, world: field(data.world, 16000), greeting: field(data.greeting, 4000) } }
}

export function WorkshopCreator({ category, work, busy, action, changed }: {
  category: WorkCategory; work?: OwnWork; busy: boolean; action: (operation: () => Promise<void>) => Promise<void>; changed: () => void
}) {
  const [draft, setDraft] = useState<Draft>(() => work ?? emptyDraft())
  const [addresses, setAddresses] = useState(work?.endpoints.join('\n') ?? '')
  const [record, setRecord] = useState<{ id: string; revision: number } | undefined>(work)
  const [cover, setCover] = useState(work?.cover ?? '')
  const [cropImage, setCropImage] = useState<HTMLImageElement>()
  const [modFile, setModFile] = useState<{ name: string; manifest: string }>()
  const [preview, setPreview] = useState<PublicWork>()
  const [brief, setBrief] = useState('')
  const [change, setChange] = useState('')
  const [previous, setPrevious] = useState<Draft>()
  const [generated, setGenerated] = useState(Boolean(work))
  const [previewKey, setPreviewKey] = useState(() => work?.id ?? uid('draft'))
  const phone = useMellow(state => state.identities.find(person => person.id === state.activeIdentityId))
  const [sessionReady, setSessionReady] = useState(false)
  const sessionKey = 'workshop_creator_preview_' + category + '_' + (work?.id ?? 'new')
  useEffect(() => {
    let active = true
    setSessionReady(false)
    if (!phone) { setSessionReady(true); return }
    void storage.getBag<{ draft: Draft; key: string; revision?: number; record?: { id: string; revision: number } }>(phone.namespace, sessionKey).then(saved => {
      if (!active) return
      if (saved && saved.revision === work?.revision) {
        setDraft(saved.draft)
        setCover(saved.draft.cover ?? '')
        setAddresses(saved.draft.endpoints.join('\n'))
        setPreviewKey(saved.key)
        setRecord(saved.record ?? work)
        setGenerated(true)
      }
    }).catch(() => undefined).finally(() => { if (active) setSessionReady(true) })
    return () => { active = false }
  }, [phone?.namespace, sessionKey, work?.revision])
  const labels = category === 'mod' ? undefined : fields[category]
  const canSave = Boolean(!cropImage && cover && (category === 'mod' ? modFile : generated))
  const modPayload = { cover, manifest: modFile?.manifest }

  function tryOnPhone(mode: WorkshopPhoneChannel) {
    if (!phone) return
    void action(async () => {
      await storage.setBag(phone.namespace, sessionKey, { draft: { ...draft, cover,
        endpoints: addresses.split(/\r?\n/).map(value => value.trim()).filter(Boolean) }, key: previewKey, revision: work?.revision, record })
      const result = await previewWorkshopDraft(phone.namespace, previewKey, category, { ...draft, cover }, mode)
      const state = useMellow.getState()
      if (state.activeIdentityId !== phone.id) return
      if (result.chat) state.requestOpenChat({ identityId: phone.id, phoneIdentityId: phone.id, chatId: result.chat.id })
      if (result.save && mode !== 'sms') state.requestOpenStory({ identityId: phone.id, mode, saveId: result.save.id })
    })
  }

  function save(event: FormEvent) {
    event.preventDefault()
    if (!canSave || busy) return
    void action(async () => {
      const payload = category === 'mod' ? modPayload : {
        title: draft.title, summary: draft.summary, content: draft.content, cover,
        endpoints: addresses.split(/\r?\n/).map(value => value.trim()).filter(Boolean),
      }
      const saved = record
        ? await workshop<{ id: string; revision: number }>('/mine/' + record.id, 'PUT', { revision: record.revision, draft: payload })
        : await workshop<{ id: string; revision: number }>('/mine/' + category, 'POST', payload)
      setRecord(saved)
      if (phone) await storage.setBag(phone.namespace, sessionKey, null)
      changed()
    })
  }

  function build(revise: boolean) {
    if (!labels) return
    const instruction = (revise ? change : brief).trim()
    if (!instruction || (revise && !draft.title.trim())) return
    if (!window.confirm('这次生成会把输入发送到你配置的创作模型。请 AI 修改也会发送当前草稿正文。继续？')) return
    void action(async () => {
      const system = '你正在为半糖工坊整理' + workshopKinds[category] +
        '。只输出 JSON 对象，字段为 title, summary, persona, world, greeting。title、summary 和 greeting 会公开。禁止脚本、HTML 或代码。修改时保留无关设定。' + labels.join('，')
      const input = revise ? { instruction, current: { title: draft.title, summary: draft.summary, ...draft.content } } : { instruction }
      const next = generatedDraft(readJson(await ai.askJson(system, JSON.stringify(input))))
      setPrevious(generated ? draft : undefined)
      setDraft(next)
      setGenerated(true)
      if (revise) setChange('')
    })
  }

  const coverPicker = <>
  <label className="workshop-upload">
    {cover ? <img className="workshop-upload-cover" src={workshopImageSource(cover)} alt="所选作品图" /> : <ImagePlus size={22} aria-hidden="true" />}
    <span>{category === 'character' ? '角色图' : '封面图'} · {cover ? '更换图片' : '选择图片'}</span>
    <small>竖版 3:4，其他比例可手动裁切，最大 2 MB</small>
    <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => {
      const file = event.currentTarget.files?.[0]
      event.currentTarget.value = ''
      if (file) void action(async () => {
        const image = await readWorkshopCover(file)
        if (image.naturalWidth * 4 === image.naturalHeight * 3) {
          setCover(image.src)
          setCropImage(undefined)
          setPreview(undefined)
        } else setCropImage(image)
      })
    }} />
  </label>
  {cropImage && <WorkshopCoverCrop key={cropImage.src} image={cropImage} onCancel={() => setCropImage(undefined)}
    onConfirm={source => { setCover(source); setPreview(undefined); setCropImage(undefined) }} />}
  </>

  if (!sessionReady) return <p role="status">正在恢复创作草稿…</p>
  return <>
    {category !== 'mod' && <section className="workshop-preview workshop-editor">
      <h3>{generated ? '继续打磨' : '把想法告诉 AI'}</h3>
      {!generated ? <>
        <label>创作想法<textarea rows={4} maxLength={12000} value={brief} disabled={busy} onChange={event => setBrief(event.target.value)}
          placeholder={'写下这份' + workshopKinds[category] + '的想法、规则或开场'} /></label>
        <button type="button" className="workshop-primary" disabled={busy || !brief.trim()} onClick={() => build(false)}>
          <Sparkles size={15} aria-hidden="true" /> 让 AI 写草稿
        </button>
        <button type="button" disabled={busy} onClick={() => setGenerated(true)}>自己填写草稿</button>
      </> : <>
        <label>告诉 AI 要怎么改<textarea maxLength={4000} disabled={busy} value={change} onChange={event => setChange(event.target.value)} /></label>
        <div className="workshop-row">
          <button type="button" disabled={busy || !change.trim() || !draft.title.trim()} onClick={() => build(true)}>请 AI 修改</button>
          {previous && <button type="button" disabled={busy} onClick={() => { setDraft(previous); setPrevious(undefined) }}>撤回上次 AI 修改</button>}
        </div>
      </>}
    </section>}
    {(category === 'mod' || generated) && <form className="workshop-editor" onSubmit={save}>
      <h3>{category === 'mod' ? '上传 MOD' : '编辑草稿'}</h3>
      {category === 'mod' ? <>
        <label className="workshop-upload">选择 MOD 文件
          <input type="file" accept=".json,application/json" disabled={busy} onChange={event => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (!file) return
            void action(async () => {
              if (!file.name.toLowerCase().endsWith('.json') || file.size > 64000) throw new Error('请选择 64 KB 以内的半糖 MOD JSON 文件。')
              const manifest: string = JSON.stringify(JSON.parse(await file.text()))
              setModFile({ name: file.name, manifest })
              setPreview(undefined)
            })
          }} />
          {modFile && <small>{modFile.name}</small>}
        </label>
        <p>标题、简介和功能从 MOD 文件读取。上传文件只支持半糖的 JSON 配置。</p>
        {coverPicker}
        <button type="button" disabled={!canSave || busy} onClick={() => void action(async () =>
          setPreview(await workshop<PublicWork>('/preview/dlc', 'POST', modPayload)))}>预览 MOD</button>
        {preview && <DlcPreview item={preview} />}
      </> : labels && <>
        {coverPicker}
        <label>公开标题<input required maxLength={80} disabled={busy} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
        <label>公开简介<textarea maxLength={800} disabled={busy} value={draft.summary} onChange={event => setDraft({ ...draft, summary: event.target.value })} /></label>
        {(['persona', 'world', 'greeting'] as const).map((key, index) => <label key={key}>{labels[index]}
          <textarea required={key === 'persona'} maxLength={[24000, 16000, 4000][index]} disabled={busy}
            value={draft.content[key] ?? ''} onChange={event => setDraft({ ...draft, content: { ...draft.content, [key]: event.target.value } })} />
        </label>)}
        <details><summary>游玩模型授权</summary><label>模型接口白名单<textarea disabled={busy} value={addresses} onChange={event => setAddresses(event.target.value)} placeholder="留空时使用小手机的受信任游玩服务" /></label></details>
        <p>用当前草稿在自己的小手机里试玩，无需保存或送审。使用小手机配置的模型；再次试玩会更新设定并保留对话。</p>
        <div className="workshop-row">
          {category === 'character' && <button type="button" disabled={busy || !phone || !draft.title.trim() || !draft.content.persona?.trim()} onClick={() => tryOnPhone('sms')}>短信试玩</button>}
          {(['offline', 'side'] as const).map(mode => <button key={mode} type="button" disabled={busy || !phone || !draft.title.trim() || !draft.content.persona?.trim()} onClick={() => tryOnPhone(mode)}>{mode === 'offline' ? '线下试玩' : '番外试玩'}</button>)}
        </div>
      </>}
      <button className="workshop-primary" disabled={busy || !canSave}>{record ? '保存修改' : '保存草稿'}</button>
    </form>}
  </>
}

export function WorkshopFolder({ works, busy, onEdit, mutate }: {
  works: OwnWork[]; busy: boolean; onEdit: (work: OwnWork) => void
  mutate: (path: string, method: string, body?: unknown) => Promise<void>
}) {
  return <div className="workshop-folder-list">
    {works.length === 0 && <p className="workshop-empty">这个文件夹还没有作品。</p>}
    {works.map(work => <article key={work.id} className="workshop-folder-item">
      <div className="workshop-folder-summary">
        {work.hasCover && <img src={workshopURL + '/mine/' + work.id + '/cover?v=' + work.revision} alt="" loading="lazy" />}
        <div><h3>{work.title}</h3><small>{statuses[work.status]}</small></div>
      </div>
        {work.reviewNote && <p>{work.reviewNote}</p>}
        <div className="workshop-row">
          <button disabled={busy} onClick={() => onEdit(work)}>{work.category === 'mod' ? '替换文件' : '继续编辑'}</button>
          {(work.status === 'draft' || work.status === 'rejected') && <button disabled={busy || !work.hasCover} onClick={() => {
            if (!window.confirm('提交后，审核员可阅读当前保存的作品。确认提交？')) return
            void mutate('/mine/' + work.id + '/submit', 'POST', { revision: work.revision })
          }}>送审</button>}
          <button disabled={busy} onClick={() => {
            if (!window.confirm('永久删除并下架这件作品？')) return
            void mutate('/mine/' + work.id, 'DELETE')
          }}>删除</button>
        </div>
      </article>)}
  </div>
}
