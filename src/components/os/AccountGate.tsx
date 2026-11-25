import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { accountSessionChanged, workshop, workshopURL, workshopWithTimeout, type WorkshopUser } from '../../lib/workshop.ts'
import { themeStyle } from '../../theme/applyTheme.ts'
import { BUNDLED_THEMES } from '../../theme/themes.ts'
import '../apps/workshop.css'

const Account = createContext<{ user: WorkshopUser; signOut: () => Promise<void> } | null>(null)

function unchangedUser(previous: WorkshopUser | null, next: WorkshopUser | null) {
  return previous === next || Boolean(previous && next && previous.id === next.id && previous.email === next.email &&
    previous.reviewer === next.reviewer && previous.warnings.length === next.warnings.length &&
    previous.warnings.every((warning, index) => warning.id === next.warnings[index].id))
}

export function useAccount() {
  return useContext(Account)
}

export function AccountGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<WorkshopUser | null>(null)
  const [checking, setChecking] = useState(Boolean(workshopURL))
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [dismissedWarning, dismissWarning] = useState(0)
  const sessionVersion = useRef(0)

  useEffect(() => {
    if (!workshopURL) return
    let live = true
    let pending: AbortController | undefined
    const verify = () => {
      if (pending) return
      pending = new AbortController()
      const version = sessionVersion.current
      const current = () => live && version === sessionVersion.current
      void workshopWithTimeout<WorkshopUser | null>('/auth/me', 'GET', undefined, pending)
        .then(value => { if (current()) setUser(previous => unchangedUser(previous, value) ? previous : value) })
        .catch(() => {
          if (current()) setNote('暂时无法连接账号服务。')
        })
        .finally(() => { pending = undefined; if (current()) setChecking(false) })
    }
    verify()
    const expired = () => {
      sessionVersion.current++
      setUser(null)
      setNote('登录已失效，请重新登录。')
    }
    const verifyVisible = () => { if (!document.hidden) verify() }
    const timer = window.setInterval(verifyVisible, 60_000)
    document.addEventListener('visibilitychange', verifyVisible)
    window.addEventListener(accountSessionChanged, expired)
    return () => {
      live = false
      pending?.abort()
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', verifyVisible)
      window.removeEventListener(accountSessionChanged, expired)
    }
  }, [])

  async function perform(operation: () => Promise<void>) {
    setBusy(true)
    setNote('')
    try { await operation() }
    catch (error) { setNote(error instanceof Error ? error.message : '暂时无法登录') }
    finally { setBusy(false) }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void perform(async () => {
      const signedIn = await workshop<WorkshopUser>('/auth/' + mode, 'POST', { email, password, ...(mode === 'register' ? { code: code.trim() } : {}) })
      sessionVersion.current++
      dismissWarning(0)
      setUser(signedIn)
      setEmail('')
      setPassword('')
      setCode('')
    })
  }

  const warning = user?.warnings.find(item => item.id > dismissedWarning)
  if (user && !warning) return <Account.Provider value={{ user, signOut: async () => {
    await workshop('/auth/logout', 'POST')
    sessionVersion.current++
    setUser(null)
  } }}>{children}</Account.Provider>

  const theme = BUNDLED_THEMES.find(item => item.id === 'theme_macaron')!
  return <main className="mellow-account" style={themeStyle(theme)}>
    <section className="workshop account-card" aria-label="半糖账号">
      <header className="workshop-hero"><span>半糖 · Mellow</span><h1>{warning ? '账号警告' : '打开小手机'}</h1></header>
      {warning ? <>
        <p>{warning.message}</p>
        <button onClick={() => dismissWarning(warning.id)}>我知道了</button>
      </> : !workshopURL ? <p role="status">此版本尚未配置账号服务。</p>
        : checking ? <p role="status">正在检查登录状态…</p>
        : <>
          <nav className="workshop-tabs" aria-label="账号操作">
            <button type="button" aria-pressed={mode === 'login'} onClick={() => { setMode('login'); setNote('') }}>登录</button>
            <button type="button" aria-pressed={mode === 'register'} onClick={() => { setMode('register'); setNote('') }}>注册</button>
          </nav>
          <form onSubmit={submit}>
            <label>邮箱<input type="email" autoComplete="username" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></label>
            {mode === 'register' && <>
              <button type="button" disabled={busy || !email} onClick={() => void perform(async () => {
                await workshop('/auth/email', 'POST', { email })
                setNote('请查收邮箱验证码。已有密码的账号可以直接登录。')
              })}>发送邮箱验证码</button>
              <label>邮箱验证码<input required autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)} /></label>
            </>}
            <label>密码<input type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required minLength={12} maxLength={256} value={password} onChange={event => setPassword(event.target.value)} /></label>
            {mode === 'register' && <p>密码至少 12 个字符。</p>}
            <button className="workshop-primary" disabled={busy}>{mode === 'register' ? '注册并进入' : '登录并进入'}</button>
          </form>
        </>}
      {note && <p role="status">{note}</p>}
    </section>
  </main>
}
