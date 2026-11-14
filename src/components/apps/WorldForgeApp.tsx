import { Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { isAiJobRunning, jobKey, runAiJob } from '../../engine/aiJobs.ts'
import { cardImportAccept, resolveImportJson } from '../../lib/cardTextImport.ts'
import { loadJiushiConfig } from '../../lib/jiushi.ts'
import { applyForgeResult, forgeWithReferences, forgeWorldFromCard, forgeWorldFromProse, reviseForgeResult, type ForgeResult } from '../../lib/worldForge.ts'
import { storage } from '../../storage/StorageService.ts'
import { loreEntries } from '../../lib/sillytavern.ts'
import type { Character } from '../../types/index.ts'
import { useMellow } from '../../store/useMellow.ts'
import { PillNote, Screen } from '../ui/primitives.tsx'

export function WorldForgeApp(props: {
  onBack: () => void
  jiushi?: boolean
  worldNamespace?: string
}) {
  const identities = useMellow((state) => state.identities)
  const activeIdentityId = useMellow((state) => state.activeIdentityId)
  const touchData = useMellow((state) => state.touchData)
  const phone = identities.find((item) => item.id === activeIdentityId)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [rawName, setRawName] = useState('')
  const [prose, setProse] = useState('')
  const [result, setResult] = useState<ForgeResult | null>(null)
  const [note, setNote] = useState('')
  const [applied, setApplied] = useState(false)
  const [people, setPeople] = useState<Character[]>([])
  const [references, setReferences] = useState<string[]>([])
  const [revision, setRevision] = useState('')
  const [applying, setApplying] = useState(false)
  const namespace = phone?.namespace ?? ''
  const draftKey = props.jiushi ? 'jiushi_worldforge_draft' : 'worldforge_draft'

  useEffect(() => {
    if (!namespace) return
    let live = true
    void storage.getBag<{ result: ForgeResult; name: string; applied?: boolean }>(namespace, draftKey).then(saved => {
      if (!live || !saved) return
      setResult(saved.result)
      setRawName(saved.name)
      setApplied(Boolean(saved.applied))
    }).catch(() => { if (live) setNote('没有读到上次的草稿') })
    return () => { live = false }
  }, [namespace, draftKey])

  useEffect(() => {
    if (!phone) return
    let live = true
    setReferences([])
    void storage.listCharacters(phone.namespace).then(rows => {
      if (live) setPeople(rows.filter(person => Boolean(person.extensions?.jiushi || person.tags.some(tag => tag === '旧世' || tag === '古风')) === Boolean(props.jiushi)))
    })
    return () => { live = false }
  }, [phone, props.jiushi])

  if (!phone) return null
  const jobNs = props.jiushi ? `${phone.namespace}__jiushi-forge` : phone.namespace
  const busy = isAiJobRunning(jobKey(jobNs, 'worldforge'))
  const referenceText = () => JSON.stringify(people.filter(person => references.includes(person.id)).map(person => ({
    name: person.name, description: person.description, personality: person.personality, scenario: person.scenario,
    worldbook: loreEntries(person.characterBook).filter(entry => entry.enabled !== false && !entry.disable).map(entry => entry.content),
  }))).slice(0, 20_000)
  const creationIdentity = async () => {
    if (!props.jiushi) return phone
    const config = await loadJiushiConfig(phone.namespace)
    return { name: config.roleName || phone.name, persona: config.roleStory || phone.persona }
  }

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    setRawName(file.name)
    setResult(null)
    setApplied(false)
    setNote('AI 正在阅读并整理大世界卡…')
    runAiJob(jobKey(jobNs, 'worldforge'), async () => {
      try {
        const { card: raw } = await resolveImportJson(file, 'world', (msg) => setNote(msg))
        const identity = await creationIdentity()
        const original = await forgeWorldFromCard(raw, identity)
        const forged = references.length ? await reviseForgeResult(original, '参考已选角色设定，补齐与他们有关的世界背景，保留原草稿的全部条目和角色。', identity, referenceText()) : original
        await storage.setBag(namespace, draftKey, { result: forged, name: file.name })
        setResult(forged)
        setNote(
          forged.local
            ? `已拆出 ${forged.characters.length} 位角色、${forged.worldEntries.length} 条世界设定（部分角色保留原文）`
            : `已拆出 ${forged.characters.length} 位角色、${forged.worldEntries.length} 条世界设定，确认后可导入`,
        )
      } catch (error) {
        setNote(error instanceof Error ? error.message : '拆分失败')
      }
    })
  }

  const forgeText = () => {
    const text = prose.trim()
    if (!text || busy) return
    setRawName('手写设定')
    setResult(null)
    setApplied(false)
    setNote('AI 正在根据你写的内容搭建世界…')
    runAiJob(jobKey(jobNs, 'worldforge'), async () => {
      try {
        const identity = await creationIdentity()
        const forged = references.length ? await forgeWithReferences(text, referenceText(), identity) : await forgeWorldFromProse(text, identity)
        await storage.setBag(namespace, draftKey, { result: forged, name: '手写设定' })
        setResult(forged)
        setNote(
          forged.local
            ? `已拆出 ${forged.characters.length} 位角色、${forged.worldEntries.length} 条世界设定（部分角色保留原文）`
            : `已拆出 ${forged.characters.length} 位角色、${forged.worldEntries.length} 条世界设定，确认后可导入`,
        )
      } catch (error) {
        setNote(error instanceof Error ? error.message : '搭建失败')
      }
    })
  }

  const revise = () => {
    if (!result || !revision.trim() || busy || applying) return
    setNote('AI 正在修改草稿…')
    runAiJob(jobKey(jobNs, 'worldforge'), async () => {
      try {
        const updated = await reviseForgeResult(result, revision, await creationIdentity(), referenceText())
        await storage.setBag(namespace, draftKey, { result: updated, name: rawName })
        setResult(updated)
        setRevision('')
        setApplied(false)
        setNote('草稿已更新，可以预览全部条目。')
      } catch (error) {
        setNote(error instanceof Error ? error.message : '修改失败，已保留原草稿')
      }
    })
  }

  const apply = async () => {
    if (!result || applying) return
    setApplying(true)
    setNote('正在写入世界书与角色…')
    try {
      const { characters } = await applyForgeResult(phone, result, {
        jiushi: props.jiushi,
        skipChat: props.jiushi,
        worldNamespace: props.worldNamespace,
      })
      setApplied(true)
      await storage.setBag(namespace, draftKey, { result, name: rawName, applied: true })
      touchData()
      setNote(
        props.jiushi
          ? `已纳入 ${characters.length} 位旧世人物。各条设定可在「世界书 → 世界观」单独查看。`
          : `已导入 ${characters.length} 位角色。各条设定可在「世界书 → 世界观」单独查看。`,
      )
    } catch (error) {
      setNote(error instanceof Error ? error.message : '导入失败')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="sms-shell relative h-full min-h-0">
      <Screen
        title={props.jiushi ? '世界搭建' : '世界搭建'}
        subtitle={props.jiushi ? '旧世 · 手写或导入' : '手写或导入 → 多人 + 世界书'}
        onBack={props.onBack}
      >
        <div className="mb-4 rounded-[24px] p-4" style={{ background: props.jiushi ? 'linear-gradient(135deg,#F5F0E6,#EDE4D3)' : 'linear-gradient(135deg,#E8EEF4,#F5F0E6)' }}>
          <p className="text-sm leading-6">手写一段世界观，或导入文件（JSON / txt / doc / docx）。AI 会拆成世界书和角色。</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--m-text-secondary)' }}>{props.jiushi ? '参考当前旧世身份' : `参考当前身份：${phone.name}`}</p>
          <ul className="mt-2 space-y-1 text-xs leading-5" style={{ color: 'var(--m-text-secondary)' }}>
            <li>· 直接打字也行，不必先做成 JSON</li>
            <li>· 每条世界设定独立写入世界书</li>
            <li>· 全部 NPC {props.jiushi ? '纳入旧世人物，不进现代短信' : '拆成可短信角色'}</li>
          </ul>
        </div>

        {people.length ? <details className="menu-card mb-3">
          <summary>参考已有角色{references.length ? `（${references.length}）` : ''}</summary>
          {people.map(person => <label className="mt-2 flex gap-2 text-sm" key={person.id}>
            <input type="checkbox" checked={references.includes(person.id)} disabled={busy || applying} onChange={() => setReferences(ids => ids.includes(person.id) ? ids.filter(id => id !== person.id) : [...ids, person.id])} />
            {person.remark || person.name}
          </label>)}
        </details> : null}
        <textarea
          value={prose}
          rows={7}
          onChange={(event) => setProse(event.target.value)}
          placeholder="比如：雨城，三年不许说出自己的名字。城里有书店老板、夜班医生、一个总是迟到的人……"
          className="soft-input resize-none leading-6"
        />
        <button type="button" className="chip chip-solid mt-2 w-full py-2.5" disabled={busy || applying || prose.trim().length < 8} onClick={forgeText}>
          {busy && rawName === '手写设定' ? '正在搭建…' : '用这段文字生成'}
        </button>

        <input ref={fileRef} type="file" accept={cardImportAccept()} className="hidden" onChange={(event) => void pickFile(event.target.files?.[0])} />
        <button type="button" className="chip chip-sky mt-2 flex w-full items-center justify-center gap-1 py-2.5" onClick={() => fileRef.current?.click()} disabled={busy || applying}>
          <Upload size={14} />{busy ? '正在整理…' : '选择大世界文件'}
        </button>

        {rawName ? <p className="mt-2 text-center text-xs" style={{ color: 'var(--m-text-secondary)' }}>{rawName}</p> : null}
        {note ? <PillNote tone={applied ? 'mint' : 'lilac'}>{note}</PillNote> : null}

        {result ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-[22px] bg-white/90 p-4">
              <p className="text-sm font-medium">{result.worldTitle}</p>
              {result.worldSummary ? <p className="mt-2 whitespace-pre-wrap text-xs leading-5">{result.worldSummary}</p> : null}
              {result.worldHostBlurb ? <details className="mt-2"><summary>世界开场</summary><p className="whitespace-pre-wrap text-sm">{result.worldHostBlurb}</p></details> : null}
              <p className="mt-2 text-xs" style={{ color: 'var(--m-text-secondary)' }}>{result.worldEntries.length} 条世界设定 · {result.characters.length} 位角色</p>
            </div>
            {result.worldEntries.map((entry, index) => <details className="menu-card" key={index}>
              <summary>{entry.title}</summary>
              {entry.keys ? <p className="text-xs">关键词 · {entry.keys}</p> : null}
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{entry.content}</p>
            </details>)}
            <ul className="divide-y divide-black/[0.05] rounded-[22px] bg-white/90">
              {result.characters.map((item, index) => (
                <li key={`${item.draft.name}-${index}`} className="px-4 py-3">
                  <details><summary>{item.draft.name} · {item.note}</summary>
                    {Object.entries(item.draft).filter(([key, value]) => !['rawCard', 'name', 'avatar', 'extensions'].includes(key) && (typeof value === 'string' ? value.trim() : Array.isArray(value) && value.length)).map(([key, value]) =>
                      <p key={key} className="mt-2 whitespace-pre-wrap text-sm"><strong>{({ description: '角色设定', personality: '性格', scenario: '情境', firstMes: '开场白', mesExample: '对话示例', systemPrompt: '系统提示词', postHistoryInstructions: '后置指令', alternateGreetings: '备用开场', tags: '标签' } as Record<string, string>)[key] ?? key}</strong>{'\n'}{Array.isArray(value) ? value.join('\n\n') : String(value)}</p>)}
                    {loreEntries(item.draft.characterBook).map((entry, i) => <p key={i} className="mt-2 whitespace-pre-wrap text-sm"><strong>{entry.comment || entry.name || '角色世界书'}</strong>{'\n'}{entry.content}</p>)}
                  </details>
                </li>
              ))}
            </ul>
            {!applied ? <div className="menu-card">
              <textarea className="soft-input" rows={3} value={revision} onChange={event => setRevision(event.target.value)} placeholder="告诉 AI 要在这份草稿上改什么" />
              <button type="button" className="chip mt-2" disabled={busy || applying || !revision.trim()} onClick={revise}>修改草稿</button>
            </div> : null}
            {!applied ? (
              <button type="button" className="chip chip-mint w-full py-2.5" onClick={() => void apply()} disabled={busy || applying}>确认导入</button>
            ) : null}
          </div>
        ) : null}
      </Screen>
    </div>
  )
}
