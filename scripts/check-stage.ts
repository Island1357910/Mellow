import assert from 'node:assert/strict'
import { STAGE_KINDS } from '../src/data/stageKinds.ts'
import { readStageBriefText, stageRoleNote } from '../src/lib/stage.ts'

const aus = ['哨向', 'ABO', '花吐症', '直播体', '学院pa', 'HP AU', '网黄&金主', '炮友转正', '先婚后爱', '史密斯夫妇', '论坛体', '末日pa', '公路文学']
for (const name of aus) {
  assert.equal(STAGE_KINDS.filter((item) => item.category === '世界AU' && item.name === name).length, 1, name)
}

const person = (name: string, tags: string[], description = '', personality = '') => ({
  name, tags, description, personality, creatorNotes: '',
})
assert.match(stageRoleNote(person('甲', ['攻'])), /是上位/)
assert.match(stageRoleNote(person('乙', ['受'], '他很难受')), /是下位/)
assert.match(stageRoleNote(person('丙', [], '他很难受，但是接受了这次进攻')), /没有写上下位/)
assert.match(stageRoleNote(person('丁', ['互攻'])), /不要对调/)
assert.match(stageRoleNote(person('戊', [], '定位：攻')), /是上位/)
assert.match(stageRoleNote(person('己', [], '定位：受')), /是下位/)
assert.match(stageRoleNote(person('庚', ['1'])), /是上位/)
assert.doesNotMatch(stageRoleNote(person('庚', ['1'])), /是下位/)
assert.match(stageRoleNote(person('辛', ['0'])), /下位/)

const jsonBrief = readStageBriefText('{"title":"雨夜","blurb":"共处一晚","body":"保持原来的性格。不要把上下位对调。场景只换外壳。"}')
assert.equal(jsonBrief?.title, '雨夜')
assert.match(jsonBrief?.body ?? '', /不要把上下位对调/)
const prose = readStageBriefText('雨夜共处\n保持原来的性格，不要把人写成相反的样子，上下位也不要对调。')
assert.equal(prose?.title, '雨夜共处')
assert.match(prose?.body ?? '', /上下位也不要对调/)
assert.equal(readStageBriefText(''), null)
assert.equal(readStageBriefText('太短'), null)

console.log('stage checks passed')
