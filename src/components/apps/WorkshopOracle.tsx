import { useState } from 'react'
import { MoonStar } from 'lucide-react'
import type { PublicWork } from '../../lib/workshop.ts'
import { Screen } from '../ui/primitives.tsx'

const cards = [
  ['星星', '给一件仍然在意的小事留一点时间。'],
  ['月亮', '先区分直觉和担心，等信息多一点再决定。'],
  ['太阳', '试着说出一个值得庆祝的小进展。'],
  ['隐者', '给自己留一段不必回答别人的时间。'],
  ['节制', '先选一个能长期坚持的步调。'],
  ['魔术师', '从手边已有的资源里挑一件，现在就能试试。'],
  ['力量', '温和地表达一条你想守住的边界。'],
  ['世界', '整理一个旧章节，想想它给你留下了什么。'],
] as const

function draw(count: number) {
  const deck = [...cards]
  return Array.from({ length: count }, () => deck.splice(Math.floor(Math.random() * deck.length), 1)[0])
}

export function WorkshopOracle({ item, onBack }: { item: PublicWork; onBack: () => void }) {
  const [result, setResult] = useState<ReturnType<typeof draw>>([])
  const color = item.display.theme_color
  return <Screen title={item.title} onBack={onBack}>
    <div className="workshop">
      <header className="workshop-preview" style={{ borderTopColor: color }}>
        <MoonStar aria-hidden="true" />
        <p>在心里想一个问题，再选一种牌阵。</p>
        <div className="workshop-row">
          <button type="button" className="workshop-primary" onClick={() => setResult(draw(1))}>抽一张牌</button>
          <button type="button" onClick={() => setResult(draw(3))}>抽三张牌</button>
        </div>
      </header>
      <div className="workshop-grid" aria-live="polite">
        {result.map(([title, reflection], index) => <article key={title} className="workshop-preview">
          <small>{result.length === 1 ? '此刻的提示' : ['此刻', '留意', '下一步'][index]}</small>
          <h2>{title}</h2>
          <p>{reflection}</p>
        </article>)}
      </div>
    </div>
  </Screen>
}
