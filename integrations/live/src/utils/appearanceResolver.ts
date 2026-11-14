import {
  FONT_PRESETS,
  ICON_STYLE_PRESETS,
  WALLPAPER_PRESETS,
  type AppIconKey,
} from '../data/appearance';
import type { FontPresetId, IconStyleId, WallpaperId } from '../types';

const CUSTOM_FONT_NAME = 'ShenhaoCustomFont';

export interface AppearanceSettings {
  wallpaperId: WallpaperId;
  customWallpaperUrl: string;
  fontId: FontPresetId;
  customFontUrl: string;
  iconStyleId: IconStyleId;
  customIconUrls: Partial<Record<AppIconKey, string>>;
}

function resolveWallpaperStyle(s: AppearanceSettings): string | null {
  if (s.wallpaperId === 'custom' && s.customWallpaperUrl.trim()) {
    return `url("${s.customWallpaperUrl.trim()}") center/cover no-repeat`;
  }
  if (s.wallpaperId !== 'custom') {
    const preset = WALLPAPER_PRESETS[s.wallpaperId as keyof typeof WALLPAPER_PRESETS];
    if (!preset) return WALLPAPER_PRESETS.photo6.home;
    if (preset.imageUrl) {
      return `url("${preset.imageUrl}") center/cover no-repeat`;
    }
    return preset.home;
  }
  return null;
}

export function resolveShellBackground(s: AppearanceSettings): string {
  const resolved = resolveWallpaperStyle(s);
  if (resolved) return resolved;
  return WALLPAPER_PRESETS.dawn.shell;
}

export function resolveHomeBackground(s: AppearanceSettings): string {
  const resolved = resolveWallpaperStyle(s);
  if (resolved) return resolved;
  return WALLPAPER_PRESETS.dawn.home;
}

export function resolveWallpaperLabel(s: AppearanceSettings): string {
  if (s.wallpaperId === 'custom') return '自定义壁纸';
  const preset = WALLPAPER_PRESETS[s.wallpaperId as keyof typeof WALLPAPER_PRESETS];
  return preset?.label ?? '主屏·默认';
}

export function resolveFontFamily(s: AppearanceSettings): string {
  if (s.fontId === 'custom' && s.customFontUrl.trim()) {
    return `"${CUSTOM_FONT_NAME}", "PingFang SC", "Microsoft YaHei", sans-serif`;
  }
  const id = s.fontId === 'custom' ? 'default' : s.fontId;
  return FONT_PRESETS[id as keyof typeof FONT_PRESETS]?.family ?? FONT_PRESETS.default.family;
}

export function injectCustomFont(url: string): void {
  const trimmed = url.trim();
  if (!trimmed) return;
  const id = 'shenhao-custom-font-face';
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = `@font-face{font-family:"${CUSTOM_FONT_NAME}";src:url("${trimmed}");font-display:swap;}`;
}

export function resolveAppIcon(
  key: AppIconKey,
  s: AppearanceSettings
): { kind: 'emoji'; value: string } | { kind: 'image'; url: string } {
  if (s.iconStyleId === 'custom') {
    const url = s.customIconUrls[key]?.trim();
    if (url) return { kind: 'image', url };
  }
  const presetId = s.iconStyleId === 'custom' ? 'classic' : s.iconStyleId;
  const preset = ICON_STYLE_PRESETS[presetId as keyof typeof ICON_STYLE_PRESETS] ?? ICON_STYLE_PRESETS.classic;
  return { kind: 'emoji', value: preset.icons[key] ?? '📱' };
}

export function resolveWallpaperImageUrl(s: AppearanceSettings): string | null {
  if (s.wallpaperId === 'custom' && s.customWallpaperUrl.trim()) {
    return s.customWallpaperUrl.trim();
  }
  if (s.wallpaperId !== 'custom') {
    const preset = WALLPAPER_PRESETS[s.wallpaperId as keyof typeof WALLPAPER_PRESETS];
    return preset?.imageUrl ?? null;
  }
  return null;
}
