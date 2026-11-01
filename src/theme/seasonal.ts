import type { Theme } from '../types/index.ts'
import { BUNDLED_THEMES } from './themes.ts'

/** 节日只覆盖展示，不写入设置；以玩家设备所在地日期为准。 */
export function effectiveTheme(selected: Theme, date = new Date()): Theme {
  if (date.getMonth() !== 9 || date.getDate() !== 31) return selected
  const halloween = BUNDLED_THEMES.find(t => t.id === 'theme_halloween')!
  return { ...halloween, wallpaper: selected.wallpaper, fontData: selected.fontData, font: selected.font, customPalette: true, effect: 'mist' }
}
