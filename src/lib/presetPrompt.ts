import type { Character, Preset } from '../types/index.ts'

export function fillCharacterPrompt(template: string, userName: string, character?: Character): string {
  const charName = character?.name ?? '角色们'
  const names = (text: string) => text.replace(/\{\{(char|user)\}\}/gi, (_, key: string) =>
    key.toLowerCase() === 'char' ? charName : userName,
  )
  return template.replace(/\{\{(char|user|personality|description|scenario)\}\}/gi, (match, token: string) => {
    const key = token.toLowerCase()
    if (key === 'char' || key === 'user') return names(match)
    return names(character?.[key as 'personality' | 'description' | 'scenario'] || '（没有写）')
  })
}

export function renderPresetPrompt(preset: Preset | null, userName: string, character?: Character): string {
  return (preset?.data.prompts ?? [])
    .filter(block => block.enabled !== false && block.content.trim())
    .map(block => fillCharacterPrompt(block.content, userName, character))
    .join('\n\n')
}
