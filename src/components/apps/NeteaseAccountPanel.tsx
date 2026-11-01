import qrcode from 'qrcode-generator'
import { useEffect, useRef, useState } from 'react'
import { accountSupported, forgetNeteaseAccount, getNeteaseRoute, setNeteaseRoute, neteaseAccountCall, NeteaseApiError, readNeteaseAccount, resolveNeteaseSong, saveNeteaseAccount, type NeteaseUser, type NeteaseRoute } from '../../lib/neteaseAccount.ts'
import { neteaseDirectAvailable } from '../../lib/neteaseDirect.ts'
import { usePlayer } from '../../lib/playerStore.ts'
interface Playlist { id: string; name: string; count: number; mine: boolean }
interface Song { id: string; name: string; artist: string }
interface Qr { key: string; image: string; url: string; until: number }
export function NeteaseAccountPanel({ namespace, active = true }: { namespace: string; active?: boolean }) {
  const [query,setQuery]=useState(''),[searched,setSearched]=useState(''),[results,setResults]=useState<Song[]>([]),[searchTotal,setSearchTotal]=useState(0),[searchOffset,setSearchOffset]=useState(0)
  const [route, setRoute] = useState(() => getNeteaseRoute(namespace))
  const [user, setUser] = useState<NeteaseUser | null>(null), [qr, setQr] = useState<Qr | null>(null)
  const [playlists, setPlaylists] = useState<Playlist[]>([]), [more, setMore] = useState(false)
  const [selected, setSelected] = useState<Playlist | null>(null), [songs, setSongs] = useState<Song[]>([]), [offset, setOffset] = useState(0), [total, setTotal] = useState(0)
  const [busy, setBusy] = useState(false), [note, setNote] = useState(''), [checking, setChecking] = useState(false)
  const alive = useRef(true), lock = useRef(false), qrLock = useRef(false), generation = useRef(0)
  const loadPlaylists = async (at = 0) => {
    const data = await neteaseAccountCall<{ user: NeteaseUser; playlists: Playlist[]; more: boolean }>(namespace, 'playlists', { offset: at })
    if (!alive.current) return
    setUser(data.user); setPlaylists(old => at ? [...old, ...data.playlists.filter(p => !old.some(x => x.id === p.id))] : data.playlists); setMore(data.more)
  }
  const error = (e: unknown) => { if (!alive.current) return; setNote(e instanceof Error ? e.message : '这次没有连上'); if (e instanceof NeteaseApiError && e.status === 401) { setUser(null); setPlaylists([]); setSelected(null); setSongs([]) } }
  const act = async (task: () => Promise<void>) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setNote('')
    try { await task() } catch (e) { error(e) } finally { lock.current = false; if (alive.current) setBusy(false) }
  }
  useEffect(() => {
    alive.current = true
    void readNeteaseAccount(namespace).then(account => { if (alive.current && account) setUser(account.user) }).catch(error)
    return () => { alive.current = false; generation.current++ }
  }, [namespace])
  const checkLogin = async (code: Qr) => {
    if (qrLock.current || !alive.current) return
    if (Date.now() >= code.until) { setQr(null); setNote('登录码已过期，请重新生成'); return }
    qrLock.current = true; setChecking(true)
    const current = generation.current
    try {
      const result = await neteaseAccountCall<{ state: string; session?: string; user?: NeteaseUser }>(namespace, 'qr_check', { key: code.key })
      if (!alive.current || generation.current !== current) return
      if (result.state === 'authorized' && result.session && result.user) {
        await saveNeteaseAccount(namespace, { token: result.session, user: result.user })
        if (!alive.current || generation.current !== current) { forgetNeteaseAccount(namespace); return }
        setQr(null); setUser(result.user); setNote('已连接网易云，正在读取歌单'); await loadPlaylists(); setNote('已读取账号歌单，选择一首歌即可一起听')
      } else if (result.state === 'expired') { setQr(null); setNote('登录码已过期，请重新生成') }
      else setNote(result.state === 'confirm' ? '已扫码，请在网易云 App 中确认登录' : '等待你在网易云 App 中扫码 / 从相册识别')
    } catch (e) { error(e) } finally { qrLock.current = false; if (alive.current) setChecking(false) }
  }
  useEffect(() => { if (!qr || !active) return; const timer = window.setInterval(() => { void checkLogin(qr) }, 5000); return () => window.clearInterval(timer) }, [qr, active])
  useEffect(() => { if (active && user && !playlists.length && !lock.current && !qrLock.current) void act(() => loadPlaylists()) }, [active, user?.id])
  const startLogin = () => act(async () => {
    generation.current++
    const g = generation.current
    const data = await neteaseAccountCall<{ key: string; url: string; expiresIn: number }>(namespace, 'qr_start')
    if (!alive.current || generation.current !== g) return
    if (new URL(data.url).origin !== 'https://music.163.com') throw Error('登录地址不正确')
    const image = qrcode(0, 'M'); image.addData(data.url); image.make()
    setQr({ key: data.key, url: data.url, image: image.createDataURL(6, 12), until: Date.now() + Math.min(180, data.expiresIn) * 1000 }); setNote('请截图保存二维码，在网易云 App 的扫一扫中从相册识别，确认后回到这里')
  })
  const openPlaylist = (playlist: Playlist, at = 0) => act(async () => {
    const data = await neteaseAccountCall<{ title: string; total: number; songs: Song[] }>(namespace, 'playlist', { id: playlist.id, offset: at })
    if (!alive.current) return
    setSelected(playlist); setSongs(data.songs); setOffset(at); setTotal(data.total)
  })
  const search = (at=0) => act(async()=>{
    const keywords=(at?searched:query).trim();if(!keywords)return
    const data=await neteaseAccountCall<{total:number;songs:Song[]}>(namespace,'search',{keywords,offset:at})
    if(!alive.current)return;setSearched(keywords);setResults(data.songs);setSearchTotal(data.total);setSearchOffset(at)
  })
  const play = (song: Song) => act(async () => {
    const data = await resolveNeteaseSong(namespace, song.id)
    if (!alive.current) return
    await usePlayer.getState().load(namespace)
    if (!alive.current || usePlayer.getState().namespace !== namespace) return
    const player = usePlayer.getState(), existing = player.config.tracks.find(t => t.provider === 'netease' && t.providerId === song.id)
    if (!existing) await player.addTrack({ name: song.name, artist: song.artist, provider: 'netease', providerId: song.id, src: 'netease:' + song.id, lyrics: data.lyrics })
    else player.patch({ tracks: player.config.tracks.map(t => t.id === existing.id ? { ...t, lyrics: data.lyrics } : t) })
    const state = usePlayer.getState()
    usePlayer.setState({ index: state.config.tracks.findIndex(t => t.provider === 'netease' && t.providerId === song.id), playing: true, seconds: 0, duration: 0, error: '' })
    setNote(data.trial ? '平台提供的是试听片段；歌词已共享到播放器' : '已加入播放器并开始播放；在上方选择 char、开启共享音乐与主动聊天即可')
  })
  return <section className="menu-card space-y-3"><h3 className="font-semibold">网易云音乐</h3><p className="text-xs leading-6">连接账号后搜索歌曲、浏览歌单，和角色一起听。</p>
    {neteaseDirectAvailable()?<label className="block space-y-2 text-xs"><span>连接方式</span><select aria-label="网易云连接方式" className="soft-select w-full" value={route} disabled={busy||checking} onChange={e=>{const next=e.target.value as NeteaseRoute;generation.current++;setQr(null);setNeteaseRoute(namespace,next);setRoute(next);setNote(next==='direct'?'已切换直连，登录和歌单请求直接发送到网易云':'已切换阿里云接口，服务会处理账号凭据和查询请求')}}><option value="direct">直连网易云（Android APK）</option><option value="cloud">阿里云接口（网页 / 备用）</option></select></label>:<p className="text-xs leading-6">网页登录已接入阿里云账号接口，无需填写 MCP 地址或令牌。</p>}
    <details className="text-xs leading-5 opacity-70"><summary className="cursor-pointer">连接说明与隐私</summary><p className="mt-2">凭据按身份加密保存在本机，不进入角色提示词或备份。</p><p className="mt-2">{route==='direct'?'APK 直接连接网易云，二维码、歌单和音频查询不经过海外云服务；二维码图片在本机生成。':'登录码和歌单查询由阿里云接口转接网易云，二维码图片在本机生成；连接失败不会自动切换其他服务。'}</p></details>
    {!accountSupported() ? <div role="status" className="space-y-2 text-xs leading-6"><p>网页登录需要安全的 HTTPS 页面。若你在旧 HTTP 网页中已有角色和设置，请先在设置中导出备份，切换后导入；两个地址的数据存储独立。</p><a className="chip" href="https://mymellow.top/" target="_blank" rel="noreferrer">打开 HTTPS 版半糖</a></div> : !user ? <><button className="chip chip-solid" disabled={busy || checking} onClick={() => void startLogin()}>{qr ? '刷新登录二维码' : '生成网易云登录二维码'}</button>{qr && <div data-holiday-preserve className="space-y-2 rounded-2xl bg-white p-4 text-center text-[#333]"><img alt="网易云登录二维码，请截图后在网易云扫一扫中识别" className="mx-auto w-52 max-w-full" src={qr.image}/><p className="text-xs leading-6">同一台手机：截图二维码 → 网易云「扫一扫」从相册识别 → 亲自确认登录 → 返回半糖。</p><button className="chip" disabled={checking} onClick={() => void checkLogin(qr)}>我已确认，检查登录</button><button className="chip" onClick={() => { generation.current++; setQr(null); setNote('已取消登录') }}>取消</button></div>}</> : <><div className="flex flex-wrap items-center gap-2"><span className="text-sm">已连接：{user.name}</span><button className="chip" disabled={busy} onClick={() => void act(() => loadPlaylists())}>刷新歌单</button><button className="chip" onClick={() => { generation.current++; forgetNeteaseAccount(namespace); setUser(null); setQr(null); setSearched(''); setResults([]); setPlaylists([]); setSongs([]); setSelected(null); if (usePlayer.getState().config.tracks[usePlayer.getState().index]?.provider === 'netease') usePlayer.setState({ playing: false }); setNote('已移除此手机的账号连接；如需撤销平台会话，可在网易云账号安全设置中管理') }}>断开账号</button></div>
    <form className="flex gap-2" onSubmit={e=>{e.preventDefault();void search()}}><input aria-label="搜索网易云歌曲" className="soft-input min-w-0" placeholder="搜索歌名、歌手" maxLength={100} value={query} onChange={e=>setQuery(e.target.value)}/><button className="chip chip-solid shrink-0" disabled={busy||!query.trim()}>搜索</button></form>
    {searched&&<section className="space-y-2 rounded-2xl border border-current/10 p-3"><div className="flex justify-between text-xs"><span>“{searched}” · 共 {searchTotal} 首</span><button onClick={()=>{setSearched('');setResults([])}}>收起</button></div>{results.map(song=><button key={song.id} className="flex w-full justify-between gap-2 rounded-xl bg-white/60 p-3 text-left text-sm" disabled={busy} onClick={()=>void play(song)}><span className="min-w-0 break-words">{song.name}<small className="block opacity-60">{song.artist}</small></span><span className="shrink-0">播放</span></button>)}{!results.length&&<p className="text-xs">没有找到歌曲，换个关键词试试。</p>}<div className="flex gap-2"><button className="chip" disabled={busy||searchOffset===0} onClick={()=>void search(Math.max(0,searchOffset-30))}>上一页</button><button className="chip" disabled={busy||searchOffset+30>=searchTotal} onClick={()=>void search(searchOffset+30)}>下一页</button></div></section>}
    {selected ? <div className="space-y-2"><button className="chip" disabled={busy} onClick={() => { setSelected(null); setSongs([]) }}>返回歌单</button><p className="text-sm font-medium">{selected.name} · 共 {total} 首</p>{songs.map(song => <button key={song.id} className="flex w-full items-center justify-between gap-2 rounded-xl bg-white/50 p-3 text-left text-sm" disabled={busy} onClick={() => void play(song)}><span>{song.name}<small className="block text-xs opacity-65">{song.artist}</small></span><span className="shrink-0 text-xs">播放 ›</span></button>)}<div className="flex gap-2"><button className="chip" disabled={busy || offset === 0} onClick={() => void openPlaylist(selected, Math.max(0, offset - 30))}>上一页</button><button className="chip" disabled={busy || offset + 30 >= total} onClick={() => void openPlaylist(selected, offset + 30)}>下一页</button></div></div> : <div className="space-y-2">{playlists.map(p => <button key={p.id} className="block w-full rounded-xl bg-white/50 p-3 text-left text-sm" disabled={busy} onClick={() => void openPlaylist(p)}>{p.name}<small className="block text-xs opacity-65">{p.mine ? '我创建的' : '我收藏的'} · {p.count} 首</small></button>)}{more && <button className="chip" disabled={busy} onClick={() => void act(() => loadPlaylists(playlists.length))}>加载更多歌单</button>}{!playlists.length && !busy && <p className="text-xs">尚未读到歌单，可点刷新重试。</p>}</div>}</>}
    {busy && <p role="status" className="text-xs">正在连接网易云…</p>}{note && <p role="status" className="text-xs leading-6">{note}</p>}
  </section>
}
