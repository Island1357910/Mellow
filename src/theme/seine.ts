import type { Theme } from '../types/index.ts'
import { BUNDLED_THEMES } from './themes.ts'

export const SEINE_THEME_ID = 'theme_seine_riverside'
const base = BUNDLED_THEMES.find(theme => theme.id === 'theme_macaron')!

export const SEINE_THEME: Theme = {
  ...base,
  id: SEINE_THEME_ID,
  name: '塞纳河畔',
  customPalette: true,
  logo: { primary: '#88A4B9', secondary: '#819678', accent: '#E7D8AB' },
  colors: {
    primary: '#A7BDCF', secondary: '#CBD5BD', background: '#F1F3EA',
    surface: '#F9FAF2', text: '#273B32', textSecondary: '#4B5E53',
    accent: '#456457', success: '#42664E', warning: '#86642F', error: '#A04E50',
  },
  shadow: { sm: '0 3px 10px #253D3218', md: '0 8px 24px #253D3226', lg: '0 16px 42px #253D3233' },
}

export const LAUNCH_GIFTS = [
  { code: '2.0版本堂堂来袭', id: 'launch_2_seine', coins: 3000, theme: SEINE_THEME },
  { code: '神豪直播间', id: 'launch_2_live', coins: 10000, theme: undefined },
  { code: '千味面包房', id: 'launch_2_bakery', coins: 2000, theme: undefined },
] as const
