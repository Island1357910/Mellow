import { sharedLifeNote } from '../../lib/sharedLife.ts'
import { ArrowLeft, History, MapPin, Send, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { moduleAi, readJson } from '../../lib/ask.ts'
import { storage, defaultCharState } from '../../storage/StorageService.ts'
import type { Character } from '../../types/index.ts'

const { askLine } = moduleAi('map')

type Line = { speaker: string; text: string; at: number }
export function MapEncounter({ namespace, place, people, player, onExit }: { namespace: string; place: {id:string;name:string;kind:string;note:string}; people: Character[]; player:string; onExit:()=>void }) {
  const [lines,setLines]=useState<Line[]>([])
  const [choices,setChoices]=useState(['看看周围','在这里坐一会儿','往前走走'])
  const [draft,setDraft]=useState('')
  const [busy,setBusy]=useState(false)
  const [ready,setReady]=useState(false)
  const [note,setNote]=useState('')
  const [history,setHistory]=useState(false)
  const [personId,setPersonId]=useState(people[0]?.id||'')
  const [now,setNow]=useState(()=>new Date())
  const alive=useRef(true)
  const lock=useRef(false)
  const person=people.find(p=>p.id===personId)
  const key='map_dialogue_'+place.id
  const arrivalText = `你来到${place.name}。${place.note}。${people.length?people.map(p=>p.remark||p.name).join('、')+'在这里。':'这里有一小段属于自己的时间。'}`
  useEffect(()=>{alive.current=true;void storage.getBag<Line[]>(namespace,key).then(saved=>{if(alive.current){setLines([...(saved??[]),{speaker:'旁白',text:arrivalText,at:Date.now()}].slice(-60));setReady(true)}}).catch(e=>{if(alive.current)setNote(String(e))});const timer=window.setInterval(()=>setNow(new Date()),30000);return()=>{alive.current=false;window.clearInterval(timer)}},[namespace,key,arrivalText])
  const send=async(action:string)=>{
    if(!action.trim()||lock.current||!ready)return
    lock.current=true;setBusy(true);setNote('');setDraft('')
    const next=[...lines,{speaker:player,text:action.trim(),at:Date.now()}].slice(-60)
    setLines(next)
    try{
      await storage.setBag(namespace,key,next)
      const chat=person?(await storage.listChats(namespace)).find(c=>c.kind==='dm'&&c.memberIds.includes(person.id)):undefined
      const recent=chat?(await storage.listMessages(namespace,chat.id)).filter(m=>!m.hidden&&m.kind!=='system').slice(-12).map(m=>({speaker:m.role==='user'?player:person!.name,text:m.content})):[]
      const shared=person?await sharedLifeNote(namespace,person.id):''
      const raw=await askLine(`${shared}\n你在主持一个现代城市的视觉小说场景。写自然、有具体动作的短对白或旁白，不替玩家发言、不替玩家作决定。角色只能知道自己在场见闻。recentSms 是你和玩家已有短信，保持关系与约定连续，不要当成现场刚说的话。当前交谈对象：${person?person.name+'；性格：'+person.personality+'；设定：'+person.description:'无，写环境与路人可见行为'}。仅返回 JSON：{"speaker":"人物名或旁白","text":"80至180字，推进眼前的小事","choices":["下一步可选行动1","下一步可选行动2","下一步可选行动3"]}。`,JSON.stringify({realTime:new Date().toLocaleString('zh-CN'),place:place.name,kind:place.kind,note:place.note,recentSms:recent,history:next.slice(-14)}),500)
      const parsed=readJson(raw) as {speaker?:unknown;text?:unknown;choices?:unknown}
      if(typeof parsed.text!=='string'||!parsed.text.trim())throw Error('这段对话没有生成完整，请再试一次')
      const response={speaker:typeof parsed.speaker==='string'?parsed.speaker:'旁白',text:parsed.text.slice(0,1200),at:Date.now()}
      const result=[...next,response].slice(-60)
      await storage.setBag(namespace,key,result)
      if(person){
        const memoryKey='map_memory_'+person.id
        const previous=await storage.getBag<{lines:Line[]}>(namespace,memoryKey)
        await storage.setBag(namespace,memoryKey,{place:place.name,at:Date.now(),lines:[...(previous?.lines??[]),next[next.length-1]!,response].slice(-24)})
        const internal=await storage.getCharState(namespace,person.id)??defaultCharState(person.id)
        await storage.saveCharState(namespace,{...internal,location:place.name,updatedAt:Date.now()})
      }
      if(alive.current){setLines(result);if(Array.isArray(parsed.choices))setChoices(parsed.choices.filter((c):c is string=>typeof c==='string'&&Boolean(c.trim())).slice(0,3))}
    }catch(e){if(alive.current){setNote(e instanceof Error?e.message:'场景暂时没能继续');setDraft(action)}}
    finally{lock.current=false;if(alive.current)setBusy(false)}
  }
  const current=lines[lines.length-1]
  const night=now.getHours()<6||now.getHours()>=18
  return <div className={`map-encounter ${night?'is-night':''}`} data-no-swipe>
    <div className="encounter-painted-background" aria-hidden="true" style={{ backgroundImage: 'url(' + import.meta.env.BASE_URL + 'scenes/city-atlas-v1.png)', backgroundPosition: (({家:0,店:1,公司:2,公园:3,学校:3,街:4,车站:4,医院:2,海边:5} as Record<string,number>)[place.kind] ?? 4) % 3 * 50 + '% ' + Math.floor((({家:0,店:1,公司:2,公园:3,学校:3,街:4,车站:4,医院:2,海边:5} as Record<string,number>)[place.kind] ?? 4) / 3) * 100 + '%' }} />
    <header className="encounter-toolbar"><button className="encounter-button" onClick={onExit}><ArrowLeft size={16}/>返回地图</button><span><MapPin size={13}/>{place.name}</span><button className="encounter-button" aria-pressed={history} onClick={()=>setHistory(!history)}><History size={16}/>回看</button></header>
    <p className="encounter-time">{now.toLocaleString('zh-CN',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})}</p>
    {people.length>0&&<div className="encounter-people">{people.map(p=><button key={p.id} className="encounter-button" aria-pressed={personId===p.id} onClick={()=>setPersonId(p.id)}>{p.remark||p.name}</button>)}</div>}
    {person&&<div className="encounter-character">{person.avatar?.startsWith('data:')||person.avatar?.startsWith('http')?<img src={person.avatar} alt={person.name}/>:<div className="encounter-silhouette"><UserRound size={130} strokeWidth={.8}/></div>}<span>{person.remark||person.name}</span></div>}
    {history?<section className="encounter-history"><h2>在{place.name}的记录</h2>{lines.map((line,i)=><p key={i}><strong>{line.speaker}</strong><span>{line.text}</span></p>)}<button className="encounter-button" onClick={()=>setHistory(false)}>继续眼前的对话</button></section>:<section className="encounter-dialogue"><p className="encounter-speaker">{busy?'正在回应…':current?.speaker||'旁白'}</p><p className="encounter-text" aria-live="polite">{current?.text||'正在走入这个地方…'}</p><div className="encounter-choices">{choices.map(c=><button key={c} disabled={busy||!ready} onClick={()=>void send(c)}>{c}</button>)}</div><form className="encounter-input" onSubmit={e=>{e.preventDefault();void send(draft)}}><input aria-label="场景行动或对白" placeholder={person?`对${person.name}说，或写下行动…`:'写下想做的事…'} value={draft} onChange={e=>setDraft(e.target.value)}/><button aria-label="发送场景行动" disabled={busy||!ready||!draft.trim()}><Send size={18}/></button></form>{note&&<p className="encounter-note" role="status">{note}</p>}</section>}
  </div>
}
