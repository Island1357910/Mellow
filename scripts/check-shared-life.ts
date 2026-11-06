import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { storage } from '../src/storage/StorageService.ts'
import { writeCharacter } from '../src/domain/importing.ts'
import { AIAdapter } from '../src/engine/AIAdapter.ts'
import { postPaidGiftMessage, postUserText } from '../src/domain/messaging.ts'
import { useMellow } from '../src/store/useMellow.ts'
import { isAiJobRunning, jobKey } from '../src/engine/aiJobs.ts'
import {
  DAY, SHARED_LIFE_KEY, addKeepsake, adjustRelationship, characterLife, changeSharedLife, cookWithGuest,
  ensureSharedCharacter, readSharedLife, rememberGift, rescheduleAppointment, saveAppointment, sharedLifeNote, updateAppointment,
} from '../src/lib/sharedLife.ts'
import { advanceLifeEvent, askAboutLifeGift, createLifeEvent, endLifeVisit, generateLifeCircle, introduceLifeContact, inviteLifeGuest, observeSharedLifeTurn, talkWithLifeGuest } from '../src/lib/sharedLifeAi.ts'
import { saveManualKeepsake, tickSharedLife } from '../src/lib/sharedLifeTick.ts'
import { EMPTY_HOME, type HomeState } from '../src/lib/homeLife.ts'
import { readCoins } from '../src/lib/wallet.ts'

const snapshot = await storage.boot()
const identity = await storage.createIdentity({ name: '共度测试玩家', avatar: '', persona: '喜欢陶器与做饭' })
const ns = identity.namespace
await writeCharacter({ identity, name: '林澄', personality: '慢热，有边界，记得朋友的建议', description: '图书编辑，独自居住。喜欢做饭，但不愿草率留宿。', firstMes: '今天过得怎样？' })
await writeCharacter({ identity, name: '顾禾', personality: '直率', description: '另一位朋友', firstMes: '' })
const people = await storage.listModernCharacters(ns)
const person = people.find(p => p.name === '林澄')!, other = people.find(p => p.name === '顾禾')!
const chat = (await storage.listChats(ns)).find(c => c.kind === 'dm' && c.memberIds.includes(person.id))!
const now = Date.now()
await storage.setBag(ns, 'coins', 900)
let state = await ensureSharedCharacter(ns, person.id)
assert.equal(state.characters[person.id]?.relationship.trust, 40)
const initial = state.characters[person.id]!.relationship
const changed = adjustRelationship(initial, { familiarity: 900, trust: -900, attraction: NaN })
assert.equal(changed.familiarity, initial.familiarity + 3)
assert.equal(changed.trust, initial.trust - 3)
assert.equal(changed.attraction, initial.attraction, 'trust and attraction must change independently')
await assert.rejects(() => saveAppointment(ns, { charId: person.id, title: '晚饭', place: '公园', at: now - 1 }, now))
state = await saveAppointment(ns, { charId: person.id, title: '周末晚饭', place: '街角小馆', at: now + 20 * 60_000 }, now)
const appointment = state.appointments[0]!
await assert.rejects(() => updateAppointment(ns, appointment.id, 'completed', now), /还没开始/)
const settings = { ...snapshot.settings, proactiveMinutes: 0, dnd: false, quietHours: false, banner: true }
useMellow.setState({ identities: [identity], activeIdentityId: identity.id, settings, pendingReplyChatId: null, activeApp: 'life', viewingChatId: null, immersiveUntil: 0, notices: [] })
await Promise.all([tickSharedLife({ identity, settings, presets: snapshot.presets }, now), tickSharedLife({ identity, settings, presets: snapshot.presets }, now)])
assert.equal(useMellow.getState().notices.length, 1, 'concurrent scheduler passes show one reminder')
await tickSharedLife({ identity, settings, presets: snapshot.presets }, now + 3 * 3_600_000)
state = await readSharedLife(ns)
assert.equal(state.appointments[0]!.status, 'planned', 'overdue never fabricates a missed appointment')
await rescheduleAppointment(ns, appointment.id, now + DAY, now)
state = await readSharedLife(ns)
assert.equal(state.appointments[0]?.reminderAt, undefined)
await updateAppointment(ns, appointment.id, 'completed', now + 2 * DAY)
assert.equal((await readSharedLife(ns)).keepsakes.filter(k => k.source === appointment.id).length, 1)

