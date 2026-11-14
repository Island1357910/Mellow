import { useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { characterFromDraft } from '../../domain/importing.ts'
import { ensureDirectChat } from '../../domain/messaging.ts'
import { line, loadConfig, newSave, putSave, saveConfig } from '../../engine/story.ts'
import { moduleAdapter } from '../../lib/ask.ts'
import { parseCharacterCard } from '../../lib/sillytavern.ts'
import { readCoins, spendCoins } from '../../lib/wallet.ts'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import type { AIMessage } from '../../types/index.ts'

type Anchor = {
  id: string
  realName: string
  stageName: string
  background: string
  personality: string
  chatStyle: string
  portraitUrl?: string
}

const mellowDestinations = new Set(['messages', 'star', 'duotao', 'flash', 'chengfeng', 'settings', 'music'])

export function LiveSimulatorApp({ onBack }: { onBack: () => void }) {
  const phone = useMellow(state => state.identities.find(item => item.id === state.activeIdentityId))
  const connecting = useRef(false)
  if (!phone) return null
  const namespace = phone.namespace
  const src = `${import.meta.env.BASE_URL}live-simulator/index.html?identity=${encodeURIComponent(namespace)}`

  return <div className={`relative h-full min-h-0 bg-[var(--m-background)] ${Capacitor.isNativePlatform() ? '' : 'pt-8'}`}>
    <iframe key={namespace} title="神豪模拟器 · 直播间" className="block h-full w-full border-0" src={src} allow="autoplay" onLoad={event => {
      const child = event.currentTarget.contentWindow
      if (!child) return
      const frameUrl = event.currentTarget.src
      Object.assign(child, { mellowLiveHost: {
        playerName: phone.name,
        close: onBack,
        open: (app: string) => {
          if (!mellowDestinations.has(app)) return
          onBack()
          useMellow.getState().openApp(app)
        },
        balance: () => readCoins(namespace),
        spend: async (amount: number) => {
          const balance = await spendCoins(namespace, amount)
          useMellow.getState().touchData()
          return balance
        },
        ai: async ({ messages, temperature, max_tokens }: { messages: AIMessage[]; temperature?: number; max_tokens?: number }) => {
          const adapter = await moduleAdapter('messages')
          return (await adapter.complete({ messages, temperature, maxTokens: max_tokens })).content
        },
        connect: async (anchor: Anchor, mode: 'sms' | 'offline') => {
          if (connecting.current) return
          connecting.current = true
          try {
            let person = (await storage.listCharacters(namespace)).find(item => item.extensions?.liveAnchorId === anchor.id)
            if (!person) {
              const avatar = anchor.portraitUrl ? new URL(anchor.portraitUrl, frameUrl).href : ''
              person = await characterFromDraft(namespace, parseCharacterCard({
                name: anchor.realName,
                description: `主播「${anchor.stageName}」。${anchor.background}`,
                personality: anchor.personality,
                scenario: `${phone.name}在直播间认识了你。`,
                system_prompt: anchor.chatStyle,
                tags: ['直播间'],
                extensions: { liveAnchorId: anchor.id },
              }), avatar, { allowProactive: false })
            }
            if (mode === 'sms') {
              const chat = await ensureDirectChat(namespace, person)
              onBack()
              useMellow.getState().requestOpenChat({ identityId: phone.id, chatId: chat.id })
            } else {
              const save = await putSave(namespace, newSave(`与${person.name}见面`, {
                lines: [{ ...line('user', `我和${person.name}约在直播结束后见面，到了约好的地点。`), participantIds: [person.id] }],
              }))
              await saveConfig(namespace, { ...await loadConfig(namespace), activeSaveId: save.id })
              onBack()
              useMellow.getState().openApp('offline')
            }
            useMellow.getState().touchData()
          } finally {
            connecting.current = false
          }
        },
      } })
      child.dispatchEvent(new Event('mellow-live-host'))
    }} />
  </div>
}
