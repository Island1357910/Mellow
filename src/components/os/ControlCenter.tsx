import type { ReactNode } from 'react'
import { BellOff, Eye, Sparkles, SunMedium } from 'lucide-react'
import { useMellow } from '../../store/useMellow.ts'
const PROACTIVE_MINUTES = [0, 30, 60, 120, 240] as const

export function ControlCenter() {
  const open = useMellow((state) => state.controlOpen)
  const setControl = useMellow((state) => state.setControl)
  const brightness = useMellow((state) => state.brightness)
  const setBrightness = useMellow((state) => state.setBrightness)
  const settings = useMellow((state) => state.settings)
  const patchSettings = useMellow((state) => state.patchSettings)
  const identities = useMellow((state) => state.identities)
  const phone = identities.find((item) => item.id === settings.activeIdentityId)

  if (!open) return null

  return (
    <div className="absolute inset-0 z-40 bg-black/15" onClick={() => setControl(false)}>
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-[32px] bg-[var(--m-surface)] px-4 pb-12 pt-4 shadow-[var(--m-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-black/10" />
        <label className="mb-4 block rounded-3xl bg-white/80 px-4 py-3">
          <span className="mb-2 flex items-center gap-2 text-sm">
            <SunMedium size={16} /> 亮度
          </span>
          <input
            type="range"
            min={0.45}
            max={1}
            step={0.01}
            value={brightness}
            onChange={(event) => setBrightness(Number(event.target.value))}
            className="w-full accent-[var(--m-accent)]"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Tile
            icon={<BellOff size={16} />}
            label="免打扰"
            on={settings.dnd}
            onClick={() => void patchSettings({ dnd: !settings.dnd })}
          />
          <Tile
            icon={<Eye size={16} />}
            label="第四面墙"
            on={settings.fourthWall}
            onClick={() => void patchSettings({ fourthWall: !settings.fourthWall })}
          />
        </div>
        <div className="mt-2 rounded-3xl bg-white/80 px-4 py-3">
          <p className="mb-2 flex items-center gap-2 text-sm">
            <Sparkles size={16} /> 主动开口
          </p>
          <div className="grid grid-cols-5 gap-1">
            {PROACTIVE_MINUTES.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => void patchSettings({ proactiveMinutes: minutes })}
                className="rounded-full py-1.5 text-xs"
                style={{
                  background: settings.proactiveMinutes === minutes ? 'var(--m-primary)' : 'transparent',
                }}
              >
                {minutes === 0 ? '关' : `${minutes}分`}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs leading-5" style={{ color: 'var(--m-text-secondary)' }}>
            你超过设定分钟没回，角色可能会自己发消息。间隔越短越费 token。
          </p>
        </div>
        <p className="mt-3 px-1 text-xs" style={{ color: 'var(--m-text-secondary)' }}>
          现在这台手机是 {phone?.avatar} {phone?.name}
          {settings.fourthWall ? ' · 角色知道屏幕外有人' : ' · 角色还以为彼此都是真人'}
        </p>
      </div>
    </div>
  )
}

function Tile(props: { icon: ReactNode; label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="flex items-center gap-2 rounded-3xl px-4 py-4 text-left text-sm"
      style={{ background: props.on ? 'var(--m-primary)' : 'rgba(255,255,255,0.8)' }}
    >
      {props.icon}
      {props.label}
    </button>
  )
}
