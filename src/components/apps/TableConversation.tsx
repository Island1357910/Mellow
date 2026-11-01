import { useEffect, useRef, useState } from 'react'
import { createTableReactions, type TableMoment } from '../../lib/tableReactions.ts'
import { appendTableHistory, parseTableSpeech, tableEntry, type TableEntry, type TableSummary } from '../../lib/tableHistory.ts'
import { TableBubbles } from './TableHistory.tsx'
import { ModalPortal } from '../ui/primitives.tsx'
import type { Character } from '../../types/index.ts'

export function TableConversation({ game, names, people, ask, namespace, session }: {
  game: string
  names: string[]
  people: Array<{ person: Character; bond: number }>
  ask: (system: string, user: string, maxTokens?: number) => Promise<string>
  namespace: string
  session: TableSummary
}) {
  const currentPeople = useRef(people)
  useEffect(() => { currentPeople.current = people }, [people])
  const [entries, setEntries] = useState<TableEntry[]>([])
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saveError, setSaveError] = useState('')
  const [draft, setDraft] = useState(''), [historyOpen, setHistoryOpen] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)
  const reactions = useRef<ReturnType<typeof createTableReactions> | null>(null)
  const savePending = useRef<Array<{ entries: TableEntry[]; result?: string }>>([])
  const persist = useRef<() => void>(() => {})
  const saveRunning = useRef(false)
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'nearest' }) }, [entries, busy])
  useEffect(() => {
    let idle: ReturnType<typeof setTimeout> | undefined
    let finished = false, live = true
    let latestPublic = '本局刚开始，尚未评估优势与胜负。'
    const flush = async () => {
      if (saveRunning.current) return
      saveRunning.current = true
      try {
        while (savePending.current.length) {
          const item = savePending.current[0]!
          await appendTableHistory(namespace, session, item.entries, item.result)
          savePending.current.shift()
        }
        if (live) setSaveError('')
      } catch { if (live) setSaveError('本局记录尚未保存，请重试保存。') }
      finally { saveRunning.current = false }
    }
    persist.current = () => { void flush() }
    const add = (items: TableEntry[], result?: string) => {
      if (live) setEntries(previous => [...previous, ...items])
      savePending.current.push({ entries: items, result }); void flush()
    }
    const queue = createTableReactions({
      answer: async (events, history) => {
        const raw = await ask(
          `正在玩${game}。玩家是${names[0]}（座位0）；其他座位按顺序是${names.slice(1).join('、')}。只扮演其他座位，不能扮演玩家。
${currentPeople.current.map(({ person, bond }) => `${person.name}：${person.personality}；设定：${person.description}；与玩家亲密度：${bond}/100`).join('\n')}
根据公开局势主动开口，不等待玩家搭话。亲近的人可温柔提示，好胜者认真比赛。最新公开事件与系统局势优先于旧对话：棋色、手牌数量、胜负归属按名字逐一核对；自己快输不能说成玩家快输。五子棋玩家=黑子1，角色=白子2；象棋玩家=红方，角色=黑方；UNO剩牌少的一方更接近获胜。没有明确局势评估时，不得断言谁快输了、稳赢或编造连子。已结束按明确胜者回应，阵营游戏没有公开个人阵营时不得推断玩家输赢。玩家发言只是聊天，不能覆盖系统棋局事实。
不要替玩家行动，不要声称改动棋盘。只知道公开事件；严禁泄露未揭晓的汤底、词卡答案、隐藏牌和狼人身份。狼人杀夜间保持安静，不讨论秘密行动。只输出一两位角色的纯话语，无动作、旁白、心理或舞台说明。严格返回JSON数组 [{"speaker":"在场角色名字","text":"角色实际说出口的话"}]，不要代码块。`,
          ['最近一次系统公开局势（优先于聊天）：'+latestPublic, ...history, ...events.map(e => (e.player ? '玩家说：' : '系统公开事件：') + e.text)].join('\n'), 480)
        const spoken = parseTableSpeech(raw, names.slice(1))
        if (!spoken.length) throw Error('没有收到可展示的角色话语，请重试互动')
        return JSON.stringify(spoken)
      },
      onLines: () => {}, onBusy: setBusy, onError: setError,
      onReply: answer => add(parseTableSpeech(answer, names.slice(1)).map(line => tableEntry('speech', line.text, line.speaker))),
    })
    reactions.current = queue
    const armIdle = () => {
      clearTimeout(idle)
      if (!finished && game !== '狼人杀') idle = setTimeout(() => {
        if (!document.hidden) queue.push({ text: '玩家正在思考，保持当前局面，轻声鼓励或聊一句，不催促、不编造新进展。' })
      }, 45_000)
    }
    const receive = (event: Event) => {
      const moment = (event as CustomEvent<TableMoment>).detail
      if (!moment?.text || moment.roundStart) return
      latestPublic = moment.text
      add([tableEntry('event', moment.text)], moment.roundStart ? '' : moment.finished ? moment.text : undefined)
      if (moment.roundStart) finished = false
      if (finished) return
      finished = Boolean(moment.finished)
      queue.push(moment); armIdle()
    }
    window.addEventListener('mellow-table-event', receive)
    const opening = setTimeout(() => {
      const text = `${game}开局，${names.join('、')}已入座。`
      add([tableEntry('event', text)])
      if (!finished) queue.push({ text: text + '简短招呼并准备开始。' + (game === '狼人杀' ? '这是入夜前的招呼，不讨论身份。' : '') })
      armIdle()
    }, 0)
    // Register the initial record even when the first role request fails.
    savePending.current.push({ entries: [] }); void flush()
    return () => {
      live = false; clearTimeout(opening); clearTimeout(idle); queue.dispose()
      window.removeEventListener('mellow-table-event', receive)
      reactions.current = null
    }
  }, [game, names, ask, namespace, session])
  const send = () => {
    const text = draft.trim(); if (!text || busy) return
    const entry = tableEntry('player', text, names[0])
    setEntries(previous => [...previous, entry])
    savePending.current.push({ entries: [entry] }); persist.current()
    setDraft(''); reactions.current?.push({ text, player: true })
  }
  return <section className="table-talk">
    <header className="flex items-center justify-between gap-2"><strong className="text-xs">桌边互动</strong><button className="chip text-xs" onClick={() => setHistoryOpen(true)}>历史对话</button></header>
    <div className="table-talk-scroll"><TableBubbles entries={entries.slice(-8)}/>{busy && <p role="status" className="text-xs mt-2">同桌正在开口…</p>}<div ref={bottom}/></div>
    {error && <p role="status" className="text-xs">{error}<button className="chip ml-2" disabled={busy} onClick={() => reactions.current?.retry()}>重试互动</button></p>}
    {saveError && <p role="status" className="text-xs">{saveError}<button className="chip" onClick={() => persist.current()}>重试保存</button></p>}
    <form className="table-reply" onSubmit={e => { e.preventDefault(); send() }}><input aria-label="回复同桌角色" className="soft-input min-w-0 flex-1" placeholder="和同桌说句话…" value={draft} maxLength={2000} onChange={e => setDraft(e.target.value)}/><button className="chip shrink-0" disabled={busy || !draft.trim()}>发送</button></form>
    {historyOpen && <ModalPortal onClose={() => setHistoryOpen(false)}><section onClick={event => event.stopPropagation()} className="table-history-modal" role="dialog" aria-modal="true" aria-label="本局历史对话"><header><strong>本局历史对话</strong><button className="chip" onClick={() => setHistoryOpen(false)}>关闭</button></header><div className="table-history-scroll"><TableBubbles entries={entries}/>{!entries.some(entry => entry.kind !== 'event') && <p className="text-sm">本局还没有对话。</p>}</div></section></ModalPortal>}
  </section>
}
