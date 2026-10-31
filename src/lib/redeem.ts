import { storage } from '../storage/StorageService.ts'
import { APPLE_THEME } from '../theme/apple.ts'
import { walletTask } from './wallet.ts'
export const HALLOWEEN_CODE_START=Date.parse('2026-10-31T00:00:00+08:00')
export const HALLOWEEN_CODE_END=Date.parse('2026-11-03T00:00:00+08:00')
export const APPLE_CODE_START=Date.parse('2026-11-01T00:00:00+08:00')
export const APPLE_CODE_END=Date.parse('2026-11-08T00:00:00+08:00')
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
  throw Error('兑换码不存在，请检查大小写和文字')
}
export async function restoreRedeemTheme(namespace:string){
  const saved=await storage.getBag<RedeemState>(namespace,'redeem_codes_v1')
  if(saved?.claims?.opening_apple_2026?.themeId===APPLE_THEME.id)await storage.saveTheme(APPLE_THEME)
}
export async function redeemCode(namespace:string,code:string,now=Date.now()){
  const result=await walletTask(namespace,()=>storage.updateEconomy<RedeemState>(namespace,'redeem_codes_v1',(saved,coins)=>{
    const reward=codeReward(code,now)
    const state=saved??{claims:{}}
    if(state.claims[reward.id])throw Error('这个身份已领取过该兑换码')
    return {state:{claims:{...state.claims,[reward.id]:{at:now,coins:reward.coins,themeId:reward.themeId}}},coins:coins+reward.coins}
  }))
  await restoreRedeemTheme(namespace)
  return result
}
