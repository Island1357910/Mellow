import { CLINIC_GIFT } from '../../theme/clinic.ts'
import { WINTER_GIFTS } from '../../theme/winter.ts'
const rewardName = (id: string) => WINTER_GIFTS.find(gift => gift.id === id)?.theme.name ?? (id === 'opening_apple_2026' ? '红苹果爱恋' : id === CLINIC_GIFT.id ? CLINIC_GIFT.theme.name : '和你一起的万圣节')
import { Gift, Apple } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { accountRewards, APPLE_CODE_END, APPLE_CODE_START, claimAccountReward, CLINIC_CODE_DEADLINE, CLINIC_CODE_END, codeReward, redeemCode, restoreRedeemTheme, WINTER_CODE_END, type RedeemState } from '../../lib/redeem.ts'
import { readCoins } from '../../lib/wallet.ts'
import { storage } from '../../storage/StorageService.ts'
import { APPLE_THEME } from '../../theme/apple.ts'
import { useMellow } from '../../store/useMellow.ts'
import { ClinicGlyph } from '../os/ClinicMotifs.tsx'

function RedeemCodeBox({ code, onFill, unavailable }: { code: string; onFill: (code: string) => void; unavailable?: string }) {
  const [feedback, setFeedback] = useState('')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setFeedback('兑换码已复制')
    } catch {
      setFeedback('复制失败，可以点「填入兑换码」')
    }
  }

  return (
    <div className="my-3 rounded-2xl border border-[var(--m-primary)] bg-[var(--m-background)] p-3 text-[var(--m-text)]">
      <p className="text-xs font-bold text-[var(--m-text-secondary)]">兑换码{unavailable ? ` · ${unavailable}` : ''}</p>
      <code className="mt-1 block break-words font-sans text-lg font-bold" style={{ userSelect: 'all', WebkitUserSelect: 'all' }}>{code}</code>
      {!unavailable && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className="chip" onClick={() => void copy()}>复制兑换码</button>
          <button type="button" className="chip chip-solid" onClick={() => onFill(code)}>填入兑换码</button>
        </div>
      )}
      {feedback && <p className="mt-2 text-xs" role="status">{feedback}</p>}
    </div>
  )
}

function ClinicReward({ owned, onFill }: { owned: boolean; onFill: (code: string) => void }) {
  const { theme, description, code, coins } = CLINIC_GIFT
  const active = useMellow(state => state.settings.themeId === theme.id)
  return (
    <article className="menu-card">
      <h3 className="font-semibold">{theme.name}</h3>
      <div data-holiday-preserve className="my-3 rounded-2xl p-4" style={{ background: theme.colors.background, color: theme.colors.text }}>
        <div className="flex items-center gap-2" aria-hidden="true">
          <ClinicGlyph kind="scope" size={40} />
          <ClinicGlyph kind="syringe" size={40} />
          <ClinicGlyph kind="iv" size={40} />
          <ClinicGlyph kind="monitor" size={40} />
        </div>
        <p className="mt-2 text-xs leading-6">{description}</p>
        <div className="mt-3 flex gap-2" aria-hidden="true">
          {[theme.colors.primary, theme.colors.secondary, theme.colors.surface, theme.colors.error].map(color => (
            <span key={color} className="h-6 w-6 rounded-full border border-[var(--m-primary)]" style={{ background: color }} />
          ))}
        </div>
      </div>
      <RedeemCodeBox code={code} onFill={onFill} unavailable={Date.now() >= CLINIC_CODE_END ? '已到期' : undefined} />
      <p className="text-xs leading-6">奖励 {coins} 枚与永久主题。{CLINIC_CODE_DEADLINE} 到期。</p>
      {owned && <button type="button" className="chip chip-solid mt-3" disabled={active} onClick={() => void useMellow.getState().patchSettings({ themeId: theme.id })}>{active ? '已应用' : '应用主题'}</button>}
    </article>
  )
}

