import { storage } from '../storage/StorageService.ts'
import { walletTask } from './wallet.ts'

export const WIND_JOBS = [
  { id: 'books', name: '书店整理', skill: '条理', minutes: 10, pay: 8, xp: 25 },
  { id: 'cafe', name: '咖啡馆值班', skill: '亲和', minutes: 30, pay: 28, xp: 45 },
  { id: 'edit', name: '夜间校稿', skill: '文思', minutes: 120, pay: 96, xp: 90 },
  { id: 'design', name: '插画接单', skill: '创意', minutes: 60, pay: 50, xp: 65 },
] as const
export type WindJob = typeof WIND_JOBS[number]
export interface WindTicket { id: string; prize: number; revealed: boolean; revealAt: number; issue?: string; numbers?: string }
export interface WindState {
  skills: Record<string, number>
  work: { job: { name: string; minutes: number; pay: number; skill?: string; xp?: number }; started: number } | null
  scratch: WindTicket | null
  lottery: WindTicket | null
  history: Array<{ at: number; text: string }>
}
export const EMPTY_WIND: WindState = { skills: {}, work: null, scratch: null, lottery: null, history: [] }
export function skillLevel(xp: number): number { return 1 + Math.floor(Math.max(0, xp) / 100) }
export function jobPay(job: WindJob, xp: number): number { return Math.round(job.pay * (1 + (skillLevel(xp) - 1) * .2)) }
export function localDay(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
export function nextDraw(now: number): { issue: string; at: number } {
  const date = new Date(now)
  date.setHours(18, 0, 0, 0)
  if (date.getTime() <= now) date.setDate(date.getDate() + 1)
  return { issue: localDay(date), at: date.getTime() }
}
/** A shared, date-based draw: every ticket in the same issue uses the same winning digits. */
export function drawNumbers(issue: string, digits = 5): string {
  let hash = 2166136261
  for (const char of `mellow-lottery-v1:${issue}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return String((hash >>> 0) % (10 ** digits)).padStart(digits, '0')
}
export function lotteryPrize(numbers: string, winning: string): number {
  const matches = [...numbers].filter((digit, i) => digit === winning[i]).length
  if (numbers.length === 3) return matches === 3 ? 100 : matches === 2 ? 15 : matches === 1 ? 5 : 0
  return matches === 5 ? 100000 : matches === 4 ? 5000 : matches === 3 ? 500 : matches === 2 ? 50 : matches === 1 ? 10 : 0
}
export function scratchPrize(random: number): number { return random < .0001 ? 10000 : random < .001 ? 1000 : random < .01 ? 100 : random < .1 ? 30 : random < .3 ? 10 : random < .65 ? 3 : 0 }
export function beginWork(s: WindState, coins: number, job: WindJob, now: number) {
  if (s.work) throw Error('已有工作进行中')
  return { state: { ...s, work: { job: { ...job, pay: jobPay(job, s.skills[job.skill] || 0) }, started: now } }, coins }
}
export function claimWork(s: WindState, coins: number, now: number) {
  const work = s.work
  if (!work || now < work.started + work.job.minutes * 60000) return { state: s, coins }
  const skill = work.job.skill || '条理'
  return { state: windLog({ ...s, work: null, skills: { ...s.skills, [skill]: (s.skills[skill] || 0) + (work.job.xp || 25) } }, `${work.job.name}完工：+${work.job.pay} 枚，${skill}经验增加`), coins: coins + work.job.pay }
}
export function revealScratch(s: WindState, coins: number) {
  const ticket = s.scratch
  if (!ticket || ticket.revealed) return { state: s, coins }
  return { state: windLog({ ...s, scratch: { ...ticket, revealed: true } }, `刮刮乐：${ticket.prize ? `获得 ${ticket.prize} 枚` : '未中奖'}`), coins: coins + ticket.prize }
}
export function buyLottery(s: WindState, coins: number, now: number, id: string, numbers: string) {
  const issue = nextDraw(now)
  if (!/^\d{5}$/.test(numbers)) throw Error('新彩票需要五位数字')
  if (s.lottery && (!s.lottery.revealed || s.lottery.issue === issue.issue)) throw Error('本期已购票')
  return { state: { ...s, lottery: { id, issue: issue.issue, numbers, revealAt: issue.at, prize: 0, revealed: false } }, coins: coins - 5 }
}
export function settleLottery(s: WindState, coins: number, now: number) {
  const ticket = s.lottery
  if (!ticket || ticket.revealed || now < ticket.revealAt) return { state: s, coins }
  const prize = ticket.numbers && ticket.issue ? lotteryPrize(ticket.numbers, drawNumbers(ticket.issue, ticket.numbers.length)) : ticket.prize
  return { state: windLog({ ...s, lottery: { ...ticket, prize, revealed: true } }, `彩票开奖：${prize ? `获得 ${prize} 枚` : '未中奖'}`), coins: coins + prize }
}
export async function loadWind(namespace: string) {
  const [oldWork, oldTicket] = await Promise.all([
    storage.getBag<WindState['work']>(namespace, 'wind_work'),
    storage.getBag<WindTicket & { kind?: string }>(namespace, 'wind_ticket'),
  ])
  return windAction(namespace, (saved, coins) => ({ state: saved ?? {
    ...EMPTY_WIND, work: oldWork,
    scratch: oldTicket?.kind === '刮刮乐' ? { ...oldTicket, id: 'legacy-scratch' } : null,
    lottery: oldTicket?.kind === '幸运彩票' ? { ...oldTicket, id: 'legacy-lottery' } : null,
  }, coins }))
}
export function windAction(namespace: string, change: (saved: WindState | null, coins: number) => { state: WindState; coins: number }) {
  return walletTask(namespace, () => storage.updateEconomy<WindState>(namespace, 'wind_earnings_v1', change))
}
export function windLog(state: WindState, text: string): WindState {
  return { ...state, history: [{ at: Date.now(), text }, ...state.history].slice(0, 30) }
}
