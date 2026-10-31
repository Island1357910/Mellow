import type { McpTool } from '../../lib/mcp.ts'

export function McpArgsForm({ tool, value, onChange }: { tool?: McpTool; value: string; onChange: (raw: string) => void }) {
  let args: Record<string, unknown>
  try { args = JSON.parse(value); if (!args || Array.isArray(args) || typeof args !== 'object') throw Error() } catch { return <p className="text-xs">请先在下方 JSON 中修正格式，才能使用参数表单。</p> }
  const fields = tool?.inputSchema?.properties as Record<string, { type?: string; description?: string; title?: string; enum?: unknown[]; default?: unknown }> | undefined
  const required = tool?.inputSchema?.required as string[] | undefined
  const update = (name: string, next: unknown) => { const result = { ...args }; if (next === undefined) delete result[name]; else result[name] = next; onChange(JSON.stringify(result, null, 2)) }
  return <div className="space-y-2">{Object.entries(fields ?? {}).map(([name, field]) => <label key={name} className="block space-y-1 text-xs"><span>{field.title || name}{required?.includes(name) ? ' *' : '（可选）'}</span>{field.description && <span className="block opacity-65">{field.description}</span>}
    {field.enum ? <select className="soft-select w-full" aria-label={'工具参数 ' + name} value={args[name] === undefined ? '' : JSON.stringify(args[name])} onChange={e => update(name, e.target.value ? JSON.parse(e.target.value) : undefined)}><option value="">请选择</option>{field.enum.map(item => <option key={JSON.stringify(item)} value={JSON.stringify(item)}>{String(item)}</option>)}</select>
      : field.type === 'boolean' ? <select className="soft-select w-full" aria-label={'工具参数 ' + name} value={args[name] === undefined ? '' : String(args[name])} onChange={e => update(name, e.target.value === '' ? undefined : e.target.value === 'true')}><option value="">未设置</option><option value="true">是</option><option value="false">否</option></select>
      : field.type === 'object' || field.type === 'array' ? <span className="block opacity-70">此项是{field.type === 'array' ? '数组' : '对象'}，请在下方高级 JSON 中填写。当前值：{JSON.stringify(args[name]) || '未填写'}</span>
      : <input className="soft-input" aria-label={'工具参数 ' + name} type={field.type === 'number' || field.type === 'integer' ? 'number' : 'text'} step={field.type === 'integer' ? 1 : 'any'} value={args[name] === undefined ? '' : String(args[name])} placeholder={field.default === undefined ? '' : '默认：' + String(field.default)} onChange={e => update(name, e.target.value === '' ? undefined : field.type === 'number' || field.type === 'integer' ? Number(e.target.value) : e.target.value)} />}
  </label>)}{!Object.keys(fields ?? {}).length && <p className="text-xs">此工具未声明参数；可以先用空参数执行。</p>}</div>
}
