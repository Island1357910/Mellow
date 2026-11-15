import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { BookOpen, Download, X } from 'lucide-react'
import { APP_VERSION } from '../../lib/buildInfo.ts'
import { openRedeemCodes } from '../../lib/redeem.ts'
import { ModalPortal } from '../ui/primitives.tsx'

const seenKey = 'mellow_announcement_seen_version'
let seenInSession = ''

const recentUpdates = [
  { version: '2.0.3', text: '图片接口可保存带参数的地址。世界搭建再次导入同名角色会覆盖设定并保留聊天。本人照片按写实自拍生成，旧手机可以进入直播间和千味面包房。' },
  { version: '2.0.2', text: '角色按人设和行动管理余额，可发红包、转账并授权亲密付。新增隐性好感、生图模型拉取，桌面第三页扩为 24 格。' },
  { version: '2.0.1', text: '短信、朋友圈、星博和商店可按情境配图。新增版本公告，快捷应用轻点即开，并修复 DOCX 导入、优化手机端加载。' },
  { version: '2.0.0', text: '群聊按情境自然接话，加入塞纳河畔主题，更新短信、故事、直播间和千味面包房。' },
  { version: '1.1.40', text: '直播间接入小手机，可从桌面打开。' },
  { version: '1.1.39', text: '聊天背景支持更大的图片，改进会话设置的保存。' },
]

function alreadySeen() {
  if (seenInSession === APP_VERSION) return true
  try { return localStorage.getItem(seenKey) === APP_VERSION } catch { return false }
}

export function UpdateAnnouncement() {
  const [open, setOpen] = useState(() => !alreadySeen())
  const [codes] = useState(() => openRedeemCodes())
  const [feedback, setFeedback] = useState('')
  const dialog = useRef<HTMLElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const close = () => setOpen(false)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement
    closeButton.current?.focus()
    seenInSession = APP_VERSION
    try { localStorage.setItem(seenKey, APP_VERSION) } catch { /* 当前会话仍能记住 */ }
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus() }
  }, [open])

  const handleKeys = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      close()
    }
    if (event.key !== 'Tab') return
    const items = dialog.current?.querySelectorAll<HTMLElement>('button, a[href]')
    if (!items?.length) return
    const first = items[0]!
    const last = items[items.length - 1]!
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  if (!open) return null
  return <ModalPortal onClose={close}>
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="mellow-update-title"
      className="flex max-h-[86vh] w-full max-w-[390px] flex-col rounded-[26px] bg-[var(--m-surface)] text-[var(--m-text)] shadow-[var(--m-shadow)]"
      onClick={event => event.stopPropagation()} onKeyDown={handleKeys}>
      <header className="flex shrink-0 items-center justify-between gap-2 px-5 pb-3 pt-5">
        <h2 id="mellow-update-title" className="text-lg font-semibold">更新公告 <span className="text-sm font-normal text-[var(--m-text-secondary)]">{APP_VERSION}</span></h2>
        <button ref={closeButton} type="button" aria-label="关闭公告" className="grid h-9 w-9 place-items-center rounded-full bg-[var(--m-background)]" onClick={close}><X size={17} /></button>
      </header>
      <div className="scroll min-h-0 space-y-4 overflow-y-auto px-5 pb-4 text-sm">
        <section>
          <h3 className="mb-2 font-semibold">近期更新</h3>
          <ul className="space-y-2">
            {recentUpdates.map(update => <li key={update.version} className="flex items-baseline gap-2 leading-5">
              <span className="shrink-0 font-semibold">{update.version}</span><span>{update.text}</span>
            </li>)}
          </ul>
        </section>
        <section>
          <h3 className="mb-2 font-semibold">当前可用兑换码</h3>
          {codes.length ? <ul className="space-y-2">{codes.map(({ code, note }) => <li key={code} className="rounded-2xl bg-[var(--m-background)] px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <code className="break-words font-sans font-semibold select-all">{code}</code>
              <button type="button" className="chip shrink-0" aria-label={`复制兑换码 ${code}`} onClick={async () => {
                try { await navigator.clipboard.writeText(code); setFeedback(`已复制 ${code}`) }
                catch { setFeedback('复制失败，可选中兑换码手动复制') }
              }}>复制</button>
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--m-text-secondary)]">{note}</p>
          </li>)}</ul> : <p className="text-[var(--m-text-secondary)]">当前没有可用兑换码。</p>}
          {codes.length > 0 && <p className="mt-2 text-xs text-[var(--m-text-secondary)]">在「设置 → 身份 → 兑换码」输入兑换码。</p>}
          {feedback && <p role="status" className="mt-2 text-xs">{feedback}</p>}
        </section>
      </div>
      <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[var(--m-background)] px-5 py-3">
        <a className="chip flex items-center gap-1.5" href="https://mymellow.top/guide.html" target="_blank" rel="noreferrer"><BookOpen size={14} />使用教程</a>
        <a className="chip flex items-center gap-1.5" href="https://mymellow.top/downloads/" target="_blank" rel="noreferrer"><Download size={14} />下载 APK</a>
        <button type="button" className="chip chip-solid ml-auto" onClick={close}>知道了</button>
      </footer>
    </section>
  </ModalPortal>
}
