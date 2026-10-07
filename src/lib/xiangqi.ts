export type Board = Array<Array<string | null>>
export interface Step { r: number; c: number; tr: number; tc: number }

const VALUE: Record<string, number> = { k: 10000, r: 90, c: 45, n: 40, b: 20, a: 20, p: 10 }
const ORTHO: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]]

export const PIECE_NAME: Record<string, string> = {
  K: '帅', k: '将', R: '车', r: '车', N: '马', n: '马', B: '相', b: '象', A: '仕', a: '士', C: '炮', c: '炮', P: '兵', p: '卒',
}

function isRed(piece: string): boolean {
  return piece === piece.toUpperCase()
}

function inside(row: number, col: number): boolean {
  return row >= 0 && row < 10 && col >= 0 && col < 9
}

function palace(row: number, col: number, red: boolean): boolean {
  if (col < 3 || col > 5) return false
  return red ? row >= 7 && row <= 9 : row >= 0 && row <= 2
}

function crossed(row: number, red: boolean): boolean {
  return red ? row <= 4 : row >= 5
}

function findKing(board: Board, piece: string): [number, number] | null {
  for (let row = 0; row < 10; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      if (board[row]?.[col] === piece) return [row, col]
    }
  }
  return null
}

function kingsFace(board: Board): boolean {
  const redKing = findKing(board, 'K')
  const blackKing = findKing(board, 'k')
  if (!redKing || !blackKing || redKing[1] !== blackKing[1]) return false
  const file = redKing[1]
  const top = Math.min(redKing[0], blackKing[0])
  const bottom = Math.max(redKing[0], blackKing[0])
  for (let row = top + 1; row < bottom; row += 1) {
    if (board[row]?.[file]) return false
  }
  return true
}

function enemy(block: string, piece: string): boolean {
  return isRed(block) !== isRed(piece)
}

function rawTargets(board: Board, row: number, col: number): Array<[number, number]> {
  const piece = board[row]?.[col]
  if (!piece) return []
  const red = isRed(piece)
  const kind = piece.toLowerCase()
  const out: Array<[number, number]> = []
  const push = (tr: number, tc: number) => {
    if (!inside(tr, tc)) return
    const target = board[tr]?.[tc]
    if (target && !enemy(target, piece)) return
    out.push([tr, tc])
  }
  if (kind === 'k') {
    for (const [dr, dc] of ORTHO) {
      const tr = row + dr
      const tc = col + dc
      if (palace(tr, tc, red)) push(tr, tc)
    }
  } else if (kind === 'a') {
    for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as Array<[number, number]>) {
      const tr = row + dr
      const tc = col + dc
      if (palace(tr, tc, red)) push(tr, tc)
    }
  } else if (kind === 'b') {
    for (const [dr, dc] of [[2, 2], [2, -2], [-2, 2], [-2, -2]] as Array<[number, number]>) {
      const tr = row + dr
      const tc = col + dc
      const eye = board[row + dr / 2]?.[col + dc / 2]
      if (!inside(tr, tc) || crossed(tr, red) || eye) continue
      push(tr, tc)
    }
  } else if (kind === 'n') {
    const legs: Array<[number, number, number, number]> = [
      [1, 2, 0, 1], [1, -2, 0, -1], [-1, 2, 0, 1], [-1, -2, 0, -1],
      [2, 1, 1, 0], [2, -1, 1, 0], [-2, 1, -1, 0], [-2, -1, -1, 0],
    ]
    for (const [dr, dc, lr, lc] of legs) {
      if (board[row + lr]?.[col + lc]) continue
      push(row + dr, col + dc)
    }
  } else if (kind === 'r' || kind === 'c') {
    for (const [dr, dc] of ORTHO) {
      let tr = row + dr
      let tc = col + dc
      let seen = 0
      while (inside(tr, tc)) {
        const block = board[tr]?.[tc]
        if (kind === 'r') {
          if (!block) out.push([tr, tc])
          else {
            if (enemy(block, piece)) out.push([tr, tc])
            break
          }
        } else if (!block) {
          if (seen === 0) out.push([tr, tc])
        } else {
          seen += 1
          if (seen === 2) {
            if (enemy(block, piece)) out.push([tr, tc])
            break
          }
        }
        tr += dr
        tc += dc
      }
    }
  } else if (kind === 'p') {
    push(row + (red ? -1 : 1), col)
    if (crossed(row, red)) {
      push(row, col + 1)
      push(row, col - 1)
    }
  }
  return out
}

