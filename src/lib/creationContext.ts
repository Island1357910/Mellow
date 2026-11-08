import type { Identity } from '../types/index.ts'

export type CreationIdentity = Pick<Identity, 'name' | 'persona'>

export function creationIdentityContext(identity?: CreationIdentity): string {
  if (!identity) return ''
  return `【当前玩家身份，仅作创作参考】\n${JSON.stringify({ name: identity.name, persona: identity.persona })}\n按用户要求参考玩家设定来写关系、视角和开场。保留玩家的身份，不要把玩家当成要生成的角色，也不要替玩家说话或行动。\n\n`
}
