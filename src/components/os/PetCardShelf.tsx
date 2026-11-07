import { useRef, useState } from 'react'
import { SHELF_CARDS, shelfCardUrl, shelfWhere, type ShelfCard } from '../../data/shelfCards.ts'
import { installShelfCard, shelfNameTaken } from '../../lib/shelfInstall.ts'
import { useMellow } from '../../store/useMellow.ts'
import { Screen } from '../ui/primitives.tsx'

export function PetCardShelf(props: { onOpen: (card: ShelfCard) => void }) {
  const group = (era: ShelfCard['era'], title: string) => (
    <>
      <p className="desk-pet-label">{title}</p>
      {SHELF_CARDS.filter((card) => card.era === era).map((card) => (
        <button key={card.id} type="button" className="desk-pet-card-row" onClick={() => props.onOpen(card)}>
          {card.file.endsWith('.png')
            ? <img src={shelfCardUrl(card)} alt="" />
            : <span className="desk-pet-card-mark" aria-hidden="true">🌾</span>}
          <span><strong>{card.name}</strong><em>{card.blurb}</em></span>
        </button>
      ))}
    </>
  )

  return (
    <section className="desk-pet-block">
      <p>点一张卡片，先看简介，再决定要不要装进当前这台小手机。</p>
      {group('modern', '现代')}
      {group('ancient', '古风')}
    </section>
  )
}

export function ShelfDetail(props: { card: ShelfCard; onBack: () => void }) {
  const identity = useMellow((state) => state.identities.find((item) => item.id === state.activeIdentityId))
  const card = props.card
  const [ask, setAsk] = useState(false)
  const [taken, setTaken] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const asked = useRef(false)

  const prepare = () => {
    setAsk(true)
    setNote('')
    if (!identity || asked.current) return
    asked.current = true
    void shelfNameTaken(card, identity.namespace).then(setTaken)
  }

  const install = async () => {
    if (!identity || busy) return
    setBusy(true)
    setNote('')
    try {
      const where = await installShelfCard(card, identity)
      useMellow.getState().touchData()
      setNote(`「${card.name}」已装进「${identity.name}」。去${where}就能看到。`)
      setAsk(false)
    } catch (error) {
      setNote(error instanceof Error ? error.message : '没装进去')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title={card.name} subtitle={card.era === 'ancient' ? '古风' : '现代'} onBack={props.onBack}>
      <article className="bazaar-detail">
        {card.file.endsWith('.png')
          ? <img src={shelfCardUrl(card)} alt="" />
          : <span className="bazaar-mark" aria-hidden="true">🌾</span>}
        <p><strong>{card.blurb}</strong></p>
        <p>{card.intro}</p>
        <p className="bazaar-where">{shelfWhere(card)}</p>
        <p className="bazaar-where">{identity ? `当前身份是「${identity.name}」。装错就会进另一台小手机。` : '还没有当前身份。先到「设置 → 身份」选一台小手机。'}</p>
        {ask ? (
          <div role="group" aria-label={`确认把${card.name}装进当前身份`}>
            <p>{`要把「${card.name}」装进当前身份${identity ? `「${identity.name}」` : ''}吗？${shelfWhere(card)}${taken ? '这个身份里已经有同名的人，再装会多一份。' : ''}`}</p>
            <p className="bazaar-actions">
              <button type="button" className="is-solid" disabled={!identity || busy} onClick={() => void install()}>{busy ? '在装…' : '装进这个身份'}</button>
              <button type="button" disabled={busy} onClick={() => setAsk(false)}>先不装</button>
            </p>
          </div>
        ) : (
          <p className="bazaar-actions">
            <button type="button" className="is-solid" disabled={!identity || busy} onClick={prepare}>装进当前身份</button>
          </p>
        )}
        {note ? <p role="status">{note}</p> : null}
      </article>
    </Screen>
  )
}
