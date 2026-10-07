import { readFileSync } from 'node:fs'
import { OFFICIAL_PRESETS } from '../src/data/officialPresets.ts'
import { canEnterScene, enterScene, leaveScene } from '../src/engine/spaceRules.ts'
import { parseCharacterCard } from '../src/lib/sillytavern.ts'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

const empty = { id: 'current' as const, currentScene: null, remoteChats: [] as string[], history: [] }
const opened = enterScene(empty, 'a', 'home')
assert(opened.gate.ok && opened.state.currentScene?.present.join() === 'a', '应该能约到家里')
const merged = enterScene(opened.state, 'b', 'home')
assert(merged.gate.reason === 'will_merge' && merged.state.currentScene?.present.length === 2, '同地可以合并')
const blocked = canEnterScene(merged.state, 'c', 'cafe')
assert(blocked.ok === false && blocked.reason === 'location_conflict', '不能同时在两个地方')
const oneLeft = leaveScene(merged.state, 'a')
assert(oneLeft.currentScene?.present.join() === 'b', '离开后还剩一个人')
const ended = leaveScene(oneLeft, 'b')
assert(ended.currentScene === null && ended.history.length === 1, '最后一个人离开就结束场景')

const sample = JSON.parse(readFileSync(new URL('../public/samples/xiaoman.json', import.meta.url), 'utf8')) as unknown
const card = parseCharacterCard(sample)
assert(card.name === '小满' && card.firstMes.includes('到家了吗'), '示例角色卡可读')
assert(OFFICIAL_PRESETS.length === 8, '官方预设应该是 8 个')
console.log('space and sample ok')
