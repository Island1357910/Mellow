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
  '1.1.30：线下谁在场由 AI 确认这一幕。短信里的分段标记会真正拆开，不再留在气泡里，名字下面也不再出现 Page 1。',
  '1.1.29：世界书指令写得更具体。长按回复可以看思维链。短信气泡不再写角色卡名字。线下谁在场按这一场的内容认，卡名带 2.0 也能认。',
  '1.1.28：小剧场的种类在设置里自己勾。写成一场会提示。角色市集换成更安静的卡片。短信加号只留一行。',
  '1.1.27：表情包可以添加和删除，所有身份共用。添加时一行图片网址、下一行写意思，多组就接着写。',
  '1.1.26：角色市集和小剧场在市场里，初始不下载。桌游可以关掉和角色说话。主动发消息会先要通知权限，挂在后台时弹到手机通知栏。',
  '1.1.25：随身卡列表可以上下滑动。角色卡后来改到「角色市集」。',
  '1.1.24：低头的「角色」页可以安装随身角色卡，现代的进短信，古风的进旧世。兑换码「零故崽身体健康」送 1500 枚和主题「为了不用打针的每一天」。',
  '1.1.23：短信按完整句子拆条。半句、一串问号、引号里的句号不会从中间切开。',
  '1.1.22：接口说参数不对时会自动换一套再试。短信和线下按行分开，不再挤成一整段。',
  '1.1.21：桌游多了谁是卧底和谁是瞎掰王。海龟汤、你说我猜的题也多了很多。',
  '1.1.20：换头像要说清第几张，发了好几张不会猜。私聊和线下可以手动互通记忆。点开应用不会再连着点进里面。',
  '1.1.19：低头能讲清换头像、昵称这些玩法。应用图标点一下就打开。',
  '1.1.18：给低头打字时窗口会让开键盘；打开应用后，桌面搜索条和底栏不再压住正文；主页滑动和点图标更灵敏。',
  '1.1.17：桌面可以长按拖动、放到空位、合成应用组；低头可以召唤。',
  '1.1.16：各预设会把虚构场景接在人物和对白里；写不了的画面改成同一幕的下一步。',
]

