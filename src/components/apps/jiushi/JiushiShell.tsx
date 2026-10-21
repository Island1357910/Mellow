import type { ReactNode } from 'react'
import './jiushi.css'

const APP_GLYPH: Record<string, string> = {
  chuanshu: '🪶',
  rumu: '📜',
  worldbook: '📚',
  worldforge: '🏯',
  roster: '👤',
  setup: '⚙️',
}

export function JiushiShell(props: { children: ReactNode; className?: string }) {
  return (
    <div className={`jiushi-phone ${props.className ?? ''}`.trim()}>
      <div className="jiushi-paper" aria-hidden />
      <div className="jiushi-frame" aria-hidden />
      <div className="jiushi-body">{props.children}</div>
    </div>
  )
}

export function JiushiAppTile(props: {
  glyph?: string
  appId?: string
  name: string
  blurb: string
  onClick: () => void
}) {
  const icon = props.glyph ?? (props.appId ? APP_GLYPH[props.appId] : '卷')
  return (
    <button type="button" className="jiushi-app-tile" data-no-swipe onClick={props.onClick}>
      <span className="jiushi-app-tile-icon">{icon}</span>
      <span className="jiushi-app-tile-name">{props.name}</span>
      <span className="jiushi-app-tile-blurb">{props.blurb}</span>
    </button>
  )
}

export function JiushiNote(props: { children: ReactNode; compact?: boolean }) {
  if (props.compact) return <p className="jiushi-note-compact">{props.children}</p>
  return <div className="jiushi-note">{props.children}</div>
}

export function JiushiScreen(props: {
  title: string
  subtitle?: string
  onBack?: () => void
  children: ReactNode
}) {
  return (
    <>
      <header className="jiushi-screen-head">
        {props.onBack ? (
          <button type="button" aria-label="返回" className="jiushi-back" onClick={props.onBack}>←</button>
        ) : (
          <span className="w-9" />
        )}
        <div className="jiushi-screen-title">
          <h1>{props.title}</h1>
          {props.subtitle ? <p>{props.subtitle}</p> : null}
        </div>
      </header>
      <div className="scroll min-h-0 flex-1 px-4 pb-16">{props.children}</div>
    </>
  )
}
