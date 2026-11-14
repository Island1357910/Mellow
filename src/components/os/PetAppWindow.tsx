import { Ellipsis, Maximize2, Minimize2, Minus, X } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { APP_BY_ID } from '../../data/apps.ts'
import { AppGlyph } from './AppGlyph.tsx'

const RATIO = 0.64
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max))

export function PetAppWindow(props: { appId: string; title: string; onClose: () => void; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null)
  const [bounds, setBounds] = useState({ width: 360, height: 640 })
  const [position, setPosition] = useState({ x: 12, y: 62, width: 310 })
  const [state, setState] = useState<'window' | 'minimized' | 'full'>('window')
  const [controls, setControls] = useState(false)
  const restore = useRef<'window' | 'full'>('window')
  const drag = useRef<{ id: number; kind: 'move' | 'resize'; x: number; y: number; origin: typeof position } | null>(null)

  useEffect(() => {
    const node = frame.current
    if (!node) return
    const measure = () => setBounds({ width: node.clientWidth, height: node.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const maxWidth = Math.max(1, Math.min(bounds.width - 12, (bounds.height - 20) * RATIO))
  const width = clamp(position.width, Math.min(245, maxWidth), maxWidth)
  const height = width / RATIO
  const x = clamp(position.x, 0, bounds.width - width - 7)
  const y = clamp(position.y, 0, bounds.height - height - 7)

  const start = (event: PointerEvent<HTMLElement>, kind: 'move' | 'resize') => {
    if (state !== 'window' || event.button !== 0 || (event.target as HTMLElement).closest('button')) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { id: event.pointerId, kind, x: event.clientX, y: event.clientY, origin: { x, y, width } }
  }
  const move = (event: PointerEvent<HTMLElement>) => {
    const pointer = drag.current
    if (pointer?.id !== event.pointerId) return
    const dx = event.clientX - pointer.x
    const dy = event.clientY - pointer.y
    if (pointer.kind === 'resize') {
      const next = clamp(pointer.origin.width + (dx + dy * RATIO) / 2, Math.min(245, maxWidth), maxWidth)
      setPosition({ x: pointer.origin.x, y: pointer.origin.y, width: next })
    } else {
      setPosition({ ...pointer.origin, x: pointer.origin.x + dx, y: pointer.origin.y + dy })
    }
  }
  const stop = () => { drag.current = null }

  return <div className="pointer-events-none absolute inset-0 z-[51]" ref={frame}>
    {state === 'minimized' ? <button type="button" className="pet-window-dock" onClick={() => setState(restore.current)} aria-label={`恢复${props.title}`}>
      <AppGlyph id={props.appId} tint={APP_BY_ID[props.appId]?.tint ?? '#E7B7C9'} size={30} ignoreCustom />
    </button> : null}
    <section aria-label={props.title} className="pet-app-window" hidden={state === 'minimized'}
      style={state === 'full' ? { inset: 0, borderRadius: 0 } : { left: x, top: y, width, height }}>
      <header className="pet-window-bar" onPointerDown={event => start(event, 'move')} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}>
        <button type="button" aria-label="窗口操作" aria-expanded={controls} onClick={() => setControls(!controls)}><Ellipsis size={23} /></button>
      </header>
      {controls ? <div className="pet-window-actions">
        <button type="button" aria-label="最小化" onClick={() => { restore.current = state === 'full' ? 'full' : 'window'; setControls(false); setState('minimized') }}><Minus size={17} /></button>
        <button type="button" aria-label={state === 'full' ? '还原小窗' : '全屏'} onClick={() => { setControls(false); setState(state === 'full' ? 'window' : 'full') }}>{state === 'full' ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
        <button type="button" aria-label="关闭" onClick={props.onClose}><X size={17} /></button>
      </div> : null}
      <div className="pet-window-content relative min-h-0 flex-1 overflow-hidden">{props.children}</div>
      {state === 'window' ? <div aria-hidden="true" className="pet-window-resize" onPointerDown={event => start(event, 'resize')} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} /> : null}
    </section>
  </div>
}
