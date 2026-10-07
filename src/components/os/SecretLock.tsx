import { useState } from 'react'
import { sameSecret } from '../../lib/secret.ts'

const PIN_LENGTH = 6

/** iPhone 布局：7 下方为取消 ×，中间 0，右侧删除 */
const IPHONE_KEYS: Array<{ key: string; label?: string } | null> = [
  { key: '1' },
  { key: '2' },
  { key: '3' },
  { key: '4' },
  { key: '5' },
  { key: '6' },
  { key: '7' },
  { key: '8' },
  { key: '9' },
  { key: 'cancel', label: '×' },
  { key: '0' },
  { key: '⌫' },
]

function PinDots(props: { length: number; filled: number }) {
  return (
    <div className="flex justify-center gap-[14px]">
      {Array.from({ length: props.length }, (_, index) => (
        <span
          key={index}
          className="h-[11px] w-[11px] rounded-full border transition-all duration-150"
          style={{
            borderColor: index < props.filled ? '#F3A8BA' : 'rgba(58, 58, 58, 0.22)',
            background: index < props.filled ? '#F3A8BA' : 'transparent',
            transform: index < props.filled ? 'scale(1.05)' : 'scale(1)',
          }}
        />
      ))}
    </div>
  )
}

function IphonePinPad(props: { onKey: (key: string) => void; onCancel?: () => void }) {
  return (
    <div className="mx-auto grid w-[min(100%,252px)] grid-cols-3 gap-x-6 gap-y-3">
      {IPHONE_KEYS.map((item, index) => {
        if (!item) return <span key={index} />
        const { key, label } = item
        const isCancel = key === 'cancel'
        const isDelete = key === '⌫'
        return (
          <button
            key={key}
            type="button"
            aria-label={isCancel ? '取消' : isDelete ? '删除' : key}
            className="lock-key grid h-[72px] w-[72px] place-items-center rounded-full text-[32px] font-light transition-transform active:scale-95"
            style={{
              color: isCancel ? 'var(--m-text-secondary)' : '#2f2f2f',
              fontSize: isCancel ? '28px' : isDelete ? '22px' : '32px',
              fontWeight: isCancel ? 400 : 300,
            }}
            onClick={() => {
              if (isCancel) props.onCancel?.()
              else props.onKey(key)
            }}
          >
            {label ?? key}
          </button>
        )
      })}
    </div>
  )
}

export function SecretLock(props: {
  hash: string
  title?: string
  hint?: string
  onPass: () => void
  onCancel?: () => void
}) {
  const [digits, setDigits] = useState('')
  const [error, setError] = useState('')

  const submitPin = async (value: string) => {
    if (await sameSecret(value, props.hash)) props.onPass()
    else {
      setError('密码不对')
      setDigits('')
    }
  }

  const press = (key: string) => {
    setError('')
    if (key === '⌫') {
      setDigits((current) => current.slice(0, -1))
      return
    }
    const next = (digits + key).slice(0, PIN_LENGTH)
    setDigits(next)
    if (next.length === PIN_LENGTH) void submitPin(next)
  }

  return (
    <div className="relative z-20 h-full min-h-0">
      <div className="absolute inset-x-0 top-[53%] w-full -translate-y-1/2 px-5">
        <div className="mx-auto w-full max-w-[320px] text-center">
        <PinDots length={PIN_LENGTH} filled={digits.length} />
        {error ? (
          <p className="mt-4 text-[13px] font-medium" style={{ color: '#b0505c' }}>
            {error}
          </p>
        ) : (
          <p className="mt-4 h-5" aria-hidden />
        )}
        <div className="mt-8">
          <IphonePinPad onKey={press} onCancel={props.onCancel} />
        </div>
        </div>
      </div>
    </div>
  )
}

export function PasswordSetup(props: { onSave: (secret: string) => void; label?: string }) {
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const [stage, setStage] = useState<'a' | 'b'>('a')
  const [error, setError] = useState('')
  const current = stage === 'a' ? first : second

  const press = (key: string) => {
    setError('')
    const apply = (value: string) => (stage === 'a' ? setFirst(value) : setSecond(value))
    if (key === '⌫') {
      apply(current.slice(0, -1))
      return
    }
    const next = (current + key).slice(0, PIN_LENGTH)
    apply(next)
    if (next.length !== PIN_LENGTH) return
    if (stage === 'a') {
      setStage('b')
      return
    }
    if (next !== first) {
      setError('两次不一样')
      setSecond('')
      setStage('a')
      setFirst('')
      return
    }
    props.onSave(next)
  }

  return (
    <div className="rounded-[24px] bg-white/70 p-4">
      <p className="text-center text-xs font-medium" style={{ color: 'var(--m-text-secondary)' }}>
        {props.label ?? (stage === 'a' ? '输入六位密码' : '再输入一次')}
      </p>
      <div className="mt-4">
        <PinDots length={PIN_LENGTH} filled={current.length} />
      </div>
      <div className="mt-5">
        <IphonePinPad onKey={press} onCancel={() => {
          setFirst('')
          setSecond('')
          setStage('a')
          setError('')
        }} />
      </div>
      {error ? <p className="mt-3 text-center text-xs" style={{ color: '#b0505c' }}>{error}</p> : null}
    </div>
  )
}
