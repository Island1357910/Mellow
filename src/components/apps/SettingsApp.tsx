import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronRight, Download, ImagePlus, Palette, Plug, Shield, Sparkles, Upload, UserRound } from 'lucide-react'
import { PRESET_GROUPS, presetFromUnknown } from '../../data/officialPresets.ts'
import { modePresetId } from '../../lib/defaults.ts'
import { downloadJson } from '../../lib/download.ts'
import { resolveIdentityId } from '../../engine/identity.ts'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import { themeFromUnknown } from '../../theme/themes.ts'
import type { Preset, PresetMode } from '../../types/index.ts'
import { candyStyle } from '../../lib/candy.ts'
import { Field, ModalPortal, PillNote, Screen, SectionTitle, SoftCard, Toggle } from '../ui/primitives.tsx'
import { ApiPanel, BackupPanel, HomeLayoutPanel, IconPanel, MinimaxPanel, PrivacyPanel } from './SettingsPanels.tsx'

const AVATARS = ['🙂', '🌙', '🌸', '🐱', '🍵', '⭐', '🫧', '🍀']

export function SettingsApp(props: { onBack: () => void }) {
  const identities = useMellow((state) => state.identities)
  const settings = useMellow((state) => state.settings)
  const themes = useMellow((state) => state.themes)
  const presets = useMellow((state) => state.presets)
  const createIdentity = useMellow((state) => state.createIdentity)
  const deleteIdentity = useMellow((state) => state.deleteIdentity)
  const updateIdentity = useMellow((state) => state.updateIdentity)
  const switchIdentity = useMellow((state) => state.switchIdentity)
  const setAppDefault = useMellow((state) => state.setAppDefault)
  const [tab, setTab] = useState<TabId>('me')
  const [picked, setPicked] = useState<Partial<Record<TabId, PaneId>>>({})
  const phone = identities.find((item) => item.id === settings.activeIdentityId)
  const theme = themes.find((item) => item.id === settings.themeId)
  const preset = presets.find((item) => item.id === settings.activePresetId)
  const group = TABS.find((item) => item.id === tab) ?? TABS[0]
  const pane = picked[tab] ?? group.panes[0].id
  const details: Partial<Record<PaneId, string>> = {
    theme: theme?.name,
    preset: preset?.name,
    notify: settings.dnd ? '免打扰中' : settings.banner ? '横幅开' : '横幅关',
  }

  return (
    <div className="sms-shell h-full min-h-0" style={candyStyle('#A9CDE8', '#E6DDF8', '#F8D0DC')}>
      <Screen title="设置" subtitle={`${phone?.name ?? '未命名'} · 半糖 Mellow 0.1`} onBack={props.onBack}>
        <nav className="sticky top-0 z-10 -mx-1 grid grid-cols-5 gap-1 rounded-[22px] bg-white/80 p-1 shadow-[0_8px_20px_rgba(120,80,100,0.08)] backdrop-blur" aria-label="设置分类">
          {TABS.map((item) => {
            const on = item.id === tab
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={on}
                onClick={() => setTab(item.id)}
                className="flex flex-col items-center gap-0.5 rounded-[18px] py-1.5 text-[11px] transition-colors"
                style={{ background: on ? item.tint : 'transparent', color: on ? '#fff' : 'var(--m-text-secondary)' }}
              >
                {item.icon}
                <span className={on ? 'font-semibold' : ''}>{item.label}</span>
              </button>
            )
          })}
        </nav>
        {group.panes.length > 1 ? (
          <div className="mt-3 flex flex-wrap gap-2" role="tablist">
            {group.panes.map((item) => {
              const on = item.id === pane
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  className="chip"
                  style={on ? { background: group.tint, color: '#fff', boxShadow: `0 6px 14px color-mix(in srgb, ${group.tint} 40%, transparent)` } : undefined}
                  onClick={() => setPicked({ ...picked, [tab]: item.id })}
                >
                  {item.label}
                  {details[item.id] ? <span className="opacity-70">· {details[item.id]}</span> : null}
                </button>
              )
            })}
          </div>
        ) : null}
        <div className="settings-pane mt-3">
          {pane === 'identity' ? (
            <IdentityCard
              identities={identities}
              phoneId={settings.activeIdentityId}
              phone={phone}
              onCreate={createIdentity}
              onDelete={deleteIdentity}
              onUpdate={updateIdentity}
              onSwitch={switchIdentity}
              messageDefault={phone ? resolveIdentityId({ ...phone, perAppOverride: {} }, 'messages', identities) : ''}
              onMessageDefault={(id) => void setAppDefault('messages', id)}
            />
          ) : null}
          {pane === 'api' ? <ApiPanel /> : null}
          {pane === 'voice' ? <MinimaxPanel /> : null}
          {pane === 'preset' ? <PresetCard /> : null}
          {pane === 'role' ? <RoleCard /> : null}
          {pane === 'notify' ? <NotifyCard /> : null}
          {pane === 'theme' ? <ThemeCard /> : null}
          {pane === 'home' ? <HomeLayoutPanel /> : null}
          {pane === 'icons' ? <IconPanel /> : null}
          {pane === 'privacy' ? <PrivacyPanel /> : null}
          {pane === 'backup' ? <BackupPanel /> : null}
        </div>
        <div className="mt-4 flex justify-center pb-6"><PillNote tone="sky" compact>密钥与备份都只留在你自己手里</PillNote></div>
      </Screen>
    </div>
  )
}

