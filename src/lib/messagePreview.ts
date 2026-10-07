import type { MessageKind } from '../types/index.ts'

export function messagePreview(content: string, kind: MessageKind = 'text'): string {
  if (kind === 'voice') return '[语音]'
  if (kind === 'image') return '[图片]'
  if (kind === 'sticker') return '[表情]'
  if (kind === 'redpacket') return '[红包]'
  if (kind === 'transfer') return '[转账]'
  if (kind === 'gift') return '[礼物]'
  if (kind === 'call') return '[通话]'
  if (kind === 'party') return '[派对]'
  if (kind === 'music') return '[音乐]'
  if (kind === 'anon') return '[匿名]'
  return content
}

export function voiceDurationSec(text: string): number {
  return Math.max(1, Math.min(60, Math.round(text.length / 4)))
}
