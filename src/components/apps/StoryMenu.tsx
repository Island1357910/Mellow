import { ChevronDown, Download, Image, Plus, Trash2, Upload } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import {
  applyRegex,
  FONT_STACK,
  line,
  lorebookFromUnknown,
  newSave,
  regexFromUnknown,
  regexValid,
  STATUS_EXAMPLE,
  STORY_CSS_SELECTORS,
  STORY_CSS_TEMPLATES,
  writeSummary,
  type ReadingStyle,
  type RegexRule,
  type SaveIndexRow,
  type StoryConfig,
  type StoryMode,
  type StorySave,
} from '../../engine/story.ts'
import { downloadJson } from '../../lib/download.ts'
import { uid } from '../../lib/id.ts'
import type { Character, Identity } from '../../types/index.ts'
import { PillNote } from '../ui/primitives.tsx'

type Tab = 'read' | 'saves' | 'memory' | 'regex' | 'persona'

const dim = { color: 'var(--m-text-secondary)' }
const small = { fontSize: 12, padding: '4px 12px' }

function SwitchRow(props: { label: string; hint?: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={props.on} onClick={props.onClick} className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm">
      <span className="min-w-0">
        <span className="block">{props.label}</span>
        {props.hint ? <span className="mt-0.5 block text-[11px] leading-4" style={dim}>{props.hint}</span> : null}
      </span>
      <span className="relative h-6 w-10 shrink-0 rounded-full transition-colors" style={{ background: props.on ? '#F3A8BA' : '#ebe5df' }}>
        <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: props.on ? 18 : 2 }} />
      </span>
    </button>
  )
}

function Num(props: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  return (
    <label className="text-[11px]" style={dim}>
      {props.label}
      <input
        type="number"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        className="soft-input mt-1 px-2 py-1.5 text-center"
        onChange={(event) => props.onChange(Math.max(props.min, Math.min(props.max, Number(event.target.value) || props.min)))}
      />
    </label>
  )
}

function Choice<T extends string | number>(props: { options: Array<[T, string]>; value: T; onChange: (value: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {props.options.map(([value, text]) => (
        <button key={String(value)} type="button" className={props.value === value ? 'chip chip-pink' : 'chip'} style={small} onClick={() => props.onChange(value)}>{text}</button>
      ))}
    </div>
  )
}

function Block(props: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="menu-card mt-3 first:mt-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{props.title}</p>
        {props.right}
      </div>
      {props.children}
    </section>
  )
}

function readJson(file: File | undefined, onData: (value: unknown) => void, onError: (text: string) => void) {
  if (!file) return
  void file
    .text()
    .then((text) => onData(JSON.parse(text)))
    .catch(() => onError('文件读不出来，确认是 JSON'))
}

export function StoryMenu(props: {
  mode: StoryMode
  namespace: string
  identity: Identity
  chars: Character[]
  config: StoryConfig
  save: StorySave
  saves: SaveIndexRow[]
  tint: string
  onClose: () => void
  onConfig: (patch: Partial<StoryConfig>) => void
  onSave: (save: StorySave) => Promise<StorySave>
  onSwitch: (id: string) => void
  onNew: (save: StorySave) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onClear: () => void
}) {
  const tabs: Array<[Tab, string]> = [
    ['read', '阅读'],
    ['saves', '存档'],
    ['memory', '记忆'],
    ['regex', '正则'],
    ...(props.mode === 'side' ? ([['persona', '人设']] as Array<[Tab, string]>) : []),
  ]
  const [tab, setTab] = useState<Tab>('read')
  const [note, setNote] = useState('')
  return (
    <div className="sms-shell absolute inset-0 z-30 flex flex-col pt-12">
      <div className="flex items-center justify-between px-4">
        <h2 className="text-[22px] font-semibold tracking-tight">{props.mode === 'offline' ? '线下详情' : '番外详情'}</h2>
        <button type="button" className="chip chip-pink" onClick={props.onClose}>完成</button>
      </div>
      <div className="mx-4 mt-3 flex gap-1 rounded-full bg-white/85 p-1 shadow-[0_6px_16px_rgba(120,80,100,0.06)]" role="tablist">
        {tabs.map(([id, text]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className="flex-1 rounded-full py-1.5 text-xs transition-colors" style={{ background: tab === id ? '#F3A8BA' : 'transparent', color: tab === id ? '#fff' : 'var(--m-text-secondary)', fontWeight: tab === id ? 600 : 400 }} onClick={() => setTab(id)}>
            {text}
          </button>
        ))}
      </div>
      {note ? <div className="mx-4 mt-2"><PillNote tone="butter" inline>{note}</PillNote></div> : null}
      <div className="scroll min-h-0 flex-1 px-4 pb-16 pt-3">
        {tab === 'read' ? <ReadTab mode={props.mode} reading={props.config.reading} onChange={(reading) => props.onConfig({ reading })} /> : null}
        {tab === 'saves' ? <SavesTab {...props} onNote={setNote} /> : null}
        {tab === 'memory' ? <MemoryTab {...props} onNote={setNote} /> : null}
        {tab === 'regex' ? <RegexTab mode={props.mode} config={props.config} onConfig={props.onConfig} onNote={setNote} /> : null}
        {tab === 'persona' ? <PersonaTab {...props} onNote={setNote} /> : null}
      </div>
    </div>
  )
}

