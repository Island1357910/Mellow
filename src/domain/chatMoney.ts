import type { ChatMessage } from '../types/index.ts'

export const SMS_MONEY_RULE = '如果此刻确实想给玩家发红包或转账，可在短信正文之后另起一行写【红包：金额｜祝福】或【转账：金额｜备注】。每轮最多一笔，金额为 0.01 到 200 的数字，最多两位小数。金额和是否发送由角色结合关系和情境决定，普通聊天可以省略。转账始终给玩家。群里发的红包是公开群红包。可以只发卡片。'

export function takeSmsMoney(text: string, recipient: string, groupShares = 0) {
  let payment: { kind: 'redpacket' | 'transfer'; content: string; incomingMoney: NonNullable<ChatMessage['incomingMoney']> } | undefined
  const body = text.replace(/^[ \t]*【(红包|转账)[：:]([^】\r\n]*)】[ \t]*\r?$/gm, (_, label: string, payload: string) => {
    if (payment) return ''
    const [raw = '', ...notes] = payload.split(/[｜|]/)
    const value = raw.trim()
    if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(value)) return ''
    const amount = Math.round(Number(value) * 100)
    const kind = label === '红包' ? 'redpacket' : 'transfer'
    const shares = kind === 'redpacket' ? Math.max(1, groupShares) : 1
    if (amount < shares || amount > 20_000) return ''
    const note = notes.join(' ').trim().slice(0, 60)
    const destination = kind === 'transfer' ? `给 ${recipient.replace(/｜/g, ' ').slice(0, 40)}` : groupShares ? `群红包 · ${shares} 份` : ''
    payment = {
      kind,
      content: `[${label}] ${(amount / 100).toFixed(2)}｜${note}｜${destination}`,
      incomingMoney: { cents: Math.floor(amount / shares), totalCents: amount },
    }
    return ''
  }).trim()
  return { body, payment }
}