let response: unknown = {}, calls = 0, replyFailure = false
const original = AIAdapter.fromStored
AIAdapter.fromStored = async () => ({ complete: async (input: { messages: Array<{ content: string }> }) => {
  calls++
  if (!input.messages[0]!.content.includes('只输出合法JSON')) {
    if (replyFailure) throw Error('simulated reply failure')
    return { content: '一直记着呢。给你准备的小杯子，今天终于能送你了。', model: 'test' }
  }
  return { content: JSON.stringify(response), model: 'test' }
} }) as unknown as AIAdapter
try {
  const user = await postUserText({ namespace: ns, identity, chat, text: '明天19点在公园吃晚饭。' })
  response = { delta: { familiarity: 2, trust: -1, attraction: 0, reliance: 1, mood: '在意，但有一点犹豫' }, appointment: { title: '公园晚饭', place: '公园', at: new Date(now + DAY).toISOString(), evidence: user.content } }
  await Promise.all([observeSharedLifeTurn(ns, person, [user], 'same_reply', now), observeSharedLifeTurn(ns, person, [user], 'same_reply', now)])
  state = await readSharedLife(ns)
  assert.equal(state.characters[person.id]!.relationship.familiarity, initial.familiarity + 2)
  assert.equal(state.appointments.filter(a => a.source === 'same_reply').length, 1)
  assert.equal(state.appointments.find(a => a.source === 'same_reply')?.status, 'proposed')
  response = { appointment: { title: '捏造的约定', place: '海边', at: new Date(now + DAY).toISOString(), evidence: '从未说过的句子' } }
  await observeSharedLifeTurn(ns, person, [user], 'invalid_proposal', now)
  assert.ok(!(await readSharedLife(ns)).appointments.some(a => a.title === '捏造的约定'))
  response = { contacts: [{ name: '陈序', relation: '出版社的老搭档', description: '爱打羽毛球，最近在赶一本新书' }] }
  await generateLifeCircle(ns, person); await generateLifeCircle(ns, person)
  state = await readSharedLife(ns)
  assert.equal(state.contacts.length, 1, 'known contacts retain their identities')
  response = { text: '陈序是我以前同组的编辑。最近他又被一本新书绊住了。' }
  await introduceLifeContact(ns, person, state.contacts[0]!.id)
  assert.equal((await readSharedLife(ns)).contacts[0]?.introduced, true)

  response = { title: '窗边的薄荷', text: '薄荷的叶子有点蔫，我想先看看是不是浇多了水。' }
  state = await createLifeEvent(ns, person, now)
  const eventId = state.events[0]!.id
  await assert.rejects(() => createLifeEvent(ns, person, now), /正在发展的/)
  response = { text: '听了你的建议，我把它挪到了有散射光的位置，今天叶子精神了一些。', resolved: false }
  await Promise.all([advanceLifeEvent(ns, person, eventId, '先挪到散射光下', now + DAY), advanceLifeEvent(ns, person, eventId, '先挪到散射光下', now + DAY)])
  state = await readSharedLife(ns)
  assert.equal(state.events[0]!.stage, 2, 'concurrent advances commit one stage')
  assert.deepEqual(state.events[0]!.advice, ['先挪到散射光下'])
  response = { text: '这几天终于缓过来了。下次给你看新叶子。', resolved: true }
  await advanceLifeEvent(ns, person, eventId, '', now + 2 * DAY)
  assert.equal((await readSharedLife(ns)).events[0]?.status, 'resolved')
  assert.ok((await readSharedLife(ns)).keepsakes.some(k => k.source === eventId))

  response = { accepted: false, reply: '今晚先不了，我还想多了解你一点。' }
  await inviteLifeGuest(ns, person, '今晚留宿', now)
  assert.equal((await readSharedLife(ns)).visits[0]?.status, 'declined')
  response = { accepted: true, reply: '来坐坐可以。电影你来挑。' }
  const invitations = await Promise.allSettled([inviteLifeGuest(ns, person, '一起看电影', now), inviteLifeGuest(ns, other, '来坐坐聊天', now)])
  assert.equal(invitations.filter(r => r.status === 'fulfilled').length, 1, 'one home cannot host two simultaneous separate visits')
  state = await readSharedLife(ns)
  const visit = state.visits.find(v => v.status === 'active')!
  const guest = people.find(p => p.id === visit.charId)!
  response = { text: '这张餐桌挺舒服。上次你说想一起做饭，我还记着。' }
  await talkWithLifeGuest(ns, guest, visit.id, '坐这边吧', now)
  await storage.setBag(ns, 'home_life_v1', { ...EMPTY_HOME, stock: { tomato: 2, egg: 2 } })
  await Promise.all([cookWithGuest(ns, visit.id, 'eggs', 'one_meal', now), cookWithGuest(ns, visit.id, 'eggs', 'one_meal', now)])
  assert.equal((await storage.getBag<HomeState>(ns, 'home_life_v1'))?.stock.egg, 0)
  state = await readSharedLife(ns)
  assert.equal(state.keepsakes.filter(k => k.source === 'one_meal').length, 1)
  const beforeFail = structuredClone(state)
  await assert.rejects(() => cookWithGuest(ns, visit.id, 'eggs', 'second_meal', now), /食材不足/)
  assert.deepEqual(await readSharedLife(ns), beforeFail, 'failed cooking rolls back meal memory and visit dialogue as well as inventory')
  assert.equal(await readCoins(ns), 900)
  await endLifeVisit(ns, visit.id, now)
  await assert.rejects(() => talkWithLifeGuest(ns, guest, visit.id, '继续'), /已经结束/)

  await Promise.all([rememberGift(ns, { id: 'delivery_1', charId: person.id, name: '围巾' }, now), rememberGift(ns, { id: 'delivery_1', charId: person.id, name: '围巾' }, now)])
  assert.equal((await readSharedLife(ns)).gifts.length, 1)
  response = { status: 'using', text: '今天出门戴了，颜色和那件大衣正好搭上。' }
  await askAboutLifeGift(ns, person, 'delivery_1', now)
  assert.equal((await readSharedLife(ns)).gifts[0]?.status, 'using')
  assert.match((await readSharedLife(ns)).gifts[0]!.uses[0]!.text, /大衣/)
  await postUserText({ namespace: ns, identity, chat, kind: 'gift', text: '[礼物] 🎁｜瓷杯 ×1｜送给 林澄｜给你用' })
  assert.ok((await readSharedLife(ns)).gifts.some(g => g.name === '瓷杯 ×1'))

  await saveManualKeepsake(ns, other.id, '另一个人的秘密', '只属于顾禾的记录')
  await saveManualKeepsake(ns, person.id, '电影票根', '我们那天看了一部老电影', 'data:image/png;base64,aGVsbG8=')
  const note = await sharedLifeNote(ns, person.id, now)
  assert.match(note, /电影票根/); assert.ok(!note.includes('只属于顾禾')); assert.ok(!note.includes('data:image/'))
  await assert.rejects(() => saveManualKeepsake(ns, person.id, '坏图片', '', 'javascript:alert(1)'))

  // Fully funded plans deliver a single return gift without spending player currency.
  const expiredProposal = (await readSharedLife(ns)).appointments.find(a => a.status === 'proposed')!
  await updateAppointment(ns, expiredProposal.id, 'cancelled', now)
  await changeSharedLife(ns, s => ({ ...s, characters: { ...s.characters, [person.id]: { ...characterLife(s, person.id), autoEvents: false, returnPlan: { name: '亲手挑的陶杯', reason: '记得你喜欢陶器', cost: 24, saved: 0, createdAt: now - 2 * DAY, lastSavedAt: now - 2 * DAY } } } }))
  const activeSettings = { ...settings, proactiveMinutes: 10 }
  useMellow.setState({ settings: activeSettings, notices: [] })
  await tickSharedLife({ identity, settings: activeSettings, presets: snapshot.presets }, now)
  const key = jobKey(ns, 'shared-life-tick', person.id)
  for (let i = 0; i < 500 && isAiJobRunning(key); i++) await new Promise(r => setTimeout(r, 10))
  assert.equal(isAiJobRunning(key), false)
  state = await readSharedLife(ns)
  assert.equal(state.gifts.filter(g => g.from === 'character').length, 1)
  assert.equal(state.characters[person.id]?.returnPlan, undefined)
  assert.equal(await readCoins(ns), 900)
  await tickSharedLife({ identity, settings: activeSettings, presets: snapshot.presets }, now + 3 * DAY)
  assert.equal((await readSharedLife(ns)).gifts.filter(g => g.from === 'character').length, 1)

  // Failed proactive delivery must retry the same event stage rather than skip its outcome.
  await changeSharedLife(ns,s=>({...s,characters:{...s.characters,[person.id]:{...characterLife(s,person.id),autoEvents:true,lastAttemptAt:0}}}))
  replyFailure=true
  await tickSharedLife({identity,settings:activeSettings,presets:snapshot.presets},now+4*DAY)
  for(let i=0;i<500&&isAiJobRunning(key);i++)await new Promise(r=>setTimeout(r,10))
  const stage=(await readSharedLife(ns)).events[0]!.stage
  assert.equal((await readSharedLife(ns)).events[0]?.announcedStage,undefined)
  replyFailure=false
  await tickSharedLife({identity,settings:activeSettings,presets:snapshot.presets},now+4*DAY+31*60_000)
  for(let i=0;i<500&&isAiJobRunning(key);i++)await new Promise(r=>setTimeout(r,10))
  assert.equal((await readSharedLife(ns)).events[0]?.stage,stage)
  assert.equal((await readSharedLife(ns)).events[0]?.announcedStage,stage)
  // Debit, gift ownership, keepsake, and user chat card are one transaction.
  const paid={namespace:ns,identity,chat,text:'[礼物] 🎁｜手工杯｜送给 林澄｜小心使用',cost:30,requestId:'atomic_gift_1'}
  await Promise.all([postPaidGiftMessage(paid),postPaidGiftMessage(paid)])
  assert.equal(await readCoins(ns),870)
  assert.equal((await readSharedLife(ns)).gifts.filter(g=>g.id==='atomic_gift_1:'+person.id).length,1)
  assert.equal((await storage.listMessages(ns,chat.id)).filter(m=>m.id==='atomic_gift_1').length,1)
  await assert.rejects(()=>postPaidGiftMessage({...paid,cost:10000,requestId:'failed_paid_gift'}),/糖币不够/)
  assert.ok(!(await storage.listMessages(ns,chat.id)).some(m=>m.id==='failed_paid_gift'))
  assert.ok(!(await readSharedLife(ns)).gifts.some(g=>g.id.startsWith('failed_paid_gift')))
  assert.equal(await readCoins(ns),870)
  const beforeOff = calls
  await tickSharedLife({ identity, settings, presets: snapshot.presets }, now + 4 * DAY)
  assert.equal(calls, beforeOff, 'disabled proactive messaging does not call AI')
  const bundle = await storage.exportBundle() as { worlds: Array<{ namespace: string; appData: Array<{ id: string }> }> }
  assert.ok(bundle.worlds.find(w => w.namespace === ns)?.appData.some(d => d.id === SHARED_LIFE_KEY))
  await storage.deleteCharacter(ns, person.id)
  state = await readSharedLife(ns)
  for (const key of ['appointments', 'events', 'contacts', 'gifts', 'visits', 'keepsakes'] as const) assert.ok(!state[key].some(r => r.charId === person.id), key + ' must be removed with the character')
  assert.ok(state.keepsakes.some(k => k.charId === other.id))
  assert.equal(state.characters[person.id], undefined)
  assert.deepEqual(addKeepsake(state, { charId: other.id, title: '重复', text: '测试', at: now, kind: 'memory', source: 'stable' }).keepsakes.length, state.keepsakes.length + 1)
} finally { AIAdapter.fromStored = original }
console.log('shared life regression ok: independent relationships, evidence-backed plan proposals, exactly-once reminders, stable contacts, event continuity, consent-aware visits, atomic shared cooking, durable gifts and return gifts, keepsake privacy/backup, character cleanup')
process.exit(0)