type TabId = 'me' | 'link' | 'talk' | 'look' | 'data'
type PaneId = 'identity' | 'api' | 'voice' | 'preset' | 'role' | 'notify' | 'theme' | 'home' | 'icons' | 'privacy' | 'backup'

const TABS: Array<{ id: TabId; label: string; tint: string; icon: ReactNode; panes: Array<{ id: PaneId; label: string }> }> = [
  { id: 'me', label: '身份', tint: '#E9B949', icon: <UserRound size={16} />, panes: [{ id: 'identity', label: '身份' }] },
  { id: 'link', label: '连接', tint: '#7FB8E0', icon: <Plug size={16} />, panes: [{ id: 'api', label: '接口与模型' }, { id: 'voice', label: 'MiniMax 语音' }] },
  { id: 'talk', label: '对话', tint: '#EE9AB0', icon: <Sparkles size={16} />, panes: [{ id: 'preset', label: '预设' }, { id: 'role', label: '角色行为' }, { id: 'notify', label: '通知' }] },
  { id: 'look', label: '外观', tint: '#B9A3E3', icon: <Palette size={16} />, panes: [{ id: 'theme', label: '主题' }, { id: 'home', label: '主页' }, { id: 'icons', label: '应用图标' }] },
  { id: 'data', label: '数据', tint: '#8EB5A6', icon: <Shield size={16} />, panes: [{ id: 'privacy', label: '隐私' }, { id: 'backup', label: '备份与恢复' }] },
]

