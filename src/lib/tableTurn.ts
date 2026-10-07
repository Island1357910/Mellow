export function nextSeat(current: number, count: number, step = 1): number {
  if (count <= 0) return 0
  return ((current + step) % count + count) % count
}

export function shuffle<T>(list: T[]): T[] {
  const next = list.slice()
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    const left = next[index]
    const right = next[swap]
    if (left !== undefined && right !== undefined) {
      next[index] = right
      next[swap] = left
    }
  }
  return next
}

export function pickAt<T>(list: T[]): T | undefined {
  if (!list.length) return undefined
  return list[Math.floor(Math.random() * list.length)]
}
