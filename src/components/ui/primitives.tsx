import { useEffect, useRef, useState, type ChangeEvent, type CompositionEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Screen(props: {
  title: string
  subtitle?: string
  onBack?: () => void
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 px-4 pb-4 pt-12">
        {props.onBack ? (
          <button
            type="button"
            aria-label="返回"
            onClick={props.onBack}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/80 shadow-[0_4px_12px_rgba(120,80,100,0.08)] backdrop-blur transition-transform active:scale-95"
          >
            <ChevronLeft size={18} />
          </button>
        ) : (
          <span className="w-9" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-semibold leading-7 tracking-tight">{props.title}</h1>
          {props.subtitle ? (
            <p className="truncate text-xs" style={{ color: 'var(--m-text-secondary)' }}>
              {props.subtitle}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center">{props.right}</div>
      </header>
      <div className="scroll min-h-0 flex-1 px-4 pb-16">{props.children}</div>
    </div>
  )
}

const PILL_TONES = {
  pink: '#F8D0DC',
  mint: '#D5F0E4',
  butter: '#F8E6C0',
  lilac: '#E6DDF8',
  sky: '#D7E7F8',
  peach: '#F8DCC8',
} as const

export function PillNote(props: { children: ReactNode; tone?: keyof typeof PILL_TONES; compact?: boolean; inline?: boolean }) {
  const shape = props.compact
    ? 'w-fit max-w-full rounded-full px-3 py-1 text-xs leading-5'
    : props.inline
      ? 'mt-2 w-fit max-w-full rounded-[18px] px-3 py-1.5 text-xs leading-5'
      : 'mx-auto mt-10 w-fit max-w-[17rem] rounded-full px-4 py-2.5 text-center text-xs leading-5 shadow-[0_10px_22px_rgba(120,80,100,0.08)]'
  return (
    <p className={shape} style={{ background: PILL_TONES[props.tone ?? 'pink'] }}>
      {props.children}
    </p>
  )
}

export function Field(props: {
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  type?: 'text' | 'password' | 'url'
  multiline?: boolean
}) {
  const className = 'soft-input mt-1 w-full'
  const composing = useRef(false)
  const [local, setLocal] = useState(props.value)

  useEffect(() => {
    if (!composing.current) setLocal(props.value)
  }, [props.value])

  const commit = (next: string) => {
    setLocal(next)
    if (!composing.current) props.onChange(next)
  }

  const shared = {
    value: local,
    placeholder: props.placeholder,
    onBlur: props.onBlur,
    onCompositionStart: () => {
      composing.current = true
    },
    onCompositionEnd: (event: CompositionEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      composing.current = false
      const next = event.currentTarget.value
      setLocal(next)
      props.onChange(next)
    },
    onChange: (event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      commit(event.target.value)
    },
  }

  return (
    <label className="block">
      <span className="mb-1.5 block text-xs" style={{ color: 'var(--m-text-secondary)' }}>
        {props.label}
      </span>
      {props.multiline ? (
        <textarea {...shared} rows={3} className={className} />
      ) : (
        <input {...shared} type={props.type ?? 'text'} className={className} />
      )}
    </label>
  )
}

export function Toggle(props: { label: string; hint?: string; on: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={props.on}
      onClick={() => props.onChange(!props.on)}
      className="flex w-full items-center gap-3 py-2 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm">{props.label}</span>
        {props.hint ? (
          <span className="mt-0.5 block text-xs leading-5" style={{ color: 'var(--m-text-secondary)' }}>
            {props.hint}
          </span>
        ) : null}
      </span>
      <span
        className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
        style={{ background: props.on ? 'var(--m-primary)' : '#e6e0da' }}
      >
        <span
          className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow"
          style={{ left: props.on ? '22px' : '2px' }}
        />
      </span>
    </button>
  )
}

export function SoftCard(props: { children: ReactNode; className?: string }) {
  return (
    <section className={`menu-card ${props.className ?? ''}`.trim()}>
      {props.children}
    </section>
  )
}

/** 挂到 document.body，避免手机壳 transform 影响 fixed 居中 */
export function ModalPortal(props: { children: ReactNode; onClose: () => void }) {
  return createPortal(
    <div className="modal-overlay modal-portal" onClick={props.onClose}>
      {props.children}
    </div>,
    document.body,
  )
}

export function MenuRow(props: { icon: ReactNode; tint: string; label: string; detail?: string; onClick: () => void }) {
  return (
    <button type="button" className="menu-row" onClick={props.onClick}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-white" style={{ background: props.tint }}>
        {props.icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{props.label}</span>
      {props.detail ? (
        <span className="max-w-[8rem] truncate text-xs" style={{ color: 'var(--m-text-secondary)' }}>{props.detail}</span>
      ) : null}
      <ChevronRight size={16} className="shrink-0 opacity-35" />
    </button>
  )
}

export function SectionTitle(props: { children: ReactNode; tone?: keyof typeof PILL_TONES }) {
  void props.tone
  return <p className="mb-2 text-sm font-medium">{props.children}</p>
}
