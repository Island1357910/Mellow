import type { CSSProperties } from 'react'
import type { Theme } from '../types/index.ts'

export function themeStyle(theme: Theme): CSSProperties {
  return {
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
