import { useEffect } from 'react';
import { useSettingsStore } from '../stores/useSettingsStore';
import {
  injectCustomFont,
  resolveFontFamily,
  resolveShellBackground,
} from '../utils/appearanceResolver';

/** 将壁纸、字体设置应用到 document */
export function useApplyTheme() {
  const wallpaperId = useSettingsStore((s) => s.wallpaperId);
  const customWallpaperUrl = useSettingsStore((s) => s.customWallpaperUrl);
  const fontId = useSettingsStore((s) => s.fontId);
  const customFontUrl = useSettingsStore((s) => s.customFontUrl);

  useEffect(() => {
    const settings = useSettingsStore.getState();
    const fontFamily = resolveFontFamily(settings);
    const shellBg = resolveShellBackground(settings);

    if (fontId === 'custom' && customFontUrl.trim()) {
      injectCustomFont(customFontUrl);
    }

    document.documentElement.style.setProperty('--font-sans', fontFamily);
    document.documentElement.style.setProperty('--shell-bg', shellBg);
    document.body.style.fontFamily = fontFamily;
  }, [wallpaperId, customWallpaperUrl, fontId, customFontUrl]);
}
