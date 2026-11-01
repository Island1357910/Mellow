import { replyInChat } from '../domain/messaging.ts'
import { storage } from '../storage/StorageService.ts'
import { useMellow } from '../store/useMellow.ts'
import type { AppSettings, Identity, Preset } from '../types/index.ts'
import { isAiJobRunning, jobKey, runAiJob } from '../engine/aiJobs.ts'
import { isSmsProactivePaused } from './smsGuard.ts'
import { modePresetId } from './defaults.ts'
import { DAY, accrueReturnPlan, addKeepsake, characterLife, changeSharedLife, readSharedLife } from './sharedLife.ts'
import { advanceLifeEvent, createLifeEvent } from './sharedLifeAi.ts'
import { inQuietHours } from './quietHours.ts'
import { uid } from './id.ts'

export async function tickSharedLife(input: { identity: Identity; settings: AppSettings; presets: Preset[] }, now = Date.now()) {
  const namespace = input.identity.namespace
  const state = await readSharedLife(namespace)
  // Each reminder is claimed in a transaction so multiple tabs do not repeat it.
  for (const item of state.appointments.filter(a => a.status === 'planned')) {
    const upcoming = !item.reminderAt && now >= item.at - 30 * 60_000 && now < item.at + 2 * 3_600_000
    const overdue = !item.followupAt && now >= item.at + 2 * 3_600_000
    if (!upcoming && !overdue) continue
    let claimed = false
    await changeSharedLife(namespace, s => ({ ...s, appointments: s.appointments.map(a => {
      if (a.id !== item.id || a.status !== 'planned' || (overdue ? a.followupAt : a.reminderAt)) return a
      claimed = true
      return overdue ? { ...a, followupAt: now, reminderAt: a.reminderAt ?? now } : { ...a, reminderAt: now }
    }) }))
    if (claimed) await useMellow.getState().pushNotice({ kind: 'toast', title: overdue ? '约定后来怎么样了？' : '约定快到了', body: `${item.title} · ${item.place} · ${new Date(item.at).toLocaleString('zh-CN')}${overdue ? '。可以记录赴约结果或改期，不会自动判定你失约。' : ''}`, appId: 'life', identityId: input.identity.id, priority: 4 })
  }

  if (isSmsProactivePaused() || inQuietHours(input.settings,new Date(now)) || input.settings.dnd || input.settings.proactiveMinutes <= 0 || useMellow.getState().pendingReplyChatId) return
  const chars = (await storage.listModernCharacters(namespace)).filter(c => !c.blocked)
  const chats = await storage.listChats(namespace)
  for (const person of chars) {
    const c = characterLife(state, person.id)
    const chat = chats.find(chat => chat.kind === 'dm' && chat.memberIds.includes(person.id) && !chat.blocked && !chat.muted && chat.allowProactive !== false)
    if (!chat || now - c.lastAttemptAt < 30 * 60_000) continue
    if (useMellow.getState().activeApp === 'messages' && useMellow.getState().viewingChatId === chat.id) continue
    const appointment=state.appointments.find(a=>a.charId===person.id&&a.status==='planned'&&((a.followupAt&&!a.characterFollowupAt)||(a.reminderAt&&!a.characterReminderAt&&now<a.at+2*3_600_000)))
    const event = state.events.find(e => e.charId === person.id && (e.announcedStage ?? 0) < e.stage) ?? state.events.find(e => e.charId === person.id && e.status === 'active')
    const latestEvent = state.events.find(e => e.charId === person.id)
    const plan = c.returnPlan ? accrueReturnPlan(c.returnPlan, now) : null
    const memory = state.keepsakes.find(k => k.charId === person.id && now - k.at >= DAY)
    const newEvent = c.autoEvents && !event && (!latestEvent || now - latestEvent.updates.at(-1)!.at >= 2 * DAY)
    const eventDue = c.autoEvents && event && ((event.announcedStage ?? 0) < event.stage || (event.status === 'active' && now >= event.nextAt))
    const giftDue = plan && plan.saved >= plan.cost
    const recallDue = c.autoEvents && memory && now - c.lastRecallAt >= 7 * DAY
    if (plan && plan.saved !== c.returnPlan?.saved) await changeSharedLife(namespace, s => {
      const current = characterLife(s, person.id)
      return { ...s, characters: { ...s.characters, [person.id]: { ...current, returnPlan: current.returnPlan ? accrueReturnPlan(current.returnPlan, now) : undefined } } }
    })
    if (!appointment && !newEvent && !eventDue && !giftDue && !recallDue) continue
    const key = jobKey(namespace, 'shared-life-tick', person.id)
    if (isAiJobRunning(key)) continue
    runAiJob(key, async () => {
      let claimed = false
      await changeSharedLife(namespace, s => {
        const fresh = characterLife(s, person.id)
        if (now - fresh.lastAttemptAt < 30 * 60_000) return s
        claimed = true
        return { ...s, characters: { ...s.characters, [person.id]: { ...fresh, lastAttemptAt: now } } }
      })
      if (!claimed) return
      try {
        let trigger = ''
        let announcedEvent: { id: string; stage: number } | undefined
        if (appointment) {
          trigger = `你和玩家的约定是${appointment.title}，地点${appointment.place}，时间${new Date(appointment.at).toLocaleString('zh-CN')}。${now>=appointment.at+2*3_600_000?'时间已过，尚未确认赴约结果。按自己的性格问问发生了什么，不自动指责玩家或声称已经失约。':'临近约定，自然地来确认一下时间地点。你可以表达期待、说明自己的安排，也可以提出改约，但未得到玩家确认不能当作新时间已经确定。'}`
        } else if (giftDue && plan) {
          trigger = `你一直在为玩家攒钱挑选${plan.name}，原因是${plan.reason}。现在终于准备好了，可以在短信中自然地送出这份虚构礼物，不索要钱，不改动玩家钱包。`
        } else if (eventDue && event) {
          const next = (event.announcedStage ?? 0) < event.stage ? state : await advanceLifeEvent(namespace, person, event.id, '', now)
          const current = next.events.find(e => e.id === event.id)!
          announcedEvent = { id: current.id, stage: current.stage }
          trigger = `你之前告诉过玩家的小事有了后续：${current.text}。自然告知进展，承接玩家原来的建议，不要再次重复起因。`
        } else if (newEvent) {
          const next = await createLifeEvent(namespace, person, now)
          const current = next.events.find(e => e.charId === person.id && e.status === 'active')!
          announcedEvent = { id: current.id, stage: current.stage }
          trigger = `你生活里刚发生一件小事：${current.text}。自然地告诉玩家，允许玩家有空再回。`
        } else if (recallDue && memory) {
          trigger = `今天你偶然想起你们真实留下的纪念：${memory.title}，${memory.text}。用一两句具体而自然的话提起，不编造照片细节。`
        }
        const reply = await replyInChat({ namespace, identity: input.identity, character: person, chat, presets: input.presets, activePresetId: modePresetId(input.settings, 'sms'), fourthWall: input.settings.fourthWall, proactive: true, triggerNote: trigger })
        if (reply.kind === 'system') return
        if (appointment) await changeSharedLife(namespace, s => ({ ...s, appointments: s.appointments.map(a => a.id === appointment.id && a.at === appointment.at ? now >= a.at + 2 * 3_600_000 ? { ...a, characterFollowupAt: now } : { ...a, characterReminderAt: now } : a) }))
        if (announcedEvent) await changeSharedLife(namespace, s => ({ ...s, events: s.events.map(e => e.id === announcedEvent!.id ? { ...e, announcedStage: Math.max(e.announcedStage ?? 0, announcedEvent!.stage) } : e) }))
        if (!appointment && giftDue && plan) await changeSharedLife(namespace, s => {
          const fresh = characterLife(s, person.id)
          if (!fresh.returnPlan || fresh.returnPlan.createdAt !== plan.createdAt) return s
          const giftId = 'return_' + person.id + '_' + plan.createdAt
          const next = { ...s, characters: { ...s.characters, [person.id]: { ...fresh, returnPlan: undefined, lastReturnAt: now } }, gifts: s.gifts.some(g => g.id === giftId) ? s.gifts : [{ id: giftId, charId: person.id, name: plan.name, from: 'character' as const, at: now, status: 'received' as const, uses: [] }, ...s.gifts] }
          return addKeepsake(next, { charId: person.id, title: plan.name, text: `${person.name}为你攒钱准备的回礼。${plan.reason}`, at: now, kind: 'gift', source: giftId })
        })
        if (!appointment && recallDue && !newEvent && !eventDue && !giftDue) await changeSharedLife(namespace, s => {
          const fresh = characterLife(s, person.id)
          return { ...s, characters: { ...s.characters, [person.id]: { ...fresh, lastRecallAt: now } } }
        })
      } catch { /* Retry after backoff; keep prior story, memory and gift plan. */ }
      finally { useMellow.getState().touchData() }
    })
    // One character per scheduler pass keeps the phone from bursting with messages.
    break
  }
}

export async function saveManualKeepsake(namespace: string, charId: string, title: string, body: string, image?: string) {
  if (!title.trim() || (!body.trim() && !image)) throw Error('请写标题，并添加文字或照片')
  if (image && (!/^data:image\/(png|jpeg|webp|gif);base64,/.test(image) || image.length > 6_000_000)) throw Error('请选择不超过4MB的 PNG、JPG、WebP 或 GIF 图片')
  return changeSharedLife(namespace, s => addKeepsake(s, { charId, title: title.trim().slice(0, 80), text: body.trim().slice(0, 2000), image, kind: image ? 'photo' : 'memory', source: uid('manual_memory'), at: Date.now() }))
}
