import type { Theme } from '../types/index.ts'
import { BUNDLED_THEMES } from './themes.ts'

const base = BUNDLED_THEMES.find(theme => theme.id === 'theme_macaron')!
export const COCOA_THEME: Theme = {
  ...base, id: 'theme_winter_cocoa', name: '热可可与甜面包', customPalette: true,
  logo: { primary: '#CA8244', secondary: '#70452F', accent: '#F0D799' },
  colors: { primary: '#D99351', secondary: '#F5DFA3', background: '#FFF5DF', surface: '#FFFAED', text: '#493023', textSecondary: '#80604A', accent: '#805139', success: '#74835A', warning: '#BA7C29', error: '#B95348' },
  shadow: { sm: '0 5px 16px #70452F15', md: '0 12px 32px #70452F20', lg: '0 22px 48px #70452F28' },
}
export const ICE_THEME: Theme = {
  ...base, id: 'theme_ice_early_winter', name: '冰蓝色初冬', customPalette: true,
  logo: { primary: '#75B8D8', secondary: '#304D70', accent: '#C4E4F5' },
  colors: { primary: '#92CDE7', secondary: '#D7EBF7', background: '#F1F8FD', surface: '#FAFDFF', text: '#233E5B', textSecondary: '#536F89', accent: '#456F96', success: '#568C92', warning: '#AD854B', error: '#B15F7B' },
  shadow: { sm: '0 5px 16px #436F9812', md: '0 12px 32px #436F981B', lg: '0 22px 48px #436F9824' },
}
export const WINTER_GIFTS = [
  { code: '冬天来一杯热可可吧！', id: 'winter_cocoa_2026', theme: COCOA_THEME, description: '暖橙、浅黄与巧克力色，热可可、面包和甜点陪你过冬。' },
  { code: '冰蓝色初冬', id: 'ice_early_winter_2026', theme: ICE_THEME, description: '冰蓝、浅白与墨蓝的通透冬日，点缀雪花、雪人和云朵。' },
] as const
