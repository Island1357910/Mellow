import { Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { isAiJobRunning, jobKey, runAiJob } from '../../../engine/aiJobs.ts'
import { cardImportAccept } from '../../../lib/cardTextImport.ts'
import { importJiushiCardFile, isJiushiCharacter } from '../../../lib/jiushi.ts'
import { storage } from '../../../storage/StorageService.ts'
import { useMellow } from '../../../store/useMellow.ts'
import type { Character, Identity } from '../../../types/index.ts'
import { PillNote, Screen } from '../../ui/primitives.tsx'

export function JiushiRosterApp(props: { phone: Identity; onBack: () => void }) {
  const touchData = useMellow((state) => state.touchData)
  const dataRevision = useMellow((state) => state.dataRevision)
  const [chars, setChars] = useState<Character[]>([])
  const [note, setNote] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)
  const busy = isAiJobRunning(jobKey(props.phone.namespace, 'jiushi-import'))

  useEffect(() => {
    void storage.listCharacters(props.phone.namespace).then((all) => setChars(all.filter(isJiushiCharacter)))
  }, [props.phone.namespace, dataRevision])

  const importCard = async (file: File | undefined) => {
    if (!file) return
    setNote('AI 正在读文整理…')
    runAiJob(jobKey(props.phone.namespace, 'jiushi-import'), async () => {
      try {
        const created = await importJiushiCardFile(file, props.phone)
        setNote(created.length ? `已纳入 ${created.map((item) => item.name).join('、')}` : '没有读出来')
        setChars((await storage.listCharacters(props.phone.namespace)).filter(isJiushiCharacter))
        touchData()
      } catch (error) {
        setNote(error instanceof Error ? error.message : '导入失败')
      }
    })
  }

  return (
    <Screen title="人物" subtitle="纳入旧世" onBack={props.onBack}>
      <div className="mb-3 rounded-[22px] p-3 text-xs leading-5" style={{ background: '#F5F0E6', color: 'var(--m-text-secondary)' }}>
        支持 JSON、PNG、txt、doc/docx。文本文档会经 AI 整理成角色卡 JSON 再纳入，不会进现代短信。
      </div>
      <input ref={fileRef} type="file" accept={cardImportAccept()} className="hidden" onChange={(event) => void importCard(event.target.files?.[0])} />
      <button type="button" className="chip chip-sky flex w-full items-center justify-center gap-1 py-2.5" onClick={() => fileRef.current?.click()} disabled={busy}>
        <Upload size={14} />{busy ? '正在整理…' : '导入古风卡 / 文档'}
      </button>
      {note ? <p className="mt-2 text-center text-xs">{note}</p> : null}
      <div className="mt-4 space-y-2">
        {chars.map((person) => (
          <div key={person.id} className="rounded-[20px] bg-white/90 px-4 py-3">
            <p className="text-sm font-medium">{person.name}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5" style={{ color: 'var(--m-text-secondary)' }}>{person.description || person.personality}</p>
          </div>
        ))}
        {!chars.length ? <PillNote tone="lilac">还没有旧世人物</PillNote> : null}
      </div>
    </Screen>
  )
}
