import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

const hook = registerHooks({
  load(url, context, next) {
    const result = next(url, context)
    if (!url.endsWith('/src/lib/workshop.ts') || !result.source) return result
    return { ...result, source: result.source.toString().replace('import.meta.env?.VITE_WORKSHOP_API', '"https://workshop.example"') }
  },
})
const { applyWorkshopWork, openWorkshopContact, openWorkshopStory, previewWorkshopDraft } = await import('../src/domain/workshopPhone.ts')
hook.deregister()
const { playInWorkshopPhone, readAppliedWorkshopWorks, setWorkshopWorkApplied, workshopWorkOf } = await import('../src/lib/workshopPhone.ts')
const { workshopEndpointPolicy } = await import('../src/lib/workshop.ts')
assert.equal(workshopEndpointPolicy([{ endpoints: [] }, { endpoints: [] }]), null)
assert.deepEqual(workshopEndpointPolicy([{ endpoints: [] }, { endpoints: ['https://custom.example/v1'] }]), ['https://custom.example/v1/chat/completions'])
assert.deepEqual(workshopEndpointPolicy([{ endpoints: ['https://one.example/v1'] }, { endpoints: ['https://two.example/v1'] }]), [])
const { replyInChat, postUserText } = await import('../src/domain/messaging.ts')
const { runStoryGeneration } = await import('../src/domain/storyRunner.ts')
const { putSave, loadSave, line } = await import('../src/engine/story.ts')
const { storage } = await import('../src/storage/StorageService.ts')
const { useMellow } = await import('../src/store/useMellow.ts')
const { describeMessage } = await import('../src/engine/prompt.ts')

const { identities, settings, presets } = await storage.boot()
for (const id of ['default', 'messages', 'offline', 'side']) {
  await storage.saveApiProfile({ id: 'workshop-' + id, name: id, endpoint: 'https://' + id + '.example/v1', model: id + '-model', key: id + '-key', ready: true })
}
await storage.saveSettings({ ...await storage.getSettings(), activeApiId: 'workshop-default' })
for (const mode of ['messages', 'offline', 'side'] as const) await storage.bindApiModule(mode, 'workshop-' + mode)
const identity = identities[0]!
const namespace = identity.namespace
const publicWork = {
  id: 'b3408f37-dabd-42d0-86e8-4d539ad9c7df', type: 'character' as const, category: 'character' as const,
  title: '工坊测试角色', display: { greeting: '公示开场' }, hasCover: false,
  creatorId: 1, creatorName: '测试创作者', summary: '', endpoints: [],
}
const dlc = {
  ...publicWork, id: 'a594cf54-5e92-4b29-9fbe-6c86fff4dd3a', type: 'dlc', category: 'mod',
  display: { usesModel: true }, enabled: false,
}
const library = [publicWork, dlc]
const requests: { channel: string; dlc: string[]; messages: { role: string; content: string; receipt?: string }[] }[] = []
const receipt = 'a'.repeat(64)
let expectDefaultApi = false
globalThis.fetch = async (url, init) => {
  const path = String(url)
  if (path === 'https://workshop.example/library') return Response.json(library)
  if (path === 'https://workshop.example/library/' + dlc.id && init?.method === 'PATCH') {
    assert.deepEqual(JSON.parse(String(init.body)), { enabled: true })
    dlc.enabled = true
    return new Response(null, { status: 204 })
  }
  assert.equal(path, 'https://workshop.example/play/' + publicWork.id + '/protected')
  assert.equal(init?.credentials, 'include')
  const body = JSON.parse(String(init?.body))
  assert.deepEqual(Object.keys(body).sort(), body.cast ? ['cast', 'channel', 'dlc', 'endpoint', 'key', 'messages', 'model'] : ['channel', 'dlc', 'endpoint', 'key', 'messages', 'model'])
  const module = expectDefaultApi ? 'default' : body.channel === 'sms' ? 'messages' : body.channel
  assert.equal(body.endpoint, 'https://' + module + '.example/v1/chat/completions')
  assert.equal(body.key, module + '-key')
  assert.equal(body.model, module + '-model')
  requests.push(body)
  return Response.json({ reply: '原应用里的可见回复', receipt })
}

const another = await storage.createIdentity({ name: '另一个手机身份', avatar: '', persona: '' })
assert.deepEqual(await applyWorkshopWork(namespace, publicWork.id), [publicWork.id])
assert.deepEqual(await applyWorkshopWork(namespace, dlc.id), [publicWork.id, dlc.id])
assert.deepEqual(await readAppliedWorkshopWorks(another.namespace), [])
assert.ok((await loadSave(namespace, 'workshop-' + publicWork.id))?.workshopWorkId)
assert.equal(await loadSave(another.namespace, 'workshop-' + publicWork.id), null)
assert.equal((await storage.listCharacters(another.namespace)).find(person => person.extensions?.workshopWorkId === publicWork.id), undefined)
await assert.rejects(applyWorkshopWork(namespace, 'not-installed'), /先领取/)
const chat = await openWorkshopContact(namespace, publicWork)
assert.equal((await openWorkshopContact(namespace, publicWork)).id, chat.id)
const character = (await storage.listCharacters(namespace)).find(person => person.id === chat.memberIds[0])!
assert.equal(character.extensions?.workshopWorkId, publicWork.id)
assert.equal(character.description, '')
assert.equal(character.systemPrompt, '')
assert.equal(character.characterBook, null)
useMellow.setState({ identities, activeIdentityId: identity.id })
useMellow.getState().requestOpenChat({ chatId: chat.id, identityId: identity.id, phoneIdentityId: identity.id })
assert.equal(useMellow.getState().activeApp, 'messages')
assert.equal(useMellow.getState().openChatRequest?.chatId, chat.id)
assert.equal(useMellow.getState().openChatRequest?.phoneIdentityId, identity.id)
const sms = { namespace, identity, chat, character, presets, activePresetId: settings.activePresetId, fourthWall: settings.fourthWall }
await postUserText({ ...sms, text: '短信第一轮' })
await replyInChat(sms)
await postUserText({ ...sms, text: '短信第二轮' })
await replyInChat(sms)
assert.equal(requests[0]?.channel, 'sms')
assert.deepEqual(requests[1]?.messages.at(-2), { role: 'assistant', content: '原应用里的可见回复', receipt })
assert.equal((await storage.listMessages(namespace, chat.id)).at(-1)?.workshopReply?.receipt, receipt)

