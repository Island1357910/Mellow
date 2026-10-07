import { useEffect, useState } from 'react'
import { candyStyle } from '../../lib/candy.ts'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import { PillNote, Screen } from '../ui/primitives.tsx'

function usePhone() {
  const identities = useMellow((state) => state.identities)
  const activeIdentityId = useMellow((state) => state.activeIdentityId)
  return identities.find((item) => item.id === activeIdentityId) ?? null
}

function when(at: number): string {
  return new Date(at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

export function DiaryApp(props: { onBack: () => void }) {
  const phone = usePhone()
  const [entries, setEntries] = useState<Array<{ id: string; text: string; at: number }>>([])
  const [text, setText] = useState('')
  useEffect(() => {
    if (!phone) return
    let stop = false
    void storage.getBag<Array<{ id: string; text: string; at: number }>>(phone.namespace, 'diary').then((rows) => {
      if (!stop) setEntries(rows ?? [])
    })
    return () => {
      stop = true
    }
  }, [phone])
  if (!phone) return null
  const save = () => {
    if (!text.trim()) return
    const next = [{ id: crypto.randomUUID(), text: text.trim(), at: Date.now() }, ...entries]
    setEntries(next)
    setText('')
    void storage.setBag(phone.namespace, 'diary', next)
  }
  return (
    <div className="sms-shell h-full min-h-0" style={candyStyle('#E8D4B0', '#F8D0DC', '#F8E6C0')}>
      <Screen title="日记" subtitle="只写给自己" onBack={props.onBack}>
        <div className="menu-card" style={{ backgroundImage: 'repeating-linear-gradient(transparent, transparent 27px, rgba(180,140,120,0.18) 28px)' }}>
          <textarea value={text} onChange={(event) => setText(event.target.value)} rows={5} placeholder="今天" className="w-full resize-none bg-transparent text-sm leading-7 outline-none" />
          <button type="button" className="chip chip-solid mt-2" onClick={save}>夹进本子</button>
        </div>
        {entries.length === 0 ? <div className="mt-3"><PillNote tone="butter">本子还是空白的</PillNote></div> : (
          <ol className="mt-4 space-y-2">
            {entries.map((entry) => (
              <li key={entry.id} className="menu-card">
                <p className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{when(entry.at)}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{entry.text}</p>
              </li>
            ))}
          </ol>
        )}
      </Screen>
    </div>
  )
}
