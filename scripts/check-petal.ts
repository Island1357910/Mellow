import assert from 'node:assert/strict'
import { advancePetalDrops, PETAL_DROPS, PETAL_DURATION, PETAL_TARGET, type PetalDrop } from '../src/domain/petalGame.ts'

const drop = (kind = 0, x = 50, y = 260): PetalDrop => ({ id: kind, kind, x, y, speed: 100 })
assert.equal(PETAL_DURATION, 30_000)
assert.equal(PETAL_TARGET, 120)
assert.deepEqual(PETAL_DROPS.map(item => item.points), [5, 15, 30, -20])
for (let kind = 0; kind < 4; kind++) {
  const result = advancePetalDrops([drop(kind)], .05, 50, 300)
  assert.equal(result.score, PETAL_DROPS[kind]!.points)
  assert.equal(result.caught, kind === 3 ? 0 : 1)
  assert.equal(result.trash, kind === 3 ? 1 : 0)
  assert.equal(result.drops.length, 0)
  assert.equal(advancePetalDrops(result.drops, .05, 50, 300).score, 0, 'a catch must not score twice')
}
const high = advancePetalDrops([drop(0, 50, 100)], .05, 50, 300)
assert.equal(high.score, 0, 'flowers above the basket cannot score')
const miss = advancePetalDrops([drop(0, 90)], .05, 50, 300)
assert.equal(miss.score, 0)
assert.equal(advancePetalDrops(miss.drops, .05, 90, 300).score, 0, 'moving under a flower after it passed the basket is too late')
assert.equal(advancePetalDrops([drop(0, 90, 329)], .05, 50, 300).drops.length, 0)
assert.equal(advancePetalDrops([drop(0, 60)], .05, 50, 300).score, 5)
assert.equal(advancePetalDrops([drop(0, 60)], .05, 50, 700).score, 0, 'collision uses actual arena width')
const mixed = advancePetalDrops([drop(2), drop(3)], .05, 50, 300)
assert.equal(mixed.score, 10)
assert.equal(mixed.caught, 1)
assert.equal(mixed.trash, 1)
console.log('Petal checks passed: bottom crossing, four scores, trash deductions, misses, single scoring and responsive collision')
