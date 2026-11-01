import { useEffect, useRef, useState } from 'react'
import { createTableReactions, type TableMoment } from '../../lib/tableReactions.ts'
import type { Character } from '../../types/index.ts'

export function TableConversation({ game, names, people, ask }: {
  game: string
  names: string[]
  people: Array<{ person: Character; bond: number }>
  ask: (system: string, user: string, maxTokens?: number) => Promise<string>
}) {
  const currentPeople = useRef(people)
  useEffect(() => { currentPeople.current = people }, [people])
  const [lines, setLines] = useState<string[]>([])
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const reactions = useRef<ReturnType<typeof createTableReactions> | null>(null)
  useEffect(() => {
    let idle: ReturnType<typeof setTimeout> | undefined
    let finished = false
    const queue = createTableReactions({
      answer: (events, history) => ask(
        `正在玩${game}。扮演同桌角色：${names.slice(1).join('、')}。
${currentPeople.current.map(({ person, bond }) => `${person.name}：${person.personality}；设定：${person.description}；与玩家亲密度：${bond}/100`).join('\n')}
根据公开局势主动开口：开局招呼、观察局势、逗弄、鼓励或赛后回应。亲近的人可温柔提示，好胜者认真比赛。一次只让一两位在场角色说一两句，标明名字。不要等待玩家搭话，不要替玩家行动，不要声称改动棋盘。只知道下方公开事件；严禁泄露未揭晓的汤底、词卡答案、隐藏牌和狼人身份。狼人杀夜间保持安静，不评论秘密行动。若本局结束，只做赛后互动。`,
        [...history, ...events.map(e => '公开事件：' + e.text)].join('\n'), 240),
      onLines: setLines, onBusy: setBusy, onError: setError,
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
      if (!moment?.text) return
      if (moment.roundStart) finished = false
      if (finished) return
      finished = Boolean(moment.finished)
      queue.push(moment)
      armIdle()
    }
    window.addEventListener('mellow-table-event', receive)
    const opening = setTimeout(() => {
      if (finished) return
      queue.push({ text: `${game}开局，${names.join('、')}已入座。简短招呼并准备开始。${game === '狼人杀' ? '这是入夜前的开局招呼，不讨论身份。' : ''}` })
      armIdle()
    }, 0)
    return () => {
      clearTimeout(opening); clearTimeout(idle); queue.dispose()
      window.removeEventListener('mellow-table-event', receive)
      reactions.current = null
    }
  }, [game, names, ask])
  return <section className="table-talk"><details open><summary>桌边互动 · 自动</summary>
    <div className="mt-2 max-h-32 space-y-2 overflow-y-auto text-xs leading-6" aria-live="polite">{lines.filter(l => !l.startsWith('本局事件：')).map((line, i) => <p key={i}>{line}</p>)}</div>
    {busy && <p role="status" className="mt-2 text-xs">同桌正在开口…</p>}
    {error && <div role="status" className="mt-2 text-xs">{error}<button type="button" className="chip ml-2" disabled={busy} onClick={() => reactions.current?.retry()}>重试互动</button></div>}
  </details></section>
}
