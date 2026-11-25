import { canGenerateAppImages, generateAppImage, portraitLockOf, smsImageDirection } from './appImages.ts'
import { storage } from '../storage/StorageService.ts'
import type { Character } from '../types/index.ts'

export interface PhoneItem {
  title: string
  text: string
  imagePrompt?: string
  image?: string
}

export async function generatePhoneAlbum(input: {
  namespace: string
  character: Character
  items: PhoneItem[]
  active: () => boolean
  onUpdate: (items: PhoneItem[]) => void
}): Promise<string> {
  if (!await canGenerateAppImages('huizhen')) {
    return '相册照片需要图片 API。请在设置 → 连接 → 图片 API 中保存接口，并开启「回针相册」。'
  }
  const items = input.items.map(item => ({ ...item }))
  const portrait = portraitLockOf(input.character.extensions)
  for (const item of items) {
    if (!input.active()) return ''
    if (item.image) continue
    const description = item.imagePrompt || `realistic | ${item.text.slice(0, 350)}`
    const selfie = /^selfie\s*\|/i.test(description) || /自拍|本人/.test(description)
    const prompt = selfie
      ? smsImageDirection(description, '', input.character.description + '\n' + input.character.personality, portrait?.summary)
      : description
    item.image = await generateAppImage('huizhen', prompt, selfie ? portrait?.image : undefined)
    await storage.setBag(input.namespace, `phone_live_v2_${input.character.id}_album`, items)
    if (input.active()) input.onUpdate([...items])
  }
  return items.some(item => !item.image) ? '部分照片未生成成功，可以点击「补全照片」重试。' : ''
}