function ThemeCard() {
  const settings = useMellow((state) => state.settings)
  const themes = useMellow((state) => state.themes)
  const patchSettings = useMellow((state) => state.patchSettings)
  const reloadLibraries = useMellow((state) => state.reloadLibraries)
  return (
      <SoftCard>
        <SectionTitle tone="lilac">主题</SectionTitle>
        <div className="grid grid-cols-4 gap-3">
          {themes.map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => void patchSettings({ themeId: theme.id })}
              className="flex flex-col items-center gap-1"
            >
              <span
                className="h-12 w-12 rounded-full ring-2 ring-offset-2"
                style={{
                  background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`,
                  ['--tw-ring-color' as string]: settings.themeId === theme.id ? theme.colors.accent : 'transparent',
                }}
              />
              <span className="text-[11px]">{theme.name}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <label className="chip chip-lilac">
            <Upload size={13} />
            导入主题
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                void file.text().then(async (text) => {
                  const theme = themeFromUnknown(JSON.parse(text) as unknown)
                  if (!theme) throw new Error('这不是主题')
                  await storage.saveTheme(theme)
                  await reloadLibraries()
                  await patchSettings({ themeId: theme.id })
                }).catch((error: unknown) => {
                  void useMellow.getState().pushNotice({
                    kind: 'toast',
                    title: '主题没放进去',
                    body: error instanceof Error ? error.message : '文件不对',
                    appId: 'settings',
                    identityId: useMellow.getState().activeIdentityId,
                    priority: 3,
                  })
                })
              }}
            />
          </label>
          <button
            type="button"
            className="chip chip-mint"
            onClick={() => {
              const theme = themes.find((item) => item.id === settings.themeId)
              if (theme) downloadJson(`${theme.name}.json`, theme)
            }}
          >
            <Download size={13} />
            导出当前主题
          </button>
        </div>
      </SoftCard>
  )
}

function PresetDetailSheet(props: {
  preset: Preset
  active: boolean
  onClose: () => void
  onApply: () => void
}) {
  const { preset } = props
  return (
    <ModalPortal onClose={props.onClose}>
      <div className="modal-center sms-shell" onClick={(event) => event.stopPropagation()}>
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="break-words text-[18px] font-semibold">{preset.name}</h2>
            <p className="preset-desc mt-1">{preset.description}</p>
          </div>
          <button type="button" className="chip chip-pink shrink-0" onClick={props.onClose}>关闭</button>
        </div>
        <div className="mt-3 flex min-w-0 flex-wrap gap-1.5">
          {preset.tags.map((tag) => (
            <span key={tag} className="chip chip-lilac text-[10px]">{tag}</span>
          ))}
        </div>
        <section className="menu-card mt-3 min-w-0">
          <p className="text-xs font-medium">采样参数</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--m-text-secondary)' }}>
            <div><dt className="inline">温度 </dt><dd className="inline">{preset.data.temperature}</dd></div>
            <div><dt className="inline">top_p </dt><dd className="inline">{preset.data.top_p}</dd></div>
            <div><dt className="inline">频率惩罚 </dt><dd className="inline">{preset.data.frequency_penalty}</dd></div>
            <div><dt className="inline">存在惩罚 </dt><dd className="inline">{preset.data.presence_penalty}</dd></div>
          </dl>
          {preset.author ? <p className="preset-desc mt-2">作者 {preset.author} · v{preset.version}</p> : null}
        </section>
        <section className="menu-card mt-3 min-w-0">
          <p className="text-xs font-medium">提示词块（{preset.data.prompts.length}）</p>
          <div className="mt-2 space-y-2">
            {preset.data.prompts.map((block) => (
              <details key={block.identifier} className="preset-prompt-block">
                <summary className="cursor-pointer break-words text-xs font-medium">
                  {block.name}
                  <span className="ml-1 font-normal opacity-60">· {block.role}</span>
                </summary>
                <pre className="preset-prompt-body">{block.content}</pre>
              </details>
            ))}
          </div>
        </section>
        <button
          type="button"
          className={`chip chip-solid mt-4 w-full ${props.active ? 'opacity-70' : ''}`}
          disabled={props.active}
          onClick={props.onApply}
        >
          {props.active ? '已是兜底预设' : '设为兜底预设'}
        </button>
      </div>
    </ModalPortal>
  )
}

function PresetCard() {
  const settings = useMellow((state) => state.settings)
  const presets = useMellow((state) => state.presets)
  const patchSettings = useMellow((state) => state.patchSettings)
  const reloadLibraries = useMellow((state) => state.reloadLibraries)
  const [detailId, setDetailId] = useState<string | null>(null)
  const detailPreset = detailId ? presets.find((item) => item.id === detailId) : null
  const choose = (mode: PresetMode, id: string) => {
    void patchSettings({ modePresets: { ...settings.modePresets, [mode]: id } })
  }
  return (
      <SoftCard className="relative min-w-0 overflow-hidden">
        <SectionTitle tone="pink">各处用哪一套</SectionTitle>
        <div className="min-w-0 space-y-3">
          {PRESET_GROUPS.map((group) => {
            const current = modePresetId(settings, group.id)
            const picked = presets.find((item) => item.id === current)
            return (
              <label key={group.id} className="block min-w-0 text-xs" style={{ color: 'var(--m-text-secondary)' }}>
                <span className="block">{group.label}</span>
                <span className="preset-hint">{group.hint}</span>
                <select value={current} onChange={(event) => choose(group.id, event.target.value)} className="soft-select mt-1 w-full min-w-0 text-sm">
                  {group.ids.map((id) => {
                    const preset = presets.find((item) => item.id === id)
                    return <option key={id} value={id}>{preset?.name ?? id}</option>
                  })}
                </select>
                {picked ? (
                  <button type="button" className="preset-desc mt-1 text-left underline decoration-black/15 underline-offset-2" onClick={() => setDetailId(picked.id)}>
                    {picked.description} · 查看详情
                  </button>
                ) : null}
              </label>
            )
          })}
        </div>
        <div className="mt-4 min-w-0">
        <SectionTitle tone="pink">兜底预设</SectionTitle>
        <p className="preset-hint mb-2">点一条查看完整说明和提示词，在详情里设为兜底。</p>
        <div className="min-w-0 space-y-1">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setDetailId(preset.id)}
              className={`chip chip-block ${settings.activePresetId === preset.id ? 'chip-pink' : ''}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm">{preset.name}</span>
                <span className="preset-desc line-clamp-2">
                  {preset.description} · 温度 {preset.data.temperature}
                </span>
              </span>
              <ChevronRight size={16} className="mt-0.5 shrink-0 opacity-45" />
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <label className="chip chip-pink">
            <Upload size={13} />
            导入预设
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                void file.text().then(async (text) => {
                  const preset = presetFromUnknown(JSON.parse(text) as unknown)
                  if (!preset) throw new Error('这不是预设')
                  await storage.savePreset(preset)
                  await reloadLibraries()
                  await patchSettings({ activePresetId: preset.id })
                }).catch((error: unknown) => {
                  void useMellow.getState().pushNotice({
                    kind: 'toast',
                    title: '预设没放进去',
                    body: error instanceof Error ? error.message : '文件不对',
                    appId: 'settings',
                    identityId: useMellow.getState().activeIdentityId,
                    priority: 3,
                  })
                })
              }}
            />
          </label>
          <button
            type="button"
            className="chip chip-mint"
            onClick={() => {
              const preset = presets.find((item) => item.id === settings.activePresetId)
              if (preset) downloadJson(`${preset.name}.json`, preset)
            }}
          >
            <Download size={13} />
            导出当前预设
          </button>
        </div>
        </div>
        {detailPreset ? (
          <PresetDetailSheet
            preset={detailPreset}
            active={settings.activePresetId === detailPreset.id}
            onClose={() => setDetailId(null)}
            onApply={() => {
              void patchSettings({ activePresetId: detailPreset.id })
              setDetailId(null)
            }}
          />
        ) : null}
      </SoftCard>
  )
}

