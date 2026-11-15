import { useEffect, useState, type CSSProperties } from 'react'
import { STAGE_CATEGORIES, STAGE_KINDS, stageKind, type StageKind } from '../../data/stageKinds.ts'
import { clampStageEvery, draftStageBrief, loadStagePlays, loadStagePrefs, saveStagePlay, saveStagePrefs, type StagePlay, type StagePrefs } from '../../lib/stage.ts'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import type { Character } from '../../types/index.ts'
import { Screen } from '../ui/primitives.tsx'

function coverStyle(kind: StageKind, seed: number): CSSProperties {
  return {
    '--wash-a': kind.wash[0],
    '--wash-b': kind.wash[1],
    '--ink': kind.ink,
    '--spot-x': `${22 + (seed % 40)}%`,
    '--tilt': `${(seed % 14) - 7}deg`,
  } as CSSProperties
}

export function StageCover(props: { kind: StageKind; seed: number; tall?: boolean }) {
  return (
    <div className={props.tall ? 'stage-cover is-tall' : 'stage-cover'} data-motif={props.kind.motif} style={coverStyle(props.kind, props.seed)} aria-hidden="true" />
  )
}

function fallbackKind(play: StagePlay): StageKind {
  return stageKind(play.kindId) ?? {
    id: play.kindId,
    name: play.kindName,
    category: play.category,
    hint: '',
    motif: 'paper',
    wash: ['#F6E7D4', '#E7C4A8'],
    ink: '#8A5A42',
  }
}

function StageBriefWriter(props: { namespace: string; onSaved: (play: StagePlay) => void }) {
  const aus = STAGE_KINDS.filter((item) => item.category === '世界AU')
  const [people, setPeople] = useState<Character[]>([])
  const [cast, setCast] = useState<string[]>([])
  const [castQuery, setCastQuery] = useState('')
  const [auId, setAuId] = useState('')
  const [wish, setWish] = useState('')
  const [draft, setDraft] = useState<StagePlay | null>(null)
  const [busy, setBusy] = useState<'' | 'draft' | 'save'>('')
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    setCast([])
    void storage.listCharacters(props.namespace).then((rows) => {
      if (!live) return
      setPeople(rows.filter((person) => !person.blocked).sort((a, b) => a.name.localeCompare(b.name, 'zh')))
    })
    return () => { live = false }
  }, [props.namespace])
  const chosen = new Set(cast)
  const visible = people.filter((person) => !castQuery.trim() || `${person.name}${person.nickname ?? ''}${person.remark ?? ''}`.includes(castQuery.trim()))
  const ready = Boolean(wish.trim() || cast.length || auId)
  const toggle = (id: string) => setCast((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  return (
    <details className="menu-card mb-3">
      <summary>写一段番外指令</summary>
      <p className="stage-hint mt-2">这里生成的是给番外用的写作指令，不是正文。可以多选角色，性格和上下位按原设，不会改成相反的人。</p>
      <input className="soft-input mt-2" aria-label="搜索角色" placeholder="搜角色" value={castQuery} onChange={(event) => setCastQuery(event.target.value)} />
      <div className="stage-cast">
        {visible.map((person) => (
          <label key={person.id}>
            <input type="checkbox" checked={chosen.has(person.id)} onChange={() => toggle(person.id)} />
            <span>{person.remark || person.nickname || person.name}</span>
          </label>
        ))}
        {people.length === 0 ? <p className="stage-hint">这台小手机里还没有角色。</p> : <p className="stage-hint">已选 {cast.length} 人</p>}
      </div>
      <div className="stage-cats" role="group" aria-label="世界 AU">
        <button type="button" className={auId === '' ? 'is-on' : ''} onClick={() => setAuId('')}>不换世界</button>
        {aus.map((item) => (
          <button key={item.id} type="button" className={auId === item.id ? 'is-on' : ''} onClick={() => setAuId(item.id)}>{item.name}</button>
        ))}
      </div>
      <textarea className="soft-input" rows={3} aria-label="番外要求" value={wish} onChange={(event) => setWish(event.target.value)} placeholder="这场番外想发生什么。例如：雨夜共处，但不要改人设" />
      <button type="button" className="chip mt-2" disabled={busy !== '' || !ready} onClick={() => {
        setBusy('draft')
        setError('')
        const picked = people.filter((person) => chosen.has(person.id))
        void draftStageBrief({ wish, people: picked, kind: stageKind(auId) ?? null }).then((next) => setDraft(next)).catch((reason: unknown) => {
          setError(reason instanceof Error ? reason.message : '没有生成指令')
        }).finally(() => setBusy(''))
      }}>{busy === 'draft' ? '正在写指令' : '生成指令'}</button>
      {draft ? <>
        <input className="soft-input mt-2" aria-label="指令标题" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        <textarea className="soft-input mt-2" rows={8} aria-label="番外指令" value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} />
        <button type="button" className="chip chip-solid mt-2" disabled={busy !== '' || !draft.title.trim() || !draft.body.trim()} onClick={() => {
          setBusy('save')
          setError('')
          void saveStagePlay(props.namespace, draft).then(() => {
            props.onSaved(draft)
            setDraft(null)
          }).catch((reason: unknown) => {
            setError(reason instanceof Error ? reason.message : '保存失败')
          }).finally(() => setBusy(''))
        }}>保存指令</button>
      </> : null}
      {error ? <p role="alert" className="mt-2 text-sm">{error}</p> : null}
    </details>
  )
}

