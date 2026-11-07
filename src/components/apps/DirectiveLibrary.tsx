import { useEffect, useState } from 'react'
import { DIRECTIVES, DIRECTIVE_CATEGORIES } from '../../data/directives.ts'
import {
  loadAllIdentityDirectives,
  loadDirectivePicks,
  saveAllIdentityDirectives,
  saveDirectivePicks,
  type DirectivePicks,
} from '../../lib/directives.ts'
import type { Character } from '../../types/index.ts'
import { PillNote } from '../ui/primitives.tsx'

function toggle(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]
}

export function DirectiveLibrary(props: { namespace: string; chars: Character[]; charId: string; onChar: (id: string) => void }) {
  const [picks, setPicks] = useState<DirectivePicks | null>(null)
  const [everyone, setEveryone] = useState<string[]>([])
  const [category, setCategory] = useState<string>('全部')
  const [query, setQuery] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    let live = true
    void Promise.all([loadDirectivePicks(props.namespace), loadAllIdentityDirectives()]).then(([saved, all]) => {
      if (!live) return
      setPicks(saved)
      setEveryone(all)
    })
    return () => { live = false }
  }, [props.namespace])

  if (!picks) return null
  const needle = query.trim()
  const shown = DIRECTIVES.filter((item) => (category === '全部' || item.category === category) && (!needle || `${item.title}${item.text}${item.category}`.includes(needle)))
  const charIds = props.charId ? picks.byChar[props.charId] ?? [] : []
  const selected = new Set([...everyone, ...picks.global, ...Object.values(picks.byChar).flat()])

  const changeChar = (id: string) => {
    if (!props.charId) return
    const next = { ...picks, byChar: { ...picks.byChar, [props.charId]: toggle(charIds, id) } }
    setPicks(next)
    void saveDirectivePicks(props.namespace, next)
    setNote('已记在这个角色上')
  }
  const changeGlobal = (id: string) => {
    const next = { ...picks, global: toggle(picks.global, id) }
    setPicks(next)
    void saveDirectivePicks(props.namespace, next)
    setNote('已记在当前身份')
  }
  const changeAll = (id: string) => {
    const next = toggle(everyone, id)
    setEveryone(next)
    void saveAllIdentityDirectives(next)
    setNote('已记给全部身份')
  }

  return (
    <div className="space-y-3">
      <PillNote tone="mint" compact>指令库共 {DIRECTIVES.length} 条。勾上的原文会进入短信、线下和番外，用来约束句子、话轮和这一轮做到哪一步。可以只给一个角色，也可以给当前身份，或全部身份。一次带不完时，靠前的先生效。</PillNote>
      <label className="block text-xs" style={{ color: 'var(--m-text-secondary)' }}>
        加给哪个角色
        <select value={props.charId} onChange={(event) => props.onChar(event.target.value)} className="soft-select mt-1 w-full text-sm">
          {props.chars.length === 0 ? <option value="">还没有角色</option> : props.chars.map((item) => (
            <option key={item.id} value={item.id}>{item.remark || item.name}</option>
          ))}
        </select>
      </label>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="找一条指令" className="soft-input" />
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {['全部', ...DIRECTIVE_CATEGORIES].map((item) => (
          <button key={item} type="button" className={category === item ? 'chip chip-solid shrink-0' : 'chip shrink-0'} onClick={() => setCategory(item)}>{item}</button>
        ))}
      </div>
      {note ? <p className="preset-desc">{note}</p> : null}
      <p className="text-xs" style={{ color: 'var(--m-text-secondary)' }}>正在用 {selected.size} 条</p>
      <div className="space-y-2">
        {shown.map((item) => {
          const onChar = charIds.includes(item.id)
          const onGlobal = picks.global.includes(item.id)
          const onAll = everyone.includes(item.id)
          return (
            <article key={item.id} className="menu-card">
              <p className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{item.category}</p>
              <p className="text-sm font-medium">{item.title}</p>
              <p className="mt-1 text-sm leading-6">{item.text}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button type="button" className={onChar ? 'chip chip-solid' : 'chip'} disabled={!props.charId} onClick={() => changeChar(item.id)}>{onChar ? '这个角色在用' : '给这个角色'}</button>
                <button type="button" className={onGlobal ? 'chip chip-solid' : 'chip'} onClick={() => changeGlobal(item.id)}>{onGlobal ? '当前身份在用' : '当前身份'}</button>
                <button type="button" className={onAll ? 'chip chip-solid' : 'chip'} onClick={() => changeAll(item.id)}>{onAll ? '全部身份在用' : '全部身份'}</button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
