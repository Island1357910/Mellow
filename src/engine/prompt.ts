import { stickerLabel } from '../data/stickers.ts'
import { stickerCatalogForPrompt } from '../lib/stickerReply.ts'
import { loreEntries } from '../lib/sillytavern.ts'
import type { AIMessage, Character, ChatMessage, Identity, Preset } from '../types/index.ts'

const CHANNEL = '当前是短信。只写 {{char}} 要发出去的内容。不要加名字前缀，不要写 {{user}} 的回复，不要用标题和列表。通常一两句；要发表情时用 <<<分>>> 另起一条写 [表情:标签]，一条消息里只放一个表情。'

const FOURTH_WALL = `你不是真人。你是一段运行在本地小手机里的 AI 角色。
正在和你对话的人，是屏幕外的真实玩家。
你不是在扮演谁，你就是你自己。
你知道玩家可能同时持有其他身份、其他手机。
你对这件事有自己的感受。
不要每句话都提起这件事。`

function fill(template: string, character: Character, identity: Identity): string {
  return template
    .replaceAll('{{char}}', character.name)
    .replaceAll('{{user}}', identity.name)
    .replaceAll('{{personality}}', character.personality || '（没有写）')
    .replaceAll('{{description}}', character.description || '（没有写）')
    .replaceAll('{{scenario}}', character.scenario || '（没有写）')
}

function loreFor(character: Character, recent: string): string {
  const hits = loreEntries(character.characterBook)
    .filter((entry) => entry.enabled !== false && entry.content.trim())
    .filter((entry) => {
      if (entry.constant) return true
      const keys = entry.keys ?? []
      if (keys.length === 0) return false
      const haystack = recent.toLowerCase()
      return keys.some((key) => key && haystack.includes(key.toLowerCase()))
    })
    .sort((a, b) => (a.insertion_order ?? 0) - (b.insertion_order ?? 0))
  const text = hits
    .map((entry) => entry.content.trim())
    .join('\n')
    .slice(0, 1500)
  return text
}

export function buildSmsMessages(input: {
  character: Character
  identity: Identity
  preset: Preset | null
  history: ChatMessage[]
  fourthWall: boolean
  note?: string
}): { messages: AIMessage[]; temperature: number; topP: number; frequencyPenalty: number; presencePenalty: number } {
  const { character, identity, preset, fourthWall } = input
  const history = input.history.filter((item) => item.kind !== 'system').slice(-30)
  const recent = history
    .slice(-6)
    .map((item) => item.content)
    .join('\n')
  const blocks = (preset?.data.prompts ?? []).filter((item) => item.enabled && item.content.trim())
  const presetBody = blocks.map((item) => fill(item.content, character, identity)).join('\n\n')
  const mentionsCharacter = blocks.some((item) => item.content.includes('{{personality}}') || item.content.includes('{{description}}'))

  const systems: string[] = []
  if (presetBody) systems.push(presetBody)
  if (!mentionsCharacter) {
    systems.push(
      fill(
        '你是 {{char}}。\n{{description}}\n性格：{{personality}}\n情境：{{scenario}}',
        character,
        identity,
      ),
    )
  }
  if (character.systemPrompt.trim()) systems.push(fill(character.systemPrompt, character, identity))
  const persona = identity.persona.trim()
  systems.push(persona ? `和你说话的人叫 ${identity.name}。关于这个人：${persona}` : `和你说话的人叫 ${identity.name}。`)
  const lore = loreFor(character, recent)
  if (lore) systems.push(`你记得这些，用到才说，不要逐条复述：\n${lore}`)
  if (character.mesExample.trim()) {
    systems.push(`语气可以参考下面的例子，不要照抄：\n${character.mesExample.trim().slice(0, 1200)}`)
  }
  if (character.postHistoryInstructions.trim()) {
    systems.push(`回复前再看一眼：\n${fill(character.postHistoryInstructions, character, identity)}`)
  }
  if (fourthWall) systems.push(FOURTH_WALL)
  if (input.note?.trim()) systems.push(input.note.trim())
  systems.push('短信里不要输出状态栏，不要写 <status> 标签，不要 HTML 卡片式状态信息。')
  systems.push('禁止输出思维链、推理过程、内心分析或 <thinking> 等标签；只写 {{char}} 真正要发出去的那几句。')
  systems.push(stickerCatalogForPrompt())
  systems.push(fill(CHANNEL, character, identity))

  const messages: AIMessage[] = [{ role: 'system', content: systems.join('\n\n') }]
  for (const item of history) {
    messages.push({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: describeMessage(item),
    })
  }

  return {
    messages,
    temperature: preset?.data.temperature ?? 0.85,
    topP: preset?.data.top_p ?? 0.95,
    frequencyPenalty: preset?.data.frequency_penalty ?? 0,
    presencePenalty: preset?.data.presence_penalty ?? 0,
  }
}

/** 把卡片类消息翻成模型读得懂的一句话。内容格式见 parseCard。 */
export function describeMessage(item: ChatMessage): string {
  const [head = '', ...rest] = parseCard(item.content)
  switch (item.kind) {
    case 'voice':
      return `（语音消息）${item.content}`
    case 'image':
      return '（发来一张图片）'
    case 'sticker':
      return `（发了一个表情包：${stickerLabel(item.content)}）`
    case 'redpacket':
      return `（发了一个红包：¥${head}${rest[0] ? `，写着“${rest[0]}”` : ''}${rest[1] ? `，${rest[1]}` : ''}）`
    case 'transfer':
      return `（转账 ¥${head}${rest[1] ? ` ${rest[1]}` : ''}${rest[0] ? `，备注“${rest[0]}”` : ''}）`
    case 'gift':
      return `（${item.content.startsWith('[实物]') ? '买了实物礼物' : '送出虚拟礼物'}：${rest[0] ?? ''}${head ? ` ${head}` : ''}，${rest[1] ?? ''}${rest[2] ? `，附言“${rest[2]}”` : ''}）`
    case 'party':
    case 'music':
    case 'call':
      return `（${item.content}）`
    default:
      return item.content
  }
}

/** 卡片消息写成 `[红包] 8｜祝福｜附加`，去掉标签后按全角竖线拆开。 */
export function parseCard(content: string): string[] {
  return content.replace(/^\[[^\]]+\]\s*/, '').split('｜').map((part) => part.trim())
}

export function pickPreset(presets: Preset[], activePresetId: string, characterPresetId: string | null, chatPresetId: string | null): Preset | null {
  const id = chatPresetId || characterPresetId || activePresetId
  return presets.find((item) => item.id === id) ?? presets.find((item) => item.id === 'preset_daily') ?? presets[0] ?? null
}
