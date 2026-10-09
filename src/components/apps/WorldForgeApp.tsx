import { ChevronRight, Hammer, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { isAiJobRunning, jobKey, runAiJob } from '../../engine/aiJobs.ts'
import { applyForgeResult, forgeWorldFromCard, type ForgeResult } from '../../lib/worldForge.ts'
import { useMellow } from '../../store/useMellow.ts'
import { PillNote, Screen } from '../ui/primitives.tsx'

export function WorldForgeApp(props: { onBack: () => void }) {
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
  const busy = isAiJobRunning(jobKey(phone.namespace, 'worldforge'))

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    setRawName(file.name)
    setResult(null)
    setApplied(false)
    setNote('正在解析大世界卡，AI 整理角色设定…')
    let raw: unknown
    try {
      if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
        setNote('PNG 卡请先在世界搭建外预览；当前请优先用 JSON 大世界卡')
        return
      }
      raw = JSON.parse(await file.text()) as unknown
    } catch {
      setNote('JSON 读不出来')
      return
    }
    runAiJob(jobKey(phone.namespace, 'worldforge'), async () => {
      try {
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
      const { characters } = await applyForgeResult(phone, result)
      setApplied(true)
      touchData()
      setNote(`已导入 ${characters.length} 位角色。世界观总条目已写入世界书 → 世界观 标签，可在短信中与各 NPC 聊天。`)
    } catch (error) {
      setNote(error instanceof Error ? error.message : '导入失败')
    }
  }

  return (
    <div className="sms-shell relative h-full min-h-0">
      <Screen title="世界搭建" subtitle="大世界卡 → 多人 + 世界书" onBack={props.onBack}>
        <div className="mb-4 rounded-[24px] p-4" style={{ background: 'linear-gradient(135deg,#E8EEF4,#F5F0E6)' }}>
          <p className="text-sm leading-6">导入含 character_book 的大世界卡：</p>
          <ul className="mt-2 space-y-1 text-xs leading-5" style={{ color: 'var(--m-text-secondary)' }}>
            <li>· 全部世界书条目写入世界书（不截断）</li>
            <li>· 全部 NPC 拆成可短信角色，AI 整理完整设定</li>
            <li>· 不导入世界主卡为短信联系人</li>
          </ul>
        </div>

        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void pickFile(event.target.files?.[0])} />
        <button type="button" className="chip chip-sky flex w-full items-center justify-center gap-1 py-2.5" onClick={() => fileRef.current?.click()} disabled={busy}>
          <Upload size={14} />{busy ? '正在整理…' : '选择大世界 JSON 卡'}
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
              <button type="button" className="chip chip-mint w-full py-2.5" onClick={() => void apply()} disabled={busy}>确认导入到当前身份</button>
            ) : null}
          </div>
        ) : null}
      </Screen>
    </div>
  )
}
