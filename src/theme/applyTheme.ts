import type { CSSProperties } from 'react'
import type { Theme } from '../types/index.ts'

export function themePack(id: string): string | undefined {
  return ({ theme_red_apple_love: 'apple', theme_winter_cocoa: 'cocoa', theme_ice_early_winter: 'ice', theme_no_needles_day: 'clinic' } as Record<string, string>)[id]
}

export function themeStyle(theme: Theme): CSSProperties {
  const logo = theme.logo ?? (theme.id === 'theme_halloween' ? {primary:'#E3A667',secondary:'#AA8EBA',accent:'#C4BE90'} : {primary:'#FFB5C5',secondary:'#B5E8D5',accent:'#FFE5A0'})
  return {
    '--m-logo-primary': logo.primary,
    '--m-logo-secondary': logo.secondary,
    '--m-logo-accent': logo.accent,
    '--m-primary': theme.colors.primary,
    '--m-secondary': theme.colors.secondary,
    '--m-background': theme.colors.background,
    '--m-surface': theme.colors.surface,
    '--m-text': theme.colors.text,
    '--m-text-secondary': theme.colors.textSecondary,
    '--m-accent': theme.colors.accent,
    '--m-accent-soft': theme.colors.primary,
    '--m-success': theme.colors.success,
    '--m-warning': theme.colors.warning,
    '--m-error': theme.colors.error,
    '--m-radius': theme.radius.lg,
    '--m-shadow': theme.shadow.md,
    '--m-font': theme.font.body,
  } as CSSProperties
}
