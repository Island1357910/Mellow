import { uid } from '../lib/id.ts'
import type { IdentitySpaceState, Scene } from '../types/index.ts'

export type SceneRefuseReason = 'location_conflict'

export interface SceneGate {
  ok: boolean
  reason?: SceneRefuseReason | 'already_there' | 'will_merge'
}

const LOCATION_LABEL: Record<string, string> = {
  home: '家',
  cafe: '咖啡馆',
  street: '街上',
  station: '车站',
  school: '学校',
  office: '办公室',
  other: '别处',
}

export function locationLabel(location: string): string {
  return LOCATION_LABEL[location] ?? location
}

/**
 * 一个身份同时只能有一个 together。
 * 已经在场的人直接通过。没有场景就可以新开。
 * 已经有场景时，只能并进当前地点，不能同时再开一个地方。
 */
export function canEnterScene(state: IdentitySpaceState, charId: string, location?: string): SceneGate {
  const scene = state.currentScene
  if (!scene) return { ok: true }
  if (scene.present.includes(charId)) return { ok: true, reason: 'already_there' }
  if (location && location !== scene.location) return { ok: false, reason: 'location_conflict' }
  return { ok: true, reason: 'will_merge' }
}

export function enterScene(
  state: IdentitySpaceState,
  charId: string,
  location: string,
): { state: IdentitySpaceState; gate: SceneGate } {
  const gate = canEnterScene(state, charId, location)
  if (!gate.ok || gate.reason === 'already_there') return { state, gate }
  if (!state.currentScene) {
    const scene: Scene = {
      id: uid('scene'),
      location,
      present: [charId],
      mode: 'together',
      startedAt: Date.now(),
      participants: ['user', charId],
    }
    return { state: { ...state, currentScene: scene }, gate }
  }
  const scene = state.currentScene
  return {
    state: {
      ...state,
      currentScene: {
        ...scene,
        present: [...scene.present, charId],
        participants: [...scene.participants, charId],
      },
    },
    gate,
  }
}

export function endScene(state: IdentitySpaceState): IdentitySpaceState {
  if (!state.currentScene) return state
  return {
    ...state,
    currentScene: null,
    history: [...state.history, state.currentScene].slice(-30),
  }
}

export function leaveScene(state: IdentitySpaceState, charId: string): IdentitySpaceState {
  const scene = state.currentScene
  if (!scene || !scene.present.includes(charId)) return state
  const present = scene.present.filter((id) => id !== charId)
  if (present.length === 0) return endScene(state)
  return {
    ...state,
    currentScene: {
      ...scene,
      present,
      participants: scene.participants.filter((id) => id !== charId),
    },
  }
}

export function describeSpace(state: IdentitySpaceState, names: Map<string, string>): string {
  if (!state.currentScene) {
    if (state.remoteChats.length === 0) return '独自。没有人在身边，也没有正在进行的远程聊天。'
    const remote = state.remoteChats.map((id) => names.get(id) ?? '某人').join('、')
    return `独自，同时在和 ${remote} 发短信。`
  }
  const who = state.currentScene.present.map((id) => names.get(id) ?? '某人').join('、')
  const place = locationLabel(state.currentScene.location)
  const remote = state.remoteChats.filter((id) => !state.currentScene?.present.includes(id))
  const remoteText =
    remote.length > 0 ? `另外还在和 ${remote.map((id) => names.get(id) ?? '某人').join('、')} 发短信。` : ''
  return `在${place}，和 ${who} 待在一起。${remoteText}`
}

export function withRemote(state: IdentitySpaceState, charId: string, active: boolean): IdentitySpaceState {
  const has = state.remoteChats.includes(charId)
  if (active === has) return state
  const remoteChats = active ? [...state.remoteChats, charId] : state.remoteChats.filter((id) => id !== charId)
  return { ...state, remoteChats }
}
