import { pickPreset } from '../engine/prompt.ts'
import { smsBridgeForStory } from '../lib/channelBridge.ts'
import { jiushiLetterBridgeForStory } from '../lib/jiushiBridge.ts'
import { isJiushiCharacter, jiushiPromptBlock, loadJiushiConfig } from '../lib/jiushi.ts'
import { jiushiWorldNs } from '../lib/jiushiPhone.ts'
import { enabledWorldText } from '../lib/worldbook.ts'
import {
  buildStoryPrompt,
  focusChars,
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
  const [chars, config] = await Promise.all([
    storage.listCharacters(phoneNs),
    loadConfig(input.namespace),
  ])
  const lead = save.charId ? chars.find((item) => item.id === save.charId) : undefined
  const preset = pickPreset(
    input.presets,
    input.presetId,
    sideLike(input.mode) ? lead?.presetId ?? null : null,
    null,
  )
  const worldNs = input.mode === 'jiushi' ? jiushiWorldNs(phoneNs) : phoneNs
  const world = await enabledWorldText(worldNs, save.charId ?? chars[0]?.id)
  const focus = input.mode === 'offline' ? focusChars(chars, save) : []
  const jiushiFocus = input.mode === 'jiushi'
    ? chars.filter(isJiushiCharacter).slice(0, 6)
    : []
  const smsBridge =
    input.mode === 'offline'
      ? await smsBridgeForStory(phoneNs, focus.length ? focus : chars.slice(0, 4))
      : ''
  const letterBridge =
    input.mode === 'jiushi'
      ? await jiushiLetterBridgeForStory(phoneNs, jiushiFocus.length ? jiushiFocus : chars.filter(isJiushiCharacter).slice(0, 4))
      : ''
  const jiushiConfig = input.mode === 'jiushi' ? await loadJiushiConfig(phoneNs) : null
  const messages = buildStoryPrompt({
    mode: input.mode,
    save,
    config,
    chars,
    identity: input.identity,
    preset,
    nudge: input.nudge,
    world,
    smsBridge: [smsBridge, letterBridge].filter(Boolean).join('\n'),
    jiushiBlock: jiushiConfig ? jiushiPromptBlock(jiushiConfig) : undefined,
  })
  const content = await generateStoryReply({
    messages,
    preset,
    charsMin: config.replyCharsMin,
    charsMax: config.replyCharsMax,
  })
  let next = await putSave(input.namespace, { ...save, lines: [...save.lines, line('assistant', content)] })
  if (needsSummary(next, config)) {
    try {
      next = await putSave(input.namespace, await writeSummary(next, 'small', config.keepRounds))
    } catch {
      // 摘要失败不影响正文
    }
  }
}
