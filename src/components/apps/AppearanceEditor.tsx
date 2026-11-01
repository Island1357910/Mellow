import { NumericInput } from '../ui/NumericInput.tsx'
import { useEffect, useRef, useState } from 'react'
import type { Theme, ThemeColors } from '../../types/index.ts'
import { BUNDLED_THEMES } from '../../theme/themes.ts'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import { downloadJson } from '../../lib/download.ts'
import { importWallpaper } from '../../lib/wallpaper.ts'

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const hex = /^#[\da-f]{6}([\da-f]{2})?$/i.test(value) ? value : '#ffffff'
  const alpha = hex.length === 9 ? parseInt(hex.slice(7), 16) : 255
  return <label className="block text-xs">{label}<div className="mt-1 flex items-center gap-2">
    <input className="color-input-swatch" data-holiday-preserve aria-label={`${label}选色`} type="color" value={hex.slice(0, 7)} onChange={e => onChange(e.target.value + (alpha < 255 ? alpha.toString(16).padStart(2, '0') : ''))} />
    <input aria-label={`${label}色码`} className="soft-input min-w-0 flex-1" value={draft} onChange={e => { setDraft(e.target.value); if (/^#[\da-f]{6}([\da-f]{2})?$/i.test(e.target.value)) onChange(e.target.value) }} placeholder="#RRGGBB / #RRGGBBAA" />
  </div><div className="flex items-center gap-2"><span>透明度</span><input aria-label={`${label}透明度`} className="min-w-0 flex-1" type="range" min="0" max="255" value={alpha} onChange={e => onChange(hex.slice(0, 7) + Number(e.target.value).toString(16).padStart(2, '0'))} /><span>{Math.round(alpha / 255 * 100)}%</span></div></label>
}
const LABELS: Record<keyof ThemeColors, string> = { primary: '主色', secondary: '副色', background: '背景', surface: '卡片', text: '正文', textSecondary: '次要文字', accent: '强调色', success: '成功', warning: '提醒', error: '错误' }
export function AppearanceEditor() {
  const settings = useMellow(s => s.settings)
  const themes = useMellow(s => s.themes)
  const original = themes.find(t => t.id === settings.themeId) ?? BUNDLED_THEMES.find(t => t.id === 'theme_macaron')!
  const [draft, setDraft] = useState<Theme>(() => structuredClone(original))
  const [note, setNote] = useState('')
  const [reading, setReading] = useState(false), [saving, setSaving] = useState(false)
  const generation = useRef(0), saveLock = useRef(false)
  useEffect(() => {
    generation.current++
    setReading(false)
    setDraft(structuredClone(original))
    return () => { generation.current++ }
  }, [original])
  const patch = (p: Partial<Theme>) => setDraft(d => ({ ...d, ...p }))
  const save = async () => {
    if (reading || saveLock.current) return
    saveLock.current = true; setSaving(true)
    try {
    const theme = { ...draft, id: draft.id.startsWith('theme_user_') ? draft.id : `theme_user_${Date.now()}`, customPalette: true }
    await storage.saveTheme(theme)
    await useMellow.getState().reloadLibraries()
    await useMellow.getState().patchSettings({ themeId: theme.id })
    setNote(draft.wallpaper ? '已保存并应用，桌面和锁屏都会显示这张壁纸。' : '已保存并应用主题。')
    } finally { saveLock.current = false; setSaving(false) }
  }
  const readFile = async (file: File | undefined, font: boolean) => {
    if (!file) return
    const ticket = generation.current
    setReading(true); setNote(font ? '正在读取字体…' : '正在读取壁纸…')
    try {
      if (!font) {
        const wallpaper = await importWallpaper(file)
        if (ticket === generation.current) { patch({ wallpaper }); setNote(`已导入 ${file.name}，请点击「保存并应用」。`) }
        return
      }
      if (file.size > 12 * 1024 * 1024) throw new Error('文件请控制在 12MB 内')
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file) })
      const face = new FontFace('MellowCustom', `url(${data})`); await face.load()
      if (ticket === generation.current) { patch({ fontData: data }); setNote(`已读取 ${file.name}，保存后使用`) }
    } catch (e) { if (ticket === generation.current) setNote(e instanceof Error ? e.message : '文件未能读取') }
    finally { if (ticket === generation.current) setReading(false) }
  }
  return <section className="menu-card mt-3 space-y-3">
    <h3 className="font-semibold">自由设计工作台</h3><p className="text-xs leading-5">选色、8 位色码、透明度、背景图片和 CSS 都可以自行设置。保存为个人主题后，可随时切换或导出。</p>
    <input aria-label="主题名称" className="soft-input" value={draft.name} onChange={e => patch({ name: e.target.value })} />
    <div className="grid grid-cols-2 gap-3">{(Object.keys(LABELS) as Array<keyof ThemeColors>).map(k => <ColorField key={k} label={LABELS[k]} value={draft.colors[k]} onChange={v => patch({ colors: { ...draft.colors, [k]: v } })} />)}</div>
    <label className="block text-xs">圆角（px）<NumericInput className="soft-input mt-1" min={0} max={64} value={parseInt(draft.radius.lg) || 0} onValueChange={radius => patch({ radius: { ...draft.radius, lg: `${radius}px` } })} /></label>
    <label className="block text-xs">壁纸（桌面与锁屏）<input aria-label="导入壁纸" type="file" accept="image/*" disabled={reading || saving} className="file-picker mt-2 block w-full" onChange={e => { const input = e.currentTarget; void readFile(input.files?.[0], false).finally(() => { input.value = '' }) }} /></label>
    <p className="text-xs leading-5">选择图片后先预览，再点击「保存并应用」。单张图片不超过 12MB。</p>
    {draft.wallpaper && <img data-holiday-preserve src={draft.wallpaper} alt="壁纸预览" className="w-full rounded-2xl object-cover" style={{ height: 200 }} />}
    <button className="chip" disabled={reading || saving || !draft.wallpaper} onClick={() => { patch({ wallpaper: '' }); setNote('壁纸已从草稿移除，保存后恢复主题背景。') }}>清除背景图</button>
    <label className="block text-xs">导入字体（TTF / OTF / WOFF / WOFF2）<input type="file" accept=".ttf,.otf,.woff,.woff2" disabled={reading || saving} className="file-picker mt-2 block w-full" onChange={e => { const input = e.currentTarget; void readFile(input.files?.[0], true).finally(() => { input.value = '' }) }} /></label>
    <button className="chip" disabled={reading || saving} onClick={() => patch({ fontData: '' })}>恢复主题字体</button>
    <label className="block text-xs">字体族<input className="soft-input mt-1" value={draft.font.body} onChange={e => patch({ font: { body: e.target.value, display: e.target.value } })} /></label>
    <label className="block text-xs">自由 CSS（手机范围内生效）<textarea className="soft-input mt-1 font-mono text-xs" rows={6} value={draft.customCss ?? ''} placeholder={'.menu-card { border: 1px solid #ff9966; }\n.sms-shell { background: transparent; }'} onChange={e => patch({ customCss: e.target.value })} /></label>
    <div data-holiday-preserve className="rounded-2xl p-4" style={{ background: draft.colors.background, color: draft.colors.text, borderRadius: draft.radius.lg }}><strong style={{ color: draft.colors.primary }}>主题配色预览</strong><p className="mt-2 rounded-xl p-3" style={{ background: draft.colors.surface }}>这是一张卡片，一句对白，一次新的相遇。</p></div>
    <div className="flex flex-wrap gap-2"><button className="chip chip-solid" disabled={reading || saving} onClick={() => void save().catch(e => setNote(String(e)))}>{saving ? '保存中…' : '保存并应用'}</button><button className="chip" disabled={reading || saving} onClick={() => { setDraft(structuredClone(original)); setNote('已撤销未保存的修改。') }}>撤销草稿</button><button className="chip" disabled={reading || saving} onClick={() => downloadJson(`${draft.name}.json`, draft)}>导出草稿</button></div>
    {note && <p role="status" className="text-xs leading-5">{note}</p>}
  </section>
}
