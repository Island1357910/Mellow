import assert from 'node:assert/strict'
import { createTableReactions, type TableMoment } from '../src/lib/tableReactions.ts'
import { commitNumber } from '../src/lib/numericDraft.ts'

assert.equal(commitNumber('', 30, 1, 1440), 30, 'empty input restores previous value only on commit')
assert.equal(commitNumber('65', 30, 1, 1440), 65)
assert.equal(commitNumber('0', 30, 1, 1440), 1)
assert.equal(commitNumber('9999', 30, 1, 1440), 1440)
assert.equal(commitNumber('0', 10, 0, 64), 0, 'zero stays valid for settings that allow zero')
assert.equal(commitNumber('1e', 30, 1, 1440), 30)
assert.equal(commitNumber('Infinity', 30, 1, 1440), 30)
assert.equal(commitNumber('50000', 1000, 50), 50000, 'offline word counts have no artificial maximum')

const tick = () => new Promise<void>(resolve => setImmediate(resolve))
let complete!: (answer: string) => void
const calls: TableMoment[][] = [], output: string[][] = []
let inflight = 0, maxInflight = 0, statuses = 0
const queue = createTableReactions({
  answer: events => {
    calls.push(events); inflight++; maxInflight = Math.max(maxInflight, inflight)
    return new Promise<string>(resolve => { complete = answer => { inflight--; resolve(answer) } })
  },
  onLines: lines => output.push(lines), onBusy: () => { statuses++ }, onError: () => {},
})
queue.push({ text: '开局入座' })
assert.equal(calls.length, 1, 'opening starts without player speech')
queue.push({ text: '公开落子' })
queue.push({ text: '本局结束', finished: true })
assert.equal(calls.length, 1, 'events wait while the role is speaking')
complete('角色：我来陪你下。'); await tick()
assert.equal(calls.length, 2)
assert.deepEqual(calls[1]?.map(e => e.text), ['公开落子', '本局结束'])
complete('角色：这局你赢了。'); await tick()
assert.equal(maxInflight, 1)
assert.match(output.at(-1)!.join('\n'), /本局结束/)
queue.push({ text: '新一轮', roundStart: true })
const count = output.length, statusCount = statuses
queue.dispose(); complete('不应写回已退出的对局'); await tick()
assert.equal(output.length, count)
assert.equal(statuses, statusCount, 'disposed sessions do not update React state')
queue.push({ text: '已经退出' }); assert.equal(calls.length, 3)

let fail = true, error = '', latest: TableMoment[] = []
const retry = createTableReactions({
  answer: async events => { latest = events; if (fail) throw Error('测试断线'); return '已恢复' },
  onLines: () => {}, onBusy: () => {}, onError: message => { error = message },
})
retry.push({ text: '未回答的事件' }); await tick(); assert.equal(error, '测试断线')
fail = false; retry.retry(); await tick()
assert.equal(error, ''); assert.equal(latest[0]?.text, '未回答的事件')
fail = true; retry.push({ text: '另一次断线' }); await tick()
fail = false; retry.push({ text: '后续局势' }); await tick()
assert.deepEqual(latest.map(e => e.text), ['另一次断线', '后续局势'], 'new events also recover unanswered context')
retry.dispose()
let emptyError = ''
const empty = createTableReactions({
  answer: async () => '', onLines: () => assert.fail('empty replies must not look successful'),
  onBusy: () => {}, onError: message => { emptyError = message },
})
empty.push({ text: '开局' }); await tick()
assert.match(emptyError, /没有返回内容/)
empty.dispose()
console.log('数字提交、自动互动排队、失败恢复和退出隔离检查通过')