export function RedeemPanel(){
  const phone=useMellow(s=>s.identities.find(i=>i.id===s.activeIdentityId))
  const [code,setCode]=useState(''),[note,setNote]=useState(''),[coins,setCoins]=useState(0),[claims,setClaims]=useState<RedeemState>({claims:{}}),[pending,setPending]=useState(false)
  const [rewards,setRewards]=useState<RedeemState>({claims:{}})
  const busy=useRef(false)
  const codeInput = useRef<HTMLInputElement>(null)
  const now = Date.now()
  const fillCode = (value: string) => {
    if (busy.current) return
    setCode(value)
    setNote('已填入兑换码，点「兑换」确认。')
    codeInput.current?.focus()
  }
  useEffect(()=>{void accountRewards().then(setRewards)},[phone?.namespace,claims])
  useEffect(()=>{if(!phone)return;let alive=true;void restoreRedeemTheme(phone.namespace).then(()=>Promise.all([readCoins(phone.namespace),storage.getBag<RedeemState>(phone.namespace,'redeem_codes_v1'),useMellow.getState().reloadLibraries()])).then(([balance,records])=>{if(alive){setCoins(balance);setClaims(records??{claims:{}})}}).catch(e=>{if(alive)setNote(String(e))});return()=>{alive=false}},[phone?.namespace])
  const redeem=async()=>{if(!phone||busy.current||!code.trim())return;busy.current=true;setPending(true);setNote('');try{const reward=codeReward(code,Date.now());const result=await redeemCode(phone.namespace,code);setCoins(result.coins);setClaims(result.state);await useMellow.getState().reloadLibraries();setNote(`兑换成功：+${reward.coins} 枚${reward.themeId?'，已获得'+rewardName(reward.id)+'主题':''}`);setCode('')}catch(e){setNote(e instanceof Error?e.message:'兑换未完成，请重试')}finally{busy.current=false;setPending(false)}}
  return <section className="space-y-3"><div className="menu-card"><h2 className="flex items-center gap-2 font-semibold"><Gift size={19}/>兑换礼物</h2><p className="my-3 text-xs">当前身份余额 {coins} 枚 · 兑换一次全身份通用，新身份可直接领取</p><form className="flex gap-2" onSubmit={e=>{e.preventDefault();void redeem()}}><input ref={codeInput} className="soft-input min-w-0" aria-label="兑换码" placeholder="输入兑换码" value={code} onChange={e=>setCode(e.target.value)}/><button className="chip chip-solid shrink-0" disabled={pending||!code.trim()}>{pending?'兑换中…':'兑换'}</button></form>{note&&<p className="mt-3 text-sm leading-6" role="status">{note}</p>}</div>
  <article className="menu-card"><h3 className="font-semibold">账号已解锁礼物</h3>{Object.entries(rewards.claims).map(([id,r])=><button key={id} className="chip mt-3" disabled={pending||Boolean(claims.claims[id])} onClick={async()=>{if(!phone||busy.current)return;busy.current=true;setPending(true);try{const result=await claimAccountReward(phone.namespace,id);setCoins(result.coins);setClaims(result.state);await useMellow.getState().reloadLibraries();setNote('领取成功')}catch(e){setNote(String(e))}finally{busy.current=false;setPending(false)}}}>{rewardName(id)} · {r.coins} 枚 · {claims.claims[id]?'已领取':'直接领取'}</button>)}</article>
  <ClinicReward owned={Boolean(claims.claims[CLINIC_GIFT.id])} onFill={fillCode} />
  {WINTER_GIFTS.map(gift => <article key={gift.id} className="menu-card"><h3 className="font-semibold">{gift.theme.name}</h3><div data-holiday-preserve className="my-3 rounded-2xl p-4" style={{ background: gift.theme.colors.background, color: gift.theme.colors.text }}><p className="text-3xl">{gift.id === 'winter_cocoa_2026' ? '☕ 🥐 🧁' : '❄️ ⛄ ☁️'}</p><p className="mt-2 text-xs leading-6">{gift.description}</p><div className="mt-3 flex gap-2">{[gift.theme.colors.primary, gift.theme.colors.secondary, gift.theme.colors.text, gift.theme.colors.accent].map(color => <span key={color} className="h-6 w-6 rounded-full" style={{ background: color }}/>)}</div></div><RedeemCodeBox code={gift.code} onFill={fillCode} unavailable={now >= WINTER_CODE_END ? '已到期' : undefined} /><p className="text-xs leading-6">奖励 2000 枚与永久主题</p><p className="mt-1 text-xs leading-6">2026 年 11 月 10 日 00:00 前可兑换（北京时间），逾期失效；已领取的主题永久保留。</p>{claims.claims[gift.id] && <button className="chip chip-solid mt-3" onClick={() => void useMellow.getState().patchSettings({ themeId: gift.theme.id })}>应用{gift.theme.name}</button>}</article>)}
  <article className="menu-card"><h3 className="font-semibold">开群纪念 · 红苹果爱恋</h3><div data-holiday-preserve className="my-3 rounded-2xl p-4" style={{background:'#FFF4DF',color:'#482A2C'}}><Apple size={34} color="#BC384B"/><p className="mt-2 font-semibold">红苹果色 × 果肉粉黄 × 苹果叶绿</p><div className="mt-3 flex gap-2">{['#BC384B','#EFC2B4','#F5D89A','#688B45'].map(c=><span key={c} className="h-6 w-6 rounded-full" style={{background:c}}/>)}</div></div><RedeemCodeBox code="半糖Mellow" onFill={fillCode} unavailable={now >= APPLE_CODE_END ? '已到期' : now < APPLE_CODE_START ? '未开放' : undefined} /><p className="text-xs leading-6">兑换期：2026 年 11 月 1 日 00:00 至 11 月 8 日 00:00 前（北京时间）。奖励 3000 枚与纪念主题。领取后永久保留。</p>{claims.claims.opening_apple_2026&&<button className="chip chip-solid mt-3" onClick={()=>void useMellow.getState().patchSettings({themeId:APPLE_THEME.id})}>应用红苹果爱恋</button>}</article>
  <div className="menu-card text-xs"><h3 className="mb-2 font-semibold">领取记录</h3>{Object.entries(claims.claims).length?Object.entries(claims.claims).map(([id,r])=><p key={id} className="py-2">{rewardName(id)} · +{r.coins} 枚 · {new Date(r.at).toLocaleString('zh-CN')}</p>):<p>还没有领取记录</p>}</div></section>
}