function RoleCard() {
  const settings = useMellow((state) => state.settings)
  const patchSettings = useMellow((state) => state.patchSettings)
  return (
      <SoftCard>
        <SectionTitle tone="mint">角色行为</SectionTitle>
        <Toggle
          label="第四面墙"
          hint={settings.fourthWall ? '角色知道你在屏幕外面。具体对话仍然按身份分开。' : '角色以为自己是真人，也以为你是真人。'}
          on={settings.fourthWall}
          onChange={(value) => void patchSettings({ fourthWall: value })}
        />
        <label className="mt-2 block text-xs" style={{ color: 'var(--m-text-secondary)' }}>
          主动发消息间隔（分钟）
          <input
            type="number"
            min={0}
            max={10080}
            value={settings.proactiveMinutes || ''}
            onChange={(event) => {
              const raw = event.target.value.trim()
              void patchSettings({ proactiveMinutes: raw ? Math.max(1, Math.min(10080, Number(raw) || 0)) : 0 })
            }}
            placeholder="0 表示关闭"
            className="soft-input mt-1 w-full text-sm"
          />
        </label>
        <p className="mt-2 text-[11px] leading-5" style={{ color: 'var(--m-text-secondary)' }}>
          你超过这么多分钟没回，角色可能会自己发一条。可在单个会话里单独改。设为 0 则关闭。
        </p>
      </SoftCard>
  )
}

function NotifyCard() {
  const settings = useMellow((state) => state.settings)
  const patchSettings = useMellow((state) => state.patchSettings)
  return (
      <SoftCard>
        <SectionTitle tone="peach">通知</SectionTitle>
        <Toggle label="横幅" hint="角色来信时从顶部滑出来。你正在看的那条对话不会再弹。" on={settings.banner} onChange={(value) => void patchSettings({ banner: value })} />
        <Toggle label="现在免打扰" hint="来信先记下，不滑横幅。" on={settings.dnd} onChange={(value) => void patchSettings({ dnd: value })} />
        <Toggle
          label="免打扰时段"
          hint={`${settings.dndStart} – ${settings.dndEnd}`}
          on={settings.quietHours}
          onChange={(value) => void patchSettings({ quietHours: value })}
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-xs" style={{ color: 'var(--m-text-secondary)' }}>
            开始
            <input
              type="time"
              value={settings.dndStart}
              onChange={(event) => void patchSettings({ dndStart: event.target.value })}
              className="soft-input mt-1 w-full"
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--m-text-secondary)' }}>
            结束
            <input
              type="time"
              value={settings.dndEnd}
              onChange={(event) => void patchSettings({ dndEnd: event.target.value })}
              className="soft-input mt-1 w-full"
            />
          </label>
        </div>
      </SoftCard>
  )
}

