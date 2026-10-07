export type Stone = 0 | 1 | 2
export type Grid = Stone[][]

const DIRS: Array<[number, number]> = [[1, 0], [0, 1], [1, 1], [1, -1]]

export function emptyGrid(size = 9): Grid {
  return Array.from({ length: size }, () => Array<Stone>(size).fill(0))
}

export function winner(grid: Grid): Stone {
  const size = grid.length
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const stone = grid[row]?.[col] ?? 0
      if (!stone) continue
      for (const [dr, dc] of DIRS) {
        let count = 1
        while (grid[row + dr * count]?.[col + dc * count] === stone) count += 1
        if (count >= 5) return stone
      }
    }
  }
  return 0
}

function lineScore(grid: Grid, row: number, col: number, stone: Stone): number {
  let total = 0
  for (const [dr, dc] of DIRS) {
    let count = 1
    let open = 0
    for (const sign of [1, -1]) {
      let step = 1
      while (grid[row + dr * sign * step]?.[col + dc * sign * step] === stone) {
        count += 1
        step += 1
      }
      if ((grid[row + dr * sign * step]?.[col + dc * sign * step] ?? 1) === 0) open += 1
    }
    if (count >= 5) total += 100000
    else if (count === 4 && open === 2) total += 10000
    else if (count === 4 && open === 1) total += 2200
    else if (count === 3 && open === 2) total += 500
    else if (count === 3 && open === 1) total += 80
    else if (count === 2 && open === 2) total += 24
  }
  return total
}

export function aiMove(grid: Grid, stone: Stone): [number, number] | null {
  const foe: Stone = stone === 1 ? 2 : 1
  let best: [number, number] | null = null
  let bestScore = -1
  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < grid.length; col += 1) {
      if (grid[row]?.[col]) continue
      const attack = lineScore(grid, row, col, stone)
      const defend = lineScore(grid, row, col, foe)
      const score = Math.max(attack, defend * 0.96) + attack * 0.02
      if (score > bestScore) {
        bestScore = score
        best = [row, col]
      }
    }
  }
  return best
}
