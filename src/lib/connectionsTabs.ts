import { create } from 'zustand'
export type ConnectionsTab = 'account' | 'together' | 'links' | 'mcp'
export const CONNECTIONS_TABS: Array<{ id: ConnectionsTab; label: string; hint: string; detail: string }> = [
  { id: 'account', label: '网易云', hint: '账号与歌单', detail: '登录账号、查看歌单和选歌播放' },
  { id: 'together', label: '一起听读', hint: '陪伴与共享', detail: '选择 char、共享音乐或正文、设置主动聊天' },
  { id: 'links', label: '链接收藏', hint: '小说与影视', detail: '保存和打开小说、电影及网页链接' },
  { id: 'mcp', label: 'MCP 工具', hint: '服务直连', detail: '填写自己的 MCP 服务地址，直接连接音乐、小说与其他工具' },
]
export const useConnectionsTab = create<{ tab: ConnectionsTab; setTab: (tab: ConnectionsTab) => void }>(set => ({ tab: 'account', setTab: tab => set({ tab }) }))
