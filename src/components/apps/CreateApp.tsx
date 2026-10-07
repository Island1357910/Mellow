import { useEffect, useState } from 'react'
import { isAiJobRunning, jobKey, runAiJob } from '../../engine/aiJobs.ts'
import { saveCard } from '../../domain/importing.ts'
import { makeCard, type MadeCard } from '../../lib/cardMaker.ts'
import { storage } from '../../storage/StorageService.ts'
import { candyStyle } from '../../lib/candy.ts'
import { modePresetId } from '../../lib/defaults.ts'
import { readWorld, writeWorld, type WorldEntry } from '../../lib/worldbook.ts'
import { uid } from '../../lib/id.ts'
import { useMellow } from '../../store/useMellow.ts'
import { PillNote, Screen } from '../ui/primitives.tsx'

function clock(): number {
  return Date.now()
}

const FIELDS: Array<{ key: keyof MadeCard; label: string }> = [
  { key: 'description', label: '简介' },
  { key: 'personality', label: '性格' },
  { key: 'scenario', label: '世界观' },
  { key: 'firstMes', label: '开场白' },
  { key: 'mesExample', label: '样例' },
  { key: 'creatorNotes', label: '玩法' },
  { key: 'systemPrompt', label: '输出设定' },
]

export function CreateApp(props: { onBack: () => void }) {
  const identities = useMellow((state) => state.identities)
  const activeIdentityId = useMellow((state) => state.activeIdentityId)
  const settings = useMellow((state) => state.settings)
  const presets = useMellow((state) => state.presets)
  const dataRevision = useMellow((state) => state.dataRevision)
  const phone = identities.find((item) => item.id === activeIdentityId)
  const preset = presets.find((item) => item.id === modePresetId(settings, 'create'))
  const [wish, setWish] = useState('')
  const [useBook, setUseBook] = useState(true)
  const [book, setBook] = useState<WorldEntry[]>([])
  const [card, setCard] = useState<MadeCard | null>(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!phone) return
    let stop = false
    void readWorld(phone.namespace).then((rows) => {
      if (!stop) setBook(rows)
    })
    void storage.getBag<{ card?: MadeCard; note?: string }>(phone.namespace, 'create_draft').then((draft) => {
      if (stop) return
      if (draft?.card) setCard(draft.card)
      if (draft?.note) setNote(draft.note)
    })
    return () => {
      stop = true
    }
  }, [phone, dataRevision])

  if (!phone) return null
  const depth = preset?.data.prompts.find((item) => item.enabled)?.content ?? '标准封装。'
  const enabled = book.filter((item) => item.enabled)

  const busy = phone ? isAiJobRunning(jobKey(phone.namespace, 'create')) : false

  const run = () => {
    if (!phone || !wish.trim() || busy) return
    setNote('正在写卡…')
    const currentWish = wish
    runAiJob(jobKey(phone.namespace, 'create'), async () => {
      try {
        const made = await makeCard({ wish: currentWish, depth, world: useBook ? book : [] })
        const message = made.local ? '接口没接上，这是一份本地草稿。接上之后可以再出一次。' : '卡已经封好，可以放进短信。'
        await storage.setBag(phone.namespace, 'create_draft', { card: made, note: message })
      } catch (reason) {
        await storage.setBag(phone.namespace, 'create_draft', {
          note: reason instanceof Error ? reason.message : '没封上',
        })
      }
    })
  }

  const keep = async () => {
    if (!card) return
    const character = await saveCard(phone, {
      name: card.name,
      avatar: '',
      description: card.description,
      personality: card.personality,
      scenario: card.scenario,
      firstMes: card.firstMes,
      mesExample: card.mesExample,
      creatorNotes: card.creatorNotes,
      systemPrompt: card.systemPrompt,
      postHistoryInstructions: '',
      alternateGreetings: [],
      tags: card.tags.length ? card.tags : ['创作'],
      creator: 'player',
      characterVersion: '1.0.0',
      characterBook: card.world.length
        ? {
            name: card.name,
            entries: card.world.map((item) => ({
              name: item.title,
              keys: item.keys.split(/[,，]/).map((key) => key.trim()).filter(Boolean),
              content: item.content,
              enabled: true,
            })),
          }
        : null,
      extensions: {},
      rawCard: null,
    })
    useMellow.getState().touchData()
    setNote(`「${character.name}」已经在短信里`)
  }

  const intoBook = async () => {
    if (!card?.world.length) return
    const extra: WorldEntry[] = card.world.map((item) => ({
      id: uid('lore'),
      title: item.title,
      keys: item.keys,
      content: item.content,
      enabled: true,
      updatedAt: clock(),
    }))
    const next = [...extra, ...book]
    setBook(next)
    await writeWorld(phone.namespace, next)
    setNote('新设定已经写进这个身份的世界书，可以再去开关。')
  }

  return (
    <div className="sms-shell h-full min-h-0" style={candyStyle('#E7B7C9', '#F8D0DC', '#E6DDF8')}>
      <Screen title="创作" subtitle={preset?.name ?? '一键出卡'} onBack={props.onBack}>
        <div className="space-y-3">
          <textarea value={wish} rows={5} onChange={(event) => setWish(event.target.value)} placeholder="想要什么样的人。一句话也行。" className="soft-input resize-none leading-6" />
          <button type="button" className="chip" style={useBook ? { background: '#E6DDF8' } : undefined} onClick={() => setUseBook((value) => !value)}>
            {useBook ? `沿用世界书 · ${enabled.length} 条在用` : '不沿用世界书'}
          </button>
          <button type="button" className="chip chip-solid" disabled={busy || !wish.trim()} onClick={() => void run()}>{busy ? '正在封装…' : '一键出卡'}</button>
          {note ? <PillNote tone="pink" inline>{note}</PillNote> : null}
          {card ? (
            <div className="space-y-2">
              <article className="menu-card">
                <p className="text-lg font-semibold">{card.name}</p>
                <p className="mt-1 text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{card.tags.join(' · ')}</p>
              </article>
              {FIELDS.map((field) => {
                const value = card[field.key]
                if (typeof value !== 'string' || !value.trim()) return null
                return (
                  <article key={field.key} className="menu-card">
                    <p className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{field.label}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{value}</p>
                  </article>
                )
              })}
              {card.world.length > 0 ? (
                <article className="menu-card">
                  <p className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>附带的设定</p>
                  {card.world.map((item) => (
                    <p key={item.title} className="mt-2 text-sm leading-6"><span className="font-medium">{item.title}</span> {item.content}</p>
                  ))}
                </article>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button type="button" className="chip chip-solid" onClick={() => void keep()}>放进短信</button>
                {card.world.length > 0 ? <button type="button" className="chip chip-lilac" onClick={() => void intoBook()}>写进世界书</button> : null}
              </div>
            </div>
          ) : null}
        </div>
      </Screen>
    </div>
  )
}
