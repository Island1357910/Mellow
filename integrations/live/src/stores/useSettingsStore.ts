import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbJSONStorage } from '../utils/storage';
import {
  DEFAULT_RECENT_APPS,
  DEFAULT_FONT_URL,
  DEFAULT_WIDGET_BOTTOM_IMAGE,
  DEFAULT_WIDGET_TOP_IMAGE,
  HOME_APP_KEYS,
  LEGACY_WIDGET_BOTTOM_IMAGES,
  LEGACY_WIDGET_TOP_IMAGES,
  migrateWidgetImageUrl,
  type AppIconKey,
} from '../data/appearance';
import { createAssetId } from '../utils/fileImport';
import type {
  AiInteractionMode,
  FontPresetId,
  HomeTextColorId,
  IconStyleId,
  ImportedAsset,
  PlayerPersona,
  WallpaperId,
} from '../types';

interface SettingsState {
  wallpaperId: WallpaperId;
  customWallpaperUrl: string;
  fontId: FontPresetId;
  customFontUrl: string;
  iconStyleId: IconStyleId;
  customIconUrls: Partial<Record<AppIconKey, string>>;
  playerPersona: PlayerPersona;
  /** AI 互动模式：主动推演 / 被动响应 */
  aiInteractionMode: AiInteractionMode;

  widgetTopImageUrl: string;
  widgetBottomImageUrl: string;
  importedImages: ImportedAsset[];
  importedFonts: ImportedAsset[];
  recentAppKeys: AppIconKey[];

  homeTextColorId: HomeTextColorId;
  customHomeTextColor: string;
  homeDesktopPage: 0 | 1;

  /** 各主播私信聊天背景（预设 id 或图片 url） */
  chatBackgrounds: Record<string, string>;

  setWallpaper: (id: WallpaperId) => void;
  setCustomWallpaperUrl: (url: string) => void;
  setFont: (id: FontPresetId) => void;
  setCustomFontUrl: (url: string) => void;
  setIconStyle: (id: IconStyleId) => void;
  setCustomIconUrl: (key: AppIconKey, url: string) => void;
  setPlayerPersona: (persona: Partial<PlayerPersona>) => void;
  setAiInteractionMode: (mode: AiInteractionMode) => void;
  setWidgetImage: (slot: 'top' | 'bottom', url: string) => void;
  addImportedImage: (name: string, dataUrl: string) => ImportedAsset;
  removeImportedImage: (id: string) => void;
  addImportedFont: (name: string, dataUrl: string) => ImportedAsset;
  removeImportedFont: (id: string) => void;
  applyImportedFont: (id: string) => void;
  recordAppOpen: (key: AppIconKey) => void;
  setHomeTextColor: (id: HomeTextColorId) => void;
  setCustomHomeTextColor: (color: string) => void;
  setHomeDesktopPage: (page: 0 | 1) => void;
  setChatBackground: (anchorId: string, bg: string) => void;
}

const DEFAULT_PERSONA: PlayerPersona = {
  title: '神秘金主',
  bio: '低调出手、品味独到的女性金主，享受被主播讨好的态度。',
  style: '从容、有主见，喜欢被温柔对待，偶尔会用打赏表达态度。',
};

function bumpRecent(keys: AppIconKey[], key: AppIconKey): AppIconKey[] {
  const next = [key, ...keys.filter((k) => k !== key)];
  return next.slice(0, 4);
}

const VALID_APP_KEYS = new Set<AppIconKey>(HOME_APP_KEYS);

