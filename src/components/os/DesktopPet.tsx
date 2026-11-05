import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { askLine } from '../../lib/ask.ts'
import { clampPet } from '../../lib/homeBoard.ts'
import { openRedeemCodes } from '../../lib/redeem.ts'
import { useMellow } from '../../store/useMellow.ts'

const PET_SIZE = 112
const FACES = [
  `${import.meta.env.BASE_URL}pet/ditou-ask.png`,
  `${import.meta.env.BASE_URL}pet/ditou-pout.png`,
  `${import.meta.env.BASE_URL}pet/ditou-wow.png`,
  `${import.meta.env.BASE_URL}pet/ditou-sleep.png`,
]

const TABS = [
  ['chat', '对话'],
  ['news', '更新'],
  ['code', '兑换'],
  ['help', '教程'],
] as const

type PetTab = (typeof TABS)[number][0]
type PetLine = { who: 'me' | 'her'; text: string }

const LINKS = [
  { href: 'https://mymellow.top/guide.html', label: '使用教程' },
  { href: 'https://mymellow.top/netease-login-guide.html', label: '网易云登录教程' },
  { href: 'https://mymellow.top/downloads/', label: '下载与更新' },
]

const RELEASE = [
  '1.1.16：各预设会把虚构场景接在人物和对白里；写不了的画面改成同一幕的下一步。',
  '长按桌面图标可以换位置，也可以放到空格子上。拖到另一个图标中间会合成应用组。',
  '应用组里的图标要长按拖出来，放到桌面上。',
  '星博、论坛、日记和灵感捕手一类的记录都可以删除。',
  '长按最下方的横条可以召唤或收起低头。',
]

function guide(now: number): string {
  const codes = openRedeemCodes(now)
  return [
    '你是半糖 Mellow 里的桌宠，名字叫低头。',
    '性格温柔、活泼，像一个会轻轻撒娇、但懂分寸的萌妹。句子短，口语一点，可以偶尔用语气词。不要堆颜文字，也不要每句都重复自称。',
    '只根据下面的说明回答怎么玩。没有写到的功能就说目前没有，不要编造，也不要替玩家操作。',
    '玩法：第一页是时钟和小组件，后面是应用。市场可以安装日记、星博、灵感捕手等。设置里可以换接口、预设、主题、图标和备份。兑换码在「设置 → 身份 → 兑换码」。短信、线下、番外的预设可以分开选。数据在本机；网页和安装包不互通，用设置里的备份导出再导入。',
    '轻点最下方横条回到桌面，上滑打开控制中心，长按召唤或收起低头。应用组的图标是四个小格，多出来的在后面几页。组里的应用要长按拖到桌面的空位上才会出来。',
    `最近更新：${RELEASE.join('')}`,
    codes.length
      ? `现在还能用的兑换码：${codes.map((item) => `${item.code}（${item.note}）`).join('；')}。`
      : '现在没有还在有效期内的兑换码。',
    '教程：https://mymellow.top/guide.html ；网易云登录：https://mymellow.top/netease-login-guide.html ；下载：https://mymellow.top/downloads/',
  ].join('\n')
}

