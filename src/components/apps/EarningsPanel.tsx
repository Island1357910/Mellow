import { BriefcaseBusiness, ChevronLeft, Coins, Ticket, WandSparkles } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { beginWork, buyLottery, claimWork, revealScratch as revealScratchReward, settleLottery as settleLotteryReward, EMPTY_WIND, WIND_JOBS, drawNumbers, jobPay, loadWind, nextDraw, scratchPrize, skillLevel, windAction, type WindState, type WindTicket } from '../../lib/earnings.ts'
import { uid } from '../../lib/id.ts'

function ScratchSurface({ ticket, onReveal }: { ticket: WindTicket; onReveal: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const last = useRef<{ x: number; y: number } | null>(null)
  const checkedAt = useRef(0)
  const complete = useRef(false)
  const [percent, setPercent] = useState(0)
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    complete.current = ticket.revealed
    setPercent(ticket.revealed ? 100 : 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, 320, 130)
    if (ticket.revealed) return
    const gradient = ctx.createLinearGradient(0, 0, 320, 130)
    gradient.addColorStop(0, '#c9c3d0'); gradient.addColorStop(.5, '#f0e8d9'); gradient.addColorStop(1, '#a49eaf')
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 320, 130)
    ctx.fillStyle = '#3c3347'; ctx.font = '600 18px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('用手指涂抹，刮开好运', 160, 71)
  }, [ticket.id, ticket.revealed])
  const scratch = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!last.current || ticket.revealed || complete.current) return
    const node = event.currentTarget, rect = node.getBoundingClientRect(), ctx = node.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    const point = { x: (event.clientX - rect.left) * 320 / rect.width, y: (event.clientY - rect.top) * 130 / rect.height }
    ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = 36; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(point.x, point.y); ctx.stroke()
    last.current = point
    if (performance.now() - checkedAt.current < 80) return
    checkedAt.current = performance.now()
    const pixels = ctx.getImageData(0, 0, 320, 130).data
    let cleared = 0, total = 0
    for (let i = 3; i < pixels.length; i += 16) { total++; if (pixels[i]! < 128) cleared++ }
    const ratio = cleared / total
    setPercent(Math.round(ratio * 100))
    if (ratio >= .5) { complete.current = true; onReveal() }
  }
  return <><div data-holiday-preserve className="relative mt-3 overflow-hidden rounded-2xl border border-[#d5b479] bg-[#fff4d9] text-[#573e2d]" style={{ aspectRatio: '320 / 130' }}>
    <div className="absolute inset-0 grid content-center justify-items-center gap-2"><span className="text-xs">本张结果</span><strong className="text-2xl">{ticket.prize ? `获得 ${ticket.prize} 枚` : '谢谢参与'}</strong></div>
    <canvas ref={canvas} width={320} height={130} aria-label="刮奖区域，按住并拖动刮开涂层" className="absolute inset-0 h-full w-full" style={{ touchAction: 'none' }} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); const r=e.currentTarget.getBoundingClientRect(); last.current={x:(e.clientX-r.left)*320/r.width,y:(e.clientY-r.top)*130/r.height}; scratch(e) }} onPointerMove={scratch} onPointerUp={() => { last.current=null }} onPointerCancel={() => { last.current=null }} />
  </div><p className="mt-2 text-xs" role="status">{ticket.revealed ? '已揭晓，奖励已自动结算' : `已刮开 ${percent}% · 刮开一半后自动揭晓`}</p>{!ticket.revealed && <button className="chip mt-2" onClick={onReveal}>辅助揭晓（键盘 / 无障碍）</button>}</>
}

