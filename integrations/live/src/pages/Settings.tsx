import { useEffect, useMemo, useState } from 'react';
import StatusBar from '../components/Phone/StatusBar';
import ScreenHeader from '../components/Common/ScreenHeader';
import CategoryTabs from '../components/Commerce/CategoryTabs';
import {
  WALLPAPER_PRESETS,
  FONT_PRESETS,
  ICON_STYLE_PRESETS,
  APP_LABELS,
  HOME_APP_KEYS,
  DEFAULT_WIDGET_TOP_IMAGE,
  DEFAULT_WIDGET_BOTTOM_IMAGE,
  HOME_TEXT_COLOR_PRESETS,
} from '../data/appearance';
import { useSettingsStore } from '../stores/useSettingsStore';
import { usePlayerStore } from '../stores/usePlayerStore';
import { useGameTimeStore } from '../stores/useGameTimeStore';
import { useNavStore } from '../stores/useNavStore';
import {
  deleteSlot,
  listSaveSlots,
  loadFromSlot,
  saveToSlot,
  startNewGame,
  type SaveSlotMeta,
} from '../utils/saveManager';
import type { AppIconKey } from '../data/appearance';
import type { FontPresetId, HomeTextColorId, IconStyleId, WallpaperId, AiInteractionMode } from '../types';
import {
  MAX_FONT_IMPORT_BYTES,
  MAX_IMAGE_IMPORT_BYTES,
  formatFileSize,
  readFileAsDataUrl,
} from '../utils/fileImport';

const SETTINGS_TABS = ['外观', '桌面', '资源', '角色', '存档'] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