function sanitizeRecentApps(keys: unknown): AppIconKey[] {
  const filtered: AppIconKey[] = [];
  if (Array.isArray(keys)) {
    for (const k of keys) {
      if (typeof k === 'string' && VALID_APP_KEYS.has(k as AppIconKey)) {
        filtered.push(k as AppIconKey);
      }
    }
  }
  if (filtered.length === 0) return DEFAULT_RECENT_APPS.slice();
  // 确保音乐仍可出现在最近使用里：若被旧存档挤掉且列表不足 4 个则补上
  if (!filtered.includes('music') && filtered.length < 4) {
    filtered.push('music');
  }
  return filtered.slice(0, 4);
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      wallpaperId: 'photo6',
      customWallpaperUrl: '',
      fontId: 'heiti',
      customFontUrl: DEFAULT_FONT_URL,
      iconStyleId: 'classic',
      customIconUrls: {},
      playerPersona: DEFAULT_PERSONA,
      aiInteractionMode: 'active',
      widgetTopImageUrl: DEFAULT_WIDGET_TOP_IMAGE,
      widgetBottomImageUrl: DEFAULT_WIDGET_BOTTOM_IMAGE,
      importedImages: [],
      importedFonts: [],
      recentAppKeys: DEFAULT_RECENT_APPS,
      homeTextColorId: 'black',
      customHomeTextColor: '#ffffff',
      homeDesktopPage: 0,
      chatBackgrounds: {},

      setWallpaper: (id) => set({ wallpaperId: id }),
      setCustomWallpaperUrl: (url) => set({ customWallpaperUrl: url, wallpaperId: 'custom' }),
      setFont: (id) => set({ fontId: id }),
      setCustomFontUrl: (url) => set({ customFontUrl: url, fontId: 'custom' }),
      setIconStyle: (id) => set({ iconStyleId: id }),
      setCustomIconUrl: (key, url) =>
        set((state) => ({
          iconStyleId: 'custom',
          customIconUrls: { ...state.customIconUrls, [key]: url },
        })),
      setPlayerPersona: (persona) =>
        set((state) => ({
          playerPersona: { ...state.playerPersona, ...persona },
        })),
      setAiInteractionMode: (mode) => set({ aiInteractionMode: mode }),
      setWidgetImage: (slot, url) =>
        set(slot === 'top' ? { widgetTopImageUrl: url } : { widgetBottomImageUrl: url }),
      addImportedImage: (name, dataUrl) => {
        const asset: ImportedAsset = { id: createAssetId(), name, dataUrl, createdAt: Date.now() };
        set((state) => ({ importedImages: [asset, ...(state.importedImages ?? [])] }));
        return asset;
      },
      removeImportedImage: (id) =>
        set((state) => ({ importedImages: (state.importedImages ?? []).filter((a) => a.id !== id) })),
      addImportedFont: (name, dataUrl) => {
        const asset: ImportedAsset = { id: createAssetId(), name, dataUrl, createdAt: Date.now() };
        set((state) => ({ importedFonts: [asset, ...(state.importedFonts ?? [])] }));
        return asset;
      },
      removeImportedFont: (id) => {
        const state = get();
        const fonts = state.importedFonts ?? [];
        const removed = fonts.find((a) => a.id === id);
        const next = fonts.filter((a) => a.id !== id);
        const patch: Partial<SettingsState> = { importedFonts: next };
        if (state.fontId === 'custom' && removed && state.customFontUrl === removed.dataUrl) {
          patch.fontId = 'default';
          patch.customFontUrl = '';
        }
        set(patch);
      },
      applyImportedFont: (id) => {
        const asset = (get().importedFonts ?? []).find((a) => a.id === id);
        if (!asset) return;
        set({ fontId: 'custom', customFontUrl: asset.dataUrl });
      },
      recordAppOpen: (key) =>
        set((state) => ({
          recentAppKeys: bumpRecent(state.recentAppKeys ?? DEFAULT_RECENT_APPS, key),
        })),
      setHomeTextColor: (id) => set({ homeTextColorId: id }),
      setCustomHomeTextColor: (color) => set({ customHomeTextColor: color, homeTextColorId: 'custom' }),
      setHomeDesktopPage: (page) => set({ homeDesktopPage: page }),
      setChatBackground: (anchorId, bg) =>
        set((state) => ({
          chatBackgrounds: { ...state.chatBackgrounds, [anchorId]: bg },
        })),
    }),
    {
      name: 'shenhao_settings',
      storage: idbJSONStorage,
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<SettingsState>;
        const merged = {
          ...current,
          ...saved,
          customIconUrls: saved.customIconUrls ?? current.customIconUrls,
          playerPersona: { ...current.playerPersona, ...saved.playerPersona },
          aiInteractionMode:
            saved.aiInteractionMode === 'passive' || saved.aiInteractionMode === 'active'
              ? saved.aiInteractionMode
              : current.aiInteractionMode,
          widgetTopImageUrl: migrateWidgetImageUrl(
            saved.widgetTopImageUrl,
            LEGACY_WIDGET_TOP_IMAGES,
            DEFAULT_WIDGET_TOP_IMAGE,
            current.widgetTopImageUrl
          ),
          widgetBottomImageUrl: migrateWidgetImageUrl(
            saved.widgetBottomImageUrl,
            LEGACY_WIDGET_BOTTOM_IMAGES,
            DEFAULT_WIDGET_BOTTOM_IMAGE,
            current.widgetBottomImageUrl
          ),
          importedImages: Array.isArray(saved.importedImages) ? saved.importedImages : current.importedImages,
          importedFonts: Array.isArray(saved.importedFonts) ? saved.importedFonts : current.importedFonts,
          recentAppKeys: sanitizeRecentApps(
            Array.isArray(saved.recentAppKeys) ? saved.recentAppKeys : current.recentAppKeys
          ),
          homeTextColorId: saved.homeTextColorId ?? current.homeTextColorId,
          customHomeTextColor: saved.customHomeTextColor ?? current.customHomeTextColor,
          homeDesktopPage: saved.homeDesktopPage === 1 ? 1 : saved.homeDesktopPage === 0 ? 0 : current.homeDesktopPage,
          chatBackgrounds: saved.chatBackgrounds ?? current.chatBackgrounds,
        };
        return merged;
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const patch: Partial<SettingsState> = {};
        if (state.wallpaperId === 'photo6' && state.homeTextColorId === 'auto') {
          patch.homeTextColorId = 'black';
        }
        if (
          state.fontId === 'custom' &&
          (!state.customFontUrl || state.customFontUrl === DEFAULT_FONT_URL)
        ) {
          patch.fontId = 'heiti';
        }
        const top = migrateWidgetImageUrl(
          state.widgetTopImageUrl,
          LEGACY_WIDGET_TOP_IMAGES,
          DEFAULT_WIDGET_TOP_IMAGE,
          DEFAULT_WIDGET_TOP_IMAGE
        );
        const bottom = migrateWidgetImageUrl(
          state.widgetBottomImageUrl,
          LEGACY_WIDGET_BOTTOM_IMAGES,
          DEFAULT_WIDGET_BOTTOM_IMAGE,
          DEFAULT_WIDGET_BOTTOM_IMAGE
        );
        if (top !== state.widgetTopImageUrl) patch.widgetTopImageUrl = top;
        if (bottom !== state.widgetBottomImageUrl) patch.widgetBottomImageUrl = bottom;
        if (Object.keys(patch).length > 0) {
          useSettingsStore.setState(patch);
        }
      },
    }
  )
);

export function getPlayerPersona(): PlayerPersona {
  return useSettingsStore.getState().playerPersona;
}

export function getAppearanceSettings() {
  const s = useSettingsStore.getState();
  return {
    wallpaperId: s.wallpaperId,
    customWallpaperUrl: s.customWallpaperUrl,
    fontId: s.fontId,
    customFontUrl: s.customFontUrl,
    iconStyleId: s.iconStyleId,
    customIconUrls: s.customIconUrls,
  };
}