function StageSettings(props: { prefs: StagePrefs; onChange: (next: StagePrefs) => void; onBack: () => void }) {
  const [query, setQuery] = useState('')
  const [needle, setNeedle] = useState('')
  useEffect(() => {
    const timer = window.setTimeout(() => setNeedle(query.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [query])
  const prefs = props.prefs
  const chosen = new Set(prefs.kinds)
  const visible = STAGE_KINDS.filter((item) => !needle || `${item.name}${item.category}${item.hint}`.includes(needle))
  const toggle = (id: string) => {
    const next = new Set(chosen)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    props.onChange({ ...prefs, kinds: STAGE_KINDS.map((item) => item.id).filter((item) => next.has(item)) })
  }
  const toggleCategory = (category: string) => {
    const ids = STAGE_KINDS.filter((item) => item.category === category).map((item) => item.id)
    const allOn = ids.every((id) => chosen.has(id))
    const next = new Set(chosen)
    for (const id of ids) {
      if (allOn) next.delete(id)
      else next.add(id)
    }
    props.onChange({ ...prefs, kinds: STAGE_KINDS.map((item) => item.id).filter((item) => next.has(item)) })
  }

  return (
    <Screen title="小剧场设置" subtitle="种类和已经生成的卡片分开" onBack={props.onBack}>
      <section className="stage-controls">
        <label className="stage-switch">
          <input type="checkbox" checked={prefs.enabled} onChange={(event) => props.onChange({ ...prefs, enabled: event.target.checked })} />
          <span>{prefs.enabled ? '聊天时会生成小剧场' : '小剧场已关闭'}</span>
        </label>
        <label className="stage-every">
          <span>大约每 {prefs.every} 次来回尝试一场</span>
          <input type="range" min={2} max={20} value={prefs.every} aria-label="小剧场触发间隔" onChange={(event) => props.onChange({ ...prefs, every: clampStageEvery(Number(event.target.value)) })} />
        </label>
        <p className="stage-hint">已选 {chosen.size} 种。没选中的不会在聊天里生成。世界 AU 默认不参与随机一场，要的话打开那一类。写成之后，手机会提示。</p>
      </section>
      <input className="soft-input stage-search" aria-label="搜索小剧场种类" placeholder="搜种类" value={query} onChange={(event) => setQuery(event.target.value)} />
      {STAGE_CATEGORIES.map((category) => {
        const rows = visible.filter((item) => item.category === category)
        if (!rows.length) return null
        const ids = STAGE_KINDS.filter((item) => item.category === category).map((item) => item.id)
        const allOn = ids.every((id) => chosen.has(id))
        return (
          <section key={category} className="stage-kind-group">
            <header>
              <h2>{category}</h2>
              <button type="button" onClick={() => toggleCategory(category)}>{allOn ? '这一类先不用' : '用这一类'}</button>
            </header>
            {rows.map((item) => (
              <label key={item.id} className="stage-kind">
                <input type="checkbox" checked={chosen.has(item.id)} onChange={() => toggle(item.id)} />
                <span>
                  <strong>{item.name}</strong>
                  <em>{item.hint}</em>
                </span>
              </label>
            ))}
          </section>
        )
      })}
    </Screen>
  )
}

export function StageApp(props: { onBack: () => void }) {
  const identity = useMellow((state) => state.identities.find((item) => item.id === state.activeIdentityId))
  const [prefs, setPrefs] = useState<StagePrefs | null>(null)
  const [plays, setPlays] = useState<StagePlay[]>([])
  const [query, setQuery] = useState('')
  const [needle, setNeedle] = useState('')
  const [category, setCategory] = useState('')
  const [open, setOpen] = useState<StagePlay | null>(null)
  const [settings, setSettings] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setNeedle(query.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!identity) return
    let live = true
    const load = () => {
      void loadStagePrefs(identity.namespace).then((next) => { if (live) setPrefs(next) })
      void loadStagePlays(identity.namespace).then((next) => { if (live) setPlays(next) })
    }
    load()
    window.addEventListener('mellow-stage', load)
    return () => { live = false; window.removeEventListener('mellow-stage', load) }
  }, [identity])

  const patch = (next: StagePrefs) => {
    setPrefs(next)
    if (identity) void saveStagePrefs(identity.namespace, next)
  }

  if (settings && prefs) return <StageSettings prefs={prefs} onChange={patch} onBack={() => setSettings(false)} />

  if (open) {
    const kind = fallbackKind(open)
    return (
      <Screen title={open.title} subtitle={open.form === 'brief' ? '番外指令' : kind.name} onBack={() => { setCopied(false); setOpen(null) }}>
        <article className="stage-detail">
          <StageCover kind={kind} seed={open.seed} tall />
          <p className="stage-kicker">{open.form === 'brief' ? '番外指令' : kind.category} · {kind.name}</p>
          <p className="stage-lead">{open.blurb}</p>
          {open.withName ? <p className="stage-with">按{open.withName}的原设</p> : null}
          <div className="stage-body">{open.body}</div>
          {open.form === 'brief' ? <button type="button" className="chip" onClick={() => {
            void navigator.clipboard.writeText(open.body).then(() => setCopied(true)).catch(() => window.alert('没有复制成功'))
          }}>{copied ? '已复制' : '复制指令'}</button> : null}
        </article>
      </Screen>
    )
  }

  const shown = plays.filter((play) => {
    if (category && play.category !== category) return false
    if (!needle) return true
    const hay = `${play.title}\n${play.kindName}\n${play.category}\n${play.blurb}\n${play.withName}`
    return hay.toLowerCase().includes(needle.toLowerCase())
  })
  const categories = [...new Set(plays.map((play) => play.category))]

  return (
    <Screen
      title="小剧场"
      subtitle={plays.length ? `已写成 ${plays.length} 场` : '聊着聊着，会多出一张卡片'}
      onBack={props.onBack}
      right={prefs ? <button type="button" className="stage-settings" onClick={() => setSettings(true)}>设置</button> : null}
    >
      {!identity ? <p>先到「设置 → 身份」选一台小手机。</p> : null}
      {identity ? <StageBriefWriter namespace={identity.namespace} onSaved={(play) => { setCopied(false); setOpen(play) }} /> : null}
      <input className="soft-input stage-search" aria-label="搜索已生成的小剧场" placeholder="搜已经写成的" value={query} onChange={(event) => setQuery(event.target.value)} />
      {categories.length > 1 ? (
        <div className="stage-cats" role="tablist" aria-label="已生成的小剧场分类">
          <button type="button" className={category === '' ? 'is-on' : ''} onClick={() => setCategory('')}>全部</button>
          {categories.map((item) => (
            <button key={item} type="button" className={category === item ? 'is-on' : ''} onClick={() => setCategory(item)}>{item}</button>
          ))}
        </div>
      ) : null}
      {shown.length === 0 ? <p className="stage-empty">{plays.length === 0 ? '还没有小剧场。到设置里打开，并选好想要的种类。' : '没有对上的小剧场。'}</p> : null}
      <div className="stage-list">
        {shown.map((play) => {
          const kind = fallbackKind(play)
          return (
            <button key={play.id} type="button" className="stage-card" onClick={() => { setCopied(false); setOpen(play) }}>
              <StageCover kind={kind} seed={play.seed} />
              <span className="stage-copy">
                <em>{play.form === 'brief' ? '指令 · ' : ''}{kind.category} · {kind.name}</em>
                <strong>{play.title}</strong>
                <span>{play.blurb}</span>
              </span>
            </button>
          )
        })}
      </div>
    </Screen>
  )
}
