import { ChevronLeft, Check, Settings2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PHONE_APPS } from '../../data/apps.ts'
import { storage } from '../../storage/StorageService.ts'
import { AppGlyph } from './AppGlyph.tsx'

const apps = PHONE_APPS.filter(app => app.home)

export function AppSidebar({ namespace, onOpen }: { namespace: string; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState<string[] | null>(null)
  const gesture = useRef<{ x: number; y: number; pointer: number; timer?: number } | null>(null)
  const cancel = () => {
    window.clearTimeout(gesture.current?.timer)
    gesture.current = null
  }
  useEffect(() => {
    let live = true
    void storage.getBag<string[]>(namespace, 'pet_quick_apps').then(saved => {
      if (live) setSelected(saved ?? apps.map(app => app.id))
    }).catch(() => { if (live) setSelected(apps.map(app => app.id)) })
    return () => { live = false; cancel() }
  }, [namespace])
  const close = () => { setOpen(false); setEditing(false) }
  return <>
    <button type="button" aria-label="快捷应用，向左滑并停留半秒" className="app-sidebar-handle"
      onPointerDown={event => {
        if (event.button !== 0) return
        cancel()
        gesture.current = { x: event.clientX, y: event.clientY, pointer: event.pointerId }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={event => {
        const press = gesture.current
        if (!press || event.pointerId !== press.pointer) return
        if (press.x - event.clientX < 30 || Math.abs(press.y - event.clientY) > 42) {
          window.clearTimeout(press.timer)
          press.timer = undefined
        } else if (press.timer === undefined) {
          press.timer = window.setTimeout(() => { cancel(); setOpen(true) }, 500)
        }
      }}
      onPointerUp={cancel} onPointerCancel={cancel} onLostPointerCapture={cancel}
      onClick={event => { if (event.detail === 0) setOpen(true) }}><ChevronLeft size={10} /></button>
    {open ? <>
      <button type="button" className="app-sidebar-scrim" aria-label="收起快捷应用" onClick={close} />
      <aside className="app-sidebar" aria-label="快捷应用">
        <header>
          <button type="button" aria-label={editing ? '完成设置' : '设置快捷应用'} onClick={() => setEditing(!editing)}>
            {editing ? <Check size={19} /> : <Settings2 size={19} />}
          </button>
          <button type="button" aria-label="关闭侧边栏" onClick={close}><X size={18} /></button>
        </header>
        <div className="app-sidebar-grid">
          {apps.filter(app => editing || selected?.includes(app.id)).map(app => <button type="button" key={app.id}
            aria-pressed={editing ? selected?.includes(app.id) : undefined} onClick={() => {
              if (!editing) { close(); onOpen(app.id); return }
              const ids = selected ?? []
              const next = ids.includes(app.id) ? ids.filter(id => id !== app.id) : [...ids, app.id]
              setSelected(next)
              void storage.setBag(namespace, 'pet_quick_apps', next)
            }}>
            <AppGlyph id={app.id} tint={app.tint} size={39} ignoreCustom />
            <span>{app.name}</span>
          </button>)}
        </div>
      </aside>
    </> : null}
  </>
}
