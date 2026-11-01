import { askLine, readJson } from './ask.ts'
import { uid } from './id.ts'
import { storage } from '../storage/StorageService.ts'
import { describeMessage } from '../engine/prompt.ts'
import { HOME_GOODS } from './homeLife.ts'
import type { Character, ChatMessage } from '../types/index.ts'
import {
  DAY, addKeepsake, adjustRelationship, characterLife, changeSharedLife, homeDescription,
  readSharedLife, sharedLifeNote, ensureSharedCharacter, type Appointment, type LifeContact, type LifeEvent, type Relationship,
} from './sharedLife.ts'

function text(value: unknown, limit = 800): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}
async function complete(person: Character, namespace: string, instruction: string, context: unknown, maxTokens = 1300) {
  const raw = await askLine(
    `你是${person.name}。性格：${person.personality}。人物设定：${person.description}。${await sharedLifeNote(namespace, person.id)}\n现在：${new Date().toLocaleString('zh-CN')}。只输出合法JSON，不替玩家说话或作决定；遵守角色自己的偏好与边界。${instruction}`,
    JSON.stringify(context), maxTokens, 60_000,
  )
  const data = readJson(raw)
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('这次内容没有生成完整，请重试')
  return data as Record<string, unknown>
}

export async function recentLifeChat(namespace: string, charId: string) {
  const chat = (await storage.listChats(namespace)).find(c => c.kind === 'dm' && c.memberIds.includes(charId))
  return chat ? (await storage.listMessages(namespace, chat.id)).filter(m => !m.hidden && m.kind !== 'system').slice(-16).map(m => ({ role: m.role, text: describeMessage(m).slice(0, 500) })) : []
}

/** Background observation proposes plans; only the player can confirm them. */
export async function observeSharedLifeTurn(namespace: string, person: Character, history: ChatMessage[], replyId: string, now = Date.now()) {
  const before = await ensureSharedCharacter(namespace, person.id), c = characterLife(before, person.id)
  if (c.processed.includes(replyId)) return
  const raw = await complete(person, namespace,
    '分析最新一轮真实对话，把有依据的变化保存到共同生活。返回{"delta":{"familiarity":-3至3,"trust":-3至3,"attraction":-3至3,"reliance":-3至3,"mood":"简短当前感受"},"appointment":null或{"title":"具体约定","place":"地点","at":"带时区的ISO时间","evidence":"对话中的原句"},"giftUse":null或{"id":"现有礼物ID","text":"实际说到怎样用了它"},"eventAdvice":null或{"id":"现有事件ID","text":"玩家实际给出的建议"},"returnGift":null或{"name":"贴合玩家喜好的回礼","reason":"选择原因","cost":24至200}}。只有明确谈到具体未来时间才提议约定，时间不明确必须null，严禁编造玩家已经同意。礼物使用和事件建议必须在本轮对话中真实出现。没有进展delta为0。回礼可以慢慢攒钱，不必每次都产生，亲密也不代表必须恋爱。',
    { time: new Date(now).toISOString(), dialogue: history.filter(m => !m.hidden && m.kind !== 'system').slice(-12).map(m => ({ id: m.id, role: m.role, content: describeMessage(m).slice(0, 600) })) }, 1400,
  )
  const delta = raw.delta && typeof raw.delta === 'object' ? raw.delta as Partial<Relationship> : {}
  const appointment = raw.appointment as Record<string, unknown> | null
  const giftUse = raw.giftUse as Record<string, unknown> | null
  const advice = raw.eventAdvice as Record<string, unknown> | null
  const returnGift = raw.returnGift as Record<string, unknown> | null
  await changeSharedLife(namespace, s => {
    const current = characterLife(s, person.id)
    if (current.processed.includes(replyId)) return s
    const nextChar = { ...current, relationship: adjustRelationship(current.relationship, delta, now), processed: [...current.processed, replyId].slice(-100) }
    if (returnGift && !current.returnPlan && current.relationship.familiarity >= 25 && now - current.lastReturnAt >= 7 * DAY && text(returnGift.name)) {
      const cost = typeof returnGift.cost === 'number' && Number.isFinite(returnGift.cost) ? Math.max(24, Math.min(200, Math.round(returnGift.cost))) : 48
      nextChar.returnPlan = { name: text(returnGift.name, 60), reason: text(returnGift.reason, 240), cost, saved: 0, lastSavedAt: now, createdAt: now }
    }
    let next = { ...s, characters: { ...s.characters, [person.id]: nextChar } }
    if (appointment && typeof appointment.at === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(appointment.at)) {
      const at = Date.parse(appointment.at), title = text(appointment.title, 80), place = text(appointment.place, 80), evidence = text(appointment.evidence, 240)
      const source = history.map(m => m.content).join('\n')
      if (at > now && at < now + 366 * DAY && title && place && evidence && source.includes(evidence) && !s.appointments.some(a => a.charId === person.id && Math.abs(a.at - at) < 60_000 && a.title === title)) {
        const proposal: Appointment = { id: uid('appointment'), charId: person.id, title, place, at, note: evidence, status: 'proposed', source: replyId }
        next = { ...next, appointments: [proposal, ...next.appointments].slice(0, 150) }
      }
    }
    if (giftUse && text(giftUse.text)) next = { ...next, gifts: next.gifts.map(g => g.id === giftUse.id && g.charId === person.id && g.from === 'player' ? { ...g, status: 'using' as const, uses: [...g.uses, { at: now, text: text(giftUse.text, 300) }].slice(-12) } : g) }
    if (advice && text(advice.text)) next = { ...next, events: next.events.map(e => e.id === advice.id && e.charId === person.id && e.status === 'active' ? { ...e, advice: [...e.advice, text(advice.text, 300)].slice(-10) } : e) }
    return next
  })
}