export function EarningsPanel({ namespace, onBalance }: { namespace: string; onBalance: (n: number) => void }) {
  const [state, setState] = useState<WindState | null>(null)
  const [page, setPage] = useState<'work' | 'scratch' | 'lottery' | null>(null)
  const [now, setNow] = useState(Date.now)
  const [note, setNote] = useState('')
  const [minutes, setMinutes] = useState(30)
  const [pending, setPending] = useState(false)
  const busy = useRef(false)
  useEffect(() => {
    let alive=true
    setState(null)
    void loadWind(namespace).then(result => { if(alive) {setState(result.state);onBalance(result.coins)} }).catch(e => {if(alive)setNote(String(e))})
    const timer=window.setInterval(()=>setNow(Date.now()),1000)
    return ()=>{alive=false;window.clearInterval(timer)}
  }, [namespace, onBalance])
  const act = async (change: (s: WindState, coins: number) => {state: WindState; coins: number}) => {
    if (busy.current || !state) return
    busy.current=true; setPending(true); setNote('')
    try {const next=await windAction(namespace,(s,c)=>change(s ?? EMPTY_WIND,c));setState(next.state);onBalance(next.coins)}
    catch(e){setNote(e instanceof Error?e.message:'操作失败')}
    finally{busy.current=false;setPending(false)}
  }
  const settleLottery = () => act((s,coins) => settleLotteryReward(s,coins,Date.now()))
  useEffect(() => {
    if (state?.lottery && !state.lottery.revealed && now>=state.lottery.revealAt && !pending) void settleLottery()
  })
  if (!state) return <section className="menu-card mb-4 text-sm">{note || '正在打开赚钱事务所…'}</section>
  const draw=nextDraw(now), work=state.work, scratch=state.scratch, lottery=state.lottery
  const buyScratch = () => act((s,coins)=>{
    if(s.scratch&&!s.scratch.revealed)throw Error('请先刮完手中的票')
    const t:WindTicket={id:uid('scratch'),prize:scratchPrize(Math.random()),revealAt:Date.now(),revealed:false}
    return {state:{...s,scratch:t},coins:coins-2}
  })
  const revealScratch = () => act(revealScratchReward)
  return <section className="mb-4 space-y-3">
    <div className="flex items-center justify-between"><h3 className="font-semibold">乘风赚钱事务所</h3>{page&&<button className="chip" onClick={()=>{setPage(null);setNote('')}}><ChevronLeft size={14}/>返回卡片</button>}</div>
    {!page ? <div className="grid gap-2">{([
      ['work','放置工作','练属性、升等级，每级工资增加 20%',BriefcaseBusiness],
      ['scratch','幸运刮刮乐','2 枚一张 · 用手指刮开，即开即兑',WandSparkles],
      ['lottery','每日幸运彩','5 枚一期 · 每天当地时间 18:00 开奖',Ticket],
    ] as const).map(([id,title,hint,Icon])=><button key={id} className="menu-card flex items-center gap-3 text-left" onClick={()=>setPage(id)}><span className="earning-icon"><Icon size={23} strokeWidth={1.6}/></span><span className="flex-1"><strong className="block text-sm">{title}</strong><span className="mt-1 block text-xs" style={{color:'var(--m-text-secondary)'}}>{hint}</span></span><span aria-hidden>›</span></button>)}</div>:null}
    {page==='work'&&<div className="menu-card space-y-3"><p className="text-xs leading-5">放置期间持续计时，完成后领取工资和对应属性经验。工资按接班时的等级锁定。</p>
      {!work&&<label className="block text-xs">自选工作时长（1～1440 分钟）<input type="number" min={1} max={1440} step={1} className="soft-input mt-2" value={minutes} onChange={e=>setMinutes(Number(e.target.value))}/></label>}
      {work?<><strong className="block text-sm">{work.job.name}</strong><p className="text-sm">{Math.max(0,Math.ceil((work.started+work.job.minutes*60000-now)/1000))} 秒后完成 · 工资 {work.job.pay} 枚</p><button className="chip chip-solid" disabled={pending||now<work.started+work.job.minutes*60000} onClick={()=>void act((s,coins)=>claimWork(s,coins,Date.now()))}>领取工资与经验</button></>:WIND_JOBS.map(job=>{const xp=state.skills[job.skill]||0;return <div key={job.id} className="rounded-2xl border border-current/10 p-3"><div className="flex justify-between gap-2"><strong className="text-sm">{job.name}</strong><span className="text-sm">{Math.max(1,Math.round(jobPay(job,xp)*minutes/job.minutes))} 枚</span></div><p className="my-2 text-xs">{job.skill} Lv.{skillLevel(xp)} · {xp%100}/100 经验 · {minutes} 分钟</p><div className="mb-3 h-1 overflow-hidden rounded-full bg-black/10"><div className="h-full bg-[var(--m-primary)]" style={{width:`${xp%100}%`}}/></div><button className="chip" disabled={pending} onClick={()=>void act((s,coins)=>beginWork(s,coins,job,Date.now(),minutes))}>接班 · +{Math.max(1,Math.round(job.xp*minutes/job.minutes))} 经验</button></div>})}
    </div>}
    {page==='scratch'&&<div className="menu-card"><h4 className="font-semibold">幸运刮刮乐</h4><p className="mt-1 text-xs leading-5">一张 2 枚，可连续购买。刮开涂层后奖励自动到账。</p>{scratch&&<ScratchSurface ticket={scratch} onReveal={()=>void revealScratch()}/>}<button className="chip chip-solid mt-3" disabled={pending||Boolean(scratch&&!scratch.revealed)} onClick={()=>void buyScratch()}><Coins size={14}/>{scratch?.revealed?'再来一张':'购买一张'} · 2 枚</button><p className="mt-3 text-xs leading-5">奖励概率：10,000 枚 0.01% · 1,000 枚 0.09% · 100 枚 0.9% · 30 枚 9% · 10 枚 20% · 3 枚 35% · 未中 35%。</p></div>}
    {page==='lottery'&&<div className="menu-card space-y-3"><h4 className="font-semibold">每日幸运彩</h4><p className="text-xs leading-5">每天当地时间 18:00 开奖，每期限购一张。18:00 后购买参加次日开奖。离开后仍按真实时间开奖，回来自动结算。</p>{lottery&&<div className="rounded-2xl border border-current/15 p-4"><p className="text-xs">{lottery.issue||'旧票'} 期 · {new Date(lottery.revealAt).toLocaleString('zh-CN')}</p><p className="my-3 text-3xl font-semibold tracking-[.35em]">{lottery.numbers||'旧票'}</p><p className="text-sm">{lottery.revealed?`开奖号码 ${lottery.issue?drawNumbers(lottery.issue,lottery.numbers?.length??5):'—'} · ${lottery.prize?`奖励 ${lottery.prize} 枚已到账`:'本期未中奖'}`:`等待开奖 · 还有 ${Math.max(0,Math.ceil((lottery.revealAt-now)/60000))} 分钟`}</p></div>}<button className="chip chip-solid" disabled={pending||lottery?.issue===draw.issue||Boolean(lottery&&!lottery.revealed)} onClick={()=>void act((s,coins)=>buyLottery(s,coins,Date.now(),uid('lottery'),String(Math.floor(Math.random()*100000)).padStart(5,'0')))}>{lottery?.issue===draw.issue?'本期已购票':`购买 ${draw.issue} 期 · 5 枚`}</button><p className="text-xs leading-5">新票为五位数字，按位置匹配：全中 100,000 枚（0.001%）· 中四位 5,000 枚（0.045%）· 中三位 500 枚（0.81%）· 中两位 50 枚（7.29%）· 中一位 10 枚（32.805%）· 未中 59.049%。旧三位票按购票时规则结算。</p></div>}
    {note&&<p role="status" className="text-xs">{note}</p>}
    <p className="text-[11px]" style={{color:'var(--m-text-secondary)'}}>全部使用游戏虚拟货币。</p>
    {state.history.length>0&&<details className="menu-card text-xs"><summary className="cursor-pointer">收入记录</summary><ol className="mt-2 space-y-2">{state.history.map((r,i)=><li key={i}>{new Date(r.at).toLocaleString('zh-CN')} · {r.text}</li>)}</ol></details>}
  </section>
}
