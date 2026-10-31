import type { McpTransport } from '../../lib/mcp.ts'

export function McpConnectionForm(props: {
  endpoint: string; token: string; transport: McpTransport; busy: boolean
  connected: boolean; configText: string
  onEndpoint: (value: string) => void; onToken: (value: string) => void
  onTransport: (value: McpTransport) => void; onConfig: (value: string) => void
  onImport: () => void; onConnect: () => void; onDisconnect: () => void
}) {
  return <section className="menu-card mt-3 space-y-4">
    <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">直连你的 MCP 服务</h3><span role="status" className="shrink-0 rounded-full bg-black/5 px-2 py-1 text-[11px]">{props.connected ? '已连接' : props.busy ? '正在处理' : '未连接'}</span></div>
    <p className="text-xs leading-6">从当前设备直接连接下方地址，不经过内置网易云云服务。音乐、小说或其他功能取决于服务提供的工具。</p>
    <label className="block space-y-1 text-xs"><span>1 · MCP 服务地址</span><input aria-label="MCP 服务地址" type="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} className="soft-input" value={props.endpoint} disabled={props.busy} onChange={e=>props.onEndpoint(e.target.value)} placeholder="https://你的服务/mcp"/></label>
    <label className="block space-y-1 text-xs"><span>2 · 连接协议</span><select aria-label="MCP 连接类型" className="soft-select w-full" value={props.transport} disabled={props.busy} onChange={e=>props.onTransport(e.target.value as McpTransport)}><option value="http">Streamable HTTP（通常为 /mcp）</option><option value="sse">旧版 HTTP + SSE（通常为 /sse）</option></select></label>
    <label className="block space-y-1 text-xs"><span>3 · 授权令牌（服务未要求时留空）</span><input aria-label="MCP 令牌" type="password" autoComplete="off" className="soft-input" value={props.token} disabled={props.busy} onChange={e=>props.onToken(e.target.value)} placeholder="Bearer Token，仅本次连接使用"/></label>
    <div className="flex flex-wrap gap-2"><button disabled={props.busy||!props.endpoint.trim()} className="chip chip-solid" onClick={props.onConnect}>{props.busy?'处理中…':props.connected?'重新连接并发现工具':'连接并发现工具'}</button>{props.connected&&<button disabled={props.busy} className="chip" onClick={props.onDisconnect}>断开连接</button>}</div>
    <details className="text-xs leading-6"><summary className="cursor-pointer">已有 MCP 配置？粘贴导入</summary><textarea aria-label="导入 MCP 配置" className="soft-input mt-2 font-mono" rows={4} value={props.configText} disabled={props.busy} onChange={e=>props.onConfig(e.target.value)} placeholder={'粘贴 mcpServers JSON 或 https://…/sse'}/><button className="chip mt-2" disabled={props.busy} onClick={props.onImport}>填入连接设置</button><p>支持远程 HTTP / SSE 配置。只有 command / args 的本地服务需先部署成远程服务。</p></details>
    <details className="text-xs leading-6"><summary className="cursor-pointer">地址从哪里来？连接失败怎么办？</summary><p className="mt-2">地址由 MCP 服务提供者或你部署的服务提供；网易云主页、歌单分享链接、GitHub 仓库地址都不能代替 MCP 服务地址。</p><p>网页需要服务允许当前网站来源跨域访问；网络不可达、跨域限制或服务端授权失败都可能导致连接失败。MCP 不会绕过这些限制。暂不支持需要 OAuth 登录的服务，请使用无需授权或支持 Bearer Token 的服务。</p><a className="underline" href="/mcp-guide.html" target="_blank" rel="noreferrer">打开 MCP 直连使用教程 ↗</a></details>
  </section>
}