const QUOTES = ['#C76B86', '#5fae93', '#8a72c4', '#D98A3D', '#5B74C9', '#3a3a3a']
const PAPERS = ['rgba(255,255,255,0.86)', '#FFF8EC', '#F4FBF7', '#F6F3FC', '#FFF1F5', 'rgba(255,255,255,0.6)']
const BACKDROPS = ['', '#FBF7F4', '#F3EEE6', '#E7F4EE', '#EEE8F8', '#2A2730']

function ReadTab(props: { mode: StoryMode; reading: ReadingStyle; onChange: (reading: ReadingStyle) => void }) {
  const r = props.reading
  const set = (patch: Partial<ReadingStyle>) => props.onChange({ ...r, ...patch })
  const template = STORY_CSS_TEMPLATES[props.mode]
  return (
    <>
      <Block title="预览">
        <div className="rounded-2xl p-3" style={{ background: r.backgroundImage ? `center / cover url(${r.backgroundImage})` : r.background || '#FBF7F4' }}>
          <p className="rounded-[18px] px-3.5 py-2.5" style={{ background: r.paper, fontFamily: FONT_STACK[r.font], fontSize: r.fontSize, lineHeight: r.lineHeight }}>
            雨停了，街角的灯一盏一盏亮起来。他把伞收好，回头看你：<span style={{ color: r.quoteColor }}>“走吧，我知道一家还开着的店。”</span>
          </p>
        </div>
      </Block>
      <Block title="排版">
        <Choice options={[['novel', '小说'], ['bubble', '气泡']]} value={r.layout} onChange={(layout) => set({ layout })} />
        <p className="mb-1.5 mt-3 text-xs" style={dim}>字体</p>
        <Choice options={[['sans', '黑体'], ['serif', '宋体'], ['kai', '楷体']]} value={r.font} onChange={(font) => set({ font })} />
        <p className="mb-1.5 mt-3 text-xs" style={dim}>字号</p>
        <Choice options={[[13, '小'], [15, '标准'], [17, '大'], [19, '特大']]} value={r.fontSize} onChange={(fontSize) => set({ fontSize })} />
        <p className="mb-1.5 mt-3 text-xs" style={dim}>行距</p>
        <Choice options={[[1.5, '紧凑'], [1.85, '舒适'], [2.2, '宽松']]} value={r.lineHeight} onChange={(lineHeight) => set({ lineHeight })} />
      </Block>
      <Block title="颜色">
        <p className="mb-1.5 text-xs" style={dim}>对白颜色</p>
        <div className="flex flex-wrap gap-2.5">
          {QUOTES.map((color) => <button key={color} type="button" aria-label={`对白 ${color}`} className="h-8 w-8 rounded-full" style={{ background: color, outline: r.quoteColor === color ? '2px solid #F3A8BA' : 'none', outlineOffset: 2 }} onClick={() => set({ quoteColor: color })} />)}
        </div>
        <p className="mb-1.5 mt-3 text-xs" style={dim}>纸张</p>
        <div className="flex flex-wrap gap-2.5">
          {PAPERS.map((color) => <button key={color} type="button" aria-label={`纸张 ${color}`} className="h-8 w-8 rounded-full ring-1 ring-black/5" style={{ background: color, outline: r.paper === color ? '2px solid #F3A8BA' : 'none', outlineOffset: 2 }} onClick={() => set({ paper: color })} />)}
        </div>
        <p className="mb-1.5 mt-3 text-xs" style={dim}>背景</p>
        <div className="flex flex-wrap gap-2.5">
          {BACKDROPS.map((color) => <button key={color || 'none'} type="button" aria-label={color ? `背景 ${color}` : '默认背景'} className="h-8 w-8 rounded-full ring-1 ring-black/5" style={{ background: color || 'linear-gradient(135deg,#F8D0DC,#D5F0E4)', outline: !r.backgroundImage && r.background === color ? '2px solid #F3A8BA' : 'none', outlineOffset: 2 }} onClick={() => set({ background: color, backgroundImage: '' })} />)}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="chip chip-sky py-2">
            <Image size={13} />上传背景图
            <input type="file" accept="image/*" className="hidden" onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file || file.size > 2_500_000) return
              const reader = new FileReader()
              reader.onload = () => set({ backgroundImage: String(reader.result ?? '') })
              reader.readAsDataURL(file)
            }} />
          </label>
          <button type="button" className="chip py-2" disabled={!r.backgroundImage} onClick={() => set({ backgroundImage: '' })}>移除背景图</button>
        </div>
      </Block>
      <Block title={`CSS 美化 · ${props.mode === 'offline' ? '线下' : '番外'}`} right={<button type="button" className="chip chip-butter" style={small} onClick={() => set({ customCss: template.css })}>套用范本</button>}>
        <p className="text-[11px] leading-5" style={dim}>
          {props.mode === 'offline' ? '线下专用选择器（前缀 offline-），写完整规则含花括号：' : '番外专用选择器（前缀 side-），写完整规则含花括号：'}
        </p>
        <ul className="mt-2 space-y-1 rounded-2xl bg-[#FBF7F4] p-2.5 font-mono text-[10px] leading-5">
          {STORY_CSS_SELECTORS[props.mode].map((item) => (
            <li key={item.selector}><span style={{ color: props.mode === 'offline' ? '#5fae93' : '#8a72c4' }}>{item.selector}</span> — {item.desc}</li>
          ))}
        </ul>
        <p className="mt-3 text-[11px]" style={dim}>范本：{template.name}</p>
        <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded-2xl bg-[#2A2730] p-3 font-mono text-[10px] leading-5 text-white/90">{template.css}</pre>
        <textarea
          value={r.customCss ?? ''}
          rows={8}
          spellCheck={false}
          placeholder={`/* 例如：\n${template.css.split('\n').slice(0, 3).join('\n')}\n... */`}
          onChange={(event) => set({ customCss: event.target.value })}
          className="soft-input mt-2 resize-none font-mono text-xs leading-5"
        />
        {r.customCss?.trim() ? <button type="button" className="chip chip-danger mt-2" style={small} onClick={() => set({ customCss: '' })}>清空 CSS</button> : null}
      </Block>
    </>
  )
}

