export const PETAL_DURATION = 30_000
export const PETAL_TARGET = 120
export const PETAL_DROPS = [
  { name: '普通花', icon: '🌸', points: 5 },
  { name: '精品花', icon: '🌹', points: 15 },
  { name: '贵重花', icon: '💐', points: 30 },
  { name: '垃圾', icon: '🗑️', points: -20 },
] as const

export type PetalDrop = { id: number; x: number; y: number; speed: number; kind: number }

/** Only a crossing of the basket mouth can score; clicking a falling item cannot. */
export function advancePetalDrops(drops: PetalDrop[], dt: number, basket: number, width: number) {
  let score = 0, caught = 0, trash = 0, flash = ''
  const remaining = drops.flatMap(drop => {
    const next = { ...drop, y: drop.y + drop.speed * dt }
    if (drop.y < 262 && next.y >= 262 && Math.abs(drop.x - basket) * width / 100 <= 34) {
      const item = PETAL_DROPS[drop.kind]!
      score += item.points
      if (item.points < 0) trash++
      else caught++
      flash = `${item.name} ${item.points > 0 ? '+' : ''}${item.points}`
      return []
    }
    return next.y < 330 ? [next] : []
  })
  return { drops: remaining, score, caught, trash, flash }
}