export function DesktopPet() {
  const settings = useMellow((state) => state.settings)
  const patchSettings = useMellow((state) => state.patchSettings)
  const pet = settings.home.pet
  const root = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLElement>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null)
  const step = useRef(1)
  const [place, setPlace] = useState(() => ({ x: pet?.x ?? 16, y: pet?.y ?? 240 }))
  const placeRef = useRef(place)
  placeRef.current = place
  const [open, setOpen] = useState(false)
  const [cardShift, setCardShift] = useState({ x: 84, y: 8 })
  const [tab, setTab] = useState<PetTab>('chat')
  const [lines, setLines] = useState<PetLine[]>([{ who: 'her', text: '我是低头。玩法上拿不准的，直接问我就好。' }])
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [typing, setTyping] = useState(false)
  const [keyboardInset, setKeyboardInset] = useState(0)
  const [face, setFace] = useState(0)
  useEffect(() => {
    if (!pet?.shown || asking) return
    const timer = window.setInterval(() => {
      setFace((current) => {
        let next = current + step.current
        if (next >= FACES.length) {
          step.current = -1
          next = FACES.length - 2
        } else if (next < 0) {
          step.current = 1
          next = 1
        }
        return next
      })
    }, 2600)
    return () => window.clearInterval(timer)
  }, [pet?.shown, asking])
  useEffect(() => {
    const node = scroll.current
    if (node && tab === 'chat') node.scrollTop = node.scrollHeight
  }, [lines, asking, tab, typing])
  useEffect(() => {
    if (!typing) return
    const pin = () => {
      const viewport = window.visualViewport
      const overlap = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0
      setKeyboardInset(overlap > 80 ? overlap : 0)
      window.scrollTo(0, 0)
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
      const pager = root.current?.parentElement
      if (pager) pager.scrollTop = 0
    }
    pin()
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', pin)
    viewport?.addEventListener('scroll', pin)
    window.addEventListener('resize', pin)
    return () => {
      viewport?.removeEventListener('resize', pin)
      viewport?.removeEventListener('scroll', pin)
      window.removeEventListener('resize', pin)
    }
  }, [typing])
  useEffect(() => {
    if (!open) setTyping(false)
  }, [open])
  if (!pet?.shown) return null
  const codes = openRedeemCodes()
  const portrait = FACES[asking ? 0 : face] ?? FACES[0]

  const save = (next: { x: number; y: number }) => {
    const current = useMellow.getState().settings.home
    void patchSettings({ home: { ...current, pet: { shown: true, x: next.x, y: next.y } } })
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.stopPropagation()
    event.preventDefault()
    const node = root.current
    if (!node) return
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, ox: place.x, oy: place.y, moved: false }
    try { node.setPointerCapture(event.pointerId) } catch { /* 没有可捕获的指针时仍按位移拖动 */ }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (!current || current.id !== event.pointerId) return
    event.stopPropagation()
    const parent = root.current?.parentElement
    if (!parent) return
    const dx = event.clientX - current.x
    const dy = event.clientY - current.y
    if (Math.hypot(dx, dy) > 6) current.moved = true
    const next = clampPet(current.ox + dx, current.oy + dy, parent.clientWidth, parent.clientHeight, PET_SIZE)
    placeRef.current = next
    setPlace(next)
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current
    drag.current = null
    if (!current || current.id !== event.pointerId) return
    event.stopPropagation()
    if (current.moved) {
      save(placeRef.current)
      return
    }
    const parent = root.current?.parentElement
    const width = parent?.clientWidth ?? 360
    const height = parent?.clientHeight ?? 640
    const x = placeRef.current.x
    const y = placeRef.current.y
    const cardHeight = 320
    const cardWidth = 232
    let shiftY = 8
    if (y + shiftY + cardHeight > height - 140) shiftY = height - 140 - y - cardHeight
    if (y + shiftY < 36) shiftY = 36 - y
    setCardShift({ x: x + PET_SIZE + cardWidth > width - 8 ? -(cardWidth + 8) : 84, y: shiftY })
    setOpen((value) => !value)
  }

  const ask = (event: FormEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const text = question.trim()
    if (!text || asking) return
    setQuestion('')
    setLines((current) => [...current, { who: 'me', text }])
    setAsking(true)
    setFace(0)
    void askLine(guide(Date.now()), text, 420, 60_000, 0.7)
      .then((line) => {
        setLines((current) => [...current, { who: 'her', text: line.trim() || '这次没想好，你再说一次嘛。' }])
        setFace(2)
      })
      .catch((reason: unknown) => {
        setLines((current) => [...current, { who: 'her', text: reason instanceof Error ? reason.message : '接口没答上来，等一下再问我。' }])
      })
      .finally(() => setAsking(false))
  }

  const finishTyping = () => {
    window.setTimeout(() => {
      const active = document.activeElement
      if (active && card.current?.contains(active)) return
      setTyping(false)
    }, 160)
  }

  return (
    <>
    <div
      ref={root}
      className="desk-pet"
      style={{ transform: `translate3d(${place.x}px, ${place.y}px, 0)` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <button type="button" className="desk-pet-face" aria-label={open ? '收起低头' : '和低头说话'} aria-expanded={open}>
        <img src={portrait} alt="" />
      </button>
    </div>
      {open ? (
        <section
          ref={card}
          className={typing ? 'desk-pet-card is-typing' : 'desk-pet-card'}
          style={typing
            ? { bottom: keyboardInset > 0 ? keyboardInset + 8 : 64 }
            : { transform: `translate3d(${place.x + cardShift.x}px, ${place.y + cardShift.y}px, 0)` }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <header className="desk-pet-bar">
            <span className="desk-pet-bar-mark" aria-hidden="true"><img src={portrait} alt="" /></span>
            <strong>低头</strong>
            <button type="button" aria-label="收起低头的窗口" onClick={() => setOpen(false)}>×</button>
          </header>
          <div className="desk-pet-tabs" role="tablist" aria-label="低头的分页">
            {TABS.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>
          <div className="desk-pet-scroll" ref={scroll}>
            {tab === 'chat' ? (
              <div className="desk-pet-chat">
                {lines.map((line, index) => <p key={`${line.who}-${index}`} className={line.who === 'me' ? 'desk-pet-bubble is-mine' : 'desk-pet-bubble'}>{line.text}</p>)}
                {asking ? <p className="desk-pet-bubble">在想呢…</p> : null}
              </div>
            ) : null}
            {tab === 'news' ? (
              <section className="desk-pet-block">
                <p className="desk-pet-label">最近更新</p>
                <ul>{RELEASE.map((item) => <li key={item}>{item}</li>)}</ul>
              </section>
            ) : null}
            {tab === 'code' ? (
              <section className="desk-pet-block">
                <p className="desk-pet-label">还能用的兑换码</p>
                {codes.length === 0 ? <p>现在没有还在有效期内的兑换码。入口在「设置 → 身份 → 兑换码」。</p> : codes.map((item) => (
                  <span key={item.code} className="desk-pet-code"><strong>{item.code}</strong>{item.note}</span>
                ))}
              </section>
            ) : null}
            {tab === 'help' ? (
              <section className="desk-pet-block">
                <p className="desk-pet-label">教程</p>
                <p className="desk-pet-links">{LINKS.map((item) => <a key={item.href} href={item.href} target="_blank" rel="noreferrer">{item.label}</a>)}</p>
              </section>
            ) : null}
          </div>
          {tab === 'chat' ? (
            <form className="desk-pet-compose" onSubmit={ask}>
              <input aria-label="对低头说" value={question} maxLength={200} enterKeyHint="send" onFocus={() => setTyping(true)} onBlur={finishTyping} onChange={(event) => setQuestion(event.target.value)} placeholder="问问怎么玩" />
              <button type="submit" disabled={asking || !question.trim()} onPointerDown={(event) => event.preventDefault()}>{asking ? '…' : '发送'}</button>
            </form>
          ) : null}
        </section>
      ) : null}
    </>
  )
}