export default function Settings() {
  const back = useNavStore((s) => s.back);
  const goHome = useNavStore((s) => s.goHome);

  const wallpaperId = useSettingsStore((s) => s.wallpaperId);
  const fontId = useSettingsStore((s) => s.fontId);
  const iconStyleId = useSettingsStore((s) => s.iconStyleId);
  const playerPersona = useSettingsStore((s) => s.playerPersona);
  const aiInteractionMode = useSettingsStore((s) => s.aiInteractionMode);
  const setWallpaper = useSettingsStore((s) => s.setWallpaper);
  const setCustomWallpaperUrl = useSettingsStore((s) => s.setCustomWallpaperUrl);
  const setFont = useSettingsStore((s) => s.setFont);
  const setCustomFontUrl = useSettingsStore((s) => s.setCustomFontUrl);
  const setIconStyle = useSettingsStore((s) => s.setIconStyle);
  const setCustomIconUrl = useSettingsStore((s) => s.setCustomIconUrl);
  const customWallpaperUrl = useSettingsStore((s) => s.customWallpaperUrl);
  const customFontUrl = useSettingsStore((s) => s.customFontUrl);
  const customIconUrls = useSettingsStore((s) => s.customIconUrls);
  const setPlayerPersona = useSettingsStore((s) => s.setPlayerPersona);
  const setAiInteractionMode = useSettingsStore((s) => s.setAiInteractionMode);
  const widgetTopImageUrl = useSettingsStore((s) => s.widgetTopImageUrl);
  const widgetBottomImageUrl = useSettingsStore((s) => s.widgetBottomImageUrl);
  const importedImages = useSettingsStore((s) => s.importedImages);
  const importedFonts = useSettingsStore((s) => s.importedFonts);
  const setWidgetImage = useSettingsStore((s) => s.setWidgetImage);
  const addImportedImage = useSettingsStore((s) => s.addImportedImage);
  const removeImportedImage = useSettingsStore((s) => s.removeImportedImage);
  const addImportedFont = useSettingsStore((s) => s.addImportedFont);
  const removeImportedFont = useSettingsStore((s) => s.removeImportedFont);
  const applyImportedFont = useSettingsStore((s) => s.applyImportedFont);
  const homeTextColorId = useSettingsStore((s) => s.homeTextColorId) ?? 'auto';
  const customHomeTextColor = useSettingsStore((s) => s.customHomeTextColor) ?? '#ffffff';
  const setHomeTextColor = useSettingsStore((s) => s.setHomeTextColor);
  const setCustomHomeTextColor = useSettingsStore((s) => s.setCustomHomeTextColor);

  const [tab, setTab] = useState<SettingsTab>('外观');
  const [wallpaperUrlDraft, setWallpaperUrlDraft] = useState(customWallpaperUrl);
  const [fontUrlDraft, setFontUrlDraft] = useState(customFontUrl);
  const [iconUrlDrafts, setIconUrlDrafts] = useState<Partial<Record<AppIconKey, string>>>(customIconUrls);
  const [widgetTopDraft, setWidgetTopDraft] = useState(widgetTopImageUrl);
  const [widgetBottomDraft, setWidgetBottomDraft] = useState(widgetBottomImageUrl);

  const playerName = usePlayerStore((s) => s.playerName);
  const [nameDraft, setNameDraft] = useState(playerName || '');
  const [toast, setToast] = useState('');
  const [slotMeta, setSlotMeta] = useState<(SaveSlotMeta | null)[]>([null, null, null]);

  const refreshSlots = () => {
    void listSaveSlots().then(setSlotMeta);
  };

  useEffect(() => {
    refreshSlots();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  const personaFields = useMemo(
    () => [
      { key: 'title' as const, label: '称号', placeholder: '例：神秘金主' },
      { key: 'bio' as const, label: '背景', placeholder: '你的身份与来历…' },
      { key: 'style' as const, label: '性格风格', placeholder: '主播该如何与你相处…' },
    ],
    []
  );

  const handleSaveName = () => {
    const trimmed = nameDraft.trim() || '神秘女王';
    usePlayerStore.setState({ playerName: trimmed });
    showToast('昵称已保存');
  };

  const handleSaveSlot = (slot: number) => {
    const clock = useGameTimeStore.getState().getClock();
    void saveToSlot(slot, {
      label: `存档 ${slot + 1}`,
      playerName: usePlayerStore.getState().playerName || '神秘女王',
      gameDay: clock.day + 1,
    }).then(() => {
      refreshSlots();
      showToast(`已保存到存档 ${slot + 1}`);
    }).catch(() => {
      showToast('保存失败');
    });
  };

  const handleLoadSlot = (slot: number) => {
    void loadFromSlot(slot).then((ok) => {
      if (!ok) {
        showToast('该槽位暂无存档');
        return;
      }
      window.location.reload();
    }).catch(() => {
      showToast('读档失败');
    });
  };

  const handleNewGame = () => {
    if (!window.confirm('确定开启新档？当前未保存的进度将丢失（设置、音乐与导入资源可保留）。')) return;
    void startNewGame(false).then(() => {
      window.location.reload();
    }).catch(() => {
      showToast('开启新档失败');
    });
  };

  const handleImportImage = async (file: File | null) => {
    if (!file || !file.type.startsWith('image/')) {
      showToast('请选择图片文件');
      return;
    }
    if (file.size > MAX_IMAGE_IMPORT_BYTES) {
      showToast(`图片请小于 ${formatFileSize(MAX_IMAGE_IMPORT_BYTES)}`);
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      addImportedImage(file.name, dataUrl);
      showToast('图片已导入到本地库');
    } catch {
      showToast('导入失败');
    }
  };

  const handleImportFont = async (file: File | null) => {
    if (!file) return;
    const ok = /\.(woff2?|ttf|otf)$/i.test(file.name) || file.type.includes('font');
    if (!ok) {
      showToast('请选择字体文件 (.woff2 / .ttf / .otf)');
      return;
    }
    if (file.size > MAX_FONT_IMPORT_BYTES) {
      showToast(`字体请小于 ${formatFileSize(MAX_FONT_IMPORT_BYTES)}`);
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const asset = addImportedFont(file.name, dataUrl);
      applyImportedFont(asset.id);
      showToast('字体已导入并应用');
    } catch {
      showToast('导入失败');
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <StatusBar />
      <ScreenHeader title="设置" onBack={back} />
      <CategoryTabs
        categories={[...SETTINGS_TABS]}
        active={tab}
        onChange={(next) => setTab(next as SettingsTab)}
        activeClassName="bg-pink-400 text-white shadow-sm"
        inactiveClassName="bg-white text-slate-500 border border-blue-100"
      />

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4">
        {tab === '外观' && (
          <>
            <Section title="壁纸">
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(WALLPAPER_PRESETS) as Exclude<WallpaperId, 'custom'>[]).map((id) => {
                  const preset = WALLPAPER_PRESETS[id];
                  const previewStyle = preset.imageUrl
                    ? { backgroundImage: `url(${preset.imageUrl})`, backgroundSize: 'cover' as const }
                    : { background: preset.home };
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setWallpaper(id)}
                      className={`overflow-hidden rounded-xl border-2 p-2 text-left transition ${
                        wallpaperId === id ? 'border-pink-400 ring-2 ring-pink-100' : 'border-transparent'
                      }`}
                    >
                      <div className="h-14 rounded-lg" style={previewStyle} />
                      <p className="mt-1.5 text-[11px] font-medium text-slate-600">{preset.label}</p>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setWallpaper('custom')}
                  className={`overflow-hidden rounded-xl border-2 p-2 text-left transition ${
                    wallpaperId === 'custom' ? 'border-pink-400 ring-2 ring-pink-100' : 'border-transparent'
                  }`}
                >
                  <div
                    className="flex h-14 items-center justify-center rounded-lg bg-slate-100 text-[10px] text-slate-400"
                    style={
                      customWallpaperUrl
                        ? { backgroundImage: `url(${customWallpaperUrl})`, backgroundSize: 'cover' }
                        : undefined
                    }
                  >
                    {!customWallpaperUrl && '自定义 URL'}
                  </div>
                  <p className="mt-1.5 text-[11px] font-medium text-slate-600">自定义壁纸</p>
                </button>
              </div>
              <UrlField
                label="壁纸图片 URL"
                value={wallpaperUrlDraft}
                onChange={setWallpaperUrlDraft}
                placeholder="https://example.com/wallpaper.jpg"
                onApply={() => {
                  setCustomWallpaperUrl(wallpaperUrlDraft.trim());
                  showToast('自定义壁纸已应用');
                }}
              />
              <label className="mt-2 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-pink-200 bg-pink-50/50 py-2.5 text-xs font-medium text-pink-600">
                从本地导入壁纸图片
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    void handleImportImage(e.target.files?.[0] ?? null).then(() => {
                      const latest = useSettingsStore.getState().importedImages[0];
                      if (latest) setCustomWallpaperUrl(latest.dataUrl);
                    });
                  }}
                />
              </label>
            </Section>

            <Section title="字体">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(FONT_PRESETS) as Exclude<FontPresetId, 'custom'>[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFont(id)}
                    className={`rounded-full px-3 py-1.5 text-xs ${
                      fontId === id ? 'bg-sky-500 text-white' : 'bg-white text-slate-500 border border-blue-100'
                    }`}
                    style={{ fontFamily: FONT_PRESETS[id].family }}
                  >
                    {FONT_PRESETS[id].label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setFont('custom')}
                  className={`rounded-full px-3 py-1.5 text-xs ${
                    fontId === 'custom' ? 'bg-sky-500 text-white' : 'bg-white text-slate-500 border border-blue-100'
                  }`}
                >
                  自定义 URL
                </button>
              </div>
              <UrlField
                label="字体文件 URL（.woff2 / .ttf）"
                value={fontUrlDraft}
                onChange={setFontUrlDraft}
                placeholder="https://example.com/font.woff2"
                onApply={() => {
                  setCustomFontUrl(fontUrlDraft.trim());
                  showToast('自定义字体已应用');
                }}
              />
              <p className="mt-2 text-[10px] text-slate-400">本地字体导入与管理请前往「资源」页。</p>
            </Section>

            <Section title="图标风格">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(ICON_STYLE_PRESETS) as Exclude<IconStyleId, 'custom'>[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setIconStyle(id)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ${
                      iconStyleId === id ? 'bg-violet-500 text-white' : 'bg-white text-slate-500 border border-blue-100'
                    }`}
                  >
                    <span>{ICON_STYLE_PRESETS[id].icons.liveList}</span>
                    {ICON_STYLE_PRESETS[id].label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setIconStyle('custom')}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ${
                    iconStyleId === 'custom' ? 'bg-violet-500 text-white' : 'bg-white text-slate-500 border border-blue-100'
                  }`}
                >
                  自定义 URL
                </button>
              </div>
              <p className="mb-2 text-[10px] text-slate-400">为每个 App 设置图标图片 URL</p>
              <div className="space-y-2">
                {HOME_APP_KEYS.map((key) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-[10px] text-slate-500">{APP_LABELS[key]}</span>
                    <input
                      value={iconUrlDrafts[key] ?? ''}
                      onChange={(e) => setIconUrlDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder="https://..."
                      className="min-w-0 flex-1 rounded-lg border border-blue-100 bg-white px-2 py-1.5 text-[11px] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const url = iconUrlDrafts[key]?.trim();
                        if (url) {
                          setCustomIconUrl(key, url);
                          showToast(`${APP_LABELS[key]} 图标已应用`);
                        }
                      }}
                      className="shrink-0 rounded-lg bg-violet-100 px-2 py-1 text-[10px] font-bold text-violet-600"
                    >
                      应用
                    </button>
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}

        {tab === '桌面' && (
          <>
            <Section title="文字颜色">
              <p className="mb-2 text-[10px] text-slate-400">影响欢迎页时间日期与应用桌面（第二页）文字颜色</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(HOME_TEXT_COLOR_PRESETS) as Exclude<HomeTextColorId, 'custom'>[]).map((id) => {
                  const preset = HOME_TEXT_COLOR_PRESETS[id];
                  const previewColor = preset.main || '#64748b';
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setHomeTextColor(id)}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
                        homeTextColorId === id
                          ? 'border-pink-400 bg-pink-50 text-pink-600'
                          : 'border-blue-100 bg-white text-slate-500'
                      }`}
                    >
                      {id !== 'auto' && (
                        <span
                          className="inline-block h-3 w-3 rounded-full border border-white shadow-sm"
                          style={{ backgroundColor: previewColor }}
                        />
                      )}
                      {preset.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setHomeTextColor('custom')}
                  className={`rounded-full border px-3 py-1.5 text-xs ${
                    homeTextColorId === 'custom'
                      ? 'border-pink-400 bg-pink-50 text-pink-600'
                      : 'border-blue-100 bg-white text-slate-500'
                  }`}
                >
                  自定义
                </button>
              </div>
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-dashed border-pink-200 bg-white/80 p-3">
                <input
                  type="color"
                  value={customHomeTextColor}
                  onChange={(e) => setCustomHomeTextColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded-lg border border-blue-100 bg-white"
                />
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-[10px] text-slate-400">自定义色值</label>
                  <input
                    value={customHomeTextColor}
                    onChange={(e) => setCustomHomeTextColor(e.target.value)}
                    placeholder="#ffffff"
                    className="w-full rounded-lg border border-blue-100 px-2 py-1.5 text-[11px] outline-none"
                  />
                </div>
              </div>
            </Section>

            <Section title="装饰图片">
              <p className="mb-2 text-[10px] text-slate-400">左上与右下两张装饰图，比例 3:4</p>
              <UrlField
                label="左上装饰图 URL"
                value={widgetTopDraft}
                onChange={setWidgetTopDraft}
                placeholder={DEFAULT_WIDGET_TOP_IMAGE}
                onApply={() => {
                  setWidgetImage('top', widgetTopDraft.trim() || DEFAULT_WIDGET_TOP_IMAGE);
                  showToast('左上装饰图已更新');
                }}
              />
              <UrlField
                label="右下装饰图 URL"
                value={widgetBottomDraft}
                onChange={setWidgetBottomDraft}
                placeholder={DEFAULT_WIDGET_BOTTOM_IMAGE}
                onApply={() => {
                  setWidgetImage('bottom', widgetBottomDraft.trim() || DEFAULT_WIDGET_BOTTOM_IMAGE);
                  showToast('右下装饰图已更新');
                }}
              />
              {importedImages?.length > 0 && (
                <div className="mt-2">
                  <p className="mb-1 text-[10px] text-slate-400">从本地图库设为装饰图</p>
                  <div className="flex flex-wrap gap-2">
                    {importedImages.slice(0, 8).map((img) => (
                      <div key={img.id} className="flex flex-col gap-1">
                        <img src={img.dataUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setWidgetImage('top', img.dataUrl);
                              setWidgetTopDraft(img.dataUrl);
                              showToast('已设为左上');
                            }}
                            className="rounded bg-sky-100 px-1.5 py-0.5 text-[9px] text-sky-600"
                          >
                            左上
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setWidgetImage('bottom', img.dataUrl);
                              setWidgetBottomDraft(img.dataUrl);
                              showToast('已设为右下');
                            }}
                            className="rounded bg-pink-100 px-1.5 py-0.5 text-[9px] text-pink-600"
                          >
                            右下
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          </>
        )}

        {tab === '资源' && (
          <>
            <Section title="图片库">
              <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-violet-200 bg-violet-50/50 py-2.5 text-xs font-medium text-violet-600">
                导入图片到本地（新档不重置）
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void handleImportImage(e.target.files?.[0] ?? null)}
                />
              </label>
              <p className="mt-1 text-[9px] text-slate-400">单张上限 {formatFileSize(MAX_IMAGE_IMPORT_BYTES)}</p>
              {importedImages?.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {importedImages.map((img) => (
                    <div key={img.id} className="flex items-center gap-2 rounded-xl border border-blue-100 bg-white p-2">
                      <img src={img.dataUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-medium text-slate-700">{img.name}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setCustomWallpaperUrl(img.dataUrl);
                              showToast('已设为壁纸');
                            }}
                            className="rounded bg-sky-100 px-2 py-0.5 text-[9px] text-sky-600"
                          >
                            壁纸
                          </button>
                          <button
                            type="button"
                            onClick={() => removeImportedImage(img.id)}
                            className="rounded bg-slate-100 px-2 py-0.5 text-[9px] text-slate-500"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[10px] text-slate-300">暂无导入图片</p>
              )}
            </Section>

            <Section title="字体库">
              <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-sky-200 bg-sky-50/50 py-2.5 text-xs font-medium text-sky-600">
                从本地导入字体文件
                <input
                  type="file"
                  accept=".woff,.woff2,.ttf,.otf,font/*"
                  className="hidden"
                  onChange={(e) => void handleImportFont(e.target.files?.[0] ?? null)}
                />
              </label>
              <p className="mt-1 text-[9px] text-slate-400">单文件上限 {formatFileSize(MAX_FONT_IMPORT_BYTES)}</p>
              {importedFonts?.length > 0 ? (
                <div className="mt-2 space-y-1.5">
                  {importedFonts.map((f) => (
                    <div key={f.id} className="flex items-center justify-between rounded-xl border border-blue-100 bg-white px-3 py-2">
                      <span className="truncate text-[11px] text-slate-700">{f.name}</span>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            applyImportedFont(f.id);
                            showToast('字体已应用');
                          }}
                          className="rounded bg-sky-100 px-2 py-0.5 text-[9px] text-sky-600"
                        >
                          应用
                        </button>
                        <button
                          type="button"
                          onClick={() => removeImportedFont(f.id)}
                          className="rounded bg-slate-100 px-2 py-0.5 text-[9px] text-slate-500"
                        >
                          删
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[10px] text-slate-300">暂无导入字体</p>
              )}
            </Section>
          </>
        )}

        {tab === '角色' && (
          <>
            <Section title="AI 互动模式">
              <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
                主动式：AI 后台持续推演（私信、口播、弹幕等），Token 消耗较高。被动式：仅在你操作时生成回复，Token 消耗显著更低。
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: 'active' as AiInteractionMode, label: '主动式', hint: '沉浸 · 耗 Token 多' },
                    { value: 'passive' as AiInteractionMode, label: '被动式', hint: '省 Token · 按需回复' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setAiInteractionMode(opt.value);
                      showToast(`已切换为${opt.label}`);
                    }}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${
                      aiInteractionMode === opt.value
                        ? 'border-pink-300 bg-pink-50 ring-1 ring-pink-200'
                        : 'border-blue-100 bg-white hover:border-pink-200'
                    }`}
                  >
                    <p className="text-sm font-bold text-slate-700">{opt.label}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">{opt.hint}</p>
                  </button>
                ))}
              </div>
            </Section>

            <Section title="玩家人设">
            <label className="mb-2 block text-[11px] text-slate-400">昵称</label>
            <div className="mb-3 flex gap-2">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={12}
                className="flex-1 rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm outline-none"
                placeholder="神秘女王"
              />
              <button
                type="button"
                onClick={handleSaveName}
                className="shrink-0 rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-white"
              >
                保存
              </button>
            </div>
            {personaFields.map((f) => (
              <div key={f.key} className="mb-3">
                <label className="mb-1 block text-[11px] text-slate-400">{f.label}</label>
                <textarea
                  value={playerPersona[f.key]}
                  onChange={(e) => setPlayerPersona({ [f.key]: e.target.value })}
                  rows={f.key === 'bio' ? 3 : 2}
                  placeholder={f.placeholder}
                  className="w-full resize-none rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm outline-none"
                />
              </div>
            ))}
            <p className="text-[10px] text-slate-400">主播 AI 会根据你的人设调整私信、PK 拉票等互动方式。</p>
          </Section>
          </>
        )}

        {tab === '存档' && (
          <Section title="存档管理">
            <div className="space-y-2">
              {[0, 1, 2].map((slot) => {
                const meta = slotMeta[slot];
                return (
                  <div key={slot} className="rounded-xl border border-blue-100 bg-white p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">存档 {slot + 1}</p>
                        {meta ? (
                          <p className="text-[10px] text-slate-400">
                            {meta.playerName} · 第{meta.gameDay}天 ·{' '}
                            {new Date(meta.savedAt).toLocaleString('zh-CN')}
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-300">空</p>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSaveSlot(slot)}
                          className="rounded-lg bg-sky-100 px-2.5 py-1 text-[10px] font-bold text-sky-600"
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          disabled={!meta}
                          onClick={() => handleLoadSlot(slot)}
                          className="rounded-lg bg-pink-100 px-2.5 py-1 text-[10px] font-bold text-pink-600 disabled:opacity-40"
                        >
                          读档
                        </button>
                        {meta && (
                          <button
                            type="button"
                            onClick={() => {
                              void deleteSlot(slot).then(() => {
                                refreshSlots();
                                showToast('已删除');
                              });
                            }}
                            className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] text-slate-500"
                          >
                            删
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={handleNewGame}
              className="mt-4 w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-bold text-red-500"
            >
              开启新档
            </button>
            <button
              type="button"
              onClick={goHome}
              className="mt-2 w-full rounded-xl border border-blue-100 py-2.5 text-xs text-slate-500"
            >
              返回桌面
            </button>
          </Section>
        )}
      </div>

      {toast && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/75 px-4 py-2 text-xs text-white">
          {toast}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs font-bold text-pink-400">{title}</h2>
      {children}
    </section>
  );
}

function UrlField({
  label,
  value,
  onChange,
  placeholder,
  onApply,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onApply: () => void;
}) {
  return (
    <div className="mt-3 rounded-xl border border-dashed border-blue-200 bg-white/80 p-3">
      <label className="mb-1 block text-[10px] text-slate-400">{label}</label>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-lg border border-blue-100 px-2 py-1.5 text-[11px] outline-none"
        />
        <button
          type="button"
          onClick={onApply}
          className="shrink-0 rounded-lg bg-sky-500 px-3 py-1.5 text-[10px] font-bold text-white"
        >
          应用
        </button>
      </div>
    </div>
  );
}
