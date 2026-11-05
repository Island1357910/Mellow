import { WINTER_GIFTS } from '../theme/winter.ts'
import { storage } from '../storage/StorageService.ts'
import { APPLE_THEME } from '../theme/apple.ts'
import { walletTask } from './wallet.ts'
export const HALLOWEEN_CODE_START=Date.parse('2026-10-31T00:00:00+08:00')
export const HALLOWEEN_CODE_END=Date.parse('2026-11-03T00:00:00+08:00')
export const APPLE_CODE_START=Date.parse('2026-11-01T00:00:00+08:00')
export const APPLE_CODE_END=Date.parse('2026-11-08T00:00:00+08:00')
export const WINTER_CODE_END=Date.parse('2026-11-10T00:00:00+08:00')
export interface RedeemState { claims: Record<string,{at:number;coins:number;themeId?:string}> }
export function codeReward(code:string,now:number) {
  if(code.trim()==='半糖Mellow'){
    if(now<APPLE_CODE_START)throw Error('该兑换码于 2026 年 11 月 1 日 00:00（北京时间）开放')
    if(now>=APPLE_CODE_END)throw Error('该兑换码已于 2026 年 11 月 8 日 00:00（北京时间）到期')
    return {id:'opening_apple_2026',coins:3000,themeId:APPLE_THEME.id}
  }
  if(code.trim()==='和你一起的万圣节'){
    if(now<HALLOWEEN_CODE_START)throw Error('万圣节兑换码于 2026 年 10 月 31 日 00:00（北京时间）开放')
    if(now>=HALLOWEEN_CODE_END)throw Error('万圣节兑换码已于 2026 年 11 月 3 日 00:00（北京时间）到期')
    return {id:'halloween_together_2026',coins:2000,themeId:undefined}
  }
  const winter = WINTER_GIFTS.find(gift => gift.code === code.trim())
  if (winter) {
    if (now >= WINTER_CODE_END) throw Error('冬日主题兑换码已于 2026 年 11 月 10 日 00:00（北京时间）到期')
    return { id: winter.id, coins: 2000, themeId: winter.theme.id }
  }
  throw Error('兑换码不存在，请检查大小写和文字')
}

export function openRedeemCodes(now = Date.now()): Array<{ code: string; note: string }> {
  const catalog = [
    { code: '半糖Mellow', note: '3000 枚，并获得苹果主题。2026 年 11 月 8 日截止。' },
    { code: '冬天来一杯热可可吧！', note: '2000 枚，热可可主题。2026 年 11 月 10 日截止。' },
    { code: '冰蓝色初冬', note: '2000 枚，冰蓝主题。2026 年 11 月 10 日截止。' },
    { code: '和你一起的万圣节', note: '2000 枚。2026 年 11 月 3 日截止。' },
  ]
  return catalog.filter((item) => {
    try {
      codeReward(item.code, now)
      return true
    } catch {
      return false
    }
  })
}
export async function restoreRedeemTheme(namespace:string){
  const saved=await storage.getBag<RedeemState>(namespace,'redeem_codes_v1')
  if(saved?.claims?.opening_apple_2026?.themeId===APPLE_THEME.id)await storage.saveTheme(APPLE_THEME)
  for (const gift of WINTER_GIFTS) if (saved?.claims?.[gift.id]?.themeId === gift.theme.id) await storage.saveTheme(gift.theme)
}
const ACCOUNT_NAMESPACE='mellow_account_rewards'
export async function accountRewards(): Promise<RedeemState> {
  const migrated:RedeemState={claims:{}}
  for(const identity of await storage.listIdentities()){
    const legacy=await storage.getBag<RedeemState>(identity.namespace,'redeem_codes_v1')
    Object.assign(migrated.claims,legacy?.claims??{})
  }
  const result=await storage.updateEconomy<RedeemState>(ACCOUNT_NAMESPACE,'redeem_codes_v1',(saved,coins)=>({state:{claims:{...migrated.claims,...saved?.claims}},coins}))
  return result.state
}

export async function claimAccountReward(namespace:string,id:string,now=Date.now()){
  const unlocked=await accountRewards(),reward=unlocked.claims[id]
  if(!reward)throw Error('请先兑换这个礼物')
  const result=await walletTask(namespace,()=>storage.updateEconomy<RedeemState>(namespace,'redeem_codes_v1',(saved,coins)=>{
    const state=saved??{claims:{}}
    if(state.claims[id])throw Error('当前身份已经领取过这个礼物')
    return {state:{claims:{...state.claims,[id]:{...reward,at:now}}},coins:coins+reward.coins}
  }))
  await restoreRedeemTheme(namespace)
  return result
}
export async function redeemCode(namespace:string,code:string,now=Date.now()){
  const reward=codeReward(code,now)
  await walletTask(ACCOUNT_NAMESPACE,async()=>{
    const state=await accountRewards()
    if(!state.claims[reward.id])await storage.updateEconomy<RedeemState>(ACCOUNT_NAMESPACE,'redeem_codes_v1',(latest,coins)=>({state:{claims:{...latest?.claims,[reward.id]:{at:now,coins:reward.coins,themeId:reward.themeId}}},coins}))
  })
  return claimAccountReward(namespace,reward.id,now)
}
