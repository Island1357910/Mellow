import { ChevronRight, Hammer, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { isAiJobRunning, jobKey, runAiJob } from '../../engine/aiJobs.ts'
import { cardImportAccept, resolveImportJson } from '../../lib/cardTextImport.ts'
import { applyForgeResult, forgeWorldFromCard, type ForgeResult } from '../../lib/worldForge.ts'
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
  const [result, setResult] = useState<ForgeResult | null>(null)
  const [note, setNote] = useState('')
  const [applied, setApplied] = useState(false)

  if (!phone) return null
  const jobNs = props.jiushi ? `${phone.namespace}__jiushi-forge` : phone.namespace
  const busy = isAiJobRunning(jobKey(jobNs, 'worldforge'))

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    setRawName(file.name)
    setResult(null)
    setApplied(false)
    setNote('正在读文并整理大世界卡…')
    runAiJob(jobKey(jobNs, 'worldforge'), async () => {
      try {
        const raw = await resolveImportJson(file, 'world')
        const forged = await forgeWorldFromCard(raw)
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

  const apply = async () => {
    if (!result) return
    setNote('正在写入世界书与角色…')
    try {
      const { characters } = await applyForgeResult(phone, result, {
        jiushi: props.jiushi,
        skipChat: props.jiushi,
        worldNamespace: props.worldNamespace,
      })
      setApplied(true)
      touchData()
      setNote(
        props.jiushi
          ? `已纳入 ${characters.length} 位旧世人物，世界观总条目在「世界书 → 世界观」。`
          : `已导入 ${characters.length} 位角色。世界观总条目已写入世界书 → 世界观 标签，可在短信中与各 NPC 聊天。`,
      )
    } catch (error) {
      setNote(error instanceof Error ? error.message : '导入失败')
    }
  }

  return (
    <div className="sms-shell relative h-full min-h-0">
      <Screen
        title={props.jiushi ? '世界搭建' : '世界搭建'}
        subtitle={props.jiushi ? '旧世 · 大世界入境' : '大世界卡 → 多人 + 世界书'}
        onBack={props.onBack}
      >
        <div className="mb-4 rounded-[24px] p-4" style={{ background: props.jiushi ? 'linear-gradient(135deg,#F5F0E6,#EDE4D3)' : 'linear-gradient(135deg,#E8EEF4,#F5F0E6)' }}>
          <p className="text-sm leading-6">导入大世界卡或文档（JSON / txt / doc / docx）：</p>
          <ul className="mt-2 space-y-1 text-xs leading-5" style={{ color: 'var(--m-text-secondary)' }}>
            <li>· 文本文档经 AI 整理成 JSON 再拆分</li>
            <li>· 全部世界书条目写入世界观总条目</li>
            <li>· 全部 NPC {props.jiushi ? '纳入旧世人物，不进现代短信' : '拆成可短信角色'}</li>
          </ul>
        </div>

        <input ref={fileRef} type="file" accept={cardImportAccept()} className="hidden" onChange={(event) => void pickFile(event.target.files?.[0])} />
        <button type="button" className="chip chip-sky flex w-full items-center justify-center gap-1 py-2.5" onClick={() => fileRef.current?.click()} disabled={busy}>
          <Upload size={14} />{busy ? '正在整理…' : '选择大世界文件'}
        </button>

        {rawName ? <p className="mt-2 text-center text-xs" style={{ color: 'var(--m-text-secondary)' }}>{rawName}</p> : null}
        {note ? <PillNote tone={applied ? 'mint' : 'lilac'}>{note}</PillNote> : null}

        {result ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-[22px] bg-white/90 p-4">
              <p className="text-sm font-medium">{result.worldTitle}</p>
              {result.worldSummary ? <p className="mt-2 text-xs leading-5" style={{ color: 'var(--m-text-secondary)' }}>{result.worldSummary}</p> : null}
              <p className="mt-2 text-xs" style={{ color: 'var(--m-text-secondary)' }}>{result.worldEntries.length} 条世界设定 · {result.characters.length} 位角色</p>
            </div>
            <ul className="max-h-[360px] divide-y divide-black/[0.05] overflow-y-auto rounded-[22px] bg-white/90">
              {result.characters.map((item, index) => (
                <li key={`${item.draft.name}-${index}`} className="flex items-center gap-2 px-4 py-3">
                  <Hammer size={14} style={{ color: 'var(--m-text-secondary)' }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{item.draft.name}</p>
                    <p className="line-clamp-1 text-xs" style={{ color: 'var(--m-text-secondary)' }}>{item.note}</p>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--m-text-secondary)' }} />
                </li>
              ))}
            </ul>
            {!applied ? (
              <button type="button" className="chip chip-mint w-full py-2.5" onClick={() => void apply()} disabled={busy}>确认导入</button>
            ) : null}
          </div>
        ) : null}
      </Screen>
    </div>
  )
}
