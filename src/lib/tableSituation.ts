import { winner, type Grid, type Stone } from './gomoku.ts'
import { winnerOf, type Board } from './xiangqi.ts'
import type { UnoMatch } from './uno.ts'

export function gomokuSituation(grid: Grid, names: string[]): string {
  const labels = [`玩家${names[0]}（黑子1）`, `角色${names[1]}（白子2）`]
  const won = winner(grid)
  if (won) return `系统胜负：${labels[won - 1]}获胜，${labels[won === 1 ? 1 : 0]}落败。`
  const threats = ([1, 2] as Stone[]).map(stone => {
    const cells: string[] = []
    for (let r = 0; r < grid.length; r++) for (let c = 0; c < grid[r]!.length; c++) {
      if (grid[r]![c]) continue
      grid[r]![c] = stone
      if (winner(grid) === stone) cells.push(`${r + 1}行${c + 1}列`)
      grid[r]![c] = 0
    }
    return `${labels[stone - 1]}下一手可直接连五的位置：${cells.join('、') || '无'}。`
  })
  return `系统局势（非最终胜负）：${threats.join('')}未堵住对方成五点才面临落败；不可把威胁归属说反。`
}
export function xiangqiSituation(board: Board, names: string[]): string {
  const won = winnerOf(board)
  return `玩家${names[0]}执红方，角色${names[1]}执黑方。系统胜负：${won ? (won === 'red' ? '玩家'+names[0] : '角色'+names[1])+'获胜' : '尚未结束，系统未评估谁占优，不得断言谁快输了'}。`
}
export function unoSituation(match: UnoMatch): string {
  return `公开剩牌：${match.names.map((name, i) => `${i === 0 ? '玩家' : '角色'}${name}剩${match.hands[i]?.length ?? 0}张`).join('；')}。剩牌少更接近获胜；${match.winner === null ? '尚未分出胜负' : '系统胜者：'+match.names[match.winner]}。`
}
