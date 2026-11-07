import { useEffect, useState, type CSSProperties } from 'react'
import { STAGE_CATEGORIES, stageKind, type StageKind } from '../../data/stageKinds.ts'
import { clampStageEvery, loadStagePlays, loadStagePrefs, saveStagePrefs, type StagePlay, type StagePrefs } from '../../lib/stage.ts'
import { useMellow } from '../../store/useMellow.ts'
import { Screen } from '../ui/primitives.tsx'

function coverStyle(kind: StageKind, seed: number): CSSProperties {
  const spot = 18 + (seed % 58)
  const rise = 8 + ((seed * 3) % 46)
  return {
    '--wash-a': kind.wash[0],
    '--wash-b': kind.wash[1],
    '--ink': kind.ink,
    '--spot-x': `${spot}%`,
    '--spot-y': `${rise}%`,
    '--tilt': `${(seed % 28) - 14}deg`,
    '--drift': `${7 + (seed % 8)}s`,
    '--blob': `${54 + (seed % 36)}px`,
  } as CSSProperties
}

export function StageCover(props: { kind: StageKind; seed: number; tall?: boolean }) {
  return (
    <div className={props.tall ? 'stage-cover is-tall' : 'stage-cover'} data-motif={props.kind.motif} style={coverStyle(props.kind, props.seed)} aria-hidden="true">
      <i />
      <i />
    </div>
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

export function StageApp(props: { onBack: () => void }) {
  const identity = useMellow((state) => state.identities.find((item) => item.id === state.activeIdentityId))
  const [prefs, setPrefs] = useState<StagePrefs | null>(null)
  const [plays, setPlays] = useState<StagePlay[]>([])
  const [query, setQuery] = useState('')
  const [needle, setNeedle] = useState('')
  const [category, setCategory] = useState('')
  const [open, setOpen] = useState<StagePlay | null>(null)

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

  if (open) {
    const kind = fallbackKind(open)
    return (
      <Screen title={open.title} subtitle={kind.name} onBack={() => setOpen(null)}>
        <article className="stage-detail">
          <StageCover kind={kind} seed={open.seed} tall />
          <p className="stage-kicker">{kind.category} · {kind.name}</p>
          <p>{open.blurb}</p>
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

  return (
    <Screen title="小剧场" subtitle="聊天时偶尔生成，封面是气氛，不是字" onBack={props.onBack}>
      {!identity ? <p>先到「设置 → 身份」选一台小手机。</p> : null}
      {prefs ? (
        <section className="stage-controls">
          <label className="stage-switch">
            <input type="checkbox" checked={prefs.enabled} onChange={(event) => patch({ ...prefs, enabled: event.target.checked })} />
            <span>{prefs.enabled ? '聊天时会生成小剧场' : '小剧场已关闭'}</span>
          </label>
          <label className="stage-every">
            <span>大约每 {prefs.every} 次来回尝试一场</span>
            <input type="range" min={2} max={20} value={prefs.every} aria-label="小剧场触发间隔" onChange={(event) => patch({ ...prefs, every: clampStageEvery(Number(event.target.value)) })} />
          </label>
          {prefs.enabled ? <p className="stage-hint">再有 {Math.max(0, prefs.every - prefs.turns)} 次来回，会试着写一场。关掉之后已有的卡片还在。</p> : <p className="stage-hint">打开之后，才会计入和角色的来回次数。</p>}
          {prefs.lastError ? <p role="status">{prefs.lastError}</p> : null}
        </section>
      ) : null}
      <input className="soft-input stage-search" aria-label="搜索小剧场" placeholder="搜名字、类型或简介" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="stage-cats" role="tablist" aria-label="小剧场分类">
        <button type="button" className={category === '' ? 'is-on' : ''} onClick={() => setCategory('')}>全部</button>
        {STAGE_CATEGORIES.map((item) => (
          <button key={item} type="button" className={category === item ? 'is-on' : ''} onClick={() => setCategory(item)}>{item}</button>
        ))}
      </div>
      {shown.length === 0 ? <p className="stage-empty">{plays.length === 0 ? '还没有小剧场。打开开关，和角色聊着聊着，这里会多出一张卡片。' : '没有对上的小剧场。'}</p> : null}
      <div className="stage-list">
        {shown.map((play) => {
          const kind = fallbackKind(play)
          return (
            <button key={play.id} type="button" className="stage-card" onClick={() => setOpen(play)}>
              <StageCover kind={kind} seed={play.seed} />
              <strong>{play.title}</strong>
              <em>{kind.name}</em>
              <span>{play.blurb}</span>
            </button>
          )
        })}
      </div>
    </Screen>
  )
}
