import { loadSave, newSave, putSave, line } from '../engine/story.ts'
import { parseCharacterCard } from '../lib/sillytavern.ts'
import { workshop, workshopURL, workshopImageSource, type Draft, type PublicWork, type WorkCategory } from '../lib/workshop.ts'
import { setWorkshopWorkApplied, workshopWorkOf, type WorkshopPhoneChannel } from '../lib/workshopPhone.ts'
import { storage } from '../storage/StorageService.ts'
import { characterFromDraft } from './importing.ts'
import { ensureDirectChat } from './messaging.ts'

const pendingContacts = new Map<string, ReturnType<typeof createContact>>()

/** Only the author's own editor supplies this draft; published protected cards stay server-side. */
export async function previewWorkshopDraft(namespace: string, key: string, category: WorkCategory, draft: Draft, mode: WorkshopPhoneChannel) {
  if (category === 'mod') throw new Error('请使用 MOD 预览。')
  if (!draft.title.trim() || !draft.content.persona?.trim()) throw new Error('请先填写标题和核心设定。')
  if (mode === 'sms' && category !== 'character') throw new Error('大世界和模拟器请在线下或番外试玩。')
  const draftKey = 'workshop-preview-' + key
  const avatar = draft.cover ? workshopImageSource(draft.cover) : ''
  const existing = (await storage.listCharacters(namespace)).find(person => person.extensions?.workshopPreviewId === draftKey)
  const parsed = parseCharacterCard({ name: draft.title, description: draft.content.persona,
    scenario: draft.content.world, first_mes: draft.content.greeting,
    tags: ['创作试玩'], extensions: { workshopPreviewId: draftKey } })
  const person = existing ? { ...existing, name: parsed.name, description: parsed.description,
    scenario: parsed.scenario, firstMes: parsed.firstMes, avatar, updatedAt: Date.now() }
    : await characterFromDraft(namespace, parsed, avatar, { skipChat: true })
  if (existing) await storage.putCharacter(namespace, person)
  if (mode === 'sms') return { chat: await ensureDirectChat(namespace, person, { allowProactive: false }) }
  const storyNamespace = mode === 'side' ? namespace + '__side' : namespace
  const id = draftKey + '-' + mode
  const previous = await loadSave(storyNamespace, id)
  const greeting = draft.content.greeting?.trim()
  const save = await putSave(storyNamespace, previous
    ? { ...previous, name: draft.title + ' · 试玩' }
    : newSave(draft.title + ' · 试玩', { id, charId: person.id, charIds: [person.id],
      lines: greeting ? [{ ...line('assistant', greeting), participantIds: [person.id] }] : [] }))
  return { save }
}

async function createContact(namespace: string, item: PublicWork) {
  const existing = (await storage.listCharacters(namespace)).find(person => workshopWorkOf(person) === item.id)
  if (existing) return existing
  const avatar = item.hasCover && workshopURL ? workshopURL + '/works/' + encodeURIComponent(item.id) + '/cover' : ''
  return characterFromDraft(namespace, parseCharacterCard({
    name: item.title,
    tags: ['创意工坊'],
    extensions: { workshopWorkId: item.id },
  }), avatar, { skipChat: true })
}

function contact(namespace: string, item: PublicWork) {
  const key = JSON.stringify([namespace, item.id])
  const pending = pendingContacts.get(key)
  if (pending) return pending
  const task = createContact(namespace, item).finally(() => pendingContacts.delete(key))
  pendingContacts.set(key, task)
  return task
}

export async function openWorkshopContact(namespace: string, item: PublicWork) {
  if (item.category !== 'character') throw new Error('只有角色卡可以添加为短信联系人。')
  return ensureDirectChat(namespace, await contact(namespace, item), { allowProactive: false })
}

export async function openWorkshopStory(namespace: string, item: PublicWork, mode: Exclude<WorkshopPhoneChannel, 'sms'>) {
  if (item.type !== 'character') throw new Error('这个扩展需要在工具箱启用。')
  const storyNamespace = mode === 'side' ? namespace + '__side' : namespace
  const id = 'workshop-' + item.id
  const existing = await loadSave(storyNamespace, id)
  if (existing) return existing
  const person = item.category === 'character' ? await contact(namespace, item) : undefined
  const greeting = item.display.greeting?.trim()
  return putSave(storyNamespace, newSave(item.title, {
    id, workshopWorkId: item.id,
    ...(person ? { charId: person.id, charIds: [person.id] } : {}),
    lines: greeting ? [{ ...line('assistant', greeting), participantIds: person ? [person.id] : [] }] : [],
  }))
}

export async function applyWorkshopWork(namespace: string, workId: string) {
  const library = await workshop<PublicWork[]>('/library')
  const item = library.find(work => work.id === workId)
  if (!item) throw new Error('请先领取当前已上架的作品。')
  if (item.type === 'dlc') {
    if (!item.enabled) await workshop('/library/' + item.id, 'PATCH', { enabled: true })
  } else {
    if (item.category === 'character') await openWorkshopContact(namespace, item)
    await openWorkshopStory(namespace, item, 'offline')
  }
  return setWorkshopWorkApplied(namespace, item.id, true)
}
