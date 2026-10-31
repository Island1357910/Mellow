import { create } from 'zustand'
export type ConnectionsTab = 'account' | 'together' | 'links' | 'mcp'
export const CONNECTIONS_TABS: Array<{ id: ConnectionsTab; label: string; detail: string }> = [
  { id: 'account', label: '网易云', detail: '登录账号、查看歌单和选歌播放' },
  { id: 'together', label: '一起听读', detail: '选择 char、共享音乐或正文、设置主动聊天' },
  { id: 'links', label: '链接收藏', detail: '保存和打开小说、电影及网页链接' },
  { id: 'mcp', label: 'MCP 工具', detail: '连接外部服务、执行工具及设置自动读取' },
]
export const useConnectionsTab = create<{ tab: ConnectionsTab; setTab: (tab: ConnectionsTab) => void }>(set => ({ tab: 'account', setTab: tab => set({ tab }) }))
