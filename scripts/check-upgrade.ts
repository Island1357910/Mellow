import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { effectiveTheme } from '../src/theme/seasonal.ts'
import { BUNDLED_THEMES, themeFromUnknown } from '../src/theme/themes.ts'
import { freshMatch, playCard, drawForTurn, aiChoice, topCard, canPlayFromHand, type UnoMatch } from '../src/lib/uno.ts'
import { storage } from '../src/storage/StorageService.ts'
import { addCoins, readCoins, spendCoins } from '../src/lib/wallet.ts'
import { buildStoryPrompt, needsSummary, newSave, line, DEFAULT_CONFIG, writeSummary } from '../src/engine/story.ts'
import { AIAdapter } from '../src/engine/AIAdapter.ts'
import { OFFICIAL_PRESETS } from '../src/data/officialPresets.ts'
import { McpClient } from '../src/lib/mcp.ts'

const snap = await storage.boot()
const phone = snap.identities[0]!
const base = BUNDLED_THEMES.find(t=>t.id==='theme_macaron')!
assert.equal(effectiveTheme(base,new Date(2026,9,31,23,59)).id,'theme_halloween')
assert.equal(effectiveTheme(base,new Date(2026,10,1,0,0)),base)
assert.equal(base.id,'theme_macaron')
const custom = {...base,colors:{...base.colors,primary:'#12345680'},fontData:'data:font/woff2;base64,AA',customCss:'.menu-card { border: 0 }',wallpaper:'data:image/png;base64,AA'}
assert.deepEqual(themeFromUnknown(custom)?.colors,custom.colors)
assert.equal(themeFromUnknown(custom)?.fontData,custom.fontData)
assert.equal(themeFromUnknown({...base,colors:{...base.colors,text:'oops'}}),null)

const save = newSave('regression',{lines:Array.from({length:8},()=>[line('user','提问'),line('assistant','回答')]).flat()})
assert.equal(needsSummary(save,{...DEFAULT_CONFIG,autoSummary:true,summaryEvery:8,keepRounds:100}),true)
assert.equal(needsSummary(save,{...DEFAULT_CONFIG,autoSummary:false}),false)
await storage.saveApiProfile({name:'regression',endpoint:'https://example.test/v1',model:'test',ready:true,key:'test-only'})
const originalComplete=AIAdapter.prototype.complete
AIAdapter.prototype.complete=async()=>({content:'人物约定明日在桥头见面。',model:'test'})
const summed=await writeSummary(save,'small',100)
AIAdapter.prototype.complete=originalComplete
assert.equal(summed.summaries[0]?.upTo,16)
assert.equal(needsSummary(summed,{...DEFAULT_CONFIG,autoSummary:true,summaryEvery:8}),false)
assert.equal(save.summaries.length,0)

const person=(id:string,name:string)=>({id,name,nickname:'',remark:'',description:`${name}的独特设定`,personality:'谨慎',scenario:'桥头',mesExample:'',systemPrompt:'',postHistoryInstructions:'',tags:[],extensions:{}})
const a=person('a','阿青'),b=person('b','阿墨')
const prompt=buildStoryPrompt({mode:'side',save:newSave('双人',{charId:'a',charIds:['a','b']}),config:DEFAULT_CONFIG,chars:[a,b] as never,identity:phone,preset:null})
assert.ok(prompt[0]?.content.includes('阿青的独特设定'))
assert.ok(prompt[0]?.content.includes('阿墨的独特设定'))
assert.ok(OFFICIAL_PRESETS.every(p=>p.version==='2.2.0'&&p.data.prompts.some(b=>b.content.includes('不围着玩家转'))&&p.data.prompts.some(b=>b.identifier==='scene_hold'&&b.content.includes('场景接续'))))
const bulky={...OFFICIAL_PRESETS[0]!,data:{...OFFICIAL_PRESETS[0]!.data,prompts:[{identifier:'main',name:'主提示',role:'system' as const,enabled:true,content:'铺垫'.repeat(2000)},...OFFICIAL_PRESETS[0]!.data.prompts.filter(b=>b.identifier==='living_people_v2'||b.identifier==='scene_hold')]}}
const held=buildStoryPrompt({mode:'offline',save:newSave('接续'),config:DEFAULT_CONFIG,chars:[a] as never,identity:phone,preset:bulky})
assert.ok(held[0]?.content.includes('不围着玩家转'),'叙事截断不能裁掉人物质感')
assert.ok(held[0]?.content.includes('场景接续'),'叙事截断不能裁掉场景接续')
assert.ok(!held[0]?.content.includes('铺垫'.repeat(2000)))

