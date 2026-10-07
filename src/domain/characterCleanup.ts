import { deleteSave, loadConfig, saveConfig } from '../engine/story.ts'
import { readWorld, writeWorld } from '../lib/worldbook.ts'
import type { FeedPost } from '../lib/feed.ts'
import type { ContactFolder, IdentitySpaceState } from '../types/index.ts'
import { storage } from '../storage/StorageService.ts'
import type { SaveIndexRow } from '../engine/story.ts'

async function purgeStoryNamespace(namespace: string, charId: string): Promise<void> {
  const index = (await storage.getBag<SaveIndexRow[]>(namespace, 'story_index')) ?? []
  for (const row of index.filter((item) => item.charId === charId)) {
    await deleteSave(namespace, row.id)
  }
  const config = await loadConfig(namespace)
  if (config.regex.some((rule) => rule.charId === charId)) {
    await saveConfig(namespace, { ...config, regex: config.regex.filter((rule) => rule.charId !== charId) })
  }
}

async function purgeWorldbook(namespace: string, charId: string): Promise<void> {
  const rows = await readWorld(namespace)
  const next = rows.filter((item) => item.charId !== charId)
  if (next.length !== rows.length) await writeWorld(namespace, next)
}

async function purgeAppData(namespace: string, charId: string): Promise<void> {
  await storage.deleteBag(namespace, `peek_${charId}`)
  await storage.deleteBag(namespace, `char_diary_${charId}`)

  const glance = (await storage.getBag<Record<string, string[]>>(namespace, 'glance')) ?? {}
  if (glance[charId]) {
    const { [charId]: _drop, ...rest } = glance
    await storage.setBag(namespace, 'glance', rest)
  }

  const charOpen = (await storage.getBag<Record<string, string[]>>(namespace, 'char_open')) ?? {}
  if (charOpen[charId]) {
    const { [charId]: _drop, ...rest } = charOpen
    await storage.setBag(namespace, 'char_open', rest)
  }

  const bound = await storage.getBag<string>(namespace, 'huizhen')
  if (bound === charId) await storage.deleteBag(namespace, 'huizhen')

  const feed = await storage.getBag<FeedPost[]>(namespace, 'star_feed')
  if (feed?.some((post) => post.charId === charId)) {
    await storage.setBag(namespace, 'star_feed', feed.filter((post) => post.charId !== charId))
  }

  const folders = await storage.getBag<ContactFolder[]>(namespace, 'folders')
  if (folders?.some((folder) => folder.charIds.includes(charId))) {
    await storage.setBag(
      namespace,
      'folders',
      folders.map((folder) => ({ ...folder, charIds: folder.charIds.filter((id) => id !== charId) })),
    )
  }
}

async function purgeSpace(namespace: string, charId: string): Promise<void> {
  const space = await storage.getSpace(namespace)
  const strip = (ids: string[]) => ids.filter((id) => id !== charId)
  const next: IdentitySpaceState = {
    ...space,
    remoteChats: strip(space.remoteChats ?? []),
    currentScene: space.currentScene
      ? {
          ...space.currentScene,
          present: strip(space.currentScene.present ?? []),
          participants: strip(space.currentScene.participants ?? []),
        }
      : null,
    history: (space.history ?? []).map((scene) => ({
      ...scene,
      present: strip(scene.present ?? []),
      participants: strip(scene.participants ?? []),
    })),
  }
  const changed = JSON.stringify(space) !== JSON.stringify(next)
  if (changed) await storage.saveSpace(namespace, next)
}

/** 删除角色前，清掉所有绑定在该 charId 上的数据（不含 chats/messages 表，由 StorageService 处理）。 */
export async function purgeCharacterBindings(namespace: string, charId: string): Promise<void> {
  await purgeWorldbook(namespace, charId)
  await purgeStoryNamespace(namespace, charId)
  await purgeStoryNamespace(`${namespace}__side`, charId)
  await purgeAppData(namespace, charId)
  await purgeSpace(namespace, charId)
}

export function deleteCharacterConfirmText(names: string[]): string {
  const who = names.length === 1 ? `「${names[0]}」` : `${names.length} 个角色`
  return [
    `确定删除 ${who}？`,
    '',
    '会一并删除：',
    '· 与该角色的聊天记录',
    '· 绑定的世界书条目',
    '· 线下 / 番外存档与正则',
    '· 回针、日记、星博等关联数据',
    '',
    '删之前请先到 设置 → 数据 → 备份，保存一份。',
  ].join('\n')
}
