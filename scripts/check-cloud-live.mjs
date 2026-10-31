// 接收本次验证凭据的隐藏 stdin；不把凭据写文件、命令参数或输出。
let input = ''
if (process.stdin.isTTY) process.stdin.setRawMode(true)
process.stdin.setEncoding('utf8')
process.stdin.on('data', chunk => { input += chunk; if (input.includes('\n') || input.includes('\r')) void run() })
let started = false
async function run() {
  if (started) return; started = true; process.stdin.pause()
  try {
    const { url, token } = JSON.parse(input.trim()); input = ''
    if (new URL(url).origin !== 'https://mellow-music-cloud-20261031.basicheart1.chatgpt.site') throw Error('验证地址不匹配')
    let id = 0
    const rpc = async (method, params) => {
      const response = await fetch(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(45_000), headers: { 'Content-Type': 'application/json', Origin: 'https://mymellow.top', ...(token ? { 'OAI-Sites-Authorization': 'Bearer ' + token } : {}) }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) })
      if (!response.ok) throw Error('服务 HTTP ' + response.status)
      if (response.headers.get('Access-Control-Allow-Origin') !== 'https://mymellow.top') throw Error('服务尚未允许小手机跨域访问')
      const data = await response.json()
      if (data.error || data.result?.isError) throw Error(data.error?.message || data.result?.content?.[0]?.text || '工具调用失败')
      return data.result
    }
    await rpc('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'mellow-check', version: '1' } })
    const tools = await rpc('tools/list')
    const songs = await rpc('tools/call', { name: 'search_music', arguments: { query: '晴天', limit: 1 } })
    const tracks = songs.structuredContent?.tracks
    if (!tracks?.length || !tracks[0].lyrics) throw Error('托管环境未获取到歌曲或歌词')
    console.log(JSON.stringify({ tools: tools.tools.length, songs: tracks.length, hasLyrics: true, crossOrigin: true }))
    process.exit(0)
  } catch (e) { console.error(e instanceof Error ? e.message : String(e)); process.exit(1) }
}
console.log('Ready for private service verification input (hidden).')
