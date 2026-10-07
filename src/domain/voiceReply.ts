import type { Chat, ChatMessage } from '../types/index.ts'

const EMOTIVE = /[！!？?哈嘿呜靠卧槽妈呀救命笑死气死想你喜欢爱哭烦死了真的假的不会吧好家伙]/
const PARTICLE = /[啊哦呜诶嘛呢吧呀哈呐噢嘞~～…]/

export function shouldReplyAsVoice(input: {
  chat: Chat
  voiceReady: boolean
  history: ChatMessage[]
  partIndex: number
  partCount: number
  content: string
}): boolean {
  if (!input.chat.voiceEnabled || !input.voiceReady) return false
  if (input.partCount > 1 && input.partIndex < input.partCount - 1) return false

  const recent = [...input.history].reverse()
  const lastUser = recent.find((item) => item.role === 'user')
  if (lastUser?.kind === 'voice') return Math.random() < 0.62

  if (EMOTIVE.test(input.content)) return Math.random() < 0.32
  if (input.content.length <= 10 && PARTICLE.test(input.content)) return Math.random() < 0.22

  return Math.random() < 0.07
}
