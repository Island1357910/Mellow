import { useEffect, useState } from 'react'
import { DIRECTIVES, DIRECTIVE_CATEGORIES, type Directive } from '../../data/directives.ts'
import {
  loadAllIdentityDirectives,
  loadDirectivePicks,
  draftDirective,
  listDirectives,
  saveCustomDirective,
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
  const [library, setLibrary] = useState(DIRECTIVES)
  const [wish, setWish] = useState('')
  const [draft, setDraft] = useState<Directive | null>(null)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    let live = true
    void Promise.all([loadDirectivePicks(props.namespace), loadAllIdentityDirectives(), listDirectives()]).then(([saved, all, items]) => {
      if (!live) return
      setPicks(saved)
      setEveryone(all)
      setLibrary(items)
    })
    return () => { live = false }
  }, [props.namespace])

  if (!picks) return null
  const needle = query.trim()
  const shown = library.filter((item) => (category === '全部' || item.category === category) && (!needle || `${item.title}${item.text}${item.category}`.includes(needle)))
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
      <details className="menu-card">
        <summary>AI 撰写指令</summary>
        <textarea className="soft-input mt-2" value={wish} onChange={event => setWish(event.target.value)} placeholder="描述你想要的文风或互动规则" />
        <button type="button" className="chip mt-2" disabled={working || !wish.trim()} onClick={async () => {
          setWorking(true)
          try { setDraft(await draftDirective(wish.trim())); setNote('请预览或编辑指令。') }
          catch (error) { setNote(error instanceof Error ? error.message : '撰写失败') }
          finally { setWorking(false) }
        }}>撰写</button>
        {draft ? <>
          <input className="soft-input mt-2" aria-label="指令标题" value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} />
          <textarea className="soft-input mt-2" rows={6} aria-label="指令正文" value={draft.text} onChange={event => setDraft({ ...draft, text: event.target.value })} />
          <button type="button" className="chip chip-solid mt-2" disabled={working || !draft.title.trim() || !draft.text.trim()} onClick={async () => {
            setWorking(true)
            try { await saveCustomDirective(draft); setLibrary(await listDirectives()); setDraft(null); setCategory('自定义'); setQuery(''); setNote('已保存，可以选用。') }
            catch (error) { setNote(error instanceof Error ? error.message : '保存失败') }
            finally { setWorking(false) }
          }}>保存指令</button>
        </> : null}
      </details>
      <PillNote tone="mint" compact>指令库共 {library.length} 条。勾上的指令会用于短信、线下和番外。</PillNote>
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
        {['全部', ...DIRECTIVE_CATEGORIES, '自定义'].map((item) => (
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
