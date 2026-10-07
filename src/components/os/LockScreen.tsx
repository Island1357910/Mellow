import { AnimatePresence, motion } from 'framer-motion'
import { ChevronUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatClock, formatLockDate } from '../../lib/format.ts'
import { useMellow } from '../../store/useMellow.ts'
import { MellowMark } from '../ui/MellowMark.tsx'
import { SecretLock } from './SecretLock.tsx'

function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

export function LockFace(props: { now: Date; onSwipeUp: () => void; hint?: string }) {
  return (
    <motion.div
      key="face"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.28 }}
      className="absolute inset-0 z-10 flex flex-col"
      drag="y"
      dragConstraints={{ top: -160, bottom: 0 }}
      dragElastic={0.14}
      onDragEnd={(_, info) => {
        if (info.offset.y < -52) props.onSwipeUp()
      }}
    >
      <div className="relative z-10 px-6 pt-[4.5rem] text-center">
        <p className="lock-time clock-face tabular leading-none">{formatClock(props.now)}</p>
        <p className="clock-date mt-3 text-[15px]" style={{ color: 'var(--m-text-secondary)' }}>
          {formatLockDate(props.now)}
        </p>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-[48%] flex -translate-y-1/2 flex-col items-center text-center">
        <MellowMark size={132} className="drop-shadow-[0_12px_28px_rgba(243,168,186,0.34)]" />
        <p className="lock-brand mt-4 leading-none">半糖</p>
        <p className="lock-brand-sub mt-2">· Mellow ·</p>
      </div>
      <motion.button
        type="button"
        className="relative z-10 mb-20 mt-auto flex w-full flex-col items-center gap-1.5 text-[13px]"
        style={{ color: 'var(--m-text-secondary)' }}
        onClick={props.onSwipeUp}
      >
        <ChevronUp size={18} strokeWidth={1.75} />
        {props.hint ?? '上滑输入密码'}
      </motion.button>
    </motion.div>
  )
}

export function LockScreen() {
  const now = useNow()
  const unlock = useMellow((state) => state.unlock)
  const privacy = useMellow((state) => state.settings.privacy)
  const [showPin, setShowPin] = useState(false)

  if (privacy.enabled && privacy.hash) {
    return (
      <div className="absolute inset-0 z-20 overflow-hidden">
        <Wallpaper />
        <AnimatePresence mode="wait">
          {!showPin ? (
            <LockFace key="face" now={now} onSwipeUp={() => setShowPin(true)} />
          ) : (
            <motion.div
              key="pin"
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 28 }}
              transition={{ duration: 0.28 }}
              className="absolute inset-0 z-10"
            >
              <SecretLock hash={privacy.hash} onPass={unlock} onCancel={() => setShowPin(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 z-10 overflow-hidden">
      <Wallpaper />
      <LockFace now={now} onSwipeUp={unlock} hint="上滑解锁" />
    </div>
  )
}

export function Wallpaper() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--m-primary) 38%, var(--m-background)) 0%, var(--m-background) 44%, color-mix(in srgb, var(--m-secondary) 32%, var(--m-background)) 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(420px 280px at 12% 8%, color-mix(in srgb, var(--m-primary) 42%, transparent), transparent 70%), radial-gradient(380px 260px at 88% 18%, color-mix(in srgb, var(--m-secondary) 40%, transparent), transparent 68%)',
        }}
      />
    </>
  )
}
