import { useRef, useState } from 'react'
import { SHELF_CARDS, shelfCardUrl, shelfWhere, type ShelfCard } from '../../data/shelfCards.ts'
import { installShelfCard, shelfNameTaken } from '../../lib/shelfInstall.ts'
import { useMellow } from '../../store/useMellow.ts'

export function PetCardShelf() {
  const identity = useMellow((state) => state.identities.find((item) => item.id === state.activeIdentityId))
  const [pick, setPick] = useState<ShelfCard | null>(null)
  const [taken, setTaken] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const pickId = useRef('')

  const choose = (card: ShelfCard) => {
    pickId.current = card.id
    setPick(card)
    setNote('')
    setTaken(false)
    document.querySelector('.desk-pet-scroll')?.scrollTo({ top: 0 })
    if (!identity) return
    const namespace = identity.namespace
    void shelfNameTaken(card, namespace).then((same) => {
      if (pickId.current === card.id) setTaken(same)
    })
  }

  const install = async () => {
    if (!identity || !pick || busy) return
    setBusy(true)
    setNote('')
    try {
      const where = await installShelfCard(pick, identity)
      useMellow.getState().touchData()
      setNote(`「${pick.name}」已装进「${identity.name}」。去${where}就能看到。`)
      pickId.current = ''
      setPick(null)
      setTaken(false)
    } catch (error) {
      setNote(error instanceof Error ? error.message : '没装进去')
    } finally {
      setBusy(false)
    }
  }

  const group = (era: ShelfCard['era'], title: string) => (
    <>
      <p className="desk-pet-label">{title}</p>
      {SHELF_CARDS.filter((card) => card.era === era).map((card) => (
        <button key={card.id} type="button" className={pick?.id === card.id ? 'desk-pet-card-row is-on' : 'desk-pet-card-row'} onClick={() => choose(card)}>
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
      <p className="desk-pet-label">当前身份</p>
      <p>{identity ? `「${identity.name}」。装进去之前，先确认是不是这台小手机。` : '还没有当前身份。先到「设置 → 身份」选一台小手机。'}</p>
      {pick ? (
        <div className="desk-pet-confirm" role="group" aria-label={`确认把${pick.name}装进当前身份`}>
          <p>{`要把「${pick.name}」装进当前身份${identity ? `「${identity.name}」` : ''}吗？${shelfWhere(pick)}${taken ? '这个身份里已经有同名的人，再装会多一份。' : ''}请先确认身份没错。`}</p>
          <p className="desk-pet-confirm-actions">
            <button type="button" className="is-solid" disabled={!identity || busy} onClick={() => void install()}>{busy ? '在装…' : '装进这个身份'}</button>
            <button type="button" disabled={busy} onClick={() => { pickId.current = ''; setPick(null); setTaken(false) }}>先不装</button>
          </p>
        </div>
      ) : null}
      {note ? <p role="status">{note}</p> : null}
      {group('modern', '现代')}
      {group('ancient', '古风')}
    </section>
  )
}