export async function generateLifeCircle(namespace: string, person: Character) {
  const saved = await readSharedLife(namespace)
  const own = saved.contacts.filter(c => c.charId === person.id)
  const data = await complete(person, namespace,
    '根据完整人物设定补充最多3位长期联系人。返回{"contacts":[{"name":"现场新创作的姓名或称呼","relation":"与角色的具体关系","description":"性格、来往原因及当前生活线索"}]}。已有联系人不可改名或重复，不默认任何人一定有父母、同事或恋人；不要把玩家或已有角色冒充新联系人。',
    { existing: own, recentChat: await recentLifeChat(namespace, person.id) },
  )
  if (!Array.isArray(data.contacts)) throw Error('联系人没有生成完整')
  const rows = data.contacts.flatMap(r => r && typeof r === 'object' && text(r.name) && text(r.relation) && text(r.description) ? [{ id: uid('life_contact'), charId: person.id, name: text(r.name, 40), relation: text(r.relation, 60), description: text(r.description, 400), introduced: false } satisfies LifeContact] : []).slice(0, 3)
  if (!rows.length) throw Error('这次没有生成新联系人，请重试')
  return changeSharedLife(namespace, s => {
    const existing = new Set(s.contacts.filter(c => c.charId === person.id).map(c => c.name))
    const additions = rows.filter(c => { if (existing.has(c.name)) return false; existing.add(c.name); return true })
    return { ...s, contacts: [...s.contacts, ...additions].slice(-250) }
  })
}
export async function introduceLifeContact(namespace: string, person: Character, contactId: string) {
  const contact = (await readSharedLife(namespace)).contacts.find(c => c.id === contactId && c.charId === person.id)
  if (!contact) throw Error('联系人不存在')
  const data = await complete(person, namespace, '玩家问起这个人。用自己的口吻介绍你们怎么认识、近期怎样来往。返回{"text":"一段自然对白"}。不能声称对方已经加了玩家好友。', contact, 700)
  if (!text(data.text)) throw Error('介绍没有生成完整')
  return changeSharedLife(namespace, s => ({ ...s, contacts: s.contacts.map(c => c.id === contactId ? { ...c, introduced: true, introduction: text(data.text) } : c) }))
}

