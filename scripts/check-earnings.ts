import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { storage } from '../src/storage/StorageService.ts'
import { readCoins } from '../src/lib/wallet.ts'
import { EMPTY_WIND, WIND_JOBS, beginWork, buyLottery, claimWork, drawNumbers, jobPay, loadWind, lotteryPrize, nextDraw, revealScratch, scratchPrize, settleLottery, skillLevel, windAction, type WindState } from '../src/lib/earnings.ts'

const before = new Date(2026, 9, 31, 17, 59, 59).getTime()
const atSix = new Date(2026, 9, 31, 18).getTime()
assert.equal(nextDraw(before).at, atSix)
assert.equal(nextDraw(atSix).issue, '2026-11-01')
assert.equal(nextDraw(new Date(2026,11,31,23).getTime()).issue, '2027-01-01')
assert.equal(new Date(nextDraw(new Date(2026,9,31,23).getTime()).at).getHours(),18)
assert.equal(skillLevel(99),1); assert.equal(skillLevel(100),2)
assert.equal(jobPay(WIND_JOBS[0],500),16)
assert.equal(lotteryPrize('123','123'),100)
assert.equal(lotteryPrize('123','124'),15)
assert.equal(lotteryPrize('123','145'),5)
assert.equal(lotteryPrize('123','456'),0)
assert.deepEqual([0,.00009,.0001,.00099,.001,.009,.01,.099,.1,.299,.3,.649,.65,.99].map(scratchPrize),[10000,10000,1000,1000,100,100,30,30,10,10,3,3,0,0])
const counts: Record<number,number>={0:0,5:0,15:0,100:0}
for(let n=0;n<1000;n++) counts[lotteryPrize(String(n).padStart(3,'0'),'123')]!++
assert.deepEqual(counts,{0:729,5:243,15:27,100:1})

const fiveCounts:Record<number,number>={0:0,10:0,50:0,500:0,5000:0,100000:0}
for(let n=0;n<100000;n++) fiveCounts[lotteryPrize(String(n).padStart(5,'0'),'12345')]!++
assert.deepEqual(fiveCounts,{0:59049,10:32805,50:7290,500:810,5000:45,100000:1})
assert.equal(drawNumbers('2026-10-31',3).length,3)
assert.equal(drawNumbers('2026-10-31').length,5)
const ns='regression_earnings_v1'
await storage.setBag(ns,'coins',100)
let result=await loadWind(ns)
assert.equal(result.coins,100)
const job=WIND_JOBS[0]
await windAction(ns,(s,c)=>beginWork(s!,c,job,1000))
result=await windAction(ns,(s,c)=>claimWork(s!,c,1001))
assert.equal(result.coins,100,'Cannot claim before work completes')
await Promise.all(Array.from({length:8},()=>windAction(ns,(s,c)=>claimWork(s!,c,1000+job.minutes*60000))))
assert.equal(await readCoins(ns),108,'Concurrent collection pays once')
result=await windAction(ns,(s,c)=>({state:{...s!,skills:{条理:99}},coins:c}))
await windAction(ns,(s,c)=>beginWork(s!,c,job,1000))
result=await windAction(ns,(s,c)=>claimWork(s!,c,1000+job.minutes*60000))
assert.equal(result.state.skills['条理'],124)
result=await windAction(ns,(s,c)=>beginWork(s!,c,job,Date.now()))
assert.equal(result.state.work?.job.pay,10,'Next shift uses new level')

await windAction(ns,(s,c)=>({state:{...s!,scratch:{id:'test',prize:12,revealed:false,revealAt:0}},coins:c-2}))
const balance=await readCoins(ns)
await Promise.all(Array.from({length:8},()=>windAction(ns,(s,c)=>revealScratch(s!,c))))
assert.equal(await readCoins(ns),balance+12,'Concurrent scratch payout happens once')
result=await windAction(ns,(s,c)=>buyLottery(s!,c,before,'test-lottery',drawNumbers('2026-10-31')))
await assert.rejects(()=>windAction(ns,(s,c)=>buyLottery(s!,c,before,'duplicate','000')))
const ticketBalance=await readCoins(ns)
result=await windAction(ns,(s,c)=>settleLottery(s!,c,atSix-1))
assert.equal(result.state.lottery?.revealed,false)
await Promise.all(Array.from({length:8},()=>windAction(ns,(s,c)=>settleLottery(s!,c,atSix+86400000))))
assert.equal(await readCoins(ns),ticketBalance+100000,'Offline draw and repeated settlement pay once')
result=await windAction(ns,(s,c)=>buyLottery(s!,c,atSix,'next-issue','00000'))
assert.equal(result.state.lottery?.issue,'2026-11-01')
const saved=structuredClone(result)
await assert.rejects(()=>windAction(ns,(s,_c)=>({state:{...s!,history:[]},coins:-1})))
assert.deepEqual(await storage.getBag<WindState>(ns,'wind_earnings_v1'),saved.state,'Rejected debit rolls state back')
assert.equal(await readCoins(ns),saved.coins)

const legacy='regression_earnings_legacy'
await storage.setBag(legacy,'wind_work',{job:{name:'旧工作',minutes:10,pay:8},started:0})
await storage.setBag(legacy,'wind_ticket',{kind:'刮刮乐',prize:3,revealAt:0,revealed:false})
const migrated=await loadWind(legacy)
assert.equal(migrated.state.work?.job.name,'旧工作')
assert.equal(migrated.state.scratch?.prize,3)
assert.deepEqual(EMPTY_WIND.skills,{})
console.log('earnings regression ok: local 18:00 / rollover, skill raises, draw odds, concurrency, offline payout, atomic rollback, legacy migration')
