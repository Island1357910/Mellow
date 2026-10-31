import { TogetherPanel } from './TogetherPanel.tsx'
import { bindTogetherSource, hasTogetherSource, pollTogetherSource, useTogether } from '../../lib/together.ts'
import { SharedLinks } from './SharedLinks.tsx'
import { useEffect, useRef, useState } from 'react'
import { McpClient, type McpTool } from '../../lib/mcp.ts'
import { usePlayer } from '../../lib/playerStore.ts'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import { Screen } from '../ui/primitives.tsx'
interface Shortcut { name: string; tool: string; args: string; endpoint: string }
export function ConnectionsApp({ onBack }: { onBack: () => void }) {
  const phone=useMellow(s=>s.identities.find(i=>i.id===s.activeIdentityId))
  const [endpoint,setEndpoint]=useState('')
  const [token,setToken]=useState('')
  const [tools,setTools]=useState<McpTool[]>([])
  const [tool,setTool]=useState('')
  const [args,setArgs]=useState('{}')
  const [syncKind,setSyncKind]=useState<'music'|'reading'>('music')
  const [bound,setBound]=useState(false)
  const [result,setResult]=useState<unknown>(null)
  const [busy,setBusy]=useState(false)
  const [note,setNote]=useState('')
  const [shortcuts,setShortcuts]=useState<Shortcut[]>([])
  const client=useRef<McpClient|null>(null)
  const connected=useRef('')
  useEffect(()=>{if(!phone)return;let alive=true;void storage.getBag<Shortcut[]>(phone.namespace,'mcp_shortcuts').then(rows=>{if(alive)setShortcuts(rows??[])});return()=>{alive=false}},[phone])
  const act=async(task:()=>Promise<void>)=>{if(busy)return;setBusy(true);setNote('');try{await task()}catch(e){setNote(e instanceof Error?e.message:'连接失败')}finally{setBusy(false)}}
  const connect=async()=>{const next=new McpClient(endpoint,token);const list=await next.connect();client.current=next;connected.current=endpoint;setTools(list);setTool(list[0]?.name??'');setNote(`已连接，${list.length} 个工具`)}
  const call=async(name=tool,raw=args)=>{if(!client.current||connected.current!==endpoint)throw new Error('先连接当前地址');const input=JSON.parse(raw);if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('参数须为 JSON 对象');setResult(await client.current.call(name,input));setNote('工具已返回结果')}
  const importTracks=async()=>{
    if(!phone)return
    const r=result as { structuredContent?: { tracks?: unknown[] }; content?: Array<{type:string;text?:string}>; isError?: boolean }|null
    if(r?.isError)throw new Error('服务返回错误，不能导入')
    let list: unknown=r?.structuredContent?.tracks
    if(!list){const text=r?.content?.filter(c=>c.type==='text').map(c=>c.text).join('\n');if(text){const parsed=JSON.parse(text);list=Array.isArray(parsed)?parsed:parsed.tracks}}
    if(!Array.isArray(list))throw new Error('需要服务返回 tracks 数组，每首含 name、src（音频直链）、artist（可选）')
    await usePlayer.getState().load(phone.namespace)
    let count=0
    for(const item of list.slice(0,200)){const t=item as {name?:string;src?:string;artist?:string;lyrics?:string};if(typeof t.name==='string'&&typeof t.src==='string'&&/^https?:\/\//.test(t.src)){await usePlayer.getState().addTrack({name:t.name,src:t.src,artist:t.artist,lyrics:typeof t.lyrics==='string'?t.lyrics:undefined});count++}}
    setNote(`已导入 ${count} 首到首页播放器；点唱片播放`)
  }
  return <div className="sms-shell h-full"><Screen title="外部连接" subtitle="MCP 工具与网页入口" onBack={onBack}>
    {phone&&<><TogetherPanel key={phone.namespace} namespace={phone.namespace}/><SharedLinks key={"links_"+phone.namespace} namespace={phone.namespace}/></>}
    <section className="menu-card mt-3 space-y-3"><h3 className="font-semibold">连接 MCP 服务</h3><p className="text-xs leading-5">支持 2025 Streamable HTTP。填入你自己的音乐或网页服务地址；服务需允许此站点跨域并暴露 Mcp-Session-Id 响应头。令牌仅本次页面驻留内存。</p>
    <input aria-label="MCP 服务地址" className="soft-input" value={endpoint} onChange={e=>{setEndpoint(e.target.value);client.current=null;setTools([])}} placeholder="https://你的服务/mcp"/>
    <input aria-label="MCP 令牌" type="password" className="soft-input" value={token} onChange={e=>{setToken(e.target.value);client.current=null;setTools([])}} placeholder="Bearer Token（可选）"/>
    <button disabled={busy} className="chip chip-solid" onClick={()=>void act(connect)}>{busy?'处理中…':'连接并发现工具'}</button>
    {tools.length>0&&<><select aria-label="MCP 工具" className="soft-select w-full" value={tool} onChange={e=>setTool(e.target.value)}>{tools.map(t=><option key={t.name}>{t.name}</option>)}</select><p className="text-xs">{tools.find(t=>t.name===tool)?.description}</p><details className="text-xs"><summary>查看参数格式</summary><pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(tools.find(t=>t.name===tool)?.inputSchema,null,2)}</pre></details><textarea aria-label="工具参数 JSON" className="soft-input font-mono text-xs" rows={5} value={args} onChange={e=>setArgs(e.target.value)}/><div className="flex flex-wrap gap-2"><button disabled={busy} className="chip chip-solid" onClick={()=>void act(()=>call())}>执行工具</button><button className="chip" onClick={()=>void act(async()=>{if(!phone)return;JSON.parse(args);const next=[...shortcuts,{name:tool,tool,args,endpoint}];await storage.setBag(phone.namespace,'mcp_shortcuts',next);setShortcuts(next);setNote('已保存快捷操作，参数不应含密钥')})}>保存快捷操作</button></div></>}
    </section>
    {shortcuts.length>0&&<section className="menu-card mt-3"><h3>快捷操作</h3>{shortcuts.map((s,i)=><div key={i} className="mt-2 flex gap-2"><button className="chip" disabled={busy||s.endpoint!==connected.current} onClick={()=>void act(()=>call(s.tool,s.args))}>{s.name}</button><button className="chip" onClick={()=>{const next=shortcuts.filter((_,n)=>n!==i);setShortcuts(next);if(phone)void storage.setBag(phone.namespace,'mcp_shortcuts',next)}}>删除</button></div>)}<p className="mt-2 text-xs">连接对应服务后，一键调用保存的歌单或播放工具。</p></section>}
    {tools.length>0&&<section className="menu-card mt-3 space-y-2"><h3>自动读取给 char</h3><p className="text-xs leading-6">先在上方选择一个只读查询工具并填好参数，再绑定。每 30 秒查询一次，即使离开本页也可继续；页面刷新后需重新连接绑定。不要绑定播放、删除或发送等操作工具。</p><select aria-label="自动读取内容类型" className="soft-select w-full" value={syncKind} onChange={e=>setSyncKind(e.target.value as 'music'|'reading')}><option value="music">当前歌曲与歌词</option><option value="reading">小说 / 网页正文 / 字幕</option></select><button className="chip chip-solid" disabled={busy} onClick={()=>void act(async()=>{if(!phone||!client.current||connected.current!==endpoint)throw Error('请先连接当前服务');const input=JSON.parse(args);if(!input||typeof input!=='object'||Array.isArray(input))throw Error('参数须为 JSON 对象');await useTogether.getState().load(phone.namespace);bindTogetherSource({namespace:phone.namespace,client:client.current,tool,args:input,kind:syncKind});setBound(true);await useTogether.getState().patch(syncKind==='music'?{music:true}:{reading:true,book:null});await pollTogetherSource(phone.namespace,true);setNote('已绑定自动读取；请在陪伴面板选择 char 并开启主动聊天')})}>将当前工具设为自动读取源</button><p className="text-xs">{syncKind==='music'?'返回示例：{ "name": "歌名", "artist": "歌手", "lyrics": "歌词或 LRC", "position": 42 }':'返回示例：{ "title": "书名 · 第三章", "text": "正在阅读的正文" }'}</p></section>}
    {(bound||phone&&hasTogetherSource(phone.namespace))&&<button className="chip mt-3" onClick={()=>{bindTogetherSource(null);setBound(false);setNote('已停止自动读取')}}>停止 MCP 自动读取</button>}
    {result!==null&&<section className="menu-card mt-3"><h3>返回结果</h3><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(result,null,2)}</pre><button className="chip mt-3" disabled={busy} onClick={()=>void act(importTracks)}>导入返回歌单到播放器</button></section>}
    {note&&<p role="status" className="mt-3 text-xs leading-5">{note}</p>}
  </Screen></div>
}