export function setupBoard(): Board {
  const board: Board = Array.from({ length: 10 }, () => Array<string | null>(9).fill(null))
  const back = ['R', 'N', 'B', 'A', 'K', 'A', 'B', 'N', 'R']
  back.forEach((piece, col) => {
    const top = board[0]
    const bottom = board[9]
    if (top) top[col] = piece.toLowerCase()
    if (bottom) bottom[col] = piece
  })
  const cannonsTop = board[2]
  const cannonsBottom = board[7]
  const pawnsTop = board[3]
  const pawnsBottom = board[6]
  if (cannonsTop) {
    cannonsTop[1] = 'c'
    cannonsTop[7] = 'c'
  }
  if (cannonsBottom) {
    cannonsBottom[1] = 'C'
    cannonsBottom[7] = 'C'
  }
  for (const col of [0, 2, 4, 6, 8]) {
    if (pawnsTop) pawnsTop[col] = 'p'
    if (pawnsBottom) pawnsBottom[col] = 'P'
  }
  return board
}

export function applyMove(board: Board, row: number, col: number, tr: number, tc: number): Board {
  const next = board.map((line) => line.slice())
  const from = next[row]
  const to = next[tr]
  if (from && to) {
    to[tc] = from[col] ?? null
    from[col] = null
  }
  return next
}

function inCheck(board: Board, red: boolean): boolean {
  const king = findKing(board, red ? 'K' : 'k')
  if (!king) return true
  for (let row = 0; row < 10; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const piece = board[row]?.[col]
      if (!piece || isRed(piece) === red) continue
      if (rawTargets(board, row, col).some(([tr, tc]) => tr === king[0] && tc === king[1])) return true
    }
  }
  return false
}

export function legalMoves(board: Board, row: number, col: number): Array<[number, number]> {
  const piece = board[row]?.[col]
  if (!piece) return []
  const red = isRed(piece)
  return rawTargets(board, row, col).filter(([tr, tc]) => {
    const next = applyMove(board, row, col, tr, tc)
    return !kingsFace(next) && !inCheck(next, red)
  })
}

export function allMoves(board: Board, red: boolean): Step[] {
  const list: Step[] = []
  for (let row = 0; row < 10; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const piece = board[row]?.[col]
      if (!piece || isRed(piece) !== red) continue
      for (const [tr, tc] of legalMoves(board, row, col)) list.push({ r: row, c: col, tr, tc })
    }
  }
  return list
}

export function winnerOf(board: Board): 'red' | 'black' | null {
  if (!findKing(board, 'K')) return 'black'
  if (!findKing(board, 'k')) return 'red'
  return null
}

export function aiMove(board: Board, red: boolean): Step | null {
  const moves = allMoves(board, red)
  if (!moves.length) return null
  let best = moves[0]
  let bestScore = -Infinity
  if (!best) return null
  for (const move of moves) {
    const next = applyMove(board, move.r, move.c, move.tr, move.tc)
    let score = 0
    for (const line of next) {
      for (const piece of line) {
        if (!piece) continue
        const value = VALUE[piece.toLowerCase()] ?? 0
        score += isRed(piece) === red ? value : -value
      }
    }
    score += Math.random() * 6
    if (score > bestScore) {
      bestScore = score
      best = move
    }
  }
  return best
}