export async function createLifeEvent(namespace: string, person: Character, now = Date.now()) {
  const data = await complete(person, namespace,
    '创作一个符合角色当前生活、能持续数天的小事件，不写灾难或强行卖惨。联系人只能使用已有的人；不替玩家行动。返回{"title":"事件名","text":"角色告诉玩家的起因，60至160字"}。当前已有未解决事件时不得另起重复事件。',
    { recentChat: await recentLifeChat(namespace, person.id) }, 1000,
  )
  if (!text(data.title) || !text(data.text)) throw Error('事件没有生成完整')
  const event: LifeEvent = { id: uid('life_event'), charId: person.id, title: text(data.title, 80), text: text(data.text), stage: 1, nextAt: now + 6 * 3_600_000, status: 'active', updates: [{ at: now, text: text(data.text) }], advice: [] }
  return changeSharedLife(namespace, s => {
    if (s.events.some(e => e.charId === person.id && e.status === 'active')) throw Error('这个角色还有正在发展的事情，先看看它的后续')
    return { ...s, events: [event, ...s.events].slice(0, 100) }
  })
}
export async function advanceLifeEvent(namespace: string, person: Character, eventId: string, advice = '', now = Date.now()) {
  const event = (await readSharedLife(namespace)).events.find(e => e.id === eventId && e.charId === person.id)
  if (!event || event.status !== 'active') throw Error('这件事已经结束')
  const data = await complete(person, namespace,
    '续写这一件正在发生的小事，承接已有阶段和玩家建议，不能重置事件。保留角色自主判断；建议可以采纳也可婉拒。返回{"text":"角色告知的新进展","resolved":true或false}。第3阶段起可以自然收尾，第5阶段必须收尾。不要假装玩家已经做了未做的事。',
    { event, playerAdvice: advice.trim().slice(0, 500), elapsedHours: (now - event.updates.at(-1)!.at) / 3_600_000 },
  )
  const line = text(data.text)
  if (!line) throw Error('没有生成新的进展')
  return changeSharedLife(namespace, s => {
    const fresh = s.events.find(e => e.id === eventId)
    if (!fresh || fresh.stage !== event.stage || fresh.status !== 'active') return s
    const resolved = data.resolved === true || fresh.stage >= 4
    let next = { ...s, events: s.events.map(e => e.id === eventId ? { ...e, text: line, stage: e.stage + 1, status: resolved ? 'resolved' as const : 'active' as const, nextAt: now + 18 * 3_600_000, updates: [...e.updates, { at: now, text: line }], advice: advice.trim() ? [...e.advice, advice.trim().slice(0, 500)].slice(-10) : e.advice } : e) }
    if (resolved) next = addKeepsake(next, { charId: person.id, title: fresh.title, text: line, at: now, kind: 'memory', source: fresh.id })
    return next
  })
}

