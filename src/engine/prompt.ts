import { SCENE_HOLD } from '../data/officialPresets.ts'
import { stickerLabel, type Sticker } from '../data/stickers.ts'
import { SMS_RELATION_LOCK } from '../lib/channelBridge.ts'
import { stickerCatalogForPrompt } from '../lib/stickerReply.ts'
import { loreEntries } from '../lib/sillytavern.ts'
import type { AIMessage, Character, ChatMessage, Identity, Preset } from '../types/index.ts'

const CHANNEL = '当前是短信。只写 {{char}} 要发出去的内容。不要加名字前缀，不要写 {{user}} 的回复，不要用标题和列表。通常一两句；要发表情时用 <<<分>>> 另起一条写 [表情:标签]，一条消息里只放一个表情。'

export const CALL_RULE =
  '当前是语音通话进行中。只写 {{char}} 此刻在电话里说的话。口语、短句，像真打电话；不要 markdown、不要列表、不要名字前缀、不要写 {{user}} 的台词。不要输出状态栏或 <status>。禁止思维链和 <thinking>；只写要说出口的话。'

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
  groupMembers?: Array<{ id: string; name: string }>
  fourthWall: boolean
  note?: string
  /** 线下关系。放在短信记录之后，压过短信旧上下文。 */
  priority?: string
  /** 主动触发只作为模型请求任务，不伪造或保存玩家消息。 */
  proactive?: boolean
  triggerNote?: string
  stickers?: Sticker[]
  /** 世界书指令库里勾上的写法。 */
  directives?: string
  /** 非空时这一轮要先写思维链。 */
  cot?: string
}): { messages: AIMessage[]; temperature: number; topP: number; frequencyPenalty: number; presencePenalty: number } {
  const { character, identity, preset, fourthWall } = input
  const history = smsSeenHistory(input.history)
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
  if (input.directives?.trim()) systems.push(input.directives.trim())
  systems.push('短信里不要输出状态栏，不要写 <status> 标签，不要 HTML 卡片式状态信息。')
  systems.push(input.cot?.trim()
    ? input.cot.trim()
    : '禁止输出思维链、推理过程、内心分析或 <thinking> 等标签；只写 {{char}} 真正要发出去的那几句。')
  systems.push(stickerCatalogForPrompt(input.stickers))
  systems.push(fill(CHANNEL, character, identity))
  systems.push('语音或文字的发送形式由应用决定。只输出正文，不要输出（语音消息）、[语音]等媒介前缀。')
  if (input.groupMembers) systems.push(`当前群聊只扮演 ${character.name}（ID：${character.id}）。群成员：${input.groupMembers.map(member => `${member.name}（${member.id}）`).join('、')}。发送者标记仅用于区分身份，不要复述。只有自己的发言是你说过的话，其他人的经历、关系和秘密不属于你的记忆。只依据自己的经历和群内明确公开的信息回应；别人讲述的经历只是你听说的事情，不能当作亲历。未经公开且不属于你的事情应当不知道，不猜测、不替别人回忆，不把自己与玩家的关系套用到全群。群聊背景仅是公开背景，不表示每位成员都亲历。`)
  if (input.priority?.trim()) systems.push(input.priority.trim())
  systems.push(SCENE_HOLD)

  const messages: AIMessage[] = [{ role: 'system', content: systems.join('\n\n') }]
  let imageNo = 0
  for (const item of history) {
    const numbered = item.role === 'user' && item.kind === 'image' && item.content.startsWith('data:') ? ++imageNo : 0
    const body = numbered ? `（发来一张图片，编号图${numbered}）` : describeMessage(item, input.stickers)
    messages.push({
      role: item.role === 'assistant' && (!input.groupMembers || item.charId === character.id) ? 'assistant' : 'user',
      content: input.groupMembers
        ? `[发送者：${item.role === 'user' ? identity.name : input.groupMembers.find(member => member.id === item.charId)?.name ?? '未知成员'}；ID：${item.role === 'user' ? identity.id : item.charId ?? '未知'}] ${body}`
        : body,
    })
  }
  if (input.priority?.trim()) {
    const last = messages[messages.length - 1]
    if (last?.role === 'user') last.content = `${last.content}\n\n${SMS_RELATION_LOCK}`
    messages.push({ role: 'system', content: input.priority.trim() })
  }
  if (input.proactive) {
    messages.push({
      role: 'user',
      content: [
        '（应用触发的主动消息任务，不是玩家发来的短信；玩家没有发送新消息。）',
        input.triggerNote?.trim() || '结合当前关系与真实聊天，自然地主动发一条短信，不要催促玩家或提及等待时长。',
        '这是你主动开启或延续话题，不是重答旧问题。只写角色此刻要发出的内容，不要引用任务提示，不要编造玩家的新发言、动作或决定。',
      ].join('\n'),
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
export type CallTurnInput = { role: 'user' | 'assistant'; text: string; charName?: string }

export function buildCallMessages(input: {
  character: Character
  identity: Identity
  preset: Preset | null
  history: ChatMessage[]
  callTurns: CallTurnInput[]
  fourthWall: boolean
  note?: string
}): { messages: AIMessage[]; temperature: number; topP: number; frequencyPenalty: number; presencePenalty: number } {
  const { character, identity, preset, fourthWall, callTurns } = input
  const history = input.history.filter((item) => item.kind !== 'system').slice(-20)
  const recent = [...history.slice(-4).map((item) => item.content), ...callTurns.map((item) => item.text)].join('\n')
  const blocks = (preset?.data.prompts ?? []).filter((item) => item.enabled && item.content.trim())
  const presetBody = blocks.map((item) => fill(item.content, character, identity)).join('\n\n')
  const mentionsCharacter = blocks.some((item) => item.content.includes('{{personality}}') || item.content.includes('{{description}}'))

  const systems: string[] = []
  if (presetBody) systems.push(presetBody)
  if (!mentionsCharacter) {
    systems.push(fill('你是 {{char}}。\n{{description}}\n性格：{{personality}}\n情境：{{scenario}}', character, identity))
  }
  if (character.systemPrompt.trim()) systems.push(fill(character.systemPrompt, character, identity))
  const persona = identity.persona.trim()
  systems.push(persona ? `和你说话的人叫 ${identity.name}。关于这个人：${persona}` : `和你说话的人叫 ${identity.name}。`)
  const lore = loreFor(character, recent)
  if (lore) systems.push(`你记得这些，用到才说，不要逐条复述：\n${lore}`)
  if (character.mesExample.trim()) {
    systems.push(`语气可以参考下面的例子，不要照抄：\n${character.mesExample.trim().slice(0, 800)}`)
  }
  if (character.postHistoryInstructions.trim()) {
    systems.push(`回复前再看一眼：\n${fill(character.postHistoryInstructions, character, identity)}`)
  }
  if (fourthWall) systems.push(FOURTH_WALL)
  if (input.note?.trim()) systems.push(input.note.trim())
  systems.push(fill(CALL_RULE, character, identity))
  systems.push(SCENE_HOLD)

  const messages: AIMessage[] = [{ role: 'system', content: systems.join('\n\n') }]
  for (const item of history) {
    messages.push({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: describeMessage(item),
    })
  }
  for (const turn of callTurns) {
    messages.push({
      role: turn.role === 'assistant' ? 'assistant' : 'user',
      content:
        turn.role === 'user'
          ? `（通话中）${identity.name}说：${turn.text}`
          : `（通话中）${turn.charName || character.name}说：${turn.text}`,
    })
  }

  return {
    messages,
    temperature: preset?.data.temperature ?? 0.88,
    topP: preset?.data.top_p ?? 0.95,
    frequencyPenalty: preset?.data.frequency_penalty ?? 0,
    presencePenalty: preset?.data.presence_penalty ?? 0,
  }
}

export function smsSeenHistory(history: ChatMessage[]): ChatMessage[] {
  return history.filter((item) => item.kind !== 'system').slice(-30)
}

export function describeMessage(item: ChatMessage, stickers?: Sticker[]): string {
  const [head = '', ...rest] = parseCard(item.content)
  switch (item.kind) {
    case 'voice':
      return item.content
    case 'image':
      return '（发来一张图片）'
    case 'sticker':
      return `[表情:${stickerLabel(item.content, stickers)}]`
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
