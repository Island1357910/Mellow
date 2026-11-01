// Local-only QA: real components and persistence; role responses are explicitly mocked.
import '../../src/lib/runtimeCompat.ts'
import '../../src/index.css'
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { TableConversation } from '../../src/components/apps/TableConversation.tsx'
import { TableHistory } from '../../src/components/apps/TableHistory.tsx'
import { SettingsApp } from '../../src/components/apps/SettingsApp.tsx'
import { useMellow } from '../../src/store/useMellow.ts'
import { storage } from '../../src/storage/StorageService.ts'
import { BUNDLED_THEMES } from '../../src/theme/themes.ts'
import type { Character } from '../../src/types/index.ts'

const names = ['测试玩家', '林澄']
const people = [{ person: { name: '林澄', personality: '温柔耐心', description: '喜欢桌游' } as Character, bond: 80 }]
const namespace = 'table_ui_qa'
const session = { id: 'ui_'+Date.now(), game: '五子棋', names, startedAt: Date.now() }
let complete: ((text: string) => void) | undefined
const calls: string[] = []
const ask = async (_system: string, user: string) => { calls.push(user); return new Promise<string>(resolve => { complete = resolve }) }
function Fixture() {
  const [mounted, setMounted] = useState(true), [view, setView] = useState('table'), [history, setHistory] = useState(false)
  return <main style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#faf6f3' }}>
    <header className="p-2 text-xs">本地验证 · 模拟角色接口 <button className="chip" onClick={() => setView('table')}>桌游验证</button><button className="chip" onClick={() => setView('settings')}>设置验证</button></header>
    {view === 'settings' ? <SettingsApp onBack={() => setView('table')}/> : <div className="table-app" style={{ flex: 1, minHeight: 0 }}><div style={{ overflow: 'auto', padding: 16 }}><h1>五子棋 · 测试棋局</h1><p>玩家黑子连四，角色白子需要防守。</p><div className="gomoku-board strategy-board" style={{ maxWidth: 300 }}>{Array.from({ length: 225 }, (_, i) => <span className="strategy-cell" key={i}>{i >= 108 && i <= 111 ? <span className="go-stone is-black"/> : null}</span>)}</div><div className="flex flex-wrap gap-2 mt-3"><button className="chip" onClick={() => window.dispatchEvent(new CustomEvent('mellow-table-event', { detail: { text: '玩家公开落子8行7列。玩家黑子下一手可连五；角色林澄执白需要防守。' } }))}>公开落子</button><button className="chip" onClick={() => complete?.(JSON.stringify([{ speaker: '林澄', text: calls.at(-1)?.includes('让着我') ? '（轻笑）我会认真陪你下，不过这次得先挡住你的黑子。' : '（看向棋盘）你的黑子连起来了，我得小心防守。' }]))}>完成当前回复</button><button className="chip" onClick={() => setMounted(false)}>退出对局</button><button className="chip" onClick={() => setHistory(true)}>过往游玩历史</button></div></div>{mounted && <TableConversation game="五子棋" names={names} people={people} ask={ask} namespace={namespace} session={session}/>}</div>}
    {history && <TableHistory namespace={namespace} onClose={() => setHistory(false)}/>}
  </main>
}
await useMellow.getState().boot()
await storage.saveTheme({ ...BUNDLED_THEMES[0]!, id: 'theme_user_ui_test', name: '验证个人主题' })
await useMellow.getState().reloadLibraries()
createRoot(document.getElementById('root')!).render(<StrictMode><Fixture/></StrictMode>)
