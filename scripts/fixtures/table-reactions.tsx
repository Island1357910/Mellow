// Development-only fixture: real UI and queue, with a visibly labelled mock API.
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { TableConversation } from '../../src/components/apps/TableConversation.tsx'
import type { Character } from '../../src/types/index.ts'

const names = ['测试玩家', '林澄']
const people = [{ person: { name: '林澄', personality: '温柔耐心', description: '喜欢桌游' } as Character, bond: 80 }]
const calls: string[] = []
let complete: ((text: string) => void) | undefined
const ask = async (_system: string, user: string) => {
  calls.push(user)
  return new Promise<string>(resolve => { complete = resolve })
}
function Fixture() {
  const [mounted, setMounted] = useState(true), [session, setSession] = useState(0), [report, setReport] = useState('')
  const inspect = () => setReport(JSON.stringify({ requests: calls.length, latest: calls.at(-1) }, null, 2))
  return <main style={{ maxWidth: 500, padding: 24, fontFamily: 'sans-serif', lineHeight: 1.8 }}>
    <h1>本地交互验证 · 模拟接口</h1>
    <p>不发送玩家聊天，也应自动请求开局互动。接口可保持等待以验证排队和退出隔离。</p>
    {mounted && <TableConversation key={session} game="五子棋" names={names} people={people} ask={ask}/>}
    <button onClick={inspect}>查看请求</button>
    <button onClick={() => { window.dispatchEvent(new CustomEvent('mellow-table-event', { detail: { text: '玩家公开落子：8行8列' } })); inspect() }}>公开落子</button>
    <button onClick={() => complete?.('林澄：慢慢想，我陪你下。')}>完成当前回复</button>
    <button onClick={() => setMounted(false)}>退出对局</button>
    <button onClick={() => { setSession(n => n + 1); setMounted(true) }}>重新开局</button>
    <pre aria-label="请求记录" style={{ whiteSpace: 'pre-wrap' }}>{report}</pre>
  </main>
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
