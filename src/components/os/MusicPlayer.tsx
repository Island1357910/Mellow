import { Ellipsis, Link2, ListMusic, Music2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Trash2, Upload, Volume1, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CARD_COLORS, DISC_COLORS, isDark, resolveTrackSrc, usePlayer, type PlayerStyle, type RepeatMode } from '../../lib/playerStore.ts'

const REPEAT_MODES: Array<{ id: RepeatMode; label: string; icon: typeof Repeat1 }> = [
  { id: 'one', label: '单曲循环', icon: Repeat1 },
  { id: 'all', label: '列表循环', icon: Repeat },
  { id: 'shuffle', label: '随机播放', icon: Shuffle },
]

export function MusicPlayer(props: { namespace: string; onSettings: () => void }) {
  const load = usePlayer((state) => state.load)
  const config = usePlayer((state) => state.config)
  const patch = usePlayer((state) => state.patch)
  useEffect(() => load(props.namespace), [load, props.namespace])
  const tracks = config.tracks
  const repeatMode = config.repeatMode ?? 'one'
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(3)
  const [progress, setProgress] = useState(0)
  const volumeRef = useRef(3)
  const gainRef = useRef<GainNode | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const shuffleRef = useRef<number[]>([])
  const advanceRef = useRef<(delta: number, keepPlaying?: boolean) => void>(() => {})
  const at = tracks.length ? index % tracks.length : 0
  const track = tracks[at]
  const repeatMeta = REPEAT_MODES.find((item) => item.id === repeatMode) ?? REPEAT_MODES[0]
  const RepeatIcon = repeatMeta.icon

  const nextIndex = (current: number, delta: number) => {
    if (tracks.length <= 1) return current
    if (repeatMode === 'shuffle') {
      if (shuffleRef.current.length !== tracks.length) {
        shuffleRef.current = tracks.map((_, idx) => idx).sort(() => Math.random() - 0.5)
      }
      const pos = shuffleRef.current.indexOf(current)
      const nextPos = (pos + delta + shuffleRef.current.length) % shuffleRef.current.length
      return shuffleRef.current[nextPos] ?? 0
    }
    return (current + delta + tracks.length) % tracks.length
  }
  const step = (delta: number, keepPlaying = false) => {
    setProgress(0)
    setIndex((value) => {
      const next = nextIndex(value, delta)
      if (next !== value) shuffleRef.current = []
      return next
    })
    if (keepPlaying) setPlaying(true)
  }
  advanceRef.current = step

  useEffect(() => {
    if (!playing || !track) return
    let cancelled = false
    if (track.src) {
      let audio: HTMLAudioElement | null = null
      const onTime = () => {
        if (audio && audio.duration) setProgress(audio.currentTime / audio.duration)
      }
      const onEnded = () => {
        if (repeatMode === 'one') return
        advanceRef.current(1, true)
      }
      void resolveTrackSrc(props.namespace, track.src).then((url) => {
        if (cancelled || !url) return
        audio = new Audio(url)
        audio.loop = repeatMode === 'one'
        audio.volume = volumeRef.current / 5
        audio.addEventListener('timeupdate', onTime)
        audio.addEventListener('ended', onEnded)
        audioRef.current = audio
        void audio.play().catch(() => setPlaying(false))
      })
      return () => {
        cancelled = true
        audio?.removeEventListener('timeupdate', onTime)
        audio?.removeEventListener('ended', onEnded)
        audio?.pause()
        audioRef.current = null
      }
    }
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = track.tone ?? 196
    gain.gain.value = volumeRef.current * 0.012
    gainRef.current = gain
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    const timer = window.setInterval(() => setProgress((value) => (value + 0.01) % 1), 600)
    return () => {
      window.clearInterval(timer)
      gainRef.current = null
      osc.stop()
      void ctx.close()
    }
  }, [playing, track, props.namespace, repeatMode])

  const changeVolume = (delta: number) => {
    const next = Math.max(0, Math.min(5, volumeRef.current + delta))
    volumeRef.current = next
    setVolume(next)
    if (gainRef.current) gainRef.current.gain.value = next * 0.012
    if (audioRef.current) audioRef.current.volume = next / 5
  }
  const cycleRepeat = () => {
    const atMode = REPEAT_MODES.findIndex((item) => item.id === repeatMode)
    const next = REPEAT_MODES[(atMode + 1) % REPEAT_MODES.length]?.id ?? 'one'
    shuffleRef.current = []
    patch({ repeatMode: next })
  }
  const dark = isDark(config.card)
  const ink = dark ? 'rgba(255,255,255,0.9)' : 'var(--m-text)'
  const soft = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.05)'
  const name = track?.name ?? '还没有歌'

  return (
    <div className="relative flex aspect-square w-full flex-col overflow-hidden rounded-[28px] p-2.5 shadow-[0_10px_24px_rgba(90,70,80,0.06)]" style={{ background: config.card, color: ink }}>
      <button type="button" aria-label="播放器设置" className="absolute left-2 top-2 z-10 grid h-6 w-6 place-items-center rounded-full" style={{ background: soft }} onClick={props.onSettings}>
        <Ellipsis size={13} />
      </button>
      <div className="relative min-h-0 flex-1">
        {config.style === 'minimal' ? (
          <button type="button" aria-label={playing ? `暂停 ${name}` : `播放 ${name}`} onClick={() => setPlaying((value) => !value)} className="flex h-full w-full flex-col items-center justify-center gap-1.5">
            <span className="grid h-12 w-12 place-items-center rounded-full text-white shadow-[0_8px_16px_rgba(0,0,0,0.12)]" style={{ background: config.disc }}>
              {playing ? <Pause size={18} /> : <Play size={18} className="translate-x-px" />}
            </span>
            <span className="flex h-4 items-end gap-0.5">
              {[0, 1, 2, 3, 4].map((bar) => (
                <span key={bar} className={playing ? 'eq-bar is-on' : 'eq-bar'} style={{ background: config.disc, animationDelay: `${bar * 0.12}s` }} />
              ))}
            </span>
          </button>
        ) : (
          <div className="relative mx-auto aspect-square h-full">
            <button
              type="button"
              aria-label={playing ? `暂停 ${name}` : `播放 ${name}`}
              onClick={() => setPlaying((value) => !value)}
              className="absolute left-1/2 top-1/2 block aspect-square h-[86%] -translate-x-1/2 -translate-y-1/2"
            >
              {config.style === 'cd' ? (
                <span
                  className={playing ? 'vinyl-disc is-on block h-full w-full rounded-full' : 'vinyl-disc block h-full w-full rounded-full'}
                  style={{ background: `conic-gradient(from 30deg, #f3f3f6, ${config.disc}55, #e7f4ff, #fbe3ec, #f3f3f6, #dff3ea, ${config.disc}55, #f3f3f6)`, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }}
                >
                  <span className="absolute left-1/2 top-1/2 block h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90 ring-1 ring-black/10" />
                  <span className="absolute left-1/2 top-1/2 block h-[10%] w-[10%] -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-black/10" style={{ background: config.card }} />
                </span>
              ) : (
                <span
                  className={playing ? 'vinyl-disc is-on block h-full w-full rounded-full' : 'vinyl-disc block h-full w-full rounded-full'}
                  style={{
                    background: config.disc,
                    boxShadow: 'inset 0 0 0 6px rgba(0,0,0,0.25), inset 0 0 0 7px rgba(255,255,255,0.22), inset 0 0 0 12px rgba(0,0,0,0.18), inset 0 0 0 13px rgba(255,255,255,0.14), inset 0 0 0 18px rgba(0,0,0,0.12)',
                  }}
                >
                  <span className="absolute left-1/2 top-1/2 block h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
                  <span className="absolute left-1/2 top-1/2 block h-[8%] w-[8%] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: config.disc }} />
                </span>
              )}
            </button>
            {config.style === 'vinyl' ? (
              <span className="pointer-events-none absolute right-[7%] top-[5%] h-[54%] w-4 origin-top transition-transform duration-500" style={{ transform: playing ? 'rotate(8deg)' : 'rotate(-40deg)' }}>
                <span className="absolute left-1/2 top-0 block h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#dedede]" />
                <span className="absolute left-1/2 top-1 block h-[74%] w-[2px] -translate-x-1/2 rounded-full bg-[#d5d5d5]" />
                <span className="absolute bottom-0 left-1/2 block h-1.5 w-3 -translate-x-1/2 rounded-sm bg-[#f4f4f4] ring-1 ring-black/10" />
              </span>
            ) : null}
          </div>
        )}
      </div>
      <div className="shrink-0">
        <p className="truncate text-center text-[11px] leading-4">{name}{track?.artist && config.style === 'minimal' ? ` · ${track.artist}` : ''}</p>
        <span className="my-1 block h-px" style={{ background: soft }}>
          <span className="block h-full transition-[width] duration-500" style={{ width: `${Math.max(6, progress * 100)}%`, background: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)' }} />
        </span>
        <div className="flex items-center justify-between">
          <button type="button" aria-label="上一首" className="grid h-6 w-6 place-items-center rounded-full" style={{ background: soft }} onClick={() => step(-1)}>
            <SkipBack size={12} />
          </button>
          <button type="button" aria-label={repeatMeta.label} title={repeatMeta.label} className="grid h-6 w-6 place-items-center rounded-full" style={{ background: repeatMode === 'one' ? soft : config.disc, color: repeatMode === 'one' ? ink : '#fff' }} onClick={cycleRepeat}>
            <RepeatIcon size={12} />
          </button>
          <button type="button" aria-label="音量减小" className="grid h-6 w-6 place-items-center rounded-full" style={{ background: soft }} onClick={() => changeVolume(-1)}>
            <Volume1 size={12} />
          </button>
          <span className="tabular text-[11px]">{volume}</span>
          <button type="button" aria-label="音量增大" className="grid h-6 w-6 place-items-center rounded-full" style={{ background: soft }} onClick={() => changeVolume(1)}>
            <Volume2 size={12} />
          </button>
          <button type="button" aria-label="下一首" className="grid h-6 w-6 place-items-center rounded-full" style={{ background: soft }} onClick={() => step(1)}>
            <SkipForward size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}

const STYLES: Array<{ id: PlayerStyle; label: string }> = [
  { id: 'vinyl', label: '黑胶' },
  { id: 'cd', label: '光碟' },
  { id: 'minimal', label: '极简' },
]

type SheetTab = 'look' | 'list' | 'import'

export function PlayerSheet(props: { onClose: () => void }) {
  const config = usePlayer((state) => state.config)
  const patch = usePlayer((state) => state.patch)
  const addTrack = usePlayer((state) => state.addTrack)
  const removeTrack = usePlayer((state) => state.removeTrack)
  const [tab, setTab] = useState<SheetTab>('look')
  const [name, setName] = useState('')
  const [artist, setArtist] = useState('')
  const [url, setUrl] = useState('')
  const [batch, setBatch] = useState('')
  const [note, setNote] = useState('')

  const addLink = () => {
    if (!name.trim()) {
      setNote('先写歌名')
      return
    }
    void addTrack({ name: name.trim(), artist: artist.trim() || undefined, src: url.trim() || undefined }).then(() => {
      setNote(url.trim() ? `已加入「${name.trim()}」` : `已加入「${name.trim()}」，没有链接时会用柔和的合成音`)
      setName('')
      setArtist('')
      setUrl('')
    })
  }
  const addBatch = () => {
    const rows = batch.split('\n').map((line) => line.trim()).filter(Boolean)
    void (async () => {
      for (const row of rows) {
        const [head, link] = row.split('|').map((part) => part.trim())
        const [title, singer] = (head ?? '').split(/\s+-\s+/)
        if (title) await addTrack({ name: title, artist: singer || undefined, src: link || undefined })
      }
      setNote(`批量加入 ${rows.length} 首`)
      setBatch('')
    })()
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/20 backdrop-blur-[2px]" onPointerDown={(event) => event.stopPropagation()} onClick={props.onClose}>
      <div className="sms-shell mx-auto max-h-[82%] w-full max-w-[460px] overflow-auto rounded-t-[30px] px-4 pb-10 pt-4 shadow-[0_-12px_30px_rgba(90,70,80,0.12)]" onClick={(event) => event.stopPropagation()}>
        <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-black/10" />
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold">播放器设置</h2>
          <button type="button" className="chip chip-pink" onClick={props.onClose}>完成</button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-full bg-white/80 p-1">
          {([['look', '外观'], ['list', `歌单 ${config.tracks.length}`], ['import', '导入']] as Array<[SheetTab, string]>).map(([id, label]) => (
            <button key={id} type="button" className="rounded-full py-1.5 text-xs transition-colors" style={{ background: tab === id ? '#F3A8BA' : 'transparent', color: tab === id ? '#fff' : 'var(--m-text-secondary)', fontWeight: tab === id ? 600 : 400 }} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'look' ? (
          <div className="mt-3 space-y-3">
            <section className="menu-card">
              <p className="text-xs" style={{ color: 'var(--m-text-secondary)' }}>样式</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {STYLES.map((item) => (
                  <button key={item.id} type="button" className="flex flex-col items-center gap-1.5 rounded-2xl py-3 text-xs" style={{ background: config.style === item.id ? '#FFF1F5' : 'white', outline: config.style === item.id ? '2px solid #F3A8BA' : '1px solid rgba(0,0,0,0.05)' }} onClick={() => patch({ style: item.id })}>
                    <StylePreview style={item.id} disc={config.disc} />
                    {item.label}
                  </button>
                ))}
              </div>
            </section>
            <section className="menu-card">
              <p className="text-xs" style={{ color: 'var(--m-text-secondary)' }}>卡片底色</p>
              <Swatches colors={CARD_COLORS} value={config.card} onPick={(card) => patch({ card })} />
              <p className="mt-4 text-xs" style={{ color: 'var(--m-text-secondary)' }}>唱片 / 按钮颜色</p>
              <Swatches colors={DISC_COLORS} value={config.disc} onPick={(disc) => patch({ disc })} />
            </section>
          </div>
        ) : null}

        {tab === 'list' ? (
          <ul className="menu-card mt-3 space-y-1 p-2">
            {config.tracks.map((item) => (
              <li key={item.id} className="flex items-center gap-3 rounded-2xl px-2 py-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: item.src ? '#D7E7F8' : '#F8E6C0' }}>
                  {item.src ? <Music2 size={15} /> : <ListMusic size={15} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{item.name}</span>
                  <span className="block truncate text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>
                    {[item.artist, item.src ? (item.src.startsWith('bag:') ? '本地文件' : '网络链接') : '合成音'].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {item.id.startsWith('builtin-') ? null : (
                  <button type="button" aria-label={`删掉 ${item.name}`} className="grid h-8 w-8 place-items-center rounded-full bg-[#FBE3E3] text-[#b0505c]" onClick={() => removeTrack(item.id)}>
                    <Trash2 size={13} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : null}

        {tab === 'import' ? (
          <div className="mt-3 space-y-3">
            <section className="menu-card">
              <p className="flex items-center gap-1.5 text-sm font-medium"><Upload size={14} /> 本地音频文件</p>
              <p className="mt-1 text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>支持 mp3、m4a、wav 等，可多选，单首 15MB 以内</p>
              <label className="chip chip-sky mt-3 w-full py-2">
                选择文件
                <input type="file" accept="audio/*" multiple className="hidden" onChange={(event) => {
                  const files = [...(event.target.files ?? [])]
                  event.target.value = ''
                  void (async () => {
                    let added = 0
                    for (const file of files) {
                      if (file.size > 15_000_000) continue
                      const data = await new Promise<string>((resolve) => {
                        const reader = new FileReader()
                        reader.onload = () => resolve(String(reader.result ?? ''))
                        reader.readAsDataURL(file)
                      })
                      await addTrack({ name: file.name.replace(/\.[^.]+$/, '') }, data)
                      added += 1
                    }
                    setNote(added ? `导入了 ${added} 首` : '文件太大或格式不对')
                  })()
                }} />
              </label>
            </section>
            <section className="menu-card space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-medium"><Link2 size={14} /> 链接或手动添加</p>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="歌名" className="soft-input" />
              <input value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="歌手（可不填）" className="soft-input" />
              <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="音频直链 https://…（可不填）" className="soft-input" />
              <button type="button" className="chip chip-solid w-full py-2" onClick={addLink}>加入歌单</button>
            </section>
            <section className="menu-card space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-medium"><ListMusic size={14} /> 批量粘贴歌单</p>
              <p className="text-[11px]" style={{ color: 'var(--m-text-secondary)' }}>每行一首：歌名 - 歌手 | 链接，后两段都可以省略</p>
              <textarea value={batch} onChange={(event) => setBatch(event.target.value)} rows={4} placeholder={'晴天 - 周杰伦\n小幸运 | https://example.com/a.mp3'} className="soft-input resize-none leading-5" />
              <button type="button" className="chip chip-lilac w-full py-2" disabled={!batch.trim()} onClick={addBatch}>全部加入</button>
            </section>
          </div>
        ) : null}

        {note ? <p className="mx-auto mt-3 w-fit rounded-full bg-[#D5F0E4] px-3 py-1 text-xs">{note}</p> : null}
      </div>
    </div>
  )
}

function Swatches(props: { colors: string[]; value: string; onPick: (color: string) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-3">
      {props.colors.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`颜色 ${color}`}
          className="h-8 w-8 rounded-full shadow-[0_4px_10px_rgba(120,80,100,0.1)]"
          style={{ background: color, outline: props.value === color ? '2px solid #F3A8BA' : '1px solid rgba(0,0,0,0.08)', outlineOffset: 2 }}
          onClick={() => props.onPick(color)}
        />
      ))}
    </div>
  )
}

function StylePreview(props: { style: PlayerStyle; disc: string }) {
  if (props.style === 'minimal') {
    return <span className="grid h-10 w-10 place-items-center rounded-full text-white" style={{ background: props.disc }}><Play size={14} /></span>
  }
  if (props.style === 'cd') {
    return <span className="h-10 w-10 rounded-full ring-1 ring-black/10" style={{ background: `conic-gradient(#f3f3f6, ${props.disc}55, #e7f4ff, #fbe3ec, #f3f3f6)` }} />
  }
  return <span className="grid h-10 w-10 place-items-center rounded-full" style={{ background: props.disc }}><span className="h-3.5 w-3.5 rounded-full bg-white" /></span>
}
