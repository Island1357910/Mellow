import type { Chat } from '../types/index.ts'

/** 置顶在上，其余按最后一条消息从新到旧，和 QQ 的会话列表一样。 */
export function sortChats(chats: Chat[]): Chat[] {
  return [...chats].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1
    return b.lastMessageAt - a.lastMessageAt
  })
}

export function chatTitle(chat: Chat): string {
  return chat.remark?.trim() || chat.title
}