export async function inviteLifeGuest(namespace: string, person: Character, activity: string, now = Date.now()) {
  const before = await readSharedLife(namespace)
  if (before.visits.some(v => v.status === 'active')) throw Error('家里已经有正在进行的来访，请先结束这次做客')
  const home = await homeDescription(namespace)
  const data = await complete(person, namespace,
    '玩家邀请你到家里进行一项活动。结合性格、关系、当前时间自主决定，可接受也可拒绝；留宿尤其需考虑信任、意愿与边界，不能只因心动高就接受。不预演未实际完成的做饭或亲密行为。返回{"accepted":true或false,"reply":"直接对玩家说的回应"}。',
    { invitation: activity.slice(0, 120), house: home.house, furniture: home.furniture, recentChat: await recentLifeChat(namespace, person.id) }, 900,
  )
  if (typeof data.accepted !== 'boolean' || !text(data.reply)) throw Error('邀请回复没有生成完整，请重试')
  return changeSharedLife(namespace, s => {
    if (s.visits.some(v => v.status === 'active')) throw Error('已有另一场来访，请稍后再邀请')
    const visit = { id: uid('visit'), charId: person.id, houseId: home.home.current, house: home.house, furniture: home.furniture, activity: activity.slice(0, 120), status: data.accepted ? 'active' as const : 'declined' as const, startedAt: now, lines: [{ who: 'player' as const, text: `邀请你来${home.house}${activity}。`, at: now }, { who: 'character' as const, text: text(data.reply), at: now }] }
    let next = { ...s, visits: [visit, ...s.visits].slice(0, 80) }
    if (data.accepted) next = addKeepsake(next, { charId: person.id, title: `来家里${activity}`, text: `${home.house}。${text(data.reply)}`, at: now, kind: 'visit', source: visit.id })
    return next
  })
}
export async function talkWithLifeGuest(namespace: string, person: Character, visitId: string, action: string, now = Date.now()) {
  const before = await readSharedLife(namespace), visit = before.visits.find(v => v.id === visitId && v.charId === person.id)
  if (!visit || visit.status !== 'active') throw Error('这次做客已经结束')
  const home = await homeDescription(namespace)
  const furniture = Object.entries(home.home.rooms[visit.houseId] ?? {}).map(([room, id]) => room + '：' + HOME_GOODS.find(g => g.id === id)?.name).join('；') || '还没有特别布置的家具'
  const data = await complete(person, namespace,
    '你正在玩家家里做客。根据来访记录与眼前动作回应，能注意家具变化并想起以前来访；不能凭空完成需要消耗食材的做饭，只有record里记载了实际做饭才可说已经做好。不替玩家发言，不推进未经同意的亲密行为。返回{"text":"对白与可见动作，80至180字"}。',
    { visit, furniture, previousVisits: before.visits.filter(v => v.charId === person.id && v.status === 'ended').slice(0, 3).map(v => ({ house: v.house, furniture: v.furniture, activity: v.activity, lastLines: v.lines.slice(-4) })), action: action.slice(0, 1200) }, 1000,
  )
  if (!text(data.text)) throw Error('这句话暂时没接上，请重试')
  return changeSharedLife(namespace, s => ({ ...s, visits: s.visits.map(v => v.id === visitId && v.status === 'active' ? { ...v, lines: [...v.lines, { who: 'player' as const, text: action.slice(0, 1200), at: now }, { who: 'character' as const, text: text(data.text), at: now }].slice(-80) } : v) }))
}
export async function endLifeVisit(namespace: string, visitId: string, now = Date.now()) {
  return changeSharedLife(namespace, s => {
    const visit = s.visits.find(v => v.id === visitId && v.status === 'active')
    if (!visit) return s
    const next = { ...s, visits: s.visits.map(v => v.id === visitId ? { ...v, status: 'ended' as const } : v) }
    return addKeepsake(next, { charId: visit.charId, title: `这次在家里的相聚`, text: visit.lines.filter(l => l.who !== 'player').slice(-3).map(l => l.text).join('\n'), at: now, kind: 'visit', source: visit.id + '_ended' })
  })
}
export async function askAboutLifeGift(namespace: string, person: Character, giftId: string, now = Date.now()) {
  const gift = (await readSharedLife(namespace)).gifts.find(g => g.id === giftId && g.charId === person.id && g.from === 'player')
  if (!gift) throw Error('礼物不存在')
  const data = await complete(person, namespace, '玩家问起自己送你的礼物。选择真实合理的使用或收藏方式，可以不合口味、舍不得用、正在使用，不必一律喜欢。返回{"status":"using或kept","text":"用自己的口吻说具体近况"}。食品应谈吃过或保存，不能说穿戴食品；已消耗物品不可反复使用。', gift, 900)
  if (!['using', 'kept'].includes(String(data.status)) || !text(data.text)) throw Error('礼物近况没有生成完整')
  return changeSharedLife(namespace, s => ({ ...s, gifts: s.gifts.map(g => g.id === giftId ? { ...g, status: data.status as 'using' | 'kept', uses: [...g.uses, { at: now, text: text(data.text) }].slice(-12) } : g) }))
}
