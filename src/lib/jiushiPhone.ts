export type JiushiPhoneAppId = 'chuanshu' | 'rumu' | 'worldbook' | 'worldforge' | 'roster' | 'setup'

export interface JiushiPhoneApp {
  id: JiushiPhoneAppId
  name: string
  blurb: string
  tint: string
}

export const JIUSHI_PHONE_APPS: JiushiPhoneApp[] = [
  { id: 'chuanshu', name: '传书', blurb: '短笺尺素', tint: '#D4C4A8' },
  { id: 'rumu', name: '入幕', blurb: '话本演绎', tint: '#C8B896' },
  { id: 'worldbook', name: '世界书', blurb: '山河设定', tint: '#E8DCC8' },
  { id: 'worldforge', name: '世界搭建', blurb: '大世界入境', tint: '#B8A888' },
  { id: 'roster', name: '人物', blurb: '纳入名册', tint: '#DED0BC' },
  { id: 'setup', name: '穿书', blurb: '身份记忆', tint: '#E5D9C6' },
]

export function jiushiStoryNs(phoneNamespace: string): string {
  return `${phoneNamespace}__jiushi`
}

export function jiushiWorldNs(phoneNamespace: string): string {
  return `${phoneNamespace}__jiushi`
}
