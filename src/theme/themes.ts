import { uid } from '../lib/id.ts'
import type { Theme, ThemeColors } from '../types/index.ts'

const radius = { sm: '12px', md: '18px', lg: '26px', xl: '36px' }
const shadow = {
  sm: '0 6px 16px rgba(180, 140, 150, 0.12)',
  md: '0 18px 40px rgba(180, 140, 150, 0.16)',
  lg: '0 30px 70px rgba(176, 132, 142, 0.22)',
}
const font = {
  body: '"Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  display: '"Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
}

function theme(id: string, name: string, colors: ThemeColors): Theme {
  return { id, name, colors, radius, shadow, font }
}

/** 饱和度压在马卡龙区间，不使用纯色荧光。 */
export const BUNDLED_THEMES: Theme[] = [
  theme('theme_macaron', '马卡龙', {
    primary: '#FFB5C5',
    secondary: '#B5E8D5',
    background: '#FDFBF7',
    surface: '#FFFAF6',
    text: '#3A3A3A',
    textSecondary: '#6B6B6B',
    accent: '#FF9B7A',
    success: '#8ECFB4',
    warning: '#E7C56A',
    error: '#E7A0A0',
  }),
  theme('theme_mint', '薄荷晨雾', {
    primary: '#B7E4D4',
    secondary: '#D5C5F0',
    background: '#F7FBFA',
    surface: '#FFFFFF',
    text: '#3A3A3A',
    textSecondary: '#6B6B6B',
    accent: '#F0C3A8',
    success: '#9ED4C2',
    warning: '#E6D39A',
    error: '#E7B4B4',
  }),
  theme('theme_lilac', '薰衣草页边', {
    primary: '#D5C5F0',
    secondary: '#FFD0DC',
    background: '#F7F4FB',
    surface: '#FDFBFF',
    text: '#3D3A45',
    textSecondary: '#6E6878',
    accent: '#E7B7C8',
    success: '#B7DCCB',
    warning: '#E6D3A1',
    error: '#E4B0B8',
  }),
]

const COLOR_KEYS: Array<keyof ThemeColors> = [
  'primary',
  'secondary',
  'background',
  'surface',
  'text',
  'textSecondary',
  'accent',
  'success',
  'warning',
  'error',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function themeFromUnknown(raw: unknown): Theme | null {
  if (!isRecord(raw) || !isRecord(raw.colors)) return null
  const colors = {} as ThemeColors
  for (const key of COLOR_KEYS) {
    const value = raw.colors[key]
    if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) return null
    colors[key] = value
  }
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : '导入的主题'
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : uid('theme')
  return {
    ...theme(id, name, colors),
    ...(isRecord(raw.radius) ? { radius: { ...radius, ...stringFields(raw.radius, radius) } } : {}),
    ...(isRecord(raw.shadow) ? { shadow: { ...shadow, ...stringFields(raw.shadow, shadow) } } : {}),
    ...(isRecord(raw.font) ? { font: { ...font, ...stringFields(raw.font, font) } } : {}),
  }
}

function stringFields<T extends Record<string, string>>(source: Record<string, unknown>, fallback: T): T {
  const next = { ...fallback }
  for (const key of Object.keys(fallback) as Array<keyof T>) {
    const value = source[key as string]
    if (typeof value === 'string') next[key] = value as T[keyof T]
  }
  return next
}
