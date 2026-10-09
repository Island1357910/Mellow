import { loadConfig, loadSave } from '../engine/story.ts'
import { listJiushiLetters } from './jiushi.ts'
import { jiushiStoryNs } from './jiushiPhone.ts'
import type { Character } from '../types/index.ts'

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** 入幕读传书：把与在场角色相关的短笺带给模型 */
export async function jiushiLetterBridgeForStory(phoneNamespace: string, chars: Character[]): Promise<string> {
  if (chars.length === 0) return ''
  const ids = new Set(chars.map((item) => item.id))
  const letters = await listJiushiLetters(phoneNamespace)
  const bits: string[] = []
  for (const thread of letters) {
    if (!ids.has(thread.charId) || thread.lines.length === 0) continue
    for (const row of thread.lines.slice(-10)) {
      const who = row.role === 'user' ? '来者' : thread.charName
      bits.push(`${who}：${row.content.slice(0, 200)}`)
    }
  }
  if (bits.length === 0) return ''
  return `【传书往来·角色已知情】此前短笺内容，入幕叙事要接得上，不能装作没写过：\n${bits.join('\n')}`
}

/** 传书读入幕：把近期入幕剧情带给该角色 */
export async function jiushiStoryBridgeForLetter(phoneNamespace: string, character: Character): Promise<string> {
  const storyNs = jiushiStoryNs(phoneNamespace)
  const config = await loadConfig(storyNs)
  const saveId = config.activeSaveId
  if (!saveId) return ''
  const save = await loadSave(storyNs, saveId)
  if (!save || save.lines.length === 0) return ''
  const recent = save.lines.slice(-10)
  const text = recent
    .map((line) => {
      const who = line.role === 'user' ? '来者' : '幕中'
      return `${who}：${stripHtml(line.content).slice(0, 200)}`
    })
    .join('\n')
  return `【入幕近况】${character.name} 刚经历过或知道的事（传书回信要接得上）：\n${text}`
}
