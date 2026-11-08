import { useEffect, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { candyStyle } from '../../lib/candy.ts'
import { blankEntry, CHARACTER_PROFILE_FIELDS, importCharacterWorld, isGlobalWorldEntry, readWorld, saveCharacterProfile, updateWorld, worldEntriesFromCharacter, type CharacterProfile, type WorldEntry } from '../../lib/worldbook.ts'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import type { Character } from '../../types/index.ts'
import { DirectiveLibrary } from './DirectiveLibrary.tsx'
import { PillNote, Screen } from '../ui/primitives.tsx'

function clock(): number {
  return Date.now()
}

function usePhone() {
  const identities = useMellow((state) => state.identities)
  const activeIdentityId = useMellow((state) => state.activeIdentityId)
  return identities.find((item) => item.id === activeIdentityId) ?? null
}

export function CharacterWorldBookShortcut({ people, onCharacterSaved }: { people: Character[]; onCharacterSaved?: (character: Character) => void }) {
  const [open, setOpen] = useState(false)
  if (!people.length) return null
  return (
    <>
      <button type="button" aria-label="编辑角色设定与世界书" title="编辑角色设定与世界书" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/85 shadow-[0_4px_12px_rgba(120,80,100,0.08)]" onClick={() => setOpen(true)}>
        <BookOpen size={16} />
      </button>
      {open ? (
        <div className="absolute inset-0 z-30">
          <WorldBookApp characterIds={people.map((person) => person.id)} onCharacterSaved={onCharacterSaved} onBack={() => setOpen(false)} />
        </div>
      ) : null}
    </>
  )
}

export function WorldBookApp(props: {
  onBack: () => void
  namespaceOverride?: string
  defaultScope?: 'world' | 'char' | 'order'
  characterIds?: string[]
  onCharacterSaved?: (character: Character) => void
}) {
  const phone = usePhone()
  const worldNamespace = props.namespaceOverride ?? phone?.namespace ?? ''
  const [rows, setRows] = useState<WorldEntry[] | null>(null)
  const [people, setPeople] = useState<Character[]>([])
  const [selectedId, setCharId] = useState('')
  const scoped = props.characterIds !== undefined
  const [scope, setScope] = useState<'world' | 'char' | 'order'>(scoped ? 'char' : props.defaultScope ?? 'world')
  const [tab, setTab] = useState<'on' | 'all'>(scoped ? 'all' : 'on')
  const [draft, setDraft] = useState<WorldEntry | null>(null)
  const [profile, setProfile] = useState<{ id: string; values: CharacterProfile } | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const chars = props.characterIds?.flatMap((id) => people.filter((person) => person.id === id)) ?? people
  const charId = chars.some((item) => item.id === selectedId) ? selectedId : chars[0]?.id ?? ''
  const selected = chars.find((item) => item.id === charId)

  useEffect(() => {
    if (!phone || !worldNamespace) return
    let stop = false
    void Promise.all([readWorld(worldNamespace), storage.listCharacters(phone.namespace)]).then(([saved, people]) => {
      if (stop) return
      setRows(saved)
      setPeople(people)
      if (scoped) return
      if (props.defaultScope) setScope(props.defaultScope)
      else if (saved.some(isGlobalWorldEntry)) setScope('world')
    }).catch((reason: unknown) => {
      if (!stop) setError(reason instanceof Error ? reason.message : '没能读取世界书')
    })
    return () => {
      stop = true
    }
  }, [phone, worldNamespace, props.defaultScope, scoped])

  const cardSources = selected ? worldEntriesFromCharacter(selected) : []
  const globalRows = (rows ?? []).filter(isGlobalWorldEntry)
  const bound = (rows ?? []).filter((item) => item.charId === charId)
  const syncedCard = bound.filter((item) => item.cardImport).length
  const needsSync = cardSources.length > 0 && syncedCard === 0
  const activeScope = scope === 'world' ? globalRows : bound
  const shown = tab === 'on' ? activeScope.filter((item) => item.enabled) : activeScope

  const commit = async (write: () => Promise<WorldEntry[]>) => {
    if (saving) return false
    setSaving(true)
    setError('')
    try {
      setRows(await write())
      return true
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '没能保存世界书')
      return false
    } finally {
      setSaving(false)
    }
  }
  const persist = (change: (current: WorldEntry[]) => WorldEntry[]) => commit(() => updateWorld(worldNamespace, change))

  const saveDraft = async () => {
    if (!draft || !draft.content.trim()) return
    if (scope === 'char' && !charId) return
    const next: WorldEntry = {
      ...draft,
      charId: scope === 'char' ? charId : undefined,
      title: draft.title.trim() || '未命名',
      content: draft.content.trim(),
      updatedAt: clock(),
    }
    const saved = await persist((current) => {
      const exists = current.some((item) => item.id === next.id)
      return exists ? current.map((item) => (item.id === next.id ? next : item)) : [next, ...current]
    })
    if (saved) setDraft(null)
  }

  const saveProfile = async () => {
    if (!profile || !phone) return
    const saved = await commit(async () => {
      const { character, value } = await saveCharacterProfile(phone.namespace, profile.id, profile.values)
      setPeople((current) => current.map((person) => person.id === character.id ? character : person))
      props.onCharacterSaved?.(character)
      return worldNamespace === phone.namespace ? value : readWorld(worldNamespace)
    })
    if (saved) {
      setProfile(null)
      setNote('角色设定已保存')
    }
  }

  const subtitle = profile
    ? '短信、线下和番外会共用这份角色设定'
    : draft
    ? '写完可以先留着，不一定要用'
    : scope === 'order'
      ? '写法、尺度、思维链和第四面墙，按需勾'
      : scope === 'world'
        ? '全局世界观，不绑定角色，所有短信都会参考'
        : scoped ? '此处修改会同步到这个角色的世界书' : '每条设定绑定一个角色，删角色会一起删'

  return (
    <div className="sms-shell h-full min-h-0" style={candyStyle('#E7B7C9', '#F8D0DC', '#E6DDF8')}>
      <Screen title={profile ? '角色卡设定' : draft ? '这一条' : scoped ? '角色设定与世界书' : '世界书'} subtitle={subtitle} onBack={() => {
        if (saving) return
        if (profile) setProfile(null)
        else if (draft) setDraft(null)
        else props.onBack()
      }}>
        {error ? <p role="alert" className="mb-2 text-sm text-[#a44f5a]">{error}</p> : null}
        {!rows ? <PillNote tone="lilac">{error ? '世界书加载失败' : '正在打开世界书…'}</PillNote> : profile ? (
          <div className="space-y-3">
            {CHARACTER_PROFILE_FIELDS.map(([key, title]) => (
              <label key={key} className="block text-sm">
                {title}
                <textarea className="soft-input mt-1 resize-y leading-6" rows={4} disabled={saving} value={profile.values[key]} onChange={(event) => {
                  setProfile({ ...profile, values: { ...profile.values, [key]: event.target.value } })
                }} />
              </label>
            ))}
            <button type="button" className="chip chip-solid" disabled={saving} onClick={() => void saveProfile()}>{saving ? '保存中…' : '保存角色设定'}</button>
          </div>
        ) : draft ? (
          <div className="space-y-3">
            <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="条目名" className="soft-input" />
            <input value={draft.keys} onChange={(event) => setDraft({ ...draft, keys: event.target.value })} placeholder="关键词，用逗号分开" className="soft-input" />
            <textarea value={draft.content} rows={8} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder="这条设定本身" className="soft-input resize-none leading-6" />
            <button type="button" className="chip" style={!draft.enabled ? { background: '#D5F0E4' } : undefined} onClick={() => setDraft({ ...draft, enabled: !draft.enabled })}>{draft.enabled ? '点此停用（不再注入对话）' : '点此启用（注入对话）'}</button>
            <button type="button" className="chip chip-solid" disabled={saving || !draft.content.trim()} onClick={() => void saveDraft()}>{saving ? '保存中…' : '保存'}</button>
          </div>
        ) : (
          <>
            {!scoped ? <div className="mb-3 grid grid-cols-3 gap-1 rounded-full bg-white/70 p-1 text-xs">
              <button type="button" className="rounded-full py-1.5" style={{ background: scope === 'world' ? '#E7B7C9' : 'transparent' }} onClick={() => setScope('world')}>
                世界观{globalRows.length ? ` ${globalRows.length}` : ''}
              </button>
              <button type="button" className="rounded-full py-1.5" style={{ background: scope === 'char' ? '#E7B7C9' : 'transparent' }} onClick={() => setScope('char')}>角色设定</button>
              <button type="button" className="rounded-full py-1.5" style={{ background: scope === 'order' ? '#E7B7C9' : 'transparent' }} onClick={() => setScope('order')}>指令库</button>
            </div> : null}
            {scope === 'order' ? <DirectiveLibrary namespace={worldNamespace} chars={chars} charId={charId} onChar={setCharId} /> : null}

            {scope === 'order' ? null : scope === 'char' ? (
              <label className="block text-xs" style={{ color: 'var(--m-text-secondary)' }}>
                绑定角色
                <select disabled={saving} value={charId} onChange={(event) => setCharId(event.target.value)} className="soft-select mt-1 w-full text-sm">
                  {chars.length === 0 ? <option value="">还没有角色</option> : chars.map((item) => (
                    <option key={item.id} value={item.id}>{item.remark || item.name}</option>
                  ))}
                </select>
              </label>
            ) : (
              <PillNote tone="mint" compact>世界搭建导入的总世界观在这里。不跟某个角色绑定，也不会出现在短信联系人里。</PillNote>
            )}

            {scope !== 'order' ? <>
            {scope === 'char' && chars.length === 0 ? <PillNote tone="lilac">先去短信导入或创建一个角色。</PillNote> : null}
            {scoped && selected ? (
              <button type="button" className="chip chip-lilac mt-3" disabled={saving} onClick={() => {
                const { id, description, personality, scenario } = selected
                setProfile({ id, values: { description, personality, scenario } })
              }}>编辑角色卡设定</button>
            ) : null}
            {scope === 'char' && selected && cardSources.length > 0 ? (
              <div className="mt-3 space-y-2">
                {needsSync ? (
                  <PillNote tone="mint" compact>
                    角色卡里还有 {cardSources.length} 条设定还没进世界书（简介、性格、情境、开场、世界书和提示词都会写入）。新导入的角色会自动写入；这个可以手动同步。
                  </PillNote>
                ) : null}
                <button
                  type="button"
                  className={`chip w-full ${needsSync ? 'chip-solid' : 'chip-sky'}`}
                  disabled={saving}
                  onClick={() => {
                    void commit(async () => {
                      const count = await importCharacterWorld(worldNamespace, selected)
                      setNote(count > 0 ? `已从「${selected.remark || selected.name}」的角色卡同步 ${count} 条` : '没有可同步的内容')
                      return readWorld(worldNamespace)
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
              disabled={saving || (scope === 'char' && !charId)}
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
                    <button type="button" className="chip" disabled={saving} style={!item.enabled ? { background: '#D5F0E4' } : undefined} onClick={() => void persist((current) => current.map((row) => row.id === item.id ? { ...row, enabled: !row.enabled, updatedAt: clock() } : row))}>{item.enabled ? '点此停用' : '点此启用'}</button>
                    <button type="button" className="chip" disabled={saving} onClick={() => setDraft(item)}>改</button>
                    <button type="button" className="chip chip-danger" disabled={saving} onClick={() => void persist((current) => current.filter((row) => row.id !== item.id))}>删除</button>
                  </div>
                </article>
              ))}
            </div>
            </> : null}
          </>
        )}
      </Screen>
    </div>
  )
}
