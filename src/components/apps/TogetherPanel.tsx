import { useEffect, useMemo, useState } from 'react'
import { storage } from '../../storage/StorageService.ts'
import { useTogether, bookPages, lyricAt, bindTogetherSource } from '../../lib/together.ts'
import { usePlayer } from '../../lib/playerStore.ts'
import { useMellow } from '../../store/useMellow.ts'
import { tickTogether } from '../../lib/togetherReplies.ts'
import { MusicPlayer, PlayerSheet } from '../os/MusicPlayer.tsx'
import type { Character } from '../../types/index.ts'

export function TogetherPanel({ namespace }: { namespace: string }) {
  const config = useTogether(s => s.config), status = useTogether(s => s.status)
  const externalMusic = useTogether(s => s.externalMusic)
  const patch = useTogether(s => s.patch)
  const player = usePlayer(), [people, setPeople] = useState<Character[]>([])
  const [title, setTitle] = useState(''), [text, setText] = useState(''), [url, setUrl] = useState('')
  const [note, setNote] = useState(''), [loading, setLoading] = useState(false)
  const [lyrics, setLyrics] = useState('')
  const [playerSettings, setPlayerSettings] = useState(false)
  const track = player.config.tracks[player.index]
  useEffect(() => {
    let alive = true
    void useTogether.getState().load(namespace)
    usePlayer.getState().load(namespace)
    void storage.listModernCharacters(namespace).then(rows => { if (alive) setPeople(rows.filter(p => !p.blocked)) })
    return () => { alive = false }
  }, [namespace])
  useEffect(() => { setLyrics(track?.lyrics ?? '') }, [track?.id, track?.lyrics])
  const act = async (task: () => Promise<void>) => { setLoading(true); setNote(''); try { await task() } catch (e) { setNote(e instanceof Error ? e.message : String(e)) } finally { setLoading(false) } }
  const importBook = async (body = text, name = title) => {
    if (useTogether.getState().namespace !== namespace) throw Error('手机身份已切换，请在当前身份重新导入')
    if (!body.trim()) throw Error('还没有可阅读的正文')
    if (body.length > 2_000_000) throw Error('请导入 200 万字以内的文本，长篇可按卷导入')
    bindTogetherSource(null)
    await patch({ reading: true, book: { title: name.trim() || '一起读的内容', text: body, page: 0, kind: '小说 / 文章' } })
    setText(''); setNote('已导入，翻页会自动同步给所选 char')
  }
  const pages = useMemo(() => config.book ? bookPages(config.book.text) : [], [config.book])
  const page = Math.max(0, Math.min(pages.length - 1, config.book?.page ?? 0))
  return <section className="menu-card space-y-3">
    <h3 className="font-semibold">陪伴 · 一起听，一起读</h3>
    <details className="text-xs leading-6"><summary>第一次用？查看教程</summary><ol className="list-inside list-decimal"><li>先在设置配置聊天 API，并添加 char。</li><li>选择陪伴角色，打开共享音乐或共享阅读。</li><li>听歌：展开一起听，选歌播放；歌词只需保存一次，也支持 LRC 文件。</li><li>阅读：导入 TXT 或一次粘贴全文，在本页翻页即可自动同步当前页。</li><li>打开主动聊天并选择间隔；TA 的回应在短信中。也可点“让 TA 聊聊当前内容”立即触发。</li><li>外部 App / 网页内容需要在下方连接自己的 MCP 读取服务，绑定只读工具；它不能凭链接读取其他 App。</li><li>结束时点“结束陪伴”。后台自动回应要求小手机页面保持运行，会消耗所配置 API 的额度。</li></ol></details>
    <p className="text-xs leading-6">只共享你开启的内容给所选 char。开启主动聊天后，内容变化时 TA 会发短信；每次回应会使用聊天 API。</p>
    <select aria-label="陪伴角色" className="soft-select w-full" value={config.charId} onChange={e => void patch({ charId: e.target.value })}>
      <option value="">选择一起听 / 读的 char</option>{people.map(p => <option key={p.id} value={p.id}>{p.remark || p.name}</option>)}
    </select>
    {!people.length && <p className="text-xs">先在通讯录添加一个现代角色。</p>}
    <div className="flex flex-wrap gap-2">
      <button className="chip" aria-pressed={config.music} onClick={() => void patch({ music: !config.music })}>共享音乐：{config.music ? '开' : '关'}</button>
      <button className="chip" aria-pressed={config.reading} onClick={() => void patch({ reading: !config.reading })}>共享阅读：{config.reading ? '开' : '关'}</button>
      <button className="chip" aria-pressed={config.auto} onClick={() => void patch({ auto: !config.auto })}>主动聊天：{config.auto ? '开' : '关'}</button>
    </div>
    <label className="flex items-center gap-2 text-xs">最短聊天间隔<select aria-label="陪伴聊天间隔" className="soft-select" value={config.minutes} onChange={e => void patch({ minutes: Number(e.target.value) })}>{[1,3,5,10].map(n => <option key={n} value={n}>{n} 分钟</option>)}</select></label>
    <button className="chip chip-solid" disabled={loading || !config.charId} onClick={() => void act(async () => { const identity = useMellow.getState().identities.find(i => i.namespace === namespace); if (identity) await tickTogether(identity, true) })}>让 TA 聊聊当前内容</button>
    <button className="chip" onClick={() => { bindTogetherSource(null); void patch({ music: false, reading: false, auto: false }); setNote('已停止共享和自动读取') }}>结束陪伴</button>
    <details><summary className="text-sm">一起听歌与歌词</summary><div className="mt-3 space-y-3">
      <div className="mx-auto w-44"><MusicPlayer namespace={namespace} onSettings={() => setPlayerSettings(true)} /></div>
      <select aria-label="陪伴播放歌曲" className="soft-select w-full" value={track?.id ?? ''} onChange={e => usePlayer.setState({ index: player.config.tracks.findIndex(t => t.id === e.target.value), seconds: 0, duration: 0 })}>{player.config.tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
      <p className="text-xs leading-5">播放音频不会自动识别歌词。每首歌只需导入一次 LRC 或纯文本歌词；之后自动跟随歌曲切换。LRC 支持按播放时间同步。</p>
      <textarea aria-label="当前歌曲歌词" className="soft-input" rows={4} placeholder="粘贴当前歌曲的歌词，或导入 .lrc 文件" value={lyrics} onChange={e => setLyrics(e.target.value)} />
      <label className="chip">导入歌词<input type="file" accept=".lrc,.txt,text/plain" className="hidden" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void act(async () => { if (file.size > 300_000) throw Error('歌词文件请小于 300KB'); const body = await file.text(); if (usePlayer.getState().config.tracks[usePlayer.getState().index]?.id !== track?.id) throw Error('歌曲已切换，请重新导入到当前歌曲'); setLyrics(body) }) }} /></label>
      <button className="chip" disabled={!track} onClick={() => { player.patch({ tracks: player.config.tracks.map(t => t.id === track.id ? { ...t, lyrics: lyrics.slice(0, 100_000) } : t) }); setNote('歌词已保存到这首歌') }}>保存这首歌词</button>
      <p className="whitespace-pre-wrap text-xs leading-6">{track?.lyrics ? lyricAt(track.lyrics, player.seconds) : '当前歌曲尚无歌词，char 只知道歌名和歌手'}</p>
      {externalMusic && <p className="whitespace-pre-wrap text-xs leading-6">MCP 外部播放器：{externalMusic.name} · {externalMusic.playing ? '播放中' : '已暂停'}{'\n'}{externalMusic.lyrics ? lyricAt(externalMusic.lyrics, externalMusic.seconds) : '外部服务尚未返回歌词'}</p>}
    </div></details>
    <details open><summary className="text-sm">一起读小说 / 文章 / 字幕</summary><div className="mt-3 space-y-2">
      <input aria-label="共读内容名称" className="soft-input" placeholder="书名、文章名或电影名" value={title} onChange={e => setTitle(e.target.value)} />
      <label className="chip">导入 TXT / 字幕文件<input type="file" accept=".txt,.srt,.vtt,text/plain" className="hidden" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void act(async () => { if (file.size > 6_000_000) throw Error('文件请小于 6MB'); await importBook(await file.text(), file.name.replace(/\.[^.]+$/, '')) }) }} /></label>
      <textarea aria-label="共读全文" rows={3} className="soft-input" placeholder="也可以一次粘贴全文，以后翻页自动同步，不必逐段发送" value={text} onChange={e => setText(e.target.value)} />
      <button className="chip" disabled={loading || !text.trim()} onClick={() => void act(() => importBook())}>导入文字</button>
      <input aria-label="正文直链" className="soft-input" placeholder="可选：允许跨域访问的 TXT 正文直链" value={url} onChange={e => setUrl(e.target.value)} />
      <button className="chip" disabled={loading || !url.trim()} onClick={() => void act(async () => {
        const href = new URL(url); if (!['http:', 'https:'].includes(href.protocol) || href.username || href.password) throw Error('请填写 HTTP(S) 正文直链')
        const response = await fetch(href, { credentials: 'omit', signal: AbortSignal.timeout(20_000) })
        if (!response.ok) throw Error('无法读取正文：' + response.status)
        if (!(response.headers.get('content-type') ?? '').includes('text/plain')) throw Error('这不是 TXT 正文直链，请用文件导入或下方 MCP 读取工具')
        if (Number(response.headers.get('content-length')) > 6_000_000) throw Error('正文文件过大')
        await importBook(await response.text())
      })}>读取正文直链</button>
      {config.book && <div className="space-y-2"><p className="text-sm font-medium">{config.book.title} · {page + 1} / {pages.length} 页</p><article className="max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl bg-white/50 p-3 text-sm leading-7" key={page}>{pages[page]}</article><div className="flex gap-2"><button className="chip" disabled={page === 0} onClick={() => void patch({ book: { ...config.book!, page: page - 1 } })}>上一页</button><button className="chip" disabled={page >= pages.length - 1} onClick={() => void patch({ book: { ...config.book!, page: page + 1 } })}>下一页</button><input aria-label="跳转阅读页" type="number" className="soft-input w-20" min={1} max={pages.length} value={page + 1} onChange={e => { const at = Number(e.target.value); if (at >= 1 && at <= pages.length) void patch({ book: { ...config.book!, page: at - 1 } }) }} /></div></div>}
    </div></details>
    {(status || note) && <p role="status" className="whitespace-pre-wrap text-xs leading-6">{note}{note && status ? '\n' : ''}{status}</p>}
    <p className="text-[11px] leading-5 opacity-70">保持小手机打开才能自动同步和发言。切换应用可继续播放；关闭网页、锁屏或系统挂起后不保证运行。普通外部网页和其他音乐 App 的内容需要可用的读取服务，不能仅凭网址直接感知。</p>
    {playerSettings && <PlayerSheet onClose={() => setPlayerSettings(false)} />}
  </section>
}
