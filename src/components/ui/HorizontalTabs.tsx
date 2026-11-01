import { useRef, type ReactNode } from 'react'

/** Native touch scrolling, plus dragging for desktop mice. */
export function HorizontalTabs({ children, className, label }: { children: ReactNode; className: string; label: string }) {
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null)
  return <nav className={className} aria-label={label} data-no-swipe
    onPointerDown={event => {
      drag.current = null
      if (event.pointerType !== 'mouse' || event.button !== 0) return
      drag.current = { x: event.clientX, left: event.currentTarget.scrollLeft, moved: false }
    }}
    onPointerMove={event => {
      const start = drag.current
      if (!start) return
      const distance = start.x - event.clientX
      if (!start.moved && Math.abs(distance) < 5) return
      start.moved = true
      event.currentTarget.setPointerCapture(event.pointerId)
      event.currentTarget.scrollLeft = start.left + distance
      event.preventDefault()
    }}
    onPointerUp={() => { if (drag.current && !drag.current.moved) drag.current = null }}
    onPointerCancel={() => { drag.current = null }}
    onLostPointerCapture={() => { /* Preserve the drag flag until the synthetic click. */ }}
    onClickCapture={event => {
      if (drag.current?.moved) { event.preventDefault(); event.stopPropagation() }
      drag.current = null
    }}
    onFocusCapture={event => {
      if (event.target instanceof HTMLElement) event.target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }}>{children}</nav>
}
