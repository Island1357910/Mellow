type Row = Record<string, any>
const PROVIDER = 'https://music.163.com'
const headers = { Referer: PROVIDER + '/', 'User-Agent': 'Mozilla/5.0' }
async function provider(path: string): Promise<Row> {
  const response = await fetch(PROVIDER + path, { headers, redirect: 'manual', signal: AbortSignal.timeout(12_000) })
  if (!response.ok) throw Error('音乐平台暂时无法查询（' + response.status + '）')
  const data = await response.json() as Row
  if (data.code !== undefined && data.code !== 200) throw Error('音乐平台未返回可用内容（' + String(data.code) + '）')
  return data
}
function idOf(value: unknown): string {
  if (!/^\d{1,20}$/.test(String(value ?? ''))) throw Error('歌曲编号需要是数字')
  return String(value)
}
async function lyrics(id: string): Promise<string> {
  const result = await provider('/api/song/lyric?id=' + id + '&lv=1&kv=1&tv=-1')
  return typeof result.lrc?.lyric === 'string' ? result.lrc.lyric.slice(0, 100_000) : ''
}
function track(song: Row, lyric: string) {
  const id = idOf(song.id)
  return { songId: id, name: String(song.name ?? '歌曲'), artist: (song.artists ?? song.ar ?? []).map((a: Row) => String(a.name ?? '')).join(' / '),
    src: PROVIDER + '/song/media/outer/url?id=' + id + '.mp3', lyrics: lyric,
    playbackNote: '音频由音乐平台提供，是否可播取决于平台权限；不绕过会员或地区限制' }
}
export const musicTools = [
  { name: 'search_music', description: '按歌名或歌手搜索公开歌曲信息，返回可导入半糖播放器的 tracks 歌单及歌词。音频可能因平台限制不可用。', annotations: { readOnlyHint: true }, inputSchema: { type: 'object', properties: { query: { type: 'string', title: '歌名或歌手', minLength: 1, maxLength: 100 }, limit: { type: 'integer', title: '结果数量', minimum: 1, maximum: 5, default: 3 } }, required: ['query'], additionalProperties: false } },
  { name: 'get_song_context', description: '根据歌曲编号查询歌名、歌手与歌词。不会获取手机其他 App 当前播放状态。', annotations: { readOnlyHint: true }, inputSchema: { type: 'object', properties: { song_id: { type: 'string', title: '歌曲编号' } }, required: ['song_id'], additionalProperties: false } },
]
export async function callMusicTool(name: string, args: Row): Promise<Row> {
  if (name === 'search_music') {
    if (typeof args.query !== 'string' || !args.query.trim() || args.query.length > 100) throw Error('请输入 1–100 字的歌名或歌手')
    const limit = args.limit === undefined ? 3 : args.limit
    if (!Number.isInteger(limit) || limit < 1 || limit > 5) throw Error('结果数量应为 1–5')
    const result = await provider('/api/search/get?s=' + encodeURIComponent(args.query.trim()) + '&type=1&limit=' + limit)
    const songs = Array.isArray(result.result?.songs) ? result.result.songs.slice(0, limit) : []
    const tracks = await Promise.all(songs.map(async (song: Row) => {
      let lyric = '', lyricStatus = '已获取'
      try { lyric = await lyrics(idOf(song.id)); if (!lyric) lyricStatus = '平台未提供歌词' } catch { lyricStatus = '歌词查询暂时失败' }
      return { ...track(song, lyric), lyricStatus }
    }))
    return { tracks, source: '网易云音乐公开网页接口', notice: tracks.length ? '导入歌单后在小手机中播放；平台可能限制部分音频。' : '没有查到歌曲，请换关键词。' }
  }
  if (name === 'get_song_context') {
    const id = idOf(args.song_id)
    const [result, lyric] = await Promise.all([provider('/api/song/detail?ids=' + encodeURIComponent('[' + id + ']')), lyrics(id)])
    const song = Array.isArray(result.songs) ? result.songs[0] : null
    if (!song) throw Error('没有找到这首歌')
    return track(song, lyric)
  }
  throw Error('没有这个工具')
}