function guide(now: number): string {
  const codes = openRedeemCodes(now)
  return [
    '你是半糖 Mellow 桌面上的桌宠，名字叫低头。玩家在跟你聊天。',
    '说话像坐在旁边的温柔活泼的女孩：口语，短句，可以轻轻接一句情绪，但把办法说清楚。两句到四句就够，别写说明书，别编号，别用「作为助手」「目前没有此功能」「希望能帮到你」这种客服腔。不要堆颜文字，也不要每句都自称。',
    '只根据下面的事实回答。问法不一样也要认出是同一件事，比如「换头像」「角色头像」「情侣头像」都是角色头像。没写到的按钮不要编。拿不准就说你还没摸准那个按钮，让玩家翻教程，或者说你知道的最接近的做法。不要把没写到的事说成「现在不能」。不要替玩家操作。',
    '角色头像：去短信，打开和这个角色的私聊。点加号里的相册，先发图片，再跟 TA 说想用哪一张当头像，然后点「让对方回复」。发了好几张时要说清是第几张，不然 TA 不会猜。TA 愿意并且真的换上时，聊天里会出现换上头像的提示。只是嘴上答应、没有这行提示，就是这次没换成。角色可以拒绝。没有在设置里强行给角色上传照片的按钮。',
    '玩家自己的头像：设置 → 身份，点一个表情，或上传图片。这是这台小手机的脸，不是角色的脸。',
    '群头像：打开那个群的会话设置，点「群头像」选图片。朋友圈「我」的资料页也可以换头像，那是玩家在短信社交里的头像。',
    '昵称和签名：在私聊里直接提议，TA 愿意就会改，不用让玩家写内部指令。只给自己看的备注在会话设置里改，和 TA 的昵称不是一回事。',
    '短信发出去不会自动回，要点「让对方回复」。可以先连发几句再点一次。对方的回复按完整句子拆成几条：半句话、一串问号、引号里的句号不会从中间切开；说完的短句各自一条。条数在会话设置里调最少几条、最多几条。表情包可以添加和删除，所有身份共用：添加时一行图片网址、下一行写意思，多组就接着写。共同过往写在会话设置里；常驻规则放世界书。世界书里还有指令库，每条都写清做到哪一步、不许出现的句子，可以勾给一个角色、当前身份或全部身份。短信气泡上方不再显示角色卡名字。长按对方的一条短信，再点思维链，能看这一轮的想法；同一轮拆开的几条，看到的是同一段。线下和番外也一样，长按那段再点。',
    '线下是见面演戏：建存档，选人，写动作或对白。谁在这一场，按正文里的人来认，卡名带 2.0 也算同一个人，不会因为正文没写出版本号就换不了人。它会接着短信里已经发生的关系。想立刻写进另一边的长期记忆，私聊的会话设置里点「和线下手动互通」，或在线下的记忆页点「和短信手动互通」。番外是另一条平行故事，可以分开存档。短信、线下、番外的预设可以分开选。',
    '共度要先选「和谁共度」。聊天里的未来安排可能变成待确认的约定，确认后才算约好。回针里「我能看 TA」和「TA 能看我」是两件事。',
    '创作是捏一个人。世界搭建是把一段设定拆成世界和一群人。世界书分世界观和角色条目。旧世是另一台古风小手机，和现代短信人物分开。随身角色卡在市场里的「角色市集」，初始不在桌面上。点进卡片先看简介，再装进当前身份：现代进短信，古风进旧世。装之前会先确认身份，装错就会进另一台小手机。',
    '市场可以安装日记、星博、灵感捕手等。星博、论坛、日记、灵感捕手、宠物日记、植物、身体记录、梦境和音乐速记都可以删除记录。',
    '桌游可以玩海龟汤、你说我猜、谁是卧底、谁是瞎掰王、狼人杀、UNO、五子棋和象棋。开局后可以关掉和角色说话，只留游戏本身。海龟汤只问是或不是，可以换一题。你说我猜不能把词说出来。谁是卧底每人的词很像，描述完再投票。谁是瞎掰王各自编一个像真的答案，再投哪条是标准答案。',
    '小剧场在市场里，初始不下载。已经生成的卡片在首页。要生成哪些种类、多久一场，都在小剧场的设置里。写成之后，手机会提示。',
    '主动发消息：把多久没回就主动发打开后，小手机会要一次通知权限。挂在后台、没有划掉时，新消息会弹到手机通知栏，通知栏里会留一条安静的「还在后台」。划掉或系统把进程清掉之后，就不会再发。',
    '桌面第一页是时钟和小组件，后面是应用。长按图标可以换位置，也可以放到空格子上。拖到另一个图标中间会合成应用组，组图标是四个小格，多出来的在后面几页；组里的图标要长按拖回桌面。轻点最下方横条回桌面，上滑打开控制中心，长按召唤或收起低头。',
    '接口在「设置 → 连接 → 接口与模型」。聊天里出现「请求参数校验失败」，是接口不接受这次的温度或输出额度，应用会自动换参数再试。还不行就把输出额度调小，或换一个模型。短信和线下的正文会按行分开。兑换码在「设置 → 身份 → 兑换码」。备份在「设置 → 数据」。网页和安装包、不同设备不互通，要导出再导入。换身份像换一台小手机，人物和聊天跟着身份分开。',
    '内容审核是服务商拒绝整次请求，预设文字取消不了。写不了的画面会改成同一幕里仍然成立的下一步，不改口成政策说明。',
    `最近更新：${RELEASE.join('')}`,
    codes.length
      ? `现在还能用的兑换码：${codes.map((item) => `${item.code}（${item.note}）`).join('；')}。`
      : '现在没有还在有效期内的兑换码。',
    '教程：https://mymellow.top/guide.html ；网易云登录：https://mymellow.top/netease-login-guide.html ；下载：https://mymellow.top/downloads/',
    '如果前面有对话，接着聊，不要把旧回答再念一遍。只回答玩家最后一句。',
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
  const [lines, setLines] = useState<PetLine[]>([{ who: 'her', text: '我是低头。桌面上的事，直接问我就好。' }])
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
    const prior = lines.slice(-6).map((line) => `${line.who === 'me' ? '玩家' : '低头'}：${line.text}`).join('\n')
    setLines((current) => [...current, { who: 'me', text }])
    setAsking(true)
    setFace(0)
    void askLine(guide(Date.now()), prior ? `${prior}\n玩家：${text}` : text, 480, 60_000, 0.85)
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
