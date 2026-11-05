import { HOME_PAGE_CAP, homePages } from '../data/apps.ts'
import type { HomeCell } from '../types/index.ts'

export function defaultBoard(installed: string[]): HomeCell[] {
  const { page2, page3 } = homePages(installed)
  return [...page2, ...page3].map((app) => ({ kind: 'app', id: app.id }))
}

function trimGaps(cells: HomeCell[]): HomeCell[] {
  let end = cells.length
  while (end > 0 && cells[end - 1]?.kind === 'gap') end -= 1
  return cells.slice(0, end)
}

/** 丢掉已卸载的应用，把新装的补到最后。只剩一个图标的组还原成单个应用。空位留在原来的格子上。 */
export function resolveBoard(installed: string[], saved: HomeCell[] | undefined): HomeCell[] {
  const allowed = new Set(defaultBoard(installed).flatMap((cell) => (cell.kind === 'app' ? [cell.id] : [])))
  const seen = new Set<string>()
  const cells: HomeCell[] = []
  for (const cell of saved ?? []) {
    if (cell.kind === 'gap') {
      cells.push(cell)
      continue
    }
    if (cell.kind === 'app') {
      if (!allowed.has(cell.id) || seen.has(cell.id)) continue
      seen.add(cell.id)
      cells.push(cell)
      continue
    }
    const appIds = cell.appIds.filter((id) => allowed.has(id) && !seen.has(id))
    if (appIds.length === 0) continue
    if (appIds.length === 1) {
      seen.add(appIds[0]!)
      cells.push({ kind: 'app', id: appIds[0]! })
      continue
    }
    for (const id of appIds) seen.add(id)
    cells.push({ ...cell, appIds })
  }
  for (const id of allowed) {
    if (!seen.has(id)) {
      let last = -1
      cells.forEach((cell, index) => {
        if (cell.kind !== 'gap') last = index
      })
      cells.splice(last + 1, 0, { kind: 'app', id })
    }
  }
  return trimGaps(cells)
}

export function moveCell(board: HomeCell[], from: number, to: number): HomeCell[] {
  if (from === to || from < 0 || to < 0 || from >= board.length || to >= board.length) return board
  const next = board.slice()
  const [item] = next.splice(from, 1)
  if (!item) return board
  next.splice(to, 0, item)
  return next
}

/** 拖到空格子上：图标过去，原来的位置空出来。 */
export function placeCell(board: HomeCell[], from: number, to: number): HomeCell[] {
  if (from === to || from < 0 || to < 0 || from >= board.length) return board
  const source = board[from]
  if (!source || source.kind === 'gap') return board
  const slots = board.slice()
  while (slots.length <= to) slots.push({ kind: 'gap' })
  const target = slots[to]
  if (target && target.kind !== 'gap') return board
  slots[to] = source
  slots[from] = { kind: 'gap' }
  return trimGaps(slots)
}

/** 拖到图标中间合成应用组；拖到组上则放入。 */
export function mergeCell(board: HomeCell[], from: number, to: number, folderId: string): HomeCell[] {
  if (from === to || from < 0 || to < 0 || from >= board.length || to >= board.length) return board
  const source = board[from]
  const target = board[to]
  if (!source || !target) return board
  if (source.kind === 'gap' || target.kind === 'gap') return board
  const incoming = source.kind === 'app' ? [source.id] : source.appIds
  const appIds = target.kind === 'folder' ? [...target.appIds] : [target.id]
  for (const id of incoming) if (!appIds.includes(id)) appIds.push(id)
  if (appIds.length < 2) return board
  const folder: HomeCell = target.kind === 'folder'
    ? { ...target, appIds }
    : { kind: 'folder', id: folderId, name: '应用组', appIds }
  const next = board.slice()
  next[to] = folder
  next.splice(from, 1)
  return next
}

export function renameFolder(board: HomeCell[], folderId: string, name: string): HomeCell[] {
  const trimmed = name.trim().slice(0, 12)
  if (!trimmed) return board
  return board.map((cell) => (cell.kind === 'folder' && cell.id === folderId ? { ...cell, name: trimmed } : cell))
}

export function ejectApp(board: HomeCell[], folderId: string, appId: string): HomeCell[] {
  const index = board.findIndex((cell) => cell.kind === 'folder' && cell.id === folderId)
  if (index < 0) return board
  return ejectTo(board, folderId, appId, index + 1)
}

/** 从应用组拖出来，放到桌面的某一格。落回组自己的位置则不动。 */
export function ejectTo(board: HomeCell[], folderId: string, appId: string, to: number): HomeCell[] {
  const index = board.findIndex((cell) => cell.kind === 'folder' && cell.id === folderId)
  const folder = board[index]
  if (!folder || folder.kind !== 'folder' || !folder.appIds.includes(appId) || to < 0 || to === index) return board
  const appIds = folder.appIds.filter((id) => id !== appId)
  const next = board.slice()
  if (appIds.length <= 1) next.splice(index, 1, ...(appIds[0] ? [{ kind: 'app' as const, id: appIds[0] }] : []))
  else next[index] = { ...folder, appIds }
  let target = to
  if (appIds.length === 0 && to > index) target -= 1
  while (next.length <= target) next.push({ kind: 'gap' })
  const landing = next[target]
  if (!landing || landing.kind === 'gap') next[target] = { kind: 'app', id: appId }
  else next.splice(target, 0, { kind: 'app', id: appId })
  return trimGaps(next)
}

export function chunkBoard(board: HomeCell[], size = HOME_PAGE_CAP): HomeCell[][] {
  if (board.length === 0) return [[]]
  const pages: HomeCell[][] = []
  for (let index = 0; index < board.length; index += size) pages.push(board.slice(index, index + size))
  return pages
}

/** 桌宠只能停在手机内屏里，上避开状态栏，下避开底栏。位移用屏幕宽高减去桌宠尺寸。 */
export function clampPet(x: number, y: number, width: number, height: number, size = 76): { x: number; y: number } {
  const maxX = Math.max(0, width - size)
  const minY = 36
  const maxY = Math.max(minY, height - size - 140)
  return {
    x: Math.min(maxX, Math.max(0, x)),
    y: Math.min(maxY, Math.max(minY, y)),
  }
}
