import { ChevronLeft, ChevronRight, NotebookPen, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { localDay } from '../../lib/earnings.ts'
import { uid } from '../../lib/id.ts'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import { Screen } from '../ui/primitives.tsx'

type Entry = { id: string; text: string; at: number }
export function DiaryApp({ onBack }: { onBack: () => void }) {
  const phone = useMellow(s=>s.identities.find(i=>i.id===s.activeIdentityId))
  const [entries,setEntries]=useState<Entry[]>([])
  const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1))
  const [today] = useState(()=>localDay(new Date()))
  const [selected,setSelected]=useState(()=>localDay(new Date()))
  const [query,setQuery]=useState('')
  const [text,setText]=useState('')
  const [editing,setEditing]=useState('')
  const [writing,setWriting]=useState(false)
  const [ready,setReady]=useState(false)
  const [saving,setSaving]=useState(false)
  const [note,setNote]=useState('')
  useEffect(()=>{let alive=true;setReady(false);setEntries([]);setWriting(false);setText('');if(phone)void storage.getBag<Entry[]>(phone.namespace,'diary').then(rows=>{if(alive){setEntries(rows??[]);setReady(true)}}).catch(e=>{if(alive)setNote(String(e))});return()=>{alive=false}},[phone?.namespace])
  const days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate()
  const offset=(month.getDay()+6)%7
  const marked=new Set(entries.map(e=>localDay(new Date(e.at))))
  const visible=entries.filter(e=>query.trim()?e.text.toLowerCase().includes(query.trim().toLowerCase()):localDay(new Date(e.at))===selected).sort((a,b)=>b.at-a.at)
  const move=(delta:number)=>setMonth(d=>new Date(d.getFullYear(),d.getMonth()+delta,1))
  const save=async()=>{
    if(!phone||!text.trim()||!ready||saving)return
    setSaving(true);setNote('')
    const [y,m,d]=selected.split('-').map(Number)
    const at=new Date(y!,m!-1,d!,12).getTime()
    const next=editing?entries.map(e=>e.id===editing?{...e,text:text.trim()}:e):[{id:uid('diary'),text:text.trim(),at},...entries]
    try{await storage.setBag(phone.namespace,'diary',next);setEntries(next);setWriting(false);setText('');setEditing('');setNote('已存入这一天，随时可以回看')}
    catch(e){setNote(e instanceof Error?e.message:'保存失败，请重试')}
    finally{setSaving(false)}
  }
  return <div className="sms-shell h-full min-h-0"><Screen title="日记" subtitle="把日子，一页页留下来" onBack={onBack}>
    <section className="menu-card journal-calendar"><div className="mb-4 flex items-center justify-between"><button className="chip" aria-label="上个月" onClick={()=>move(-1)}><ChevronLeft size={16}/></button><h2 className="text-lg font-semibold">{month.getFullYear()} 年 {month.getMonth()+1} 月</h2><button className="chip" aria-label="下个月" onClick={()=>move(1)}><ChevronRight size={16}/></button></div>
    <div className="grid grid-cols-7 gap-1 text-center text-xs">{['一','二','三','四','五','六','日'].map(day=><span key={day} className="py-2 opacity-70">{day}</span>)}{Array.from({length:offset},(_,i)=><span key={'blank'+i}/>)}{Array.from({length:days},(_,i)=>{const date=localDay(new Date(month.getFullYear(),month.getMonth(),i+1));return <button key={date} type="button" className="journal-day" aria-label={`${date}${marked.has(date)?'，有日记':''}`} aria-pressed={selected===date} data-today={date===today} onClick={()=>{setSelected(date);setQuery('');setWriting(false);setEditing('');setText('')}}><span>{i+1}</span><span aria-hidden className={marked.has(date)?'journal-dot':'journal-dot is-empty'}/></button>})}</div>
    <div className="mt-4 flex items-center justify-between text-xs"><span>{entries.length} 篇 · {marked.size} 个记录日</span><button className="chip" onClick={()=>{const date=new Date();setMonth(new Date(date.getFullYear(),date.getMonth(),1));setSelected(localDay(date));setQuery('');setWriting(false);setText('');setEditing('')}}>回到今天</button></div></section>
    <label className="my-3 flex items-center gap-2"><Search size={17}/><input className="soft-input" aria-label="搜索日记" placeholder="搜索所有日记里的文字" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">{query?`搜索结果 · ${visible.length} 篇`:selected}</h3><button className="chip chip-solid" disabled={!ready} onClick={()=>{setWriting(true);setEditing('');setText('')}}><NotebookPen size={14}/>写一页</button></div>
    {writing&&<section className="menu-card mb-3"><p className="mb-2 text-xs">{selected} · {editing?'编辑日记':'新的一页'}</p><textarea className="soft-input resize-none leading-7" rows={6} aria-label="日记正文" placeholder="这一天发生了什么？" value={text} onChange={e=>setText(e.target.value)}/><div className="mt-3 flex gap-2"><button className="chip chip-solid" disabled={saving||!text.trim()} onClick={()=>void save()}>{saving?'保存中…':'保存日记'}</button><button className="chip" onClick={()=>{setWriting(false);setText('');setEditing('')}}>取消</button></div></section>}
    {note&&<p role="status" className="mb-3 text-xs">{note}</p>}
    {!ready?<p className="text-sm">正在翻开日记…</p>:visible.length===0?<p className="menu-card text-sm">{query?'没有找到这段文字':'这一天还没有写下什么。'}</p>:<ol className="space-y-3">{visible.map(entry=><li key={entry.id} className="menu-card"><p className="text-xs" style={{color:'var(--m-text-secondary)'}}>{new Date(entry.at).toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'})}</p><p className="my-3 whitespace-pre-wrap break-words text-sm leading-7">{entry.text}</p><button className="chip" onClick={()=>{const date=new Date(entry.at);setSelected(localDay(date));setMonth(new Date(date.getFullYear(),date.getMonth(),1));setEditing(entry.id);setText(entry.text);setWriting(true)}}>编辑这一页</button></li>)}</ol>}
  </Screen></div>
}
