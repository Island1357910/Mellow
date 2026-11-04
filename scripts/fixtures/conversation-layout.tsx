import '../../src/lib/runtimeCompat.ts'
import { createRoot } from 'react-dom/client'
import { StoryApp } from '../../src/components/apps/StoryApp.tsx'
import { ChatThread } from '../../src/components/apps/ChatThread.tsx'
import { useMellow } from '../../src/store/useMellow.ts'
import { storage } from '../../src/storage/StorageService.ts'
import { newSave, putSave } from '../../src/engine/story.ts'
import { themeStyle } from '../../src/theme/applyTheme.ts'
import { BUNDLED_THEMES } from '../../src/theme/themes.ts'
import type { Character, Chat } from '../../src/types/index.ts'
if (location.search.includes('legacy')) {
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/artifacts/conversation-legacy.css'; document.head.appendChild(link)
} else await import('../../src/index.css')
await useMellow.getState().boot()
const state = useMellow.getState(), identity = state.identities[0]!, ns = identity.namespace
const person = { id: 'layout-person', name: '布局测试角色', nickname: '', signature: '聊天与线下排版检查', personality: '温和', description: '', scenario: '', mesExample: '', systemPrompt: '', postHistoryInstructions: '', extensions: {}, tags: [], createdAt: 1, updatedAt: 1 } as Character
await storage.putCharacter(ns, person)
const chat: Chat = { id: 'layout-chat', kind: 'dm', title: person.name, memberIds: [person.id], lastMessage: '', lastMessageAt: 0, unread: 0, presetId: null, createdAt: 1, updatedAt: 1 }
await storage.putChat(ns, chat)
await storage.putMessage(ns, { id: 'layout-message', chatId: chat.id, role: 'assistant', kind: 'text', content: '热茶已经收到了，还是温的。\n下次见面一起去吃草莓华夫饼吧。', charId: person.id, createdAt: Date.now(), status: 'sent' })
await putSave(ns, newSave('布局检查', { lines: [{ id: 'scene', role: 'assistant', content: '布局测试角色走到你面前，递过一杯热茶。\n\n“慢慢走，不着急。”\n\n十一月的清晨带着点凉意，你们约好去吃草莓华夫饼。这段正文应当与屏幕左右边缘保持留白，输入框和发送按钮也应该完整显示。', createdAt: Date.now(), participantIds: [person.id] }] }))
useMellow.setState({ locked: false, activeIdentityId: identity.id })
createRoot(document.getElementById('root')!).render(<div className="stage"><div className="device" style={themeStyle(BUNDLED_THEMES.find(theme => theme.id === 'theme_macaron')!)}><div className="relative min-h-0 flex-1">{location.search.includes('chat') ? <ChatThread chat={chat} identity={identity} characters={[person]} onBack={() => {}} onPatch={() => {}} /> : <StoryApp mode="offline" onBack={() => {}} />}</div></div></div>)