for (const mode of ['offline', 'side'] as const) {
  const saveNs = mode === 'side' ? namespace + '__side' : namespace
  const save = await openWorkshopStory(namespace, publicWork, mode)
  assert.equal((await openWorkshopStory(namespace, publicWork, mode)).id, save.id)
  useMellow.getState().requestOpenStory({ identityId: identity.id, mode, saveId: save.id })
  assert.equal(useMellow.getState().activeApp, mode)
  assert.equal(useMellow.getState().openStoryRequest?.saveId, save.id)
  await putSave(saveNs, { ...save, lines: [...save.lines, line('user', '我推开了门。')] })
  await runStoryGeneration({ namespace: saveNs, mode, saveId: save.id, identity, presets, presetId: settings.activePresetId })
  const result = (await loadSave(saveNs, save.id))!
  assert.equal(result.workshopWorkId, publicWork.id)
  assert.equal(result.lines.at(-1)?.content, '原应用里的可见回复')
  assert.equal(result.lines.at(-1)?.workshopReply?.receipt, receipt)
  assert.deepEqual(requests.at(-1)?.messages, [{ role: 'user', content: '我推开了门。' }])
}
assert.deepEqual(requests.map(request => request.channel), ['sms', 'sms', 'offline', 'side'])
assert.ok(requests.every(request => request.dlc.length === 1 && request.dlc[0] === dlc.id))
const history = [{ role: 'user', content: '继续剧情' }]
await playInWorkshopPhone({ namespace: another.namespace, workId: publicWork.id, channel: 'offline', history })
assert.deepEqual(requests.at(-1)?.dlc, [])
await setWorkshopWorkApplied(namespace, dlc.id, false)
await playInWorkshopPhone({ namespace, workId: publicWork.id, channel: 'offline', history })
assert.deepEqual(requests.at(-1)?.dlc, [])
console.log('Workshop phone checks passed: native routing, isolated identity application, protected replies and per-identity DLC')

const draft = { title: '未发布的草稿', summary: '', endpoints: [], content: { version: 1 as const, persona: '守在花店的店长', world: '雨天的街角', greeting: '进来避雨吧。' } }
const trial = await previewWorkshopDraft(namespace, 'unsaved', 'character', draft, 'sms')
assert.ok(trial.chat)
const trialPerson = (await storage.listCharacters(namespace)).find(person => person.id === trial.chat!.memberIds[0])!
assert.equal(workshopWorkOf(trialPerson), undefined)
assert.equal(trialPerson.description, draft.content.persona)
assert.equal(trialPerson.scenario, draft.content.world)
assert.equal((await storage.listMessages(namespace, trial.chat!.id)).at(-1)?.content, draft.content.greeting)
const updated = await previewWorkshopDraft(namespace, 'unsaved', 'character', { ...draft, content: { ...draft.content, persona: '更新后的店长' } }, 'sms')
assert.equal(updated.chat?.id, trial.chat!.id)
assert.equal((await storage.listCharacters(namespace)).find(person => person.id === trialPerson.id)?.description, '更新后的店长')
for (const category of ['character', 'world', 'simulator'] as const) {
  for (const mode of ['offline', 'side'] as const) {
    const result = await previewWorkshopDraft(namespace, category, category, draft, mode)
    assert.ok(result.save?.charId)
    assert.equal(result.save?.workshopWorkId, undefined)
    assert.equal(result.save?.lines[0]?.content, draft.content.greeting)
  }
}
const isolated = await previewWorkshopDraft(another.namespace, 'unsaved', 'character', draft, 'sms')
assert.notEqual(isolated.chat?.id, trial.chat!.id)
await assert.rejects(previewWorkshopDraft(namespace, 'bad', 'character', { ...draft, title: '' }, 'sms'), /标题/)
console.log('Creator drafts: unsaved native SMS, world/simulator stories, setting updates and identity isolation passed')
const packet = await postUserText({ ...sms, text: '[红包] 0.01｜送你100万！｜', kind: 'redpacket' })
assert.match(describeMessage(packet), /¥0\.01.*送你100万/)
await replyInChat(sms)
assert.match(requests.at(-1)?.messages.at(-1)?.content ?? '', /¥0\.01.*送你100万/)
console.log('Redpacket title and actual amount both reach imported workshop characters')
await storage.bindApiModule('messages', '')
expectDefaultApi = true
await playInWorkshopPhone({ namespace, workId: publicWork.id, channel: 'sms', history })
const beforeMissingConfig = requests.length
await storage.saveSettings({ ...await storage.getSettings(), apiModuleBindings: { messages: 'missing-profile' } })
await assert.rejects(playInWorkshopPhone({ namespace, workId: publicWork.id, channel: 'sms', history }), /绑定的 API 不可用/)
assert.equal(requests.length, beforeMissingConfig, 'An invalid binding must never fall back to platform credentials')
