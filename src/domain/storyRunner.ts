import { pickPreset } from '../engine/prompt.ts'
import { smsBridgeForStory } from '../lib/channelBridge.ts'
import { jiushiLetterBridgeForStory } from '../lib/jiushiBridge.ts'
import { isJiushiCharacter, jiushiPromptBlock, loadJiushiConfig } from '../lib/jiushi.ts'
import { jiushiWorldNs } from '../lib/jiushiPhone.ts'
import { directivePrompt } from '../lib/directives.ts'
import { offlineFocus } from '../lib/offlineCast.ts'
import { enabledWorldText, storyWorldText } from '../lib/worldbook.ts'
import {
  buildStoryPrompt,
  generateStoryReply,
  line,
  loadConfig,
  loadSave,
  needsSummary,
  putSave,
  sideLike,
  writeSummary,
  type StoryMode,
} from '../engine/story.ts'
import { storage } from '../storage/StorageService.ts'
import type { Identity, Preset } from '../types/index.ts'

export async function runStoryGeneration(input: {
  namespace: string
  saveId: string
  mode: StoryMode
  identity: Identity
  presetId: string
  presets: Preset[]
  nudge?: string
}): Promise<void> {
  const phoneNs = input.namespace.replace(/__(?:side|jiushi)$/, '')
  const save = await loadSave(input.namespace, input.saveId)
  if (!save) return
  const [allChars, config] = await Promise.all([
    storage.listCharacters(phoneNs),
    loadConfig(input.namespace),
  ])
  const chars = allChars.filter(c => input.mode === 'jiushi' ? isJiushiCharacter(c) : !isJiushiCharacter(c))
  const lead = save.charId ? chars.find((item) => item.id === save.charId) : undefined
  const preset = pickPreset(
    input.presets,
    input.presetId,
    sideLike(input.mode) ? lead?.presetId ?? null : null,
    null,
  )
  const worldNs = input.mode === 'jiushi' ? jiushiWorldNs(phoneNs) : phoneNs
  const focus = input.mode === 'offline' ? await offlineFocus(chars, save, input.nudge) : []
  const world = input.mode === 'offline'
    ? await storyWorldText(worldNs, focus, `${save.lines.slice(-6).map(item => item.content).join('\n')}\n${input.nudge ?? ''}`)
    : await enabledWorldText(worldNs, save.charId ?? chars[0]?.id)
  const jiushiFocus = input.mode === 'jiushi'
    ? chars.filter(isJiushiCharacter).slice(0, 6)
    : []
  const smsBridge =
    input.mode === 'offline'
      ? await smsBridgeForStory(phoneNs, focus)
      : ''
  const letterBridge =
    input.mode === 'jiushi'
      ? await jiushiLetterBridgeForStory(phoneNs, jiushiFocus.length ? jiushiFocus : chars.filter(isJiushiCharacter).slice(0, 4))
      : ''
  const jiushiConfig = input.mode === 'jiushi' ? await loadJiushiConfig(phoneNs) : null
  const directiveIds = input.mode === 'offline'
    ? focus.map((person) => person.id)
    : input.mode === 'side'
      ? (save.charIds?.length ? save.charIds : [save.charId].filter((id): id is string => Boolean(id)))
      : []
  const writing = input.mode === 'jiushi' ? { text: '', cot: '' } : await directivePrompt(phoneNs, directiveIds)
  const messages = buildStoryPrompt({
    mode: input.mode,
    config,
    chars,
    identity: jiushiConfig ? { ...input.identity, name: jiushiConfig.roleName || '无名旅人', persona: jiushiConfig.roleStory || '此世土生土长的古代居民' } : input.identity,
    save: jiushiConfig ? { ...save, persona: { name: jiushiConfig.roleName || '无名旅人', persona: jiushiConfig.roleStory || '此世土生土长的古代居民' } } : save,
    preset,
    nudge: input.nudge,
    world,
    smsBridge: [smsBridge, letterBridge].filter(Boolean).join('\n'),
    jiushiBlock: jiushiConfig ? jiushiPromptBlock(jiushiConfig) : undefined,
    directives: writing.text,
    cot: writing.cot,
    castIds: input.mode === 'offline' ? focus.map((person) => person.id) : undefined,
  })
  const reply = await generateStoryReply({
    mode: input.mode,
    messages,
    preset,
    charsMin: config.replyCharsMin,
    charsMax: config.replyCharsMax,
  })
  const participantIds = focus.map(person => person.id)
  const lines = save.lines.map((item, index) => input.mode === 'offline' && index === save.lines.length - 1 && item.role === 'user'
    ? { ...item, participantIds } : item)
  const replyLine = { ...line('assistant', reply.content), ...(input.mode === 'offline' || input.mode === 'side' ? { reasoning: reply.reasoning } : {}) }
  let settled = participantIds
  if (input.mode === 'offline') {
    const seen = await offlineFocus(chars, { ...save, lines: [...lines, replyLine] })
    settled = seen.map((person) => person.id)
  }
  let next = await putSave(input.namespace, { ...save, lines: [...lines, { ...replyLine, ...(input.mode === 'offline' ? { participantIds: settled } : {}) }] })
  if (needsSummary(next, config)) {
    try {
      next = await putSave(input.namespace, { ...await writeSummary(next, 'small', config.keepRounds, input.mode), summaryError: '' })
    } catch (error) {
      await putSave(input.namespace, { ...next, summaryError: error instanceof Error ? error.message : '总结失败，下轮自动重试' })
      const { useMellow } = await import('../store/useMellow.ts')
      await useMellow.getState().pushNotice({ kind: 'toast', title: '剧情已保存，总结待重试', body: error instanceof Error ? error.message : '请检查接口配置', appId: input.mode, identityId: input.identity.id, priority: 2 })
    }
  }
}
