import { useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { addLiveSmsFriend, type LiveAnchorContact } from '../../domain/liveContact.ts'
import { moduleAdapter } from '../../lib/ask.ts'
import { APP_VERSION } from '../../lib/buildInfo.ts'
import { readCoins, spendCoins } from '../../lib/wallet.ts'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import { applyEmbeddedTheme } from '../../theme/embeddedTheme.ts'
import type { AIMessage } from '../../types/index.ts'

const mellowDestinations = new Set(['messages', 'star', 'duotao', 'flash', 'chengfeng', 'settings', 'music'])

export function LiveSimulatorApp({ onBack }: { onBack: () => void }) {
  const phone = useMellow(state => state.identities.find(item => item.id === state.activeIdentityId))
  const connecting = useRef(false)
  if (!phone) return null
  const namespace = phone.namespace
  const src = `${import.meta.env.BASE_URL}live-simulator/index.html?identity=${encodeURIComponent(namespace)}&v=${APP_VERSION}`

  const native = Capacitor.isNativePlatform()
  return <div className="embedded-host h-full min-h-0">
    <iframe key={namespace} title="神豪模拟器 · 直播间" className="embedded-frame" style={native ? undefined : { top: 32 }} src={src} allow="autoplay" onLoad={event => {
      applyEmbeddedTheme(event.currentTarget, 'live')
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
        apiSettings: async () => {
          const [settings, profiles, defaultApi] = await Promise.all([storage.getSettings(), storage.listApiProfiles(), storage.readApi()])
          return {
            selected: settings.apiModuleBindings.live ?? '',
            defaultModel: defaultApi?.ready ? defaultApi.model : '',
            profiles: profiles.filter(profile => profile.ready).map(({ id, name, model }) => ({ id, name, model })),
          }
        },
        setApi: async (id: string) => {
          await storage.bindApiModule('live', id)
          await useMellow.getState().reloadApis()
        },
        ai: async ({ messages, temperature, max_tokens }: { messages: AIMessage[]; temperature?: number; max_tokens?: number }) => {
          const adapter = await moduleAdapter('live')
          return (await adapter.complete({ messages, temperature, maxTokens: max_tokens })).content
        },
        connect: async (anchor: LiveAnchorContact) => {
          if (connecting.current) return
          connecting.current = true
          try {
            const { chat } = await addLiveSmsFriend(namespace, anchor, frameUrl, phone.name)
            onBack()
            useMellow.getState().requestOpenChat({ identityId: phone.id, chatId: chat.id })
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