const ns='regression_wallet'
await storage.setBag(ns,'coins',20)
await Promise.all(Array.from({length:20},()=>addCoins(ns,1)))
assert.equal(await readCoins(ns),40)
const purchases=await Promise.allSettled([spendCoins(ns,30),spendCoins(ns,30)])
assert.equal(purchases.filter(p=>p.status==='fulfilled').length,1)
assert.equal(await readCoins(ns),10)
await assert.rejects(()=>spendCoins(ns,NaN))

// 检查随机整局的唯一牌数与回合推进，包括抽牌堆回收。
for(let trial=0;trial<25;trial++){
 let m=freshMatch(['我','青','墨','白'])
 for(let turn=0;turn<1200&&m.winner===null;turn++){
  const all=[...m.draw,...m.discard,...m.hands.flat()]
  assert.equal(all.length,108);assert.equal(new Set(all.map(c=>c.id)).size,108)
  const pick=aiChoice(m)
  m=pick?playCard(m,m.turn,pick.index,pick.color)!:drawForTurn(m)
  assert.ok(m)
 }
 assert.notEqual(m.winner,null,'有限回合内应能结束一局')
}

const card=(id:number,color:'red'|'blue'|null,rank:string)=>({id,color,rank})
const penalty: UnoMatch={draw:[],discard:[card(1,'red','1'),card(2,'red','2')],hands:[[card(3,'red','draw2'),card(4,'blue','7')],[card(5,'blue','1')]],names:['我','他'],turn:0,dir:1,wild:null,note:'',winner:null}
const penalized=playCard(penalty,0,0,null)!
assert.equal(topCard(penalized)?.id,3)
const ids=[...penalized.draw,...penalized.discard,...penalized.hands.flat()].map(c=>c.id)
assert.equal(ids.length,5);assert.equal(new Set(ids).size,5)
const wild:UnoMatch={...penalty,hands:[[card(6,null,'wild4'),card(7,'red','1')],[card(8,'blue','2')]]}
assert.equal(canPlayFromHand(wild,wild.hands[0]![0]!),false)
assert.equal(playCard(wild,0,0,'blue'),null)

const originalFetch=globalThis.fetch
const calls:Array<{method:string;headers:Headers;body:Record<string,unknown>}>=[]
globalThis.fetch=async(_url,init)=>{
 const body=JSON.parse(String(init?.body)); const headers=new Headers(init?.headers);calls.push({method:body.method,headers,body})
 if(body.method==='notifications/initialized')return new Response(null,{status:202})
 let result:unknown={}
 if(body.method==='initialize')result={protocolVersion:'2025-11-25',capabilities:{tools:{}}}
 if(body.method==='tools/list')result=body.params?.cursor?{tools:[{name:'playlist'}]}:{tools:[{name:'play'}],nextCursor:'second'}
 if(body.method==='tools/call'){
  const data='event: message\ndata: '+JSON.stringify({jsonrpc:'2.0',id:body.id,result:{content:[{type:'text',text:'played'}]}})+'\n\n'
  return new Response(data,{headers:{'Content-Type':'text/event-stream'}})
 }
 return new Response(JSON.stringify({jsonrpc:'2.0',id:body.id,result}),{headers:{'Content-Type':'application/json','Mcp-Session-Id':'test-session'}})
}
const client=new McpClient('https://example.test/mcp','ephemeral')
assert.equal((await client.connect()).length,2)
const result=await client.call('play',{id:'playlist'}) as {content:Array<{text:string}>}
assert.equal(result.content[0]?.text,'played')
assert.equal(calls[1]?.method,'notifications/initialized')
assert.equal(calls[2]?.headers.get('Mcp-Session-Id'),'test-session')
assert.equal(calls[2]?.headers.get('Authorization'),'Bearer ephemeral')
globalThis.fetch=originalFetch
console.log('upgrade regression ok: seasonal restoration, theme/font roundtrip, summary threshold, multi-cast, wallet concurrency, 25 UNO games, MCP JSON/SSE + paging')
// 现代应用名单排除古代人物，原始角色存储仍完整保留。
await storage.putCharacter('isolation_test',{...a,createdAt:1} as never)
await storage.putCharacter('isolation_test',{...b,createdAt:2,tags:['旧世']} as never)
assert.deepEqual((await storage.listModernCharacters('isolation_test')).map(c=>c.id),['a'])
assert.equal((await storage.listCharacters('isolation_test')).length,2)
console.log('modern/ancient roster isolation ok')
