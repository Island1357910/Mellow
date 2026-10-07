import type { CSSProperties, ReactNode } from 'react'

export type PickCardItem = {
  id: string
  name: string
  blurb: string
  emoji: string
  tint: string
  accent: string
  badge?: string
}

export function PickCard(props: {
  item: PickCardItem
  selected?: boolean
  disabled?: boolean
  onClick: () => void
  check?: ReactNode
}) {
  const style = {
    '--pick-tint': props.item.tint,
    '--pick-accent': props.item.accent,
  } as CSSProperties
  return (
    <button
      type="button"
      aria-pressed={props.selected}
      disabled={props.disabled}
      className={`pick-card${props.selected ? ' is-selected' : ''}${props.disabled ? ' is-disabled' : ''}`}
      style={style}
      onClick={props.onClick}
    >
      <span className="pick-card-glow" aria-hidden />
      <span className="pick-card-top">
        <span className="pick-card-icon" aria-hidden>{props.item.emoji}</span>
        {props.item.badge ? <span className="pick-card-badge">{props.item.badge}</span> : null}
      </span>
      <span className="pick-card-name">{props.item.name}</span>
      <span className="pick-card-blurb">{props.item.blurb}</span>
      {props.selected ? <span className="pick-card-check" aria-hidden>{props.check ?? '✓'}</span> : null}
    </button>
  )
}
