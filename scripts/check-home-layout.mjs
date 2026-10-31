import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

// Run with PLAYWRIGHT_PACKAGE set to a locally installed Playwright package.
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright')
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage()
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:5175/')
  await page.waitForFunction(async () => (await import('/src/store/useMellow.ts')).useMellow.getState().ready)
  await page.waitForTimeout(500)
  const result = await page.evaluate(async () => {
    const { homePages, homeApps, PHONE_APPS } = await import('/src/data/apps.ts')
    const { useMellow } = await import('/src/store/useMellow.ts')
    const all = PHONE_APPS.map(app => app.id)
    const cases = [[], ['connections'], ['connections', 'create', 'forum', 'jiushi'], all]
    const counts = cases.map(installed => {
      const { page2, page3 } = homePages(installed)
      const expected = homeApps(installed).map(app => app.id).sort()
      if (JSON.stringify([...page2, ...page3].map(app => app.id).sort()) !== JSON.stringify(expected)) throw Error('An app was lost or duplicated')
      if (page2.length !== Math.min(12, expected.length)) throw Error('Second page has unused slots')
      return [page2.length, page3.length]
    })
    const state = useMellow.getState()
    useMellow.setState({ locked: false, settings: { ...state.settings, installedApps: all, backup: { ...state.settings.backup, enabled: false } } })
    return counts
  })
  for (const [width, height] of [[320, 568], [360, 640], [390, 844], [412, 915]]) {
    await page.setViewportSize({ width, height })
    await page.getByRole('button', { name: '第 2 页', exact: true }).click()
    await page.waitForTimeout(400)
    const bounds = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('.home-page:nth-child(2) .launcher-board .app-launch')].map(el => el.getBoundingClientRect())
      const search = document.querySelector('input[placeholder="搜索或输入网址"]').closest('form').getBoundingClientRect()
      return { count: buttons.length, rows: [...new Set(buttons.map(box => Math.round(box.top)))], bottom: Math.max(...buttons.map(box => box.bottom)), searchTop: search.top, minX: Math.min(...buttons.map(box => box.left)), maxX: Math.max(...buttons.map(box => box.right)) }
    })
    assert.equal(bounds.count, 12)
    assert.equal(bounds.rows.length, 3, 'Second page must have three icon rows')
    assert.ok(bounds.bottom < bounds.searchTop, JSON.stringify({ width, height, ...bounds }))
    assert.ok(bounds.minX >= 0 && bounds.maxX <= width)
    console.log(JSON.stringify({ width, height, ...bounds }))
    if (width === 390) await page.screenshot({ path: 'artifacts/home-three-rows-1.0.6.png' })
  }
  console.log('Home pagination and mobile layout verified:', JSON.stringify(result))
} finally { await browser.close() }
