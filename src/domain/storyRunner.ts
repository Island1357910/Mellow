import { pickPreset } from '../engine/prompt.ts'
import { smsBridgeForStory } from '../lib/channelBridge.ts'
import { purchaseMemory } from '../lib/deliveryMemory.ts'
import { momentMemory } from '../lib/socialAi.ts'
import { jiushiLetterBridgeForStory } from '../lib/jiushiBridge.ts'
import { isJiushiCharacter, jiushiPromptBlock, loadJiushiConfig } from '../lib/jiushi.ts'
import { jiushiWorldNs } from '../lib/jiushiPhone.ts'
import { directivePrompt } from '../lib/directives.ts'
import { offlineFocus } from '../lib/offlineCast.ts'
import { migrateJiushiCardWorld, storyWorldText } from '../lib/worldbook.ts'
import { checkAbort } from '../lib/abort.ts'
import { playInWorkshopPhone, workshopWorkOf } from '../lib/workshopPhone.ts'
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
  type StoryLine,
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
  replaceLineId?: string
  signal?: AbortSignal
  onReplySaved?: (interrupted: boolean) => void
}): Promise<void> {
  const { signal } = input
  checkAbort(signal)
  const phoneNs = input.namespace.replace(/__(?:side|jiushi)$/, '')
  const loaded = await loadSave(input.namespace, input.saveId)
  if (!loaded) throw new Error('找不到这段剧情的存档，请重新打开后重试。')
  const original = loaded
  const replaceFrom = input.replaceLineId ? original.lines.findIndex(item => item.id === input.replaceLineId && item.role === 'assistant') : original.lines.length
  if (replaceFrom < 0) throw new Error('找不到要重说的消息。')
  const save = input.replaceLineId
    ? { ...original, lines: original.lines.slice(0, replaceFrom), summaries: original.summaries.filter(item => item.upTo <= replaceFrom) }
    : original
  const [allChars, config] = await Promise.all([
    storage.listCharacters(phoneNs),
    loadConfig(input.namespace),
  ])
  const chars = allChars.filter(c => input.mode === 'jiushi' ? isJiushiCharacter(c) : !isJiushiCharacter(c))
  const sideIds = save.charIds?.length ? save.charIds : [save.charId ?? chars[0]?.id].filter((id): id is string => Boolean(id))
  const lead = chars.find(item => item.id === save.charId && sideIds.includes(item.id))
    ?? chars.find(item => sideIds.includes(item.id))
  async function saveReply(replyLine: StoryLine, participantIds: string[], replyParticipantIds: string[] | undefined) {
    const current = await loadSave(input.namespace, input.saveId)
    checkAbort(signal)
    if (!current || current.lines.length !== original.lines.length || current.lines.some((item, index) =>
      item.id !== original.lines[index]?.id || item.content !== original.lines[index]?.content)) {
      throw new Error('生成期间剧情记录已变动，请从当前剧情重试。')
    }
    const lines = current.lines.slice(0, replaceFrom).map((item, index) => input.mode === 'offline' && index === replaceFrom - 1 && item.role === 'user'
      ? { ...item, participantIds } : item)
    const summaries = input.replaceLineId ? current.summaries.filter(item => item.upTo <= replaceFrom) : current.summaries
    const draft = { ...current, summaries, lines: [...lines, replyLine] }
    const next = await putSave(input.namespace, { ...draft, lines: [...lines, { ...replyLine, participantIds: replyParticipantIds }] })
    return { draft, lines, next }
  }
  if (input.mode === 'offline' || input.mode === 'side') {
    const sceneCast = input.mode === 'offline'
      ? focusChars(chars, save, input.nudge)
      : chars.filter(person => (save.charIds ?? (save.charId ? [save.charId] : [])).includes(person.id))
    const peopleInScene = sceneCast.length || !save.workshopWorkId ? sceneCast
      : chars.filter(person => (save.charIds ?? (save.charId ? [save.charId] : [])).includes(person.id))
    const linked = peopleInScene.map(workshopWorkOf).filter((id): id is string => Boolean(id))
    const workId = save.workshopWorkId ?? linked[0]
    if (workId) {
      const cast = [...new Set(linked)].filter(id => id !== workId).slice(0, 3)
      const result = await playInWorkshopPhone({ namespace: phoneNs, workId, channel: input.mode, history: save.lines, action: input.nudge, cast, signal })
      const people = peopleInScene.map(person => person.id)
      await saveReply({ ...line('assistant', result.text), workshopReply: result.workshopReply }, people, people)
      input.onReplySaved?.(false)
      return
    }
  }
  const preset = pickPreset(
    input.presets,
    input.presetId,
    sideLike(input.mode) ? lead?.presetId ?? null : null,
    null,
  )
  const worldNs = input.mode === 'jiushi' ? jiushiWorldNs(phoneNs) : phoneNs
  checkAbort(signal)
  const focus = input.mode === 'offline' ? await offlineFocus(chars, save, input.nudge, signal) : []
  checkAbort(signal)
  const active = input.mode === 'offline' ? focus : chars.filter(person => sideIds.includes(person.id))
  const jiushiConfig = input.mode === 'jiushi' ? await loadJiushiConfig(phoneNs) : null
  const worldUser = jiushiConfig ? jiushiConfig.roleName || '无名旅人' : sideLike(input.mode) ? save.persona?.name || input.identity.name : input.identity.name
  if (input.mode === 'jiushi') await migrateJiushiCardWorld(phoneNs, active.map(person => person.id))
  const world = await storyWorldText(worldNs, active, `${save.lines.slice(-6).map(item => item.content).join('\n')}\n${input.nudge ?? ''}`, { userName: worldUser })
  const smsBridge =
    input.mode === 'offline'
      ? await smsBridgeForStory(phoneNs, focus)
      : ''
  const letterBridge =
    input.mode === 'jiushi'
      ? await jiushiLetterBridgeForStory(phoneNs, active)
      : ''
  const directiveIds = input.mode === 'offline'
    ? focus.map((person) => person.id)
    : sideIds
  const writing = await directivePrompt(worldNs, directiveIds)
  const messages = buildStoryPrompt({
    mode: input.mode,
    config,
    chars,
    identity: jiushiConfig ? { ...input.identity, name: jiushiConfig.roleName || '无名旅人', persona: jiushiConfig.roleStory || '此世土生土长的古代居民' } : input.identity,
    save: jiushiConfig ? { ...save, persona: { name: jiushiConfig.roleName || '无名旅人', persona: jiushiConfig.roleStory || '此世土生土长的古代居民' } } : save,
    preset,
    nudge: input.nudge,
    world,
    worldResolved: true,
    smsBridge: [smsBridge, letterBridge].filter(Boolean).join('\n'),
    purchaseMemory: input.mode === 'offline' ? await purchaseMemory(phoneNs, focus.map((person) => person.id), true) : undefined,
    momentMemory: input.mode === 'offline' ? await momentMemory(phoneNs, focus) : undefined,
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
    signal,
  })
  const participantIds = focus.map(person => person.id)
  const replyLine = { ...line('assistant', reply.content), reasoning: reply.reasoning }
  const immediateIds = input.mode === 'offline' ? focusChars(chars, { ...save, lines: [...save.lines, replyLine] }).map(person => person.id) : undefined
  const { draft, lines, next: saved } = await saveReply(replyLine, participantIds, immediateIds)
  let next = saved
  input.onReplySaved?.(reply.interrupted)
  if (signal?.aborted || reply.interrupted) return
  if (input.mode === 'offline') {
    const settled = (await offlineFocus(chars, draft, '', signal)).map(person => person.id)
    if (signal?.aborted) return
    if (settled.join() !== immediateIds?.join()) {
      const latest = await loadSave(input.namespace, input.saveId)
      if (signal?.aborted || latest?.updatedAt !== next.updatedAt) return
      next = await putSave(input.namespace, { ...latest, lines: [...lines, { ...replyLine, participantIds: settled }] })
    }
  }
  if (needsSummary(next, config)) {
    try {
      const summarized = await writeSummary(next, 'small', config.keepRounds, input.mode, signal)
      const latest = await loadSave(input.namespace, input.saveId)
      if (!signal?.aborted && latest?.updatedAt === next.updatedAt) await putSave(input.namespace, { ...summarized, summaryError: '' })
    } catch (error) {
      const latest = await loadSave(input.namespace, input.saveId)
      if (signal?.aborted || latest?.updatedAt !== next.updatedAt) return
      await putSave(input.namespace, { ...latest, summaryError: error instanceof Error ? error.message : '总结失败，下轮自动重试' })
      const { useMellow } = await import('../store/useMellow.ts')
      await useMellow.getState().pushNotice({ kind: 'toast', title: '剧情已保存，总结待重试', body: error instanceof Error ? error.message : '请检查接口配置', appId: input.mode, identityId: input.identity.id, priority: 2 })
    }
  }
}
