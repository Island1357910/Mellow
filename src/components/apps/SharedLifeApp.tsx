import { HorizontalTabs } from '../ui/HorizontalTabs.tsx'
import './shared-life.css'
import { useEffect, useRef, useState } from 'react'
import { Armchair, BookHeart, CalendarDays, Camera, ChevronRight, Gift, Heart, Home, MessageCircle, Plus, Sprout, Users } from 'lucide-react'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import type { Character } from '../../types/index.ts'
import {
  characterLife, changeSharedLife, cookWithGuest, emptySharedLife, ensureSharedCharacter, readSharedLife,
  rescheduleAppointment, saveAppointment, updateAppointment, type SharedLife,
} from '../../lib/sharedLife.ts'
import { advanceLifeEvent, askAboutLifeGift, createLifeEvent, endLifeVisit, generateLifeCircle, introduceLifeContact, inviteLifeGuest, talkWithLifeGuest } from '../../lib/sharedLifeAi.ts'
import { saveManualKeepsake } from '../../lib/sharedLifeTick.ts'
import { RECIPES } from '../../lib/homeLife.ts'
import { uid } from '../../lib/id.ts'
import { Screen } from '../ui/primitives.tsx'

type LifeTab = 'calendar' | 'events' | 'visits' | 'circle' | 'gifts' | 'relationship' | 'memories'
const TABS = [
  { id: 'calendar', label: '约定', Icon: CalendarDays }, { id: 'events', label: '日常', Icon: Sprout },
  { id: 'visits', label: '来访', Icon: Home }, { id: 'circle', label: '人际', Icon: Users },
  { id: 'gifts', label: '礼物', Icon: Gift }, { id: 'relationship', label: '关系', Icon: Heart },
  { id: 'memories', label: '相册', Icon: Camera },
] as const
const when = (at: number) => new Date(at).toLocaleString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
function localInput(at: number) {
  const date = new Date(at)
  return new Date(at - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
const APPOINTMENT_LABEL = { proposed: '待你确认', planned: '已约好', completed: '已赴约', cancelled: '已取消', missed: '未赴约' }

export function SharedLifeApp({ onBack }: { onBack: () => void }) {
  const phone = useMellow(s => s.identities.find(i => i.id === s.activeIdentityId))
  return <div className="sms-shell shared-life-shell h-full min-h-0"><Screen allowHorizontalScroll title="共度" subtitle="把日常，过成我们的故事" onBack={onBack}>{phone && <SharedLifePanel key={phone.namespace} namespace={phone.namespace}/>}</Screen></div>
}

export function SharedLifePanel({ namespace, initialCharId }: { namespace: string; initialCharId?: string }) {
  const [people, setPeople] = useState<Character[]>([])
  const [charId, setCharId] = useState(initialCharId ?? '')
  const [state, setState] = useState<SharedLife>(emptySharedLife)
  const [tab, setTab] = useState<LifeTab>('calendar')
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [note, setNote] = useState('')
  const [title, setTitle] = useState(''), [place, setPlace] = useState(''), [date, setDate] = useState(() => localInput(Date.now() + 3_600_000)), [appointmentNote, setAppointmentNote] = useState(''), [editing, setEditing] = useState('')
  const [draft, setDraft] = useState(''), [advice, setAdvice] = useState<Record<string, string>>({})
  const [memoryTitle, setMemoryTitle] = useState(''), [memoryText, setMemoryText] = useState(''), [image, setImage] = useState<string>()
  const [memoryKind, setMemoryKind] = useState('全部')
  const revision = useMellow(s => s.dataRevision)
  const lock = useRef(false), mounted = useRef(true), generation = useRef(0)
  const person = people.find(p => p.id === charId)
  useEffect(() => {
    mounted.current = true
    void Promise.all([storage.listModernCharacters(namespace), readSharedLife(namespace), storage.getBag<string>(namespace, 'life_selected_char')]).then(([chars, saved, selected]) => {
      if (!mounted.current) return
      setPeople(chars.filter(c => !c.blocked)); setState(saved)
      setCharId(chars.some(c => c.id === initialCharId) ? initialCharId! : chars.some(c => c.id === selected) ? selected! : chars[0]?.id ?? '')
      setReady(true)
    }).catch(e => { if (mounted.current) setNote(e instanceof Error ? e.message : '打开失败，请重试') })
    return () => { mounted.current = false; generation.current++ }
  }, [namespace, initialCharId])
  useEffect(() => { let live = true; void readSharedLife(namespace).then(s => { if (live) setState(s) }); return () => { live = false } }, [namespace, revision])
  useEffect(() => { let live = true; if (charId) void ensureSharedCharacter(namespace, charId).then(s => { if (live) setState(s) }).catch(e => { if (live) setNote(String(e)) }); return () => { live = false } }, [namespace, charId])

  const act = async (action: () => Promise<unknown>, success = '') => {
    if (lock.current || !ready) return
    lock.current = true; setBusy(true); setNote('')
    const ticket = generation.current
    try {
      await action()
      const saved = await readSharedLife(namespace)
      if (mounted.current && ticket === generation.current) { setState(saved); setNote(success) }
      useMellow.getState().touchData()
    } catch (e) {
      if (mounted.current && ticket === generation.current) {
        setState(await readSharedLife(namespace))
        setNote(e instanceof Error ? e.message : '这次没完成，请重试')
      }
    } finally { lock.current = false; if (mounted.current) setBusy(false) }
  }
  const pickPerson = (id: string) => {
    generation.current++; setCharId(id); setDraft(''); setNote(''); setEditing(''); setAdvice({}); setMemoryTitle(''); setMemoryText(''); setImage(undefined)
    void storage.setBag(namespace, 'life_selected_char', id)
  }
  const life = characterLife(state, charId)
  const appointments = state.appointments.filter(a => a.charId === charId).sort((a, b) => a.at - b.at)
  const events = state.events.filter(e => e.charId === charId)
  const visits = state.visits.filter(v => v.charId === charId)
  const activeVisit = visits.find(v => v.status === 'active')
  const contacts = state.contacts.filter(c => c.charId === charId)
  const gifts = state.gifts.filter(g => g.charId === charId)
  const memories = state.keepsakes.filter(k => k.charId === charId && (memoryKind === '全部' || (memoryKind === '照片' ? k.kind === 'photo' : k.kind !== 'photo')))
  const canAct = Boolean(person && ready && !busy)
  const submitAppointment = async () => {
    if (!person) return
    const at = new Date(date).getTime()
    await act(async () => {
      if (editing) await rescheduleAppointment(namespace, editing, at)
      else await saveAppointment(namespace, { charId, title, place, at, note: appointmentNote })
      setEditing(''); setTitle(''); setPlace(''); setAppointmentNote('')
    }, '约定已保存，临近时会在小手机里提醒你。')
  }

  return <section className="shared-life-panel space-y-4">
    <div className="life-hero"><BookHeart size={27} strokeWidth={1.4}/><span className="life-eyebrow">LITTLE DAYS, SHARED</span><h2>今天，也和你一起。</h2><p>赴约、做客、听听近况，留下值得记住的小事。</p></div>
    <label className="life-person-picker"><span>和谁共度</span><select aria-label="共度角色" disabled={busy || !ready} value={charId} onChange={e => pickPerson(e.target.value)}><option value="">选择一个人</option>{people.map(p => <option key={p.id} value={p.id}>{p.remark || p.name}</option>)}</select></label>
    {!people.length && ready && <div className="life-empty">先在短信或创作里添加一位现代角色。</div>}
    {person && <>
      <HorizontalTabs className="life-tabs" label="共同生活分类">{TABS.map(({ id, label, Icon }) => <button key={id} aria-pressed={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => { setTab(id); setNote('') }}><Icon size={16}/>{label}</button>)}</HorizontalTabs>
      {busy && <p role="status" className="life-feedback">{person.name} 正在回应…</p>}
      {note && <p role="status" className="life-feedback">{note}</p>}

      {tab === 'calendar' && <>
        <details className="life-card" open={editing ? true : undefined}><summary className="life-section-title"><Plus size={16}/>{editing ? '重新约一个时间' : '记下一次约定'}</summary><form className="mt-4 space-y-3" onSubmit={e => { e.preventDefault(); void submitAppointment() }}>
          {!editing && <><input aria-label="约定内容" className="soft-input" maxLength={80} placeholder="比如周六一起吃晚饭" value={title} onChange={e => setTitle(e.target.value)}/><input aria-label="约定地点" className="soft-input" maxLength={80} placeholder="在哪里见面" value={place} onChange={e => setPlace(e.target.value)}/></>}
          <label className="block text-xs">现实时间<input aria-label="约定时间" type="datetime-local" className="soft-input mt-2" value={date} onChange={e => setDate(e.target.value)}/></label>
          {!editing && <textarea aria-label="约定备注" className="soft-input" rows={2} placeholder="备注、想做的事（可选）" value={appointmentNote} onChange={e => setAppointmentNote(e.target.value)}/>}
          <div className="flex gap-2"><button className="chip chip-solid" disabled={!canAct || (!editing && (!title.trim() || !place.trim()))}>保存约定</button>{editing && <button type="button" className="chip" onClick={() => setEditing('')}>取消改期</button>}</div>
        </form></details>
        <p className="life-caption">聊天里谈到具体日期的约定会放在这里等你确认。提醒需保持小手机页面打开；回来时也会检查错过的约定。</p>
        {!appointments.length && <div className="life-empty"><CalendarDays size={26}/><p>下一次见面，想约在什么时候？</p></div>}
        {appointments.map(a => <article key={a.id} className="life-card"><div className="life-card-top"><span className="life-tag">{APPOINTMENT_LABEL[a.status]}</span><time>{when(a.at)}</time></div><h3>{a.title}</h3><p>{a.place}</p>{a.note && <blockquote>{a.note}</blockquote>}<div className="life-actions">
          {a.status === 'proposed' && <button className="chip chip-solid" disabled={!canAct} onClick={() => void act(() => updateAppointment(namespace, a.id, 'planned'))}>确认这次约定</button>}
          {['planned', 'proposed'].includes(a.status) && <><button className="chip" disabled={!canAct} onClick={() => { setEditing(a.id); setDate(localInput(a.at > Date.now() ? a.at : Date.now() + 3_600_000)) }}>改约</button><button className="chip" disabled={!canAct} onClick={() => void act(() => updateAppointment(namespace, a.id, 'cancelled'))}>取消</button></>}
          {a.status === 'planned' && a.at <= Date.now() && <><button className="chip chip-solid" disabled={!canAct} onClick={() => void act(() => updateAppointment(namespace, a.id, 'completed'), '这次赴约已放进共同相册。')}>我们赴约了</button><button className="chip" disabled={!canAct} onClick={() => void act(() => updateAppointment(namespace, a.id, 'missed'))}>这次没能赴约</button></>}
        </div></article>)}
      </>}

      {tab === 'events' && <>
        <label className="life-card flex items-center justify-between gap-3 text-sm"><span>让 TA 的日常继续发生<small className="mt-1 block text-[11px] opacity-60">开启后按现实时间发展；主动短信沿用聊天通知设置。</small></span><input type="checkbox" checked={life.autoEvents} disabled={!canAct} onChange={e => { const enabled = e.target.checked; void act(() => changeSharedLife(namespace, s => ({ ...s, characters: { ...s.characters, [charId]: { ...characterLife(s, charId), autoEvents: enabled } } }))) }}/></label>
        <button className="life-feature-button" disabled={!canAct || events.some(e => e.status === 'active')} onClick={() => void act(() => createLifeEvent(namespace, person))}><Sprout size={19}/><span>听听 TA 最近的事<small>从人设和你们聊过的话里，长出一件小事。</small></span><ChevronRight size={16}/></button>
        {!events.length && <div className="life-empty">这里会保存事情的起因、你的建议，以及几天后的进展。</div>}
        {events.map(event => <article className="life-card" key={event.id}><div className="life-card-top"><span className="life-tag">{event.status === 'resolved' ? '告一段落' : `进行中 · 第 ${event.stage} 段`}</span></div><h3>{event.title}</h3><ol className="life-timeline">{event.updates.map((u, i) => <li key={i}><time>{when(u.at)}</time><p>{u.text}</p></li>)}</ol>{event.advice.length > 0 && <details className="mt-3 text-xs"><summary>你给过的建议</summary>{event.advice.map((a, i) => <p key={i} className="mt-2">{a}</p>)}</details>}{event.status === 'active' && <form className="mt-4 space-y-2" onSubmit={e => { e.preventDefault(); void act(async () => { await advanceLifeEvent(namespace, person, event.id, advice[event.id] ?? ''); setAdvice(s => ({ ...s, [event.id]: '' })) }) }}><textarea aria-label={`给${event.title}的建议`} className="soft-input" rows={2} placeholder="给个建议，或直接问问后续" value={advice[event.id] ?? ''} onChange={e => setAdvice(s => ({ ...s, [event.id]: e.target.value }))}/><button className="chip" disabled={!canAct}>聊聊这件事</button></form>}</article>)}
      </>}

      {tab === 'visits' && <>
        {!activeVisit && <article className="life-card"><div className="life-section-title"><Armchair size={19}/><h3>家里给你留个位置</h3></div><p>TA 会按性格、关系和意愿决定是否来，留宿也可以拒绝。</p><div className="life-invitations">{['一起做饭', '一起看电影', '来坐坐聊天', '今晚留宿'].map(activity => <button key={activity} disabled={!canAct || state.visits.some(v => v.status === 'active')} onClick={() => void act(() => inviteLifeGuest(namespace, person, activity))}>{activity}</button>)}</div>{state.visits.some(v => v.status === 'active') && <p className="life-caption">家里已有正在进行的来访，请先结束那次相聚。</p>}</article>}
        {activeVisit && <article className="life-card"><div className="life-card-top"><span className="life-tag">正在做客 · {activeVisit.activity}</span><button className="text-xs" disabled={!canAct} onClick={() => void act(() => endLifeVisit(namespace, activeVisit.id))}>结束这次相聚</button></div><h3>{activeVisit.house}</h3><div className="life-visit-lines" aria-live="polite">{activeVisit.lines.map((l, i) => <div key={i} className={`life-line is-${l.who}`}><small>{l.who === 'player' ? '你' : l.who === 'character' ? person.name : '共同经历'}</small><p>{l.text}</p></div>)}</div><form className="mt-3 flex gap-2" onSubmit={e => { e.preventDefault(); const text = draft.trim(); if (text) void act(async () => { await talkWithLifeGuest(namespace, person, activeVisit.id, text); setDraft('') }) }}><input aria-label="家中对白或行动" className="soft-input min-w-0" placeholder="对 TA 说话，或写一个动作…" value={draft} onChange={e => setDraft(e.target.value)}/><button className="chip shrink-0" disabled={!canAct || !draft.trim()}>说话</button></form><details className="mt-4"><summary className="text-xs">一起下厨 · 使用冰箱食材</summary><div className="mt-3 flex flex-wrap gap-2">{RECIPES.map(recipe => <button className="chip" key={recipe.id} disabled={!canAct} onClick={() => void act(async () => { await cookWithGuest(namespace, activeVisit.id, recipe.id, uid('shared_meal')); await talkWithLifeGuest(namespace, person, activeVisit.id, `刚才我们实际做了${recipe.name}，尝尝看吧。`) })}>{recipe.name}</button>)}</div></details></article>}
        {visits.filter(v => v.id !== activeVisit?.id).slice(0, 8).map(v => <article className="life-card" key={v.id}><div className="life-card-top"><span className="life-tag">{v.status === 'declined' ? '这次没来' : '相聚记录'}</span><time>{when(v.startedAt)}</time></div><h3>{v.activity} · {v.house}</h3><p>{v.lines.filter(l => l.who === 'character').at(-1)?.text}</p></article>)}
      </>}

      {tab === 'circle' && <>
        <p className="life-caption">这些人属于 {person.name} 的生活，会延续到日常事件和回针短信里。</p><button className="chip" disabled={!canAct || contacts.length >= 12} onClick={() => void act(() => generateLifeCircle(namespace, person))}><Users size={15}/>{contacts.length ? '再认识几位生活里的人' : '认识 TA 的朋友圈子'}</button>
        {!contacts.length && <div className="life-empty">还没有认识 TA 生活中的其他人。点上方后，才会依据人物设定生成。</div>}
        {contacts.map(contact => <article className="life-card" key={contact.id}><div className="life-card-top"><span className="life-tag">{contact.relation}</span><span className="text-xs opacity-60">{contact.introduced ? 'TA 已经介绍过' : '还未介绍'}</span></div><h3>{contact.name}</h3><p>{contact.introduced ? contact.description : '想知道你们是怎么认识的吗？'}</p>{contact.introduction && <blockquote>{contact.introduction}</blockquote>}<button className="chip mt-3" disabled={!canAct} onClick={() => void act(() => introduceLifeContact(namespace, person, contact.id))}><MessageCircle size={14}/>{contact.introduced ? '再聊聊这个人' : '请 TA 介绍一下'}</button></article>)}
      </>}

      {tab === 'gifts' && <>
        <p className="life-caption">送达的购物礼物和聊天礼物会留在这里。角色会选择使用、收藏，也会按你的喜好慢慢准备回礼。</p>{!gifts.length && <div className="life-empty"><Gift size={26}/><p>从多淘、闪送或短信送出第一份礼物吧。</p></div>}
        {gifts.map(g => <article className="life-card" key={g.id}><div className="life-card-top"><span className="life-tag">{g.from === 'character' ? 'TA 送给你' : '你送给 TA'} · {g.status === 'using' ? '用进日常里' : g.status === 'kept' ? '好好收着' : '已收到'}</span><time>{when(g.at)}</time></div><h3>{g.name}</h3>{g.uses.map((u, i) => <p className="life-gift-use" key={i}><small>{when(u.at)}</small>{u.text}</p>)}{g.from === 'player' && <button className="chip mt-3" disabled={!canAct} onClick={() => void act(() => askAboutLifeGift(namespace, person, g.id))}>问问 TA 用得怎么样</button>}</article>)}
      </>}

      {tab === 'relationship' && <article className="life-card"><h3>你们之间，正在慢慢变化</h3><p>{life.relationship.mood}</p><div className="life-relationship">{([['familiarity', '熟悉', '了解彼此的习惯与日常'], ['trust', '信任', '愿意坦诚，也相信对方的承诺'], ['attraction', '心动', '可能萌生的特别在意'], ['reliance', '依赖', '遇到事情时会不会想起你']] as const).map(([key, label, description]) => <div key={key}><div className="flex justify-between text-sm"><strong>{label}</strong><span className="text-xs opacity-60">{life.relationship[key] < 25 ? '慢慢了解' : life.relationship[key] < 50 ? '有所靠近' : life.relationship[key] < 75 ? '越来越深' : '很重要的人'}</span></div><div className="life-relationship-track"><span style={{ width: `${life.relationship[key]}%` }}/></div><small>{description}</small></div>)}</div><p className="life-caption mt-5">关系依据实际聊天缓慢变化。它们各自独立：喜欢也可以拒绝，亲密也需要尊重边界。</p></article>}

      {tab === 'memories' && <>
        <details className="life-card"><summary className="life-section-title"><Camera size={17}/>留下一张照片或一件小事</summary><form className="mt-4 space-y-3" onSubmit={e => { e.preventDefault(); void act(async () => { await saveManualKeepsake(namespace, charId, memoryTitle, memoryText, image); setMemoryTitle(''); setMemoryText(''); setImage(undefined) }) }}><input aria-label="纪念标题" className="soft-input" placeholder="给这一刻起个名字" value={memoryTitle} onChange={e => setMemoryTitle(e.target.value)}/><textarea aria-label="纪念内容" className="soft-input" rows={3} placeholder="发生了什么，想记住什么…" value={memoryText} onChange={e => setMemoryText(e.target.value)}/><label className="block text-xs">上传照片（可选，4MB以内）<input className="mt-2 block w-full text-xs" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 4 * 1024 * 1024) { setNote('照片请控制在4MB内'); return } const ticket = generation.current, reader = new FileReader(); reader.onload = () => { if (mounted.current && ticket === generation.current) setImage(String(reader.result)) }; reader.readAsDataURL(file) }}/></label>{image && <img className="max-h-48 rounded-xl object-contain" alt="待保存的纪念照片" src={image}/>}<button className="chip chip-solid" disabled={!canAct || !memoryTitle.trim() || (!memoryText.trim() && !image)}>放入共同相册</button></form></details>
        <div className="flex gap-2">{['全部', '照片', '纪念物'].map(kind => <button className={memoryKind === kind ? 'chip chip-solid' : 'chip'} key={kind} onClick={() => setMemoryKind(kind)}>{kind}</button>)}</div>
        {!memories.length && <div className="life-empty">赴约、一起做的饭、礼物和桌游战绩都会慢慢留下来。照片由你亲自添加。</div>}
        <div className="life-memory-grid">{memories.map(memory => <article className="life-memory" key={memory.id}>{memory.image ? <img src={memory.image} alt={memory.title} loading="lazy"/> : <div className="life-memory-art">{memory.kind === 'gift' ? <Gift size={28}/> : memory.kind === 'appointment' ? <CalendarDays size={28}/> : memory.kind === 'meal' ? <Home size={28}/> : <BookHeart size={28}/>}</div>}<div><time>{when(memory.at)}</time><h3>{memory.title}</h3><p>{memory.text}</p></div></article>)}</div>
      </>}
    </>}
  </section>
}
