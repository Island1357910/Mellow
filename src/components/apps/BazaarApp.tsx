import { useState } from 'react'
import { PetCardShelf, ShelfDetail } from '../os/PetCardShelf.tsx'
import { Screen } from '../ui/primitives.tsx'
import type { ShelfCard } from '../../data/shelfCards.ts'

export function BazaarApp(props: { onBack: () => void }) {
  const [card, setCard] = useState<ShelfCard | null>(null)
  if (card) return <ShelfDetail card={card} onBack={() => setCard(null)} />
  return (
    <Screen title="角色市集" subtitle="先看简介，再决定装进哪一台" onBack={props.onBack}>
      <PetCardShelf onOpen={setCard} />
    </Screen>
  )
}
