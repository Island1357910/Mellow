import { useEffect, useState } from 'react'
import { loadJiushiConfig, saveJiushiConfig, type JiushiConfig } from '../../../lib/jiushi.ts'
import { JIUSHI_PHONE_APPS, jiushiWorldNs, type JiushiPhoneAppId } from '../../../lib/jiushiPhone.ts'
import { useMellow } from '../../../store/useMellow.ts'
import type { Identity } from '../../../types/index.ts'
import { Field } from '../../ui/primitives.tsx'
import { StoryApp } from '../StoryApp.tsx'
import { WorldBookApp } from '../WorldBookApp.tsx'
import { WorldForgeApp } from '../WorldForgeApp.tsx'
import { JiushiAppTile, JiushiNote, JiushiScreen, JiushiShell } from './JiushiShell.tsx'
import { JiushiChuanShuApp } from './JiushiChuanShuApp.tsx'
import { JiushiRosterApp } from './JiushiRosterApp.tsx'

function SetupForm(props: {
  config: JiushiConfig
  phone: Identity
  onBack?: () => void
  onSave: (config: JiushiConfig) => void
  submitLabel: string
}) {
  const [config, setConfig] = useState(props.config)
  return (
    <JiushiScreen title="穿书" subtitle="定身份，再入境" onBack={props.onBack}>
      <div className="space-y-3">
        <div className="jiushi-card p-4">
          <p className="text-xs leading-6" style={{ color: 'var(--js-ink-soft)' }}>
            在此世醒来之前，先写下所入之书与身份。设定可随时在「穿书」中修改。
          </p>
        </div>
        <div className="jiushi-field">
          <Field label="所入世界 / 书名" value={config.worldTitle} onChange={(value) => setConfig({ ...config, worldTitle: value })} />
        </div>
        <div className="jiushi-field">
          <Field label="在此世的身份名" value={config.roleName} onChange={(value) => setConfig({ ...config, roleName: value })} placeholder={props.phone.name} />
        </div>
        <div className="jiushi-field">
          <Field label="来历与处境" value={config.roleStory} onChange={(value) => setConfig({ ...config, roleStory: value })} multiline />
        </div>
        <button
          type="button"
          className={`jiushi-toggle ${config.hasMemory ? 'is-on' : ''}`}
          onClick={() => setConfig({ ...config, hasMemory: !config.hasMemory })}
        >
          <p className="font-medium" style={{ fontFamily: 'var(--js-serif)' }}>保留现代记忆</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--js-ink-muted)' }}>
            {config.hasMemory ? '开：仍记得穿书前的事，用到才提' : '关：在此世醒来，只有当前身份'}
          </p>
        </button>
        <button
          type="button"
          className="jiushi-btn jiushi-btn-primary jiushi-btn-block py-3"
          onClick={() => void props.onSave({
            ...config,
            setupDone: true,
            roleName: config.roleName.trim() || props.phone.name,
          })}
        >
          {props.submitLabel}
        </button>
      </div>
    </JiushiScreen>
  )
}

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
      <JiushiShell>
        <SetupForm
          config={config}
          phone={props.phone}
          onBack={props.onExit}
          submitLabel="进入旧世"
          onSave={(next) => {
            void saveJiushiConfig(props.phone.namespace, next).then((saved) => {
              setConfig(saved)
              setSetupMode(false)
            })
          }}
        />
      </JiushiShell>
    )
  }

  if (activeApp === 'rumu') {
    return (
      <JiushiShell>
        <StoryApp mode="jiushi" onBack={() => setActiveApp(null)} />
      </JiushiShell>
    )
  }
  if (activeApp === 'chuanshu') {
    return (
      <JiushiShell>
        <JiushiChuanShuApp phone={props.phone} onBack={() => setActiveApp(null)} />
      </JiushiShell>
    )
  }
  if (activeApp === 'roster') {
    return (
      <JiushiShell>
        <JiushiRosterApp phone={props.phone} onBack={() => setActiveApp(null)} />
      </JiushiShell>
    )
  }
  if (activeApp === 'worldbook') {
    return (
      <JiushiShell>
        <WorldBookApp
          onBack={() => setActiveApp(null)}
          namespaceOverride={jiushiWorldNs(props.phone.namespace)}
          defaultScope="world"
        />
      </JiushiShell>
    )
  }
  if (activeApp === 'worldforge') {
    return (
      <JiushiShell>
        <WorldForgeApp onBack={() => setActiveApp(null)} jiushi worldNamespace={jiushiWorldNs(props.phone.namespace)} />
      </JiushiShell>
    )
  }
  if (activeApp === 'setup' && config) {
    return (
      <JiushiShell>
        <SetupForm
          config={config}
          phone={props.phone}
          onBack={() => setActiveApp(null)}
          submitLabel="保存"
          onSave={(next) => void saveJiushiConfig(props.phone.namespace, next).then(setConfig)}
        />
      </JiushiShell>
    )
  }

  return (
    <JiushiShell>
      <header className="jiushi-header">
        <p className="jiushi-header-eyebrow">旧世小手机</p>
        <h1 className="jiushi-header-title">{config?.worldTitle || '此世'}</h1>
        <p className="jiushi-header-sub">{config?.roleName || props.phone.name} · 穿书入境</p>
        <div className="jiushi-seal-line">传书 · 入幕 · 世界</div>
      </header>

      <div className="scroll min-h-0 flex-1 px-4 pb-20">
        <div className="jiushi-app-grid">
          {JIUSHI_PHONE_APPS.map((app) => (
            <JiushiAppTile
              key={app.id}
              appId={app.id}
              name={app.name}
              blurb={app.blurb}
              onClick={() => setActiveApp(app.id)}
            />
          ))}
        </div>
        <JiushiNote>
          传书与入幕会互相参考近期内容；此世人物与现代短信隔离，各成一卷。
        </JiushiNote>
      </div>

      <footer className="jiushi-footer">
        <button type="button" className="jiushi-btn jiushi-btn-ghost" onClick={props.onExit}>
          退出旧世
        </button>
      </footer>
    </JiushiShell>
  )
}
