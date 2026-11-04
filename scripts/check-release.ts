import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { HALLOWEEN_CODE_START,HALLOWEEN_CODE_END,APPLE_CODE_START,APPLE_CODE_END,codeReward,redeemCode,WINTER_CODE_END,type RedeemState } from '../src/lib/redeem.ts'
import { storage } from '../src/storage/StorageService.ts'
import { readCoins } from '../src/lib/wallet.ts'
import { WINTER_GIFTS } from '../src/theme/winter.ts'
import { claimAccountReward, restoreRedeemTheme } from '../src/lib/redeem.ts'
import { APPLE_THEME } from '../src/theme/apple.ts'
import { themeFromUnknown,BUNDLED_THEMES } from '../src/theme/themes.ts'
import { themeStyle } from '../src/theme/applyTheme.ts'
import { FORUM_BOARDS,normalizeForumThreads } from '../src/lib/forumAi.ts'
assert.throws(()=>codeReward('半糖Mellow',APPLE_CODE_START-1),/开放/)
assert.equal(codeReward('半糖Mellow',APPLE_CODE_START).coins,3000)
assert.equal(codeReward('半糖Mellow',APPLE_CODE_END-1).themeId,APPLE_THEME.id)
assert.throws(()=>codeReward('半糖Mellow',APPLE_CODE_END),/到期/)
assert.throws(()=>codeReward('和你一起的万圣节',HALLOWEEN_CODE_START-1),/开放/)
assert.equal(codeReward('和你一起的万圣节',HALLOWEEN_CODE_START).coins,2000)
assert.equal(codeReward('和你一起的万圣节',HALLOWEEN_CODE_END-1).coins,2000)
assert.throws(()=>codeReward('和你一起的万圣节',HALLOWEEN_CODE_END),/到期/)
assert.equal(HALLOWEEN_CODE_END-HALLOWEEN_CODE_START,3*24*60*60*1000)
assert.throws(()=>codeReward('bad-code',APPLE_CODE_START),/不存在/)
const ns='regression_redeem'
await storage.setBag(ns,'coins',20)
await assert.rejects(()=>redeemCode(ns,'半糖Mellow',APPLE_CODE_START-1))
assert.equal(await readCoins(ns),20)
const results=await Promise.allSettled(Array.from({length:10},()=>redeemCode(ns,'半糖Mellow',APPLE_CODE_START)))
assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
assert.equal(await readCoins(ns),3020)
await redeemCode(ns,'和你一起的万圣节',APPLE_CODE_START)
assert.equal(await readCoins(ns),5020)
await assert.rejects(()=>redeemCode(ns,'和你一起的万圣节',APPLE_CODE_START))
const record=await storage.getBag<RedeemState>(ns,'redeem_codes_v1')
assert.equal(Object.keys(record!.claims).length,2)
assert.deepEqual(themeFromUnknown(APPLE_THEME)?.logo,APPLE_THEME.logo)
const style=themeStyle(APPLE_THEME) as Record<string,string>
assert.equal(style['--m-logo-primary'],'#B82E43')
assert.equal((themeStyle(BUNDLED_THEMES.find(t=>t.id==='theme_halloween')!) as Record<string,string>)['--m-logo-primary'],'#E3A667')
assert.equal((themeStyle(BUNDLED_THEMES.find(t=>t.id==='theme_macaron')!) as Record<string,string>)['--m-logo-primary'],'#FFB5C5')
for(const board of FORUM_BOARDS){const post=normalizeForumThreads([{id:board,title:'测试',board,author:'测试',text:'长文'.repeat(4000),replies:[]}])[0]!;assert.equal(post.board,board);assert.equal(post.text.length,8000)}
const newIdentityBalance = await readCoins('winter-new-identity')
for (const gift of WINTER_GIFTS) {
  assert.equal(codeReward(gift.code, WINTER_CODE_END - 1).coins, 2000)
  assert.throws(() => codeReward(gift.code, WINTER_CODE_END), /到期/)
  assert.throws(() => codeReward(gift.code, WINTER_CODE_END + 1), /到期/)
  assert.equal(codeReward(gift.code, APPLE_CODE_END).coins, 2000)
  assert.equal(codeReward(gift.code, APPLE_CODE_END).themeId, gift.theme.id)
  const before = await readCoins(ns)
  const claims = await Promise.allSettled(Array.from({ length: 5 }, () => redeemCode(ns, gift.code, APPLE_CODE_END)))
  assert.equal(claims.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(await readCoins(ns), before + 2000)
  assert((await storage.listThemes()).some(theme => theme.id === gift.theme.id))
  await claimAccountReward('winter-new-identity', gift.id)
  await assert.rejects(() => claimAccountReward('winter-new-identity', gift.id), /已经领取/)
  await restoreRedeemTheme('winter-new-identity')
  assert.deepEqual(themeFromUnknown(gift.theme)?.colors, gift.theme.colors)
}
assert.equal(await readCoins('winter-new-identity'), newIdentityBalance + 4000)
console.log('release regression ok: exact redemption windows, repeat-claim exclusion, atomic currency rewards, apple theme/logo roundtrip, all forum boards and long-form preservation')
