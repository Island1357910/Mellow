import type { Theme } from '../types/index.ts'
import { BUNDLED_THEMES } from './themes.ts'

const base = BUNDLED_THEMES.find((theme) => theme.id === 'theme_macaron')!
export const CLINIC_THEME: Theme = {
  ...base,
  id: 'theme_no_needles_day',
  name: '为了不用打针的每一天',
  customPalette: true,
  logo: { primary: '#EBA4B4', secondary: '#A85A6A', accent: '#FFF4EE' },
  colors: {
    primary: '#F5C4CF',
    secondary: '#FBE3D7',
    background: '#FFF8F7',
    surface: '#FFFEFC',
    text: '#52343D',
    textSecondary: '#76515A',
    accent: '#A24F60',
    success: '#99B7A6',
    warning: '#EBC5AC',
    error: '#DB8595',
  },
  shadow: {
    sm: '0 5px 14px #A24F6012',
    md: '0 12px 30px #A24F6016',
    lg: '0 22px 48px #A24F6020',
  },
}
export const CLINIC_GIFT = {
  code: '零故崽身体健康',
  id: 'no_needles_day',
  coins: 1500,
  theme: CLINIC_THEME,
  description: '嫩粉和浅肤色罩着一层薄雾。听诊器、输液袋和心电线描淡淡地浮在后面。',
} as const