type TabProps = Parameters<typeof StoryMenu>[0] & { onNote: (text: string) => void }

function SavesTab(props: TabProps) {
  const [name, setName] = useState(props.save.name)
  const fresh = () => {
    if (props.mode === 'offline') return newSave(`存档 ${props.saves.length + 1}`)
    const lead = props.chars.find((item) => item.id === props.save.charId)
    const opener = lead?.firstMes.trim().replaceAll('{{char}}', lead.name).replaceAll('{{user}}', props.save.persona?.name || props.identity.name)
    return newSave(`${lead?.name ?? '番外'} 新的一档`, { charId: props.save.charId, persona: props.save.persona, bookCharIds: props.save.bookCharIds, books: props.save.books, lines: opener ? [line('assistant', opener)] : [] })
  }
  return (
    <>
      <Block title="当前存档">
        <div className="flex gap-2">
          <input value={name} onChange={(event) => setName(event.target.value)} className="soft-input min-w-0 flex-1" />
          <button type="button" className="chip chip-mint shrink-0" disabled={!name.trim() || name.trim() === props.save.name} onClick={() => void props.onSave({ ...props.save, name: name.trim() }).then(() => props.onNote('已改名'))}>改名</button>
        </div>
        <p className="mt-2 text-[11px]" style={dim}>共 {props.save.lines.length} 段 · {props.save.summaries.length} 条摘要</p>
        <button type="button" className="chip chip-danger mt-3 w-full py-2" onClick={props.onClear}>清空聊天记录</button>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" className="chip chip-lilac py-2" onClick={() => void props.onNew({ ...newSave(`${props.save.name} 副本`), ...structuredClone({ lines: props.save.lines, summaries: props.save.summaries, charId: props.save.charId, persona: props.save.persona, bookCharIds: props.save.bookCharIds, books: props.save.books }) })}>复制一份</button>
          <button type="button" className="chip chip-sky py-2" onClick={() => downloadJson(`${props.save.name}.json`, { kind: 'mellow-story', save: props.save })}><Download size={13} />导出</button>
        </div>
      </Block>
      <Block title="全部存档" right={<button type="button" className="chip chip-pink" style={small} onClick={() => void props.onNew(fresh())}><Plus size={12} />新建</button>}>
        <ul className="divide-y divide-black/5">
          {props.saves.map((row) => {
            const current = row.id === props.save.id
            return (
              <li key={row.id} className="flex items-center gap-2 py-2.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: current ? props.tint : '#e5dde2' }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{row.name}</span>
                  <span className="block truncate text-[11px]" style={dim}>{row.count} 段 · {new Date(row.updatedAt).toLocaleString('zh-CN', { hour12: false, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </span>
                {current ? <span className="chip chip-mint" style={{ fontSize: 11, padding: '3px 10px' }}>正在读</span> : <button type="button" className="chip" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => props.onSwitch(row.id)}>读取</button>}
                <button type="button" aria-label="删除存档" className="grid h-7 w-7 place-items-center rounded-full bg-[#FBE3E3] text-[#b0505c]" onClick={() => {
                  if (window.confirm(`删除「${row.name}」？删除后不能恢复。`)) void props.onDelete(row.id)
                }}><Trash2 size={12} /></button>
              </li>
            )
          })}
        </ul>
        <label className="chip mt-3 w-full py-2">
          <Upload size={13} />导入存档
          <input type="file" accept="application/json,.json" className="hidden" onChange={(event) => readJson(event.target.files?.[0], (raw) => {
            const value = raw as { save?: StorySave }
            const source = value.save ?? (raw as StorySave)
            if (!source || !Array.isArray(source.lines)) {
              props.onNote('这不是半糖导出的存档')
              return
            }
            void props.onNew({ ...newSave(source.name || '导入的存档'), ...source, id: newSave('').id, updatedAt: Date.now() })
          }, props.onNote)} />
        </label>
      </Block>
    </>
  )
}

function MemoryTab(props: TabProps) {
  const { config, save } = props
  const [busy, setBusy] = useState<'small' | 'big' | null>(null)
  const write = async (kind: 'small' | 'big') => {
    setBusy(kind)
    try {
      await props.onSave(await writeSummary(save, kind, config.keepRounds))
      props.onNote(kind === 'small' ? '写好了一条小总结' : '合成了大总结')
    } catch (reason) {
      props.onNote(reason instanceof Error ? reason.message : '没总结出来')
    } finally {
      setBusy(null)
    }
  }
  const covered = Math.max(0, ...save.summaries.map((item) => item.upTo))
  const rawFrom = Math.min(covered, Math.max(0, save.lines.length - config.keepRounds * 2))
  return (
    <>
      <Block title="上下文">
        <div className="grid grid-cols-2 gap-2">
          <Num label="最近几轮保留原文" value={config.keepRounds} min={1} max={100} onChange={(keepRounds) => props.onConfig({ keepRounds })} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Num label="正文字数下限" value={config.replyCharsMin} min={50} max={3000} step={10} onChange={(replyCharsMin) => props.onConfig({ replyCharsMin, replyCharsMax: Math.max(replyCharsMin, config.replyCharsMax) })} />
          <Num label="正文字数上限" value={config.replyCharsMax} min={50} max={3000} step={10} onChange={(replyCharsMax) => props.onConfig({ replyCharsMax, replyCharsMin: Math.min(replyCharsMax, config.replyCharsMin) })} />
        </div>
        <p className="mt-3 text-[11px] leading-5" style={dim}>超出 {config.keepRounds} 轮的旧剧情，只把摘要发给模型。现在发送：{save.summaries.length ? '摘要 + ' : ''}第 {rawFrom + 1} 段之后的原文，共 {save.lines.length - rawFrom} 段。</p>
      </Block>
      <Block title="自动总结">
        <SwitchRow label="自动写小总结" hint="旧剧情攒够一定轮数，就自动压成一条小总结" on={config.autoSummary} onClick={() => props.onConfig({ autoSummary: !config.autoSummary })} />
        <div className="mt-1 grid grid-cols-2 gap-2">
          <Num label="每攒多少轮总结一次" value={config.summaryEvery} min={2} max={50} onChange={(summaryEvery) => props.onConfig({ summaryEvery })} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" className="chip chip-mint py-2" disabled={busy !== null} onClick={() => void write('small')}>{busy === 'small' ? '正在写…' : '现在写小总结'}</button>
          <button type="button" className="chip chip-lilac py-2" disabled={busy !== null || save.summaries.length === 0} onClick={() => void write('big')}>{busy === 'big' ? '正在合成…' : '合成大总结'}</button>
        </div>
      </Block>
      <Block title={`摘要 · ${save.summaries.length}`}>
        {save.summaries.length === 0 ? <p className="text-[11px]" style={dim}>还没有摘要。剧情长了以后会自动生成，也可以手动写。</p> : null}
        <ul className="space-y-2.5">
          {save.summaries.map((item) => (
            <li key={item.id} className="rounded-[18px] bg-[#FBF7F4] p-2.5">
              <div className="mb-1.5 flex items-center gap-2 text-[11px]">
                <span className="rounded-full px-2 py-0.5" style={{ background: item.kind === 'big' ? '#E6DDF8' : '#D5F0E4' }}>{item.kind === 'big' ? '大总结' : '小总结'}</span>
                <span style={dim}>覆盖到第 {item.upTo} 段</span>
                <button type="button" aria-label="删除摘要" className="ml-auto grid h-6 w-6 place-items-center rounded-full bg-white text-[#b0505c]" onClick={() => void props.onSave({ ...save, summaries: save.summaries.filter((entry) => entry.id !== item.id) })}><Trash2 size={11} /></button>
              </div>
              <textarea
                defaultValue={item.text}
                rows={3}
                onBlur={(event) => {
                  if (event.target.value !== item.text) void props.onSave({ ...save, summaries: save.summaries.map((entry) => (entry.id === item.id ? { ...entry, text: event.target.value } : entry)) })
                }}
                className="soft-input resize-none text-xs leading-5"
              />
            </li>
          ))}
        </ul>
      </Block>
    </>
  )
}

function blankRule(): RegexRule {
  return { id: uid('rx'), name: '新规则', find: '', flags: 'g', replace: '', target: 'display', roles: 'assistant', enabled: true }
}

function RegexTab(props: { mode: StoryMode; config: StoryConfig; onConfig: (patch: Partial<StoryConfig>) => void; onNote: (text: string) => void }) {
  const { config } = props
  const [open, setOpen] = useState<string | null>(null)
  const [sample, setSample] = useState('')
  const setRules = (regex: RegexRule[]) => props.onConfig({ regex })
  const patchRule = (id: string, patch: Partial<RegexRule>) => setRules(config.regex.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)))
  const useExample = () => {
    const has = config.regex.some((rule) => rule.name === STATUS_EXAMPLE.rule.name)
    props.onConfig({ statusPrompt: STATUS_EXAMPLE.prompt, renderHtml: true, regex: has ? config.regex : [...config.regex, { ...STATUS_EXAMPLE.rule, id: uid('rx'), enabled: true }] })
    props.onNote('已填入示例状态栏和对应的美化正则')
  }
  return (
    <>
      <Block title="渲染">
        <SwitchRow
          label={props.mode === 'side' ? '渲染 HTML / style 状态栏' : '渲染 HTML'}
          hint={props.mode === 'side' ? '回复里出现 HTML 标签时，放进隔离的小窗里渲染，样式不会影响手机' : '回复里出现 HTML 标签时，放进隔离的小窗里渲染'}
          on={config.renderHtml}
          onClick={() => props.onConfig({ renderHtml: !config.renderHtml })}
        />
        <SwitchRow label="使用角色卡自带的正则" hint="导入角色卡时会自动写入 regex_scripts；也可继续读卡内 extensions" on={config.useCardRegex} onClick={() => props.onConfig({ useCardRegex: !config.useCardRegex })} />
      </Block>
      {props.mode === 'side' ? (
        <Block title="状态栏提示词" right={<button type="button" className="chip chip-butter" style={small} onClick={useExample}>填入示例</button>}>
          <textarea value={config.statusPrompt} rows={4} onChange={(event) => props.onConfig({ statusPrompt: event.target.value })} placeholder="告诉模型每次回复末尾输出什么状态栏，比如 <status>…</status>。配合下面的正则把它变成漂亮的卡片。" className="soft-input resize-none text-xs leading-5" />
        </Block>
      ) : null}
      <Block
        title={`正则 · ${config.regex.length}`}
        right={
          <span className="flex gap-1.5">
            <label className="chip chip-sky" style={small}>
              <Upload size={11} />导入
              <input type="file" accept="application/json,.json" multiple className="hidden" onChange={(event) => {
                for (const file of Array.from(event.target.files ?? [])) {
                  readJson(file, (raw) => {
                    const rules = regexFromUnknown(raw)
                    if (rules.length === 0) props.onNote(`${file.name} 里没有可用的正则`)
                    else {
                      props.onConfig({ regex: [...config.regex, ...rules] })
                      props.onNote(`导入了 ${rules.length} 条正则`)
                    }
                  }, props.onNote)
                }
              }} />
            </label>
            <button type="button" className="chip chip-pink" style={small} onClick={() => {
              const rule = blankRule()
              setRules([...config.regex, rule])
              setOpen(rule.id)
            }}><Plus size={11} />新建</button>
          </span>
        }
      >
        {config.regex.length === 0 ? <p className="text-[11px] leading-5" style={dim}>可以导入 SillyTavern 的正则脚本 JSON，或手动新建。查找支持 /写法/flags。</p> : null}
        <ul className="space-y-2">
          {config.regex.map((rule) => {
            const valid = !rule.find.trim() || regexValid(rule)
            const expanded = open === rule.id
            return (
              <li key={rule.id} className="rounded-[18px] bg-[#FBF7F4] p-2.5">
                <div className="flex items-center gap-2">
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpen(expanded ? null : rule.id)}>
                    <ChevronDown size={14} className="shrink-0 transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : 'none' }} />
                    <span className="truncate text-sm">{rule.name || '未命名'}</span>
                    {!valid ? <span className="shrink-0 rounded-full bg-[#FBE3E3] px-1.5 text-[10px] text-[#b0505c]">写法有误</span> : null}
                  </button>
                  <button type="button" aria-pressed={rule.enabled} className="relative h-5 w-9 shrink-0 rounded-full transition-colors" style={{ background: rule.enabled ? '#F3A8BA' : '#ebe5df' }} onClick={() => patchRule(rule.id, { enabled: !rule.enabled })}>
                    <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all" style={{ left: rule.enabled ? 18 : 2 }} />
                  </button>
                </div>
                {expanded ? (
                  <div className="mt-2 space-y-2">
                    <input value={rule.name} onChange={(event) => patchRule(rule.id, { name: event.target.value })} placeholder="名字" className="soft-input text-xs" />
                    <div className="flex gap-2">
                      <input value={rule.find} spellCheck={false} onChange={(event) => patchRule(rule.id, { find: event.target.value })} placeholder="查找，如 <status>(.*?)</status>" className="soft-input min-w-0 flex-1 font-mono text-xs" />
                      <input value={rule.flags} spellCheck={false} onChange={(event) => patchRule(rule.id, { flags: event.target.value.replace(/[^dgimsuvy]/g, '') })} placeholder="g" className="soft-input w-14 text-center font-mono text-xs" />
                    </div>
                    <textarea value={rule.replace} rows={3} spellCheck={false} onChange={(event) => patchRule(rule.id, { replace: event.target.value })} placeholder="替换为，可用 $1 $2 和 {{match}}，可以写 HTML 和 <style>" className="soft-input resize-none font-mono text-xs leading-5" />
                    <Choice options={[['display', '只改显示'], ['prompt', '只改发给模型'], ['both', '都改']]} value={rule.target} onChange={(target) => patchRule(rule.id, { target })} />
                    <Choice options={[['assistant', '剧情'], ['user', '我说的'], ['all', '全部']]} value={rule.roles} onChange={(roles) => patchRule(rule.id, { roles })} />
                    <button type="button" className="chip chip-danger w-full" style={small} onClick={() => setRules(config.regex.filter((item) => item.id !== rule.id))}><Trash2 size={11} />删除这条</button>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      </Block>
      <Block title="试一试">
        <textarea value={sample} rows={3} onChange={(event) => setSample(event.target.value)} placeholder="粘贴一段回复，看正则替换后的结果" className="soft-input resize-none text-xs leading-5" />
        {sample ? <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-2xl bg-[#2A2730] p-3 font-mono text-[11px] leading-5 text-white/90">{applyRegex(sample, config.regex, 'display', 'assistant')}</pre> : null}
      </Block>
    </>
  )
}

function PersonaTab(props: TabProps) {
  const { save } = props
  const [name, setName] = useState(save.persona?.name ?? props.identity.name)
  const [persona, setPersona] = useState(save.persona?.persona ?? props.identity.persona)
  const books = save.bookCharIds ?? []
  const withBooks = props.chars.filter((item) => item.characterBook)
  return (
    <>
      <Block title="这一档的主角">
        <div className="flex flex-wrap gap-2">
          {props.chars.map((person) => (
            <button key={person.id} type="button" className={save.charId === person.id ? 'chip chip-lilac' : 'chip'} style={small} onClick={() => void props.onSave({ ...save, charId: person.id })}>{person.name}</button>
          ))}
        </div>
      </Block>
      <Block title="这一档里的我" right={<button type="button" className="chip chip-mint" style={small} onClick={() => void props.onSave({ ...save, persona: { name: name.trim() || props.identity.name, persona } }).then(() => props.onNote('人设已保存'))}>保存</button>}>
        <p className="mb-2 text-[11px]" style={dim}>只在这一档生效，不改主线身份</p>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="名字" className="soft-input" />
        <textarea value={persona} rows={5} onChange={(event) => setPersona(event.target.value)} placeholder="身份、性格、外貌、和 TA 的关系……" className="soft-input mt-2 resize-none leading-6" />
        <button type="button" className="chip mt-2" style={small} onClick={() => {
          setName(props.identity.name)
          setPersona(props.identity.persona)
        }}>用主线身份填入</button>
      </Block>
      <Block
        title="世界书"
        right={
          <label className="chip chip-sky" style={small}>
            <Upload size={11} />导入
            <input type="file" accept="application/json,.json" className="hidden" onChange={(event) => {
              const file = event.target.files?.[0]
              readJson(file, (raw) => {
                const book = lorebookFromUnknown(raw, file?.name.replace(/\.json$/i, '') ?? '世界书')
                if (!book) props.onNote('认不出这是世界书')
                else void props.onSave({ ...save, books: [...(save.books ?? []), book] }).then(() => props.onNote(`导入了「${book.name}」`))
              }, props.onNote)
            }} />
          </label>
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {withBooks.map((person) => {
            const on = books.includes(person.id)
            return (
              <button key={person.id} type="button" className={on ? 'chip chip-lilac' : 'chip'} style={small} onClick={() => void props.onSave({ ...save, bookCharIds: on ? books.filter((id) => id !== person.id) : [...books, person.id] })}>
                📘 {person.characterBook?.name || `${person.name} 的世界书`}
              </button>
            )
          })}
          {(save.books ?? []).map((book, index) => (
            <button key={`${book.name}-${index}`} type="button" className="chip chip-sky" style={small} onClick={() => void props.onSave({ ...save, books: (save.books ?? []).filter((_, at) => at !== index) })}>📗 {book.name} ×</button>
          ))}
        </div>
        {withBooks.length === 0 && (save.books ?? []).length === 0 ? <p className="text-[11px]" style={dim}>还没有世界书，可以导入 SillyTavern 世界书 JSON</p> : null}
      </Block>
    </>
  )
}