function IdentityCard(props: {
  identities: Array<{ id: string; name: string; avatar: string; persona: string; namespace: string; defaultForApps: Record<string, string>; perAppOverride: Record<string, string>; createdAt: number }>
  phoneId: string
  phone: { id: string; name: string; avatar: string; persona: string; namespace: string; defaultForApps: Record<string, string>; perAppOverride: Record<string, string>; createdAt: number } | undefined
  messageDefault: string
  onMessageDefault: (id: string | null) => void
  onCreate: (input: { name: string; persona: string; avatar: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onUpdate: (identity: { id: string; name: string; avatar: string; persona: string; namespace: string; defaultForApps: Record<string, string>; perAppOverride: Record<string, string>; createdAt: number }) => Promise<void>
  onSwitch: (id: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [persona, setPersona] = useState('')
  const [avatar, setAvatar] = useState(AVATARS[0] ?? '🙂')
  const [error, setError] = useState('')
  const phone = props.phone
  const [draftName, setDraftName] = useState(phone?.name ?? '')
  const [draftPersona, setDraftPersona] = useState(phone?.persona ?? '')

  useEffect(() => {
    if (!phone) return
    setDraftName(phone.name)
    setDraftPersona(phone.persona)
  }, [phone?.id])

  const flushIdentity = () => {
    if (!phone) return
    if (draftName === phone.name && draftPersona === phone.persona) return
    void props.onUpdate({ ...phone, name: draftName.trim() || phone.name, persona: draftPersona })
  }

  return (
    <SoftCard>
      <SectionTitle tone="butter">身份</SectionTitle>
      <div className="space-y-1">
        {props.identities.map((identity) => (
          <button
            key={identity.id}
            type="button"
            onClick={() => void props.onSwitch(identity.id)}
            className={`chip w-full py-2 text-left text-sm ${identity.id === props.phoneId ? 'chip-butter' : ''}`}
          >
            {identity.avatar.startsWith('data:') ? <img src={identity.avatar} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span>{identity.avatar}</span>}
            <span className="flex-1">{identity.name}</span>
            {props.identities.length > 1 ? (
              <span
                role="button"
                className="chip chip-danger px-2.5 py-1 text-[11px]"
                onClick={(event) => {
                  event.stopPropagation()
                  if (window.confirm(`拆掉「${identity.name}」？这张手机里的角色和短信会一起消失。`)) {
                    void props.onDelete(identity.id)
                  }
                }}
              >
                删除
              </span>
            ) : null}
          </button>
        ))}
      </div>
      {phone ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {AVATARS.map((item) => (
              <button key={item} type="button" className="text-lg" onClick={() => void props.onUpdate({ ...phone, avatar: item })}>{item}</button>
            ))}
            <label className="chip chip-butter">
              <ImagePlus size={13} />
              上传头像
              <input type="file" accept="image/*" className="hidden" onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file || file.size > 700_000) return
                const reader = new FileReader()
                reader.onload = () => void props.onUpdate({ ...phone, avatar: String(reader.result ?? '') })
                reader.readAsDataURL(file)
              }} />
            </label>
          </div>
          <Field label="这个人怎么自称" value={draftName} onChange={setDraftName} onBlur={flushIdentity} />
          <Field label="关于这个人" value={draftPersona} onChange={setDraftPersona} onBlur={flushIdentity} multiline placeholder="身份、性格、和角色们的关系……" />
          <p className="preset-hint">离开输入框后自动保存。中文输入法已优化，不会乱码。</p>
          <label className="block text-xs" style={{ color: 'var(--m-text-secondary)' }}>
            短信没被单独指定时，默认用
            <select
              value={props.messageDefault}
              onChange={(event) => props.onMessageDefault(event.target.value === phone.id ? null : event.target.value)}
              className="soft-select mt-1 w-full text-sm"
            >
              {props.identities.map((identity) => (
                <option key={identity.id} value={identity.id}>
                  {identity.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      {open ? (
        <div className="mt-3 space-y-3">
          <div className="flex gap-2">
            {AVATARS.map((item) => (
              <button key={item} type="button" onClick={() => setAvatar(item)} className="text-lg" style={{ opacity: avatar === item ? 1 : 0.4 }}>
                {item}
              </button>
            ))}
          </div>
          <Field label="新身份" value={name} onChange={setName} placeholder="名字" />
          <Field label="这个人是谁" value={persona} onChange={setPersona} multiline placeholder="一两句就够" />
          {error ? <PillNote tone="pink" inline>{error}</PillNote> : null}
          <button
            type="button"
            className="chip chip-solid w-full py-2 text-sm"
            onClick={() => {
              if (!name.trim()) {
                setError('先写名字')
                return
              }
              void props.onCreate({ name, persona, avatar }).then(() => {
                setOpen(false)
                setName('')
                setPersona('')
              })
            }}
          >
            建成并换过去
          </button>
        </div>
      ) : (
        <button type="button" className="chip chip-butter mt-4 w-full py-2 text-sm" onClick={() => setOpen(true)}>
          新建一张手机
        </button>
      )}
    </SoftCard>
  )
}
