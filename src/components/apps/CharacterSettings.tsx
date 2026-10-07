import { useMemo, useState } from 'react'
import { deleteCharacterConfirmText } from '../../domain/characterCleanup.ts'
import { isTrustedVoiceCache, resolveCharacterVoiceId, voiceLabel, voiceOptions } from '../../engine/minimax.ts'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import type { Character, Identity } from '../../types/index.ts'
import { VoiceSelect } from './SettingsPanels.tsx'
import { PillNote } from '../ui/primitives.tsx'

export function CharacterSettingsSheet(props: {
  identity: Identity
  character: Character
  onClose: () => void
  onSaved: (character: Character) => void
  onDeleted: () => void
}) {
  const settings = useMellow((state) => state.settings)
  const mini = settings.minimax
  const voices = voiceOptions(mini)
  const globalVoice = mini.voiceId || 'female-shaonv'
  const [voiceId, setVoiceId] = useState(props.character.voiceId?.trim() || '')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const label = useMemo(() => {
    if (!voiceId) return `跟随全局（${voiceLabel(voices, globalVoice)}）`
    return voiceLabel(voices, voiceId)
  }, [globalVoice, voiceId, voices])

  const saveVoice = async () => {
    const next: Character = {
      ...props.character,
      voiceId: voiceId.trim() || null,
      updatedAt: Date.now(),
    }
    await storage.putCharacter(props.identity.namespace, next)
    props.onSaved(next)
    setStatus('音色已保存')
  }

  const remove = async () => {
    if (!window.confirm(deleteCharacterConfirmText([props.character.remark || props.character.name]))) return
    await storage.deleteCharacter(props.identity.namespace, props.character.id)
    props.onDeleted()
  }

  return (
    <div className="modal-overlay" onClick={props.onClose}>
      <div className="modal-center sms-shell" onClick={(event) => event.stopPropagation()}>
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="break-words text-[18px] font-semibold">{props.character.remark || props.character.name}</h2>
            {props.character.remark ? <p className="preset-desc">{props.character.name}</p> : null}
          </div>
          <button type="button" className="chip chip-pink shrink-0" onClick={props.onClose}>关闭</button>
        </div>

        <section className="menu-card mt-3 min-w-0">
          <p className="text-xs font-medium">MiniMax 音色</p>
          <p className="preset-hint mt-1">只影响这个角色的语音条。留空则用全局默认。</p>
          {!isTrustedVoiceCache(mini.fetchedVoices) ? (
            <PillNote tone="sky" compact><span className="break-words">请先在 设置 → MiniMax 语音 里拉取平台音色。</span></PillNote>
          ) : (
            <div className="mt-2">
              <VoiceSelect
                label="角色音色"
                voices={[{ id: '', name: `跟随全局 · ${voiceLabel(voices, globalVoice)}` }, ...voices]}
                value={voiceId}
                query={query}
                onQuery={setQuery}
                onChange={setVoiceId}
              />
              <p className="preset-desc mt-1">当前：{label}（id: {resolveCharacterVoiceId({ voiceId: voiceId || null }, mini)}）</p>
            </div>
          )}
          <button type="button" className="chip chip-solid mt-3 w-full" onClick={() => void saveVoice().catch((error: unknown) => setStatus(error instanceof Error ? error.message : '没保存成'))}>
            保存音色
          </button>
        </section>

        <section className="menu-card mt-3 min-w-0">
          <p className="text-xs font-medium">删除角色</p>
          <p className="preset-hint mt-1">会删掉聊天记录、绑定世界书、线下/番外存档与正则等。删之前请先备份。</p>
          <button type="button" className="chip chip-danger mt-2 w-full" onClick={() => void remove()}>删除这个角色</button>
        </section>

        {status ? <PillNote tone="lilac" inline><span className="break-words">{status}</span></PillNote> : null}
      </div>
    </div>
  )
}
