import { useEffect, useRef, useState } from 'react'
import { moduleAdapter, readJsonArray } from '../../lib/ask.ts'
import type { ApiModuleId } from '../../lib/apiModules.ts'
import { storage } from '../../storage/StorageService.ts'

const styles = ['直白', '温柔', '俏皮', '推动情节']

export function splitAssistedSms(text: string): string[] {
  const lines = text.trim().split(/\n+/).map(part => part.trim()).filter(Boolean)
  return lines.flatMap(line => line.match(/[^。！？!?]+[。！？!?]*|[。！？!?]+/g)?.map(part => part.trim()).filter(Boolean) ?? [])
}

export function ReplyAssist(props: {
  namespace: string
  mode: ApiModuleId
  turnId: string
  context: string
  draft: string
  disabled?: boolean
  onRewrite: (text: string, original: string) => void
  onSend: (text: string) => Promise<void>
}) {
  const { namespace, mode, turnId, context } = props
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [options, setOptions] = useState<{ turnId: string; texts: string[] }>()
  const [working, setWorking] = useState(false)
  const [sending, setSending] = useState(false)
  const [rewriting, setRewriting] = useState(false)
  const [note, setNote] = useState('')
  const action = useRef(false)
  const latest = useRef(props)
  latest.current = props
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  useEffect(() => {
    let current = true
    setEnabled(null)
    void storage.getBag<boolean>(namespace, `reply_assist_${mode}`).then(value => {
      if (current) setEnabled(value === true)
    }).catch(() => { if (current) setEnabled(false) })
    return () => { current = false }
  }, [namespace, mode])

  useEffect(() => {
    setNote('')
    setWorking(false)
    if (!enabled || !turnId) return
    let current = true
    setWorking(true)
    void (async () => {
      try {
        const ai = await moduleAdapter(mode)
        const response = await ai.complete({
          messages: [
            { role: 'system', content: `站在玩家一方，接着最新一轮对话写四种可直接发出的完整回复，依次是直白、温柔、俏皮、推动情节。四种应有不同回应策略，符合关系和当前语境，不替对方作出决定，也不添加未发生的事件。短信使用自然口语，多句可分行；叙事可用玩家的动作和对白。仅返回四个非空字符串组成的 JSON 数组，无标题、标签或解释。` },
            { role: 'user', content: context },
          ],
          maxTokens: 1100,
        })
        const values = readJsonArray(response.content)
        if (values.length !== 4 || values.some(value => typeof value !== 'string' || !value.trim())) throw new Error('没有收到四条完整建议')
        if (current) setOptions({ turnId, texts: values.map(value => (value as string).trim().slice(0, 4000)) })
      } catch {
        if (current) setNote('这轮没能生成回复建议，仍可输入自己的回复。')
      } finally { if (current) setWorking(false) }
    })()
    return () => { current = false }
  }, [enabled, mode, turnId, context])

  const rewrite = async () => {
    const original = props.draft
    if (action.current || !original.trim()) return
    action.current = true
    setRewriting(true)
    setNote('')
    try {
      const ai = await moduleAdapter(mode)
      const response = await ai.complete({
        messages: [
          { role: 'system', content: '把玩家草稿润色成可直接发送的文字。保留原意、边界和行动选择，适当补足措辞，不代写对方回应。短信适合分行，叙事保留动作与对白。只输出改写正文。' },
          { role: 'user', content: `前情：\n${context}\n\n玩家草稿：\n${original}` },
        ],
        maxTokens: 1400,
      })
      if (!alive.current) return
      if (latest.current.draft !== original) {
        setNote('草稿已修改，已保留你正在写的内容。')
        return
      }
      if (response.content.trim()) latest.current.onRewrite(response.content.trim().slice(0, 4000), original)
    } catch {
      if (alive.current) setNote('润色失败，原草稿已保留。')
    } finally {
      action.current = false
      if (alive.current) setRewriting(false)
    }
  }

  const sendOption = async (text: string) => {
    if (action.current || props.disabled) return
    action.current = true
    setSending(true)
    setNote('')
    try {
      await props.onSend(text)
      setOptions(current => current?.turnId === turnId ? undefined : current)
    } catch { setNote('发送未完成，请先查看已发送的内容。') }
    finally { action.current = false; setSending(false) }
  }

  return <div className="shrink-0 px-3 pb-1 text-xs">
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="chip" role="switch" aria-checked={enabled === true} disabled={enabled === null || sending || rewriting} onClick={() => {
        const next = !enabled
        setEnabled(next)
        setOptions(undefined)
        void storage.setBag(namespace, `reply_assist_${mode}`, next).catch(() => setNote('没能保存帮回复设置'))
      }}>帮回复 · {enabled ? '开' : '关'}</button>
      {enabled && <button type="button" className="chip" disabled={!props.draft.trim() || props.disabled || rewriting || sending} onClick={() => void rewrite()}>{rewriting ? '润色中…' : '润色草稿'}</button>}
      {enabled && working && <span>正在想四种回法…</span>}
    </div>
    {enabled && options?.turnId === turnId && <div className="scroll mt-1 max-h-40 space-y-1">
      {options.texts.map((text, index) => <button key={index} type="button" className="menu-card block w-full whitespace-pre-wrap text-left leading-5" disabled={props.disabled || rewriting || sending} onClick={() => void sendOption(text)}>
        <strong className="mr-2">{styles[index]}</strong>{text}
      </button>)}
    </div>}
    {note && <p role="status" className="mt-1">{note}</p>}
  </div>
}
