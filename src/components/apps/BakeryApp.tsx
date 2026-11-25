import type { SyntheticEvent } from 'react'
import { moduleAdapter } from '../../lib/ask.ts'
import { APP_VERSION } from '../../lib/buildInfo.ts'
import type { AIMessage } from '../../types/index.ts'
import { applyEmbeddedTheme } from '../../theme/embeddedTheme.ts'

function connectBakery(event: SyntheticEvent<HTMLIFrameElement>) {
  applyEmbeddedTheme(event.currentTarget, 'bakery')
  const frame = event.currentTarget.contentWindow
  if (!frame || frame.document?.URL !== event.currentTarget.src) return
  Object.assign(frame, {
    mellowBakeryHost: {
      async test() {
        const adapter = await moduleAdapter()
        await adapter.complete({
          messages: [{ role: 'user', content: '只回复 OK。' }],
          maxTokens: 32,
          timeoutMs: 30_000,
          antiTruncation: false,
        })
      },
      async complete(messages: AIMessage[], options: { temperature?: number; max_tokens?: number; timeoutMs?: number }) {
        const adapter = await moduleAdapter()
        const response = await adapter.complete({
          messages,
          temperature: options.temperature,
          maxTokens: options.max_tokens,
          timeoutMs: options.timeoutMs,
        })
        return response.content
      },
    },
  })
}

export function BakeryApp({ onBack }: { onBack: () => void }) {
  return (
    <div className="bakery-host embedded-host h-full min-h-0">
      <iframe title="千味面包房" className="embedded-frame" src={`${import.meta.env.BASE_URL}bakery/index.html?mellow=1&v=${APP_VERSION}`} allow="autoplay" onLoad={connectBakery} />
      <button type="button" className="bakery-back" aria-label="返回短信" onClick={onBack}>‹</button>
    </div>
  )
}
