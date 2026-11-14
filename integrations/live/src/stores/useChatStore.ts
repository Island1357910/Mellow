import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbJSONStorage } from '../utils/storage';
import type { ChatMessage, ChatMessageKind, ChatSession } from '../types';

/** 稳定的空消息列表，避免 selector 中 `?? []` 每次产生新引用导致无限重渲染 */
export const EMPTY_CHAT_MESSAGES: ChatMessage[] = [];

export interface AddMessageOptions {
  kind?: ChatMessageKind;
  redPacketAmount?: number;
  voiceText?: string;
  imageDesc?: string;
}

function previewText(content: string, opts?: AddMessageOptions): string {
  if (opts?.kind === 'redpacket') {
    return `[红包] ${opts.redPacketAmount ?? 0} 虚拟币${content ? ` · ${content}` : ''}`;
  }
  if (opts?.kind === 'voice') {
    return `[语音] ${opts.voiceText ?? content}`;
  }
  if (opts?.kind === 'image') {
    return `[图片] ${opts.imageDesc ?? content}`;
  }
  return content;
}

/** 私信 AI 上下文条数 */
export const CHAT_AI_HISTORY_LIMIT = 20;

interface ChatState {
  messages: Record<string, ChatMessage[]>;
  sessions: Record<string, ChatSession>;

  addMessage: (
    anchorId: string,
    role: 'anchor' | 'player',
    content: string,
    options?: AddMessageOptions
  ) => ChatMessage;
  markRead: (anchorId: string) => void;
  getMessages: (anchorId: string) => ChatMessage[];
  hasAnyUnread: () => boolean;
  getSessionList: () => ChatSession[];
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: {},
      sessions: {},

      addMessage: (anchorId, role, content, options) => {
        const msg: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          anchorId,
          role,
          content,
          timestamp: Date.now(),
          kind: options?.kind ?? 'text',
          redPacketAmount: options?.redPacketAmount,
          voiceText: options?.voiceText,
          imageDesc: options?.imageDesc,
        };
        set((state) => {
          const list = [...(state.messages[anchorId] ?? []), msg];
          const session: ChatSession = {
            anchorId,
            lastMessage: previewText(content, options),
            lastTimestamp: msg.timestamp,
            unread: role === 'anchor',
          };
          return {
            messages: { ...state.messages, [anchorId]: list },
            sessions: { ...state.sessions, [anchorId]: session },
          };
        });
        return msg;
      },

      markRead: (anchorId) =>
        set((state) => {
          const session = state.sessions[anchorId];
          if (!session) {
            const msgs = state.messages[anchorId];
            if (!msgs?.length) return state;
            const last = msgs[msgs.length - 1];
            return {
              sessions: {
                ...state.sessions,
                [anchorId]: {
                  anchorId,
                  lastMessage: last.content,
                  lastTimestamp: last.timestamp,
                  unread: false,
                },
              },
            };
          }
          if (!session.unread) return state;
          return {
            sessions: {
              ...state.sessions,
              [anchorId]: { ...session, unread: false },
            },
          };
        }),

      getMessages: (anchorId) => get().messages[anchorId] ?? EMPTY_CHAT_MESSAGES,

      hasAnyUnread: () => Object.values(get().sessions).some((s) => s.unread),

      getSessionList: () =>
        Object.values(get().sessions).sort((a, b) => b.lastTimestamp - a.lastTimestamp),
    }),
    {
      name: 'shenhao_chat',
      storage: idbJSONStorage,
    }
  )
);

/** 将私信消息转为 AI 可读描述 */
export function chatMessageToAiText(m: ChatMessage): string {
  if (m.kind === 'redpacket') {
    return `（观众发了红包${m.redPacketAmount}虚拟币${m.content ? `，附言：${m.content}` : ''}）`;
  }
  if (m.kind === 'voice') {
    return `（观众发了语音消息，内容：${m.voiceText ?? m.content}）`;
  }
  if (m.kind === 'image') {
    return `（观众发了图片，描述：${m.imageDesc ?? m.content}）`;
  }
  return m.content;
}
