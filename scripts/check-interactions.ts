import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { storage, defaultCharState } from '../src/storage/StorageService.ts'
import { EMPTY_HOME, homeAction, buyHomeItem, cookMeal, furnishHome, type HomeState } from '../src/lib/homeLife.ts'
import { beginWork, EMPTY_WIND, WIND_JOBS, claimWork } from '../src/lib/earnings.ts'
import { redeemCode, claimAccountReward, APPLE_CODE_START, APPLE_CODE_END, accountRewards } from '../src/lib/redeem.ts'
import { readCoins } from '../src/lib/wallet.ts'
import { addLine, checkout, readCart, readDeliveries, merchantOf, FLASH, type Delivery } from '../src/lib/delivery.ts'
import { emptyGrid,winner } from '../src/lib/gomoku.ts'
import { accountAction } from '../src/lib/neteaseProtocol.ts'
import { mapMemoryNote } from '../src/lib/mapMemory.ts'
import { searchSocial } from '../src/lib/socialSearch.ts'
import { loadPeek, refreshPeek } from '../src/lib/peek.ts'
import { AIAdapter } from '../src/engine/AIAdapter.ts'
import { useMellow } from '../src/store/useMellow.ts'
import type { Character } from '../src/types/index.ts'
const ns='interaction_test'
await storage.setBag(ns,'coins',10000)
for(let i=0;i<2;i++){await homeAction(ns,(s,c)=>buyHomeItem(s,c,'tomato'));await homeAction(ns,(s,c)=>buyHomeItem(s,c,'egg'))}
let home=await homeAction(ns,(s,c)=>cookMeal(s,c,'eggs'))
assert.equal(home.state.meals[0]?.name,'番茄炒蛋');assert.equal(home.state.stock.egg,0)
const before=await readCoins(ns)
await assert.rejects(()=>homeAction(ns,(s,c)=>cookMeal(s,c,'eggs')),/食材不足/)
assert.equal(await readCoins(ns),before)
await homeAction(ns,(s,c)=>buyHomeItem(s,c,'studio'))
const purchases=await Promise.allSettled(Array.from({length:6},()=>homeAction(ns,(s,c)=>buyHomeItem(s,c,'sofa'))))
assert.equal(purchases.filter(r=>r.status==='fulfilled').length,1)
home=await homeAction(ns,(s,c)=>furnishHome(s,c,'sofa'));assert.equal(home.state.rooms.studio?.['客厅'],'sofa')
await assert.rejects(()=>homeAction(ns,(s,c)=>buyHomeItem(s,c,'riverside')),/余额不足/)
assert.equal((await storage.getBag<HomeState>(ns,'home_life_v1'))?.houses.length,1)
assert.deepEqual(EMPTY_HOME.stock,{})
const work=beginWork(EMPTY_WIND,10,WIND_JOBS[0],0,60)
assert.equal(work.state.work?.job.minutes,60);assert.equal(work.state.work?.job.pay,48)
assert.equal(claimWork(work.state,10,3600000-1).coins,10)
assert.equal(claimWork(work.state,10,3600000).coins,58)
for(const duration of [0,-1,1.5,1441,NaN])assert.throws(()=>beginWork(EMPTY_WIND,0,WIND_JOBS[0],0,duration))
await redeemCode('reward_a','半糖Mellow',APPLE_CODE_START)
assert.ok((await accountRewards()).claims.opening_apple_2026)
const claims=await Promise.allSettled(Array.from({length:8},()=>claimAccountReward('reward_b','opening_apple_2026',APPLE_CODE_END+86400000)))
assert.equal(claims.filter(r=>r.status==='fulfilled').length,1)
assert.equal(await readCoins('reward_b'),3020,'new identity claims without reentering code even after redemption closes')
await storage.saveSettings(useMellow.getState().settings)
const backups=await storage.exportBundle() as {worlds:Array<{namespace:string}>}
assert.ok(backups.worlds.some(w=>w.namespace==='mellow_account_rewards'))
await Promise.all(Array.from({length:4},()=>addLine(ns,'flash','tea')))
await addLine(ns,'flash','rice')
assert.equal((await readCart(ns,'flash')).find(l=>l.id==='tea')?.qty,4)
const orderInput={namespace:ns,shop:'flash' as const,merchant:'云朵茶饮',items:[{name:'热茶',qty:4,price:8}],purchasedIds:['tea'],recipient:'self',recipientName:'我',told:false,note:''}
const order=await checkout(orderInput)
assert.ok(order.arrivesAt-order.createdAt>=20*60000&&order.arrivesAt-order.createdAt<=40*60000)
assert.deepEqual(await readCart(ns,'flash'),[{id:'rice',qty:1}])
const after=await readCoins(ns)
await assert.rejects(()=>checkout(orderInput),/购物车已经变化/)
assert.equal(await readCoins(ns),after)
assert.equal((await readDeliveries(ns)).length,1)
await assert.rejects(()=>checkout({...orderInput,purchasedIds:['rice'],items:[{name:'bad',qty:1,price:1000000}]}),/余额不足/)
assert.deepEqual(await readCart(ns,'flash'),[{id:'rice',qty:1}])
assert.equal((await storage.getBag<Delivery[]>(ns,'deliveries'))?.length,1)
assert.notEqual(merchantOf(FLASH[0]!, 'flash'),merchantOf(FLASH[2]!, 'flash'))
const board=emptyGrid();assert.equal(board.length,15);assert.equal(board.flat().length,225)
for(let i=10;i<15;i++)board[14]![i]=1
assert.equal(winner(board),1,'outermost cells participate in victory detection')
let searchCall:Record<string,unknown>|undefined
const request=async(path:string,data:Record<string,unknown>)=>{
 if(path.includes('account/get'))return {data:{code:200,profile:{userId:12,nickname:'测试'}},cookie:''}
 assert.equal(path,'/api/cloudsearch/pc');searchCall=data
 return {data:{code:200,result:{songCount:1,songs:[{id:123,name:'晴天',ar:[{name:'歌手'}]}]}},cookie:''}
}
const result=await accountAction('search',{keywords:' 晴天 ',offset:30},'MUSIC_U=test',request)
assert.equal(searchCall?.s,'晴天');assert.equal(searchCall?.offset,30);assert.equal(result.songs[0].id,'123');assert.equal(result.songs[0].artist,'歌手')
await assert.rejects(()=>accountAction('search',{keywords:''},'MUSIC_U=test',request),/请输入/)
await storage.setBag(ns,'map_memory_char',{place:'公园',at:Date.now(),lines:[{speaker:'角色',text:'下次在这棵树下见',at:Date.now()}]})
assert.match(await mapMemoryNote(ns,'char'),/下次在这棵树下见/)
assert.equal(await mapMemoryNote('unrelated_identity','char'),'')
assert.equal(await mapMemoryNote(ns,'not_present'),'')
const person={id:'char',name:'测试角色',personality:'寡言、爱读书',description:'独自居住的作家'} as Character
assert.deepEqual(await loadPeek(ns,person),[],'opening data cannot seed template conversations')
let response='';const prompts:string[]=[]
const original=AIAdapter.fromStored
AIAdapter.fromStored=async()=>({complete:async(input:{messages:Array<{content:string}>})=>{prompts.push(input.messages[0]!.content);return {content:response}}}) as unknown as AIAdapter
try{
 response=JSON.stringify([{author:'书架上的猫',title:'雨天读书',text:'下雨的时候适合读哪些短篇？'}])
 const star=await searchSocial('star','读书');assert.equal(star.length,1);assert.equal(star[0]?.text,'下雨的时候适合读哪些短篇？')
 const forum=await searchSocial('forum','读书');assert.equal(forum[0]?.title,'雨天读书')
 assert.ok(prompts.every(p=>p.includes('现实时间：')))
 response=JSON.stringify([{title:'责任编辑',lines:[{author:'责任编辑',text:'这版我读完了。'},{author:person.name,text:'明天聊结尾。'}]}])
 const threads=await refreshPeek(ns,person);assert.equal(threads[0]?.title,'责任编辑')
 response='[]';await assert.rejects(()=>refreshPeek(ns,person));assert.equal((await loadPeek(ns,person))[0]?.title,'责任编辑','failure preserves existing generated data and does not fabricate defaults')
}finally{AIAdapter.fromStored=original}
useMellow.setState({activeApp:'duotao',viewingChatId:'test_chat',locked:false,settings:{...useMellow.getState().settings,banner:true,dnd:false,quietHours:false},notices:[]})
await useMellow.getState().pushNotice({kind:'message',title:'角色',body:'你好',chatId:'test_chat',appId:'messages',priority:4})
assert.equal(useMellow.getState().notices.length,1,'a stale viewed-chat id must not hide banners over another app')
assert.equal(defaultCharState('char').bond.intimacy,.2)
console.log('interaction regressions ok: custom work, cross-identity redemption, atomic merchant orders, home inventory/cooking/furnishing, 225 board cells, search protocol and generated topics, phone lazy generation, map privacy, global banners')
process.exit(0)
