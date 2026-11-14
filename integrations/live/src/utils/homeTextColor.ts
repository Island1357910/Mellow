import { HOME_TEXT_COLOR_PRESETS } from '../data/appearance';
import type { HomeTextColorId } from '../types';

export interface HomeTextColors {
  main: string;
  sub: string;
  label: string;
  useStyle: boolean;
}

function autoColors(isDark: boolean): HomeTextColors {
  return isDark
    ? { main: '#f1f5f9', sub: '#cbd5e1', label: '#e2e8f0', useStyle: true }
    : { main: '#334155', sub: '#64748b', label: '#475569', useStyle: true };
}

function fromHex(hex: string): HomeTextColors {
  const main = hex.trim();
  return {
    main,
    sub: main,
    label: main,
    useStyle: true,
  };
}

export function resolveHomeTextColors(
  colorId: HomeTextColorId,
  customColor: string,
  isDarkWallpaper: boolean
): HomeTextColors {
  if (colorId === 'auto') {
    return autoColors(isDarkWallpaper);
  }
  if (colorId === 'custom') {
    const hex = customColor.trim();
    if (/^#[0-9a-fA-F]{3,8}$/.test(hex)) return fromHex(hex);
    return autoColors(isDarkWallpaper);
  }
  const preset = HOME_TEXT_COLOR_PRESETS[colorId];
  return {
    main: preset.main,
    sub: preset.sub,
    label: preset.labelColor,
    useStyle: true,
  };
}
