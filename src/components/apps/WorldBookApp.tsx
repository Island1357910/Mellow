import { useEffect, useState } from 'react'
import { candyStyle } from '../../lib/candy.ts'
import { blankEntry, importCharacterWorld, isGlobalWorldEntry, readWorld, writeWorld, worldEntriesFromCharacter, type WorldEntry } from '../../lib/worldbook.ts'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import type { Character } from '../../types/index.ts'
import { PillNote, Screen } from '../ui/primitives.tsx'

function clock(): number {
  return Date.now()
}

function usePhone() {
  const identities = useMellow((state) => state.identities)
  const activeIdentityId = useMellow((state) => state.activeIdentityId)
  return identities.find((item) => item.id === activeIdentityId) ?? null
}

export function WorldBookApp(props: { onBack: () => void }) {
  const phone = usePhone()
  const [rows, setRows] = useState<WorldEntry[] | null>(null)
  const [chars, setChars] = useState<Character[]>([])
  const [charId, setCharId] = useState('')
  const [scope, setScope] = useState<'world' | 'char'>('world')
  const [tab, setTab] = useState<'on' | 'all'>('on')
  const [draft, setDraft] = useState<WorldEntry | null>(null)
  const [note, setNote] = useState('')
  const selected = chars.find((item) => item.id === charId)
  const cardSources = selected ? worldEntriesFromCharacter(selected) : []

  useEffect(() => {
    if (!phone) return
    let stop = false
    void Promise.all([readWorld(phone.namespace), storage.listCharacters(phone.namespace)]).then(([saved, people]) => {
      if (stop) return
      setRows(saved)
      setChars(people)
      setCharId((current) => current || people[0]?.id || '')
      if (saved.some(isGlobalWorldEntry)) setScope('world')
    })
    return () => {
      stop = true
    }
  }, [phone])

  if (!phone || !rows) return null

  const globalRows = rows.filter(isGlobalWorldEntry)
  const bound = rows.filter((item) => item.charId === charId)
  const syncedCard = bound.filter((item) => item.cardImport).length
  const needsSync = cardSources.length > 0 && syncedCard === 0
  const activeScope = scope === 'world' ? globalRows : bound
  const shown = tab === 'on' ? activeScope.filter((item) => item.enabled) : activeScope

  const persist = (next: WorldEntry[]) => {
    setRows(next)
    void writeWorld(phone.namespace, next)
  }

  const keepScope = (nextScope: WorldEntry[]) => {
    if (scope === 'world') {
      persist([...nextScope, ...rows.filter((item) => item.charId)])
      return
    }
    persist([...nextScope, ...rows.filter((item) => item.charId !== charId)])
  }

  const saveDraft = () => {
    if (!draft || !draft.content.trim()) return
    if (scope === 'char' && !charId) return
    const next: WorldEntry = {
      ...draft,
      charId: scope === 'char' ? charId : undefined,
      title: draft.title.trim() || '未命名',
      content: draft.content.trim(),
      updatedAt: clock(),
    }
    const exists = rows.some((item) => item.id === next.id)
    const merged = exists ? rows.map((item) => (item.id === next.id ? next : item)) : [next, ...rows]
    persist(merged)
    setDraft(null)
  }

  const subtitle = draft
    ? '写完可以先留着，不一定要用'
    : scope === 'world'
      ? '全局世界观，不绑定角色，所有短信都会参考'
      : '每条设定绑定一个角色，删角色会一起删'

  return (
    <div className="sms-shell h-full min-h-0" style={candyStyle('#E7B7C9', '#F8D0DC', '#E6DDF8')}>
      <Screen title={draft ? '这一条' : '世界书'} subtitle={subtitle} onBack={() => (draft ? setDraft(null) : props.onBack())}>
        {draft ? (
          <div className="space-y-3">
            <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="条目名" className="soft-input" />
            <input value={draft.keys} onChange={(event) => setDraft({ ...draft, keys: event.target.value })} placeholder="关键词，用逗号分开" className="soft-input" />
            <textarea value={draft.content} rows={8} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder="这条设定本身" className="soft-input resize-none leading-6" />
            <button type="button" className="chip" style={!draft.enabled ? { background: '#D5F0E4' } : undefined} onClick={() => setDraft({ ...draft, enabled: !draft.enabled })}>{draft.enabled ? '点此停用（不再注入对话）' : '点此启用（注入对话）'}</button>
            <button type="button" className="chip chip-solid" disabled={!draft.content.trim()} onClick={saveDraft}>保存</button>
          </div>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-2 gap-1 rounded-full bg-white/70 p-1 text-xs">
              <button type="button" className="rounded-full py-1.5" style={{ background: scope === 'world' ? '#E7B7C9' : 'transparent' }} onClick={() => setScope('world')}>
                世界观{globalRows.length ? ` (${globalRows.length})` : ''}
              </button>
              <button type="button" className="rounded-full py-1.5" style={{ background: scope === 'char' ? '#E7B7C9' : 'transparent' }} onClick={() => setScope('char')}>角色设定</button>
            </div>

            {scope === 'char' ? (
              <label className="block text-xs" style={{ color: 'var(--m-text-secondary)' }}>
                绑定角色
                <select value={charId} onChange={(event) => setCharId(event.target.value)} className="soft-select mt-1 w-full text-sm">
                  {chars.length === 0 ? <option value="">还没有角色</option> : chars.map((item) => (
                    <option key={item.id} value={item.id}>{item.remark || item.name}</option>
                  ))}
                </select>
              </label>
            ) : (
              <PillNote tone="mint" compact>世界搭建导入的总世界观在这里。不跟某个角色绑定，也不会出现在短信联系人里。</PillNote>
            )}

            {scope === 'char' && chars.length === 0 ? <PillNote tone="lilac">先去短信导入或创建一个角色。</PillNote> : null}
            {scope === 'char' && selected && cardSources.length > 0 ? (
              <div className="mt-3 space-y-2">
                {needsSync ? (
                  <PillNote tone="mint" compact>
                    角色卡里还有 {cardSources.length} 条设定还没进世界书（character_book、系统提示、历史后指令）。新导入的角色会自动写入；这个可以手动同步。
                  </PillNote>
                ) : null}
                <button
                  type="button"
                  className={`chip w-full ${needsSync ? 'chip-solid' : 'chip-sky'}`}
                  onClick={() => {
                    void importCharacterWorld(phone.namespace, selected).then((count) => {
                      void readWorld(phone.namespace).then(setRows)
                      setNote(count > 0 ? `已从「${selected.remark || selected.name}」的角色卡同步 ${count} 条` : '没有可同步的内容')
                    })
                  }}
                >
                  {needsSync ? '从角色卡一键导入' : '重新从角色卡同步'}
                </button>
              </div>
            ) : null}
            {note ? <p className="preset-desc mt-2">{note}</p> : null}
            <div className="mb-3 mt-3 grid grid-cols-2 gap-1 rounded-full bg-white/70 p-1 text-xs">
              <button type="button" className="rounded-full py-1.5" style={{ background: tab === 'on' ? '#E7B7C9' : 'transparent' }} onClick={() => setTab('on')}>在用</button>
              <button type="button" className="rounded-full py-1.5" style={{ background: tab === 'all' ? '#E7B7C9' : 'transparent' }} onClick={() => setTab('all')}>全部</button>
            </div>
            <button
              type="button"
              className="chip chip-solid mb-3"
              disabled={scope === 'char' && !charId}
              onClick={() => setDraft(scope === 'char' ? blankEntry(charId) : blankEntry())}
            >
              新的一条
            </button>
            <div className="space-y-2">
              {shown.length === 0 ? (
                <PillNote tone="lilac">
                  {scope === 'world'
                    ? tab === 'on'
                      ? '还没有启用的世界观条目，可从世界搭建 App 导入大世界卡'
                      : '还没有世界观条目'
                    : tab === 'on'
                      ? '这个角色还没有启用的设定'
                      : '这个角色还没有世界书'}
                </PillNote>
              ) : shown.map((item) => (
                <article key={item.id} className="menu-card">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{item.title || '未命名'}</p>
                      <p className="mt-1 line-clamp-3 text-sm leading-6">{item.content}</p>
                      {item.keys ? <p className="mt-1 text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>{item.keys}</p> : null}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <button type="button" className="chip" style={!item.enabled ? { background: '#D5F0E4' } : undefined} onClick={() => keepScope(activeScope.map((row) => row.id === item.id ? { ...row, enabled: !row.enabled } : row))}>{item.enabled ? '点此停用' : '点此启用'}</button>
                    <button type="button" className="chip" onClick={() => setDraft(item)}>改</button>
                    <button type="button" className="chip chip-danger" onClick={() => keepScope(activeScope.filter((row) => row.id !== item.id))}>删除</button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </Screen>
    </div>
  )
}
