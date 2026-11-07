import { useEffect, useState, type CSSProperties } from 'react'
import { STAGE_CATEGORIES, STAGE_KINDS, stageKind, type StageKind } from '../../data/stageKinds.ts'
import { clampStageEvery, loadStagePlays, loadStagePrefs, saveStagePrefs, type StagePlay, type StagePrefs } from '../../lib/stage.ts'
import { useMellow } from '../../store/useMellow.ts'
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
        <p className="stage-hint">已选 {chosen.size} 种。没选中的不会生成。写成之后，手机会提示。</p>
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
      <Screen title={open.title} subtitle={kind.name} onBack={() => setOpen(null)}>
        <article className="stage-detail">
          <StageCover kind={kind} seed={open.seed} tall />
          <p className="stage-kicker">{kind.category} · {kind.name}</p>
          <p className="stage-lead">{open.blurb}</p>
          {open.withName ? <p className="stage-with">和{open.withName}有关</p> : null}
          <div className="stage-body">{open.body}</div>
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
            <button key={play.id} type="button" className="stage-card" onClick={() => setOpen(play)}>
              <StageCover kind={kind} seed={play.seed} />
              <span className="stage-copy">
                <em>{kind.category} · {kind.name}</em>
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
