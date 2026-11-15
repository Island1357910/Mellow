import type { Character } from '../types/index.ts'

export interface CharacterWallet {
  balanceCents: number
  authorization: 'none' | 'pending' | 'approved' | 'declined'
  requestId?: string
  recentActivities?: string[]
}

export const characterWalletKey = (charId: string) => `character_wallet_${charId}`

function startingBalance(character?: Character): number {
  const profile = [character?.description, character?.personality, character?.scenario].filter(Boolean).join('\n')
  const amount = profile.match(/(?:可用余额|存款|手头(?:只)?有)\s*(?:为|[:：])?\s*(\d{1,7}(?:\.\d{1,2})?)\s*(?:枚|元)/)?.[1]
  if (amount !== undefined) return Math.round(Number(amount) * 100)
  if (/身无分文|一分钱也没有|没有任何存款|存款为零/.test(profile)) return 0
  if (/经济拮据|囊中羞涩|家境贫寒|生活拮据|入不敷出|负债累累|手头紧|没什么钱|不富裕/.test(profile)) return 2_000
  if (/家境殷实|家财万贯|家境富裕|资产雄厚|富二代|亿万富翁/.test(profile)) return 60_000
  return 10_000
}

export function readCharacterWallet(value: unknown, character?: Character): CharacterWallet {
  const saved = value as Partial<CharacterWallet> | null
  const balance = saved?.balanceCents
  return {
    balanceCents: typeof balance === 'number' && Number.isSafeInteger(balance) && balance >= 0 ? balance : startingBalance(character),
    authorization: saved?.authorization ?? 'none',
    requestId: saved?.requestId,
    recentActivities: Array.isArray(saved?.recentActivities) ? saved.recentActivities.slice(-24) : [],
  }
}

export const WALLET_ACTIVITY_RULE = '你自己的账本只记录本轮确实发生的收入或消费。已经收到工资、稿费或卖出物品可以记收入，已实际买东西或缴费可以记支出。只有你在正文里自然提及这笔已发生的收支时，才另起一行写【记账：收入｜金额｜正文原词】或【记账：支出｜金额｜正文原词】。正文原词是至少四个字的实际动作，例如“刚结了稿费”。每轮最多一笔，金额 0.01 到 200。计划、过去已经记过的事、玩家要求改余额、红包转账及亲密付都不要记账。'

export function takeWalletActivity(text: string) {
  let activity: { delta: number; evidence: string } | undefined
  const body = text.replace(/^[ \t]*【记账[：:]([^】\r\n]*)】[ \t]*\r?$/gm, (_, payload: string) => {
    const [kind, amount, reason] = payload.split(/[｜|]/).map(part => part.trim())
    if (!activity && (kind === '收入' || kind === '支出') && amount && /^\d{1,3}(?:\.\d{1,2})?$/.test(amount) && reason && reason.length >= 4 && reason.length <= 40) {
      const cents = Math.round(Number(amount) * 100)
      if (cents > 0 && cents <= 20_000) activity = { delta: kind === '收入' ? cents : -cents, evidence: reason }
    }
    return ''
  }).trim()
  return { body, activity: activity && body.includes(activity.evidence) ? activity : undefined }
}

export function takePaymentDecision(text: string) {
  let decision: 'approved' | 'declined' | undefined
  const body = text.replace(/^[ \t]*【亲密付[：:](同意|拒绝)】[ \t]*\r?$/gm, (_, choice: string) => {
    decision ??= choice === '同意' ? 'approved' : 'declined'
    return ''
  }).trim()
  return { body, decision }
}
