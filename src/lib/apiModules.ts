export const MAX_API_PROFILES = 7

/** 每个调用入口归属一个模块；映射以模块为键，不能重复绑定。 */
export const API_MODULES = [
  { id: 'messages', name: '短信（含通话与主动消息）' },
  { id: 'offline', name: '线下' },
  { id: 'side', name: '番外' },
  { id: 'romance', name: '人机恋' },
  { id: 'jiushi', name: '旧世（入幕与传书）' },
  { id: 'life', name: '共度' },
  { id: 'moments', name: '朋友圈' },
  { id: 'nearby', name: '附近的人' },
  { id: 'star', name: '星博' },
  { id: 'forum', name: '论坛' },
  { id: 'search', name: '搜索' },
  { id: 'map', name: '地图' },
  { id: 'huizhen', name: '回针' },
  { id: 'table', name: '桌游' },
  { id: 'duotao', name: '多淘' },
  { id: 'flash', name: '闪送' },
  { id: 'dream', name: '梦境电台' },
  { id: 'spark', name: '灵感捕手' },
  { id: 'write', name: '写作助手' },
  { id: 'create', name: '创作' },
  { id: 'worldforge', name: '世界搭建' },
  { id: 'cardimport', name: '角色文件导入整理' },
  { id: 'connections', name: '外部连接（共看内容）' },
] as const

export type ApiModuleId = typeof API_MODULES[number]['id']
export type ApiModuleBindings = Partial<Record<ApiModuleId, string>>

export function normalizeApiBindings(raw: unknown): ApiModuleBindings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const row = raw as Record<string, unknown>
  return Object.fromEntries(API_MODULES.flatMap(({ id }) => {
    const value = row[id]
    return typeof value === 'string' && value.trim() ? [[id, value.trim()]] : []
  }))
}
