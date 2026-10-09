import { useEffect, useState } from 'react'
import { loadJiushiConfig, saveJiushiConfig, type JiushiConfig } from '../../../lib/jiushi.ts'
import { JIUSHI_PHONE_APPS, jiushiWorldNs, type JiushiPhoneAppId } from '../../../lib/jiushiPhone.ts'
import { useMellow } from '../../../store/useMellow.ts'
import type { Identity } from '../../../types/index.ts'
import { Field, PillNote, Screen } from '../../ui/primitives.tsx'
import { StoryApp } from '../StoryApp.tsx'
import { WorldBookApp } from '../WorldBookApp.tsx'
import { WorldForgeApp } from '../WorldForgeApp.tsx'
import { JiushiChuanShuApp } from './JiushiChuanShuApp.tsx'
import { JiushiRosterApp } from './JiushiRosterApp.tsx'

export function JiushiPhoneShell(props: { phone: Identity; onExit: () => void }) {
  const dataRevision = useMellow((state) => state.dataRevision)
  const [activeApp, setActiveApp] = useState<JiushiPhoneAppId | null>(null)
  const [config, setConfig] = useState<JiushiConfig | null>(null)
  const [setupMode, setSetupMode] = useState(false)

  useEffect(() => {
    void loadJiushiConfig(props.phone.namespace).then((cfg) => {
      setConfig(cfg)
      if (!cfg.setupDone) setSetupMode(true)
    })
  }, [props.phone.namespace, dataRevision])

  if (setupMode && config) {
    return (
      <div className="jiushi-phone relative h-full min-h-0 overflow-hidden rounded-[28px] border-4 border-[#8B7355] bg-[#F5F0E6] shadow-[inset_0_0_40px_rgba(120,90,60,0.12)]">
        <Screen title="穿书" subtitle="定下来，再入旧世" onBack={props.onExit}>
          <div className="space-y-3">
            <Field label="所入世界 / 书名" value={config.worldTitle} onChange={(value) => setConfig({ ...config, worldTitle: value })} />
            <Field label="在此世的身份名" value={config.roleName} onChange={(value) => setConfig({ ...config, roleName: value })} placeholder={props.phone.name} />
            <Field label="来历与处境" value={config.roleStory} onChange={(value) => setConfig({ ...config, roleStory: value })} multiline />
            <button
              type="button"
              className={`w-full rounded-[22px] px-4 py-3 text-left text-sm ${config.hasMemory ? 'bg-[#E8DCC8]' : 'bg-white/90'}`}
              onClick={() => setConfig({ ...config, hasMemory: !config.hasMemory })}
            >
              <p className="font-medium">保留现代记忆</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--m-text-secondary)' }}>
                {config.hasMemory ? '开：仍记得穿书前的事，用到才提' : '关：在此世醒来，只有当前身份'}
              </p>
            </button>
            <button
              type="button"
              className="chip chip-mint w-full py-2.5"
              onClick={() => {
                void saveJiushiConfig(props.phone.namespace, {
                  ...config,
                  setupDone: true,
                  roleName: config.roleName.trim() || props.phone.name,
                }).then((next) => {
                  setConfig(next)
                  setSetupMode(false)
                })
              }}
            >
              进入旧世
            </button>
          </div>
        </Screen>
      </div>
    )
  }

  if (activeApp === 'rumu') {
    return (
      <div className="jiushi-phone relative h-full min-h-0 overflow-hidden rounded-[28px] border-4 border-[#8B7355] bg-[#F5F0E6]">
        <StoryApp mode="jiushi" onBack={() => setActiveApp(null)} />
      </div>
    )
  }
  if (activeApp === 'chuanshu') {
    return (
      <div className="jiushi-phone relative h-full min-h-0 overflow-hidden rounded-[28px] border-4 border-[#8B7355] bg-[#F5F0E6]">
        <JiushiChuanShuApp phone={props.phone} onBack={() => setActiveApp(null)} />
      </div>
    )
  }
  if (activeApp === 'roster') {
    return (
      <div className="jiushi-phone relative h-full min-h-0 overflow-hidden rounded-[28px] border-4 border-[#8B7355] bg-[#F5F0E6]">
        <JiushiRosterApp phone={props.phone} onBack={() => setActiveApp(null)} />
      </div>
    )
  }
  if (activeApp === 'worldbook') {
    return (
      <div className="jiushi-phone relative h-full min-h-0 overflow-hidden rounded-[28px] border-4 border-[#8B7355] bg-[#F5F0E6]">
        <WorldBookApp
          onBack={() => setActiveApp(null)}
          namespaceOverride={jiushiWorldNs(props.phone.namespace)}
          defaultScope="world"
        />
      </div>
    )
  }
  if (activeApp === 'worldforge') {
    return (
      <div className="jiushi-phone relative h-full min-h-0 overflow-hidden rounded-[28px] border-4 border-[#8B7355] bg-[#F5F0E6]">
        <WorldForgeApp onBack={() => setActiveApp(null)} jiushi worldNamespace={jiushiWorldNs(props.phone.namespace)} />
      </div>
    )
  }
  if (activeApp === 'setup' && config) {
    return (
      <div className="jiushi-phone relative h-full min-h-0 overflow-hidden rounded-[28px] border-4 border-[#8B7355] bg-[#F5F0E6]">
        <Screen title="穿书设定" subtitle="可随时修改" onBack={() => setActiveApp(null)}>
          <div className="space-y-3">
            <Field label="所入世界 / 书名" value={config.worldTitle} onChange={(value) => setConfig({ ...config, worldTitle: value })} />
            <Field label="在此世的身份名" value={config.roleName} onChange={(value) => setConfig({ ...config, roleName: value })} />
            <Field label="来历与处境" value={config.roleStory} onChange={(value) => setConfig({ ...config, roleStory: value })} multiline />
            <button
              type="button"
              className={`w-full rounded-[22px] px-4 py-3 text-left text-sm ${config.hasMemory ? 'bg-[#E8DCC8]' : 'bg-white/90'}`}
              onClick={() => setConfig({ ...config, hasMemory: !config.hasMemory })}
            >
              <p className="font-medium">保留现代记忆</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--m-text-secondary)' }}>
                {config.hasMemory ? '开' : '关'}
              </p>
            </button>
            <button
              type="button"
              className="chip chip-mint w-full py-2.5"
              onClick={() => void saveJiushiConfig(props.phone.namespace, config).then(setConfig)}
            >
              保存
            </button>
          </div>
        </Screen>
      </div>
    )
  }

  return (
    <div className="jiushi-phone relative flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border-4 border-[#8B7355] bg-[#F5F0E6] shadow-[inset_0_0_40px_rgba(120,90,60,0.12)]">
      <header className="px-4 pb-2 pt-10 text-center">
        <p className="text-[11px] tracking-[0.35em]" style={{ color: 'var(--m-text-secondary)' }}>— 旧世 —</p>
        <p className="mt-1 text-base font-medium" style={{ fontFamily: '"Songti SC", "Noto Serif SC", serif' }}>
          {config?.worldTitle || '此世'}
        </p>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--m-text-secondary)' }}>
          {config?.roleName || props.phone.name} · 古风小手机
        </p>
      </header>

      <div className="scroll min-h-0 flex-1 px-4 pb-20">
        <div className="grid grid-cols-3 gap-3">
          {JIUSHI_PHONE_APPS.map((app) => (
            <button
              key={app.id}
              type="button"
              className="flex flex-col items-center gap-1.5 rounded-[20px] px-2 py-3 text-center shadow-[0_6px_14px_rgba(120,90,60,0.08)]"
              style={{ background: app.tint }}
              onClick={() => setActiveApp(app.id)}
            >
              <span className="text-lg">{app.id === 'chuanshu' ? '🪶' : app.id === 'rumu' ? '📜' : app.id === 'worldbook' ? '📚' : app.id === 'worldforge' ? '🏯' : app.id === 'roster' ? '👤' : '⚙️'}</span>
              <span className="text-xs font-medium">{app.name}</span>
            </button>
          ))}
        </div>
        <PillNote tone="mint" compact>传书 ↔ 入幕 会互相参考近期内容，与现代短信隔离。</PillNote>
      </div>

      <footer className="absolute inset-x-0 bottom-0 flex justify-center pb-3 pt-2">
        <button type="button" className="rounded-full bg-[#8B7355]/15 px-5 py-2 text-xs" onClick={props.onExit}>
          退出旧世
        </button>
      </footer>
    </div>
  )
}
