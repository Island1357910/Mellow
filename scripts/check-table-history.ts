import assert from 'node:assert/strict'
import { storage } from '../src/storage/StorageService.ts'
import { MetaDB } from '../src/storage/db.ts'
import { BUNDLED_THEMES, canDeleteTheme } from '../src/theme/themes.ts'
import { APPLE_THEME } from '../src/theme/apple.ts'
import { defaultSettings, normalizeSettings } from '../src/lib/defaults.ts'
import { appendTableHistory, listTableHistory, readTableHistory, parseTableSpeech, tableEntry, type TableSummary } from '../src/lib/tableHistory.ts'
import { gomokuSituation, unoSituation, xiangqiSituation } from '../src/lib/tableSituation.ts'
import { emptyGrid } from '../src/lib/gomoku.ts'
import { freshMatch } from '../src/lib/uno.ts'
import { setupBoard } from '../src/lib/xiangqi.ts'

const boot = await storage.boot()
for (const theme of [...BUNDLED_THEMES, APPLE_THEME]) {
  assert.equal(canDeleteTheme(theme.id), false)
  await assert.rejects(storage.deleteTheme(theme.id), /预设/)
}
const custom = { ...BUNDLED_THEMES[0]!, id: 'theme_user_collection_test', name: '可删除主题' }
await storage.saveTheme(custom)
await storage.saveSettings({ ...boot.settings, themeId: custom.id })
await storage.deleteTheme(custom.id)
assert.equal((await storage.getSettings()).themeId, 'theme_macaron')
assert.equal((await storage.listThemes()).some(theme => theme.id === custom.id), false)
assert.equal((await storage.listThemes()).filter(theme => BUNDLED_THEMES.some(item => item.id === theme.id)).length, BUNDLED_THEMES.length)
assert.deepEqual(normalizeSettings({ ...defaultSettings(), iconSets: undefined }).iconSets, [])
const icons = { sms: '🌸', table: '♟' }
await storage.saveSettings({ ...await storage.getSettings(), appIcons: icons, iconSets: [{ id: 'set_test', name: '春日', icons }] })
const reopened = new MetaDB(); await reopened.open()
assert.equal((await reopened.settings.get('global'))?.iconSets[0]?.icons.sms, '🌸')
await storage.saveSettings({ ...await storage.getSettings(), iconSets: [] })
assert.deepEqual((await storage.getSettings()).appIcons, icons, 'deleting an icon set leaves current icons intact')
reopened.close()

const namespace = boot.identities[0]!.namespace
const session: TableSummary = { id: 'history_test', game: '五子棋', names: ['小夏', '林澄'], startedAt: Date.now() }
const entries = Array.from({ length: 80 }, (_, i) => tableEntry(i % 2 ? 'speech' : 'event', '步骤'+i, i % 2 ? '林澄' : undefined))
await Promise.all(entries.map(entry => appendTableHistory(namespace, session, [entry])))
await appendTableHistory(namespace, session, [entries[0]!], '林澄获胜')
const record = await readTableHistory(namespace, session.id)
assert.equal(record?.entries.length, 80, 'full match is retained beyond prompt/UI windows with no duplicate retry entries')
assert.equal(record?.result, '林澄获胜')
assert.equal((await listTableHistory(namespace)).length, 1)
assert.equal((await listTableHistory(namespace + '_other')).length, 0, 'identities have separate history')
await appendTableHistory(namespace, session, [tableEntry('event', '再来一局')], '')
assert.equal((await readTableHistory(namespace, session.id))?.endedAt, undefined)
assert.deepEqual(parseTableSpeech('[{"speaker":"林澄","text":"（笑）你赢啦！*鼓掌*"},{"speaker":"小夏","text":"替玩家说话"}]', ['林澄']), [{ speaker: '林澄', text: '你赢啦！' }])
assert.deepEqual(parseTableSpeech('林澄：他笑着说：“我还得认真一点。”\n旁白：一阵风吹过', ['林澄']), [{ speaker: '林澄', text: '我还得认真一点。' }])
const grid = emptyGrid(); grid[7]![3] = grid[7]![4] = grid[7]![5] = grid[7]![6] = 1
const before = JSON.stringify(grid), situation = gomokuSituation(grid, session.names)
assert.match(situation, /玩家小夏（黑子1）下一手可直接连五的位置：8行3列、8行8列/)
assert.match(situation, /角色林澄（白子2）下一手可直接连五的位置：无/)
assert.equal(JSON.stringify(grid), before, 'evaluation never changes real board')
grid[7]![7] = 1
assert.match(gomokuSituation(grid, session.names), /玩家小夏（黑子1）获胜，角色林澄（白子2）落败/)
const uno = freshMatch(session.names); uno.hands[1] = uno.hands[1]!.slice(0,1)
assert.match(unoSituation(uno), /角色林澄剩1张/)
assert.match(xiangqiSituation(setupBoard(), session.names), /玩家小夏执红方，角色林澄执黑方/)
console.log('主题保护与删除、图标套装持久化、对局完整历史与身份隔离、话语过滤和双方局势归属检查通过')
process.exit(0)
