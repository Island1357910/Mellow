import { mcpUrl, type McpTool, type McpTransport } from './mcp.ts'
type Row = Record<string, unknown>
function row(value: unknown): Row { return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {} }

export function parseMcpConfig(raw: string): { endpoint: string; token: string; transport: McpTransport } {
  const trimmed = raw.trim()
  if (!trimmed) throw Error('先粘贴服务 URL 或 MCP 配置')
  if (/^https?:\/\//i.test(trimmed)) return { endpoint: mcpUrl(trimmed).href, token: '', transport: /\/sse\/?$/i.test(new URL(trimmed).pathname) ? 'sse' : 'http' }
  let config: Row
  try { config = row(JSON.parse(trimmed)) } catch { throw Error('配置不是有效 JSON，也不是 HTTP(S) 地址') }
  const servers = config.mcpServers ?? config.servers
  if (servers) {
    const entries = Object.values(row(servers))
    if (entries.length !== 1) throw Error('请一次导入一个服务：只保留 mcpServers 中要连接的那一项')
    config = row(entries[0])
  }
  if (config.command || config.type === 'stdio') throw Error('这是需要电脑运行命令的 STDIO 配置。网页 / APK 不能直接运行，请先将服务部署为 HTTP 或 SSE，再填写地址')
  const url = config.url ?? config.serverUrl
  if (typeof url !== 'string') throw Error('配置中没有 url 服务地址')
  const headers = row(config.headers)
  const auth = Object.entries(headers).find(([key]) => key.toLowerCase() === 'authorization')?.[1]
  if (Object.keys(headers).some(key => key.toLowerCase() !== 'authorization')) throw Error('此配置含自定义请求头，目前入口只支持 Bearer Token，请向服务提供者确认授权方式')
  if (auth !== undefined && (typeof auth !== 'string' || !/^Bearer\s+\S+/i.test(auth))) throw Error('当前入口支持 Bearer Token；此配置的授权方式需要服务适配')
  const endpoint = mcpUrl(url).href
  const type = config.type ?? config.transport
  return { endpoint, token: typeof auth === 'string' ? auth.replace(/^Bearer\s+/i, '') : '', transport: type === 'sse' || (!type && /\/sse\/?$/i.test(new URL(endpoint).pathname)) ? 'sse' : 'http' }
}

export function toolArgs(raw: string, tool?: McpTool): Row {
  let data: unknown
  try { data = JSON.parse(raw) } catch { throw Error('工具参数不是有效 JSON') }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('工具参数须为 JSON 对象')
  const args = data as Row, schema = tool?.inputSchema
  const required = Array.isArray(schema?.required) ? schema.required as string[] : []
  const properties = row(schema?.properties)
  for (const name of required) if (args[name] === undefined || args[name] === '') throw Error('请填写必填参数：' + name)
  for (const [name, value] of Object.entries(args)) {
    const field = row(properties[name])
    if (!Object.keys(field).length) continue
    const valid = field.type === 'integer' ? Number.isInteger(value) : field.type === 'array' ? Array.isArray(value) : field.type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value) : ['string', 'number', 'boolean'].includes(String(field.type)) ? typeof value === field.type : true
    if (!valid) throw Error(`参数 ${name} 应为 ${String(field.type)}`)
    if (typeof value === 'number' && (!Number.isFinite(value) || (typeof field.minimum === 'number' && value < field.minimum) || (typeof field.maximum === 'number' && value > field.maximum))) throw Error('数值参数超出范围：' + name)
    if (Array.isArray(field.enum) && !field.enum.includes(value)) throw Error('参数选项不正确：' + name)
  }
  return args
}

export function adaptMusic(data: Row, fallbackName = ''): { name: string; artist: string; lyrics: string; position: number; playing: boolean } {
  const song = row(data.nowPlaying ?? data.track ?? data.song ?? data.data ?? data)
  const rawText = typeof song.text === 'string' ? song.text : ''
  if (/\[music:/.test(rawText)) throw Error('服务只返回音乐卡片标记，没有音频或歌词；需要它的歌词查询工具 / API，不能把卡片当作已播放内容')
  const name = song.name ?? song.title ?? song.song_name ?? fallbackName
  if (typeof name !== 'string' || !name.trim()) throw Error('服务没有返回歌名，请填写“内容名称”或改用歌曲详情查询工具')
  const lyrics = [song.lyrics, song.lyric, row(song.lrc).lyric, row(song.lyrics).lyric].find(v => typeof v === 'string')
  const artist = song.artist ?? song.singer ?? (Array.isArray(song.artists) ? song.artists.map(a => row(a).name).filter(Boolean).join(' / ') : '')
  return { name: name.slice(0, 300), artist: typeof artist === 'string' ? artist.slice(0, 300) : '', lyrics: (typeof lyrics === 'string' ? lyrics : rawText).slice(0, 100_000), position: Math.max(0, Number(song.position ?? song.currentTime ?? song.progress) || 0), playing: song.playing !== false }
}

export function adaptReading(data: Row, fallbackName = ''): { title: string; text: string } {
  const read = row(data.reading ?? data.data ?? data)
  const text = read.text ?? read.content ?? read.body ?? read.chapterContent
  if (typeof text !== 'string' || !text.trim()) throw Error('服务没有返回正文，请选择能返回正文的查询工具')
  const title = read.title ?? read.name ?? fallbackName
  return { title: typeof title === 'string' && title.trim() ? title.slice(0, 300) : '正在阅读', text: text.slice(0, 2_000_000) }
}
