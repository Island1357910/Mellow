import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright')
const apiHost = 'mellow-account-kkcpvjjpdj.cn-hangzhou.fcapp.run'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const endpoints = []
  let preflight = false
  const network = await page.context().newCDPSession(page)
  await network.send('Network.enable')
  network.on('Network.requestWillBeSent', event => {
    const request = event.request
    if (request.url.startsWith('https://' + apiHost) && request.method === 'OPTIONS') preflight = true
  })
  page.on('request', request => { if (request.url().includes('/api/account')) endpoints.push(new URL(request.url()).hostname) })
  await page.goto('https://mymellow.top/?verify=aliyun-login', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '上滑解锁', exact: true }).click()
  await page.getByRole('button', { name: '第 2 页', exact: true }).click()
  await page.getByRole('button', { name: '市场', exact: true }).click()
  await page.getByLabel('搜索市场应用', { exact: true }).fill('外部连接')
  await page.getByRole('button', { name: '装上', exact: true }).click()
  await page.getByRole('button', { name: '已装上', exact: true }).last().waitFor()
  await page.getByRole('button', { name: '返回', exact: true }).click()
  await page.getByRole('button', { name: '外部连接', exact: true }).click()
  await page.getByRole('button', { name: '生成网易云登录二维码', exact: true }).click()
  const qr = page.getByRole('img', { name: '网易云登录二维码，请截图后在网易云扫一扫中识别', exact: true })
  await qr.waitFor({ timeout: 45000 })
  assert.ok((await qr.getAttribute('src')).startsWith('data:image/'))
  assert.ok(endpoints.includes(apiHost))
  assert.ok(endpoints.every(host => host === apiHost), 'Account flow must only use the new Alibaba endpoint')
  await page.getByRole('button', { name: '我已确认，检查登录', exact: true }).click()
  await page.getByText('等待你在网易云 App 中扫码 / 从相册识别', { exact: true }).waitFor({ timeout: 45000 })
  await page.screenshot({ path: 'artifacts/web-aliyun-qr-verified.png' })
  await page.getByRole('button', { name: '取消', exact: true }).click()
  await page.getByText('已取消登录', { exact: true }).waitFor()
  console.log(JSON.stringify({ liveWebQr: true, qrCheck: 'waiting', actualEndpoint: apiHost, browserPreflightObserved: preflight, noOldAccountHost: true, realAccountAuthorization: 'requires user scan', userPhoneNoVpn: 'requires user verification' }))
} finally { await browser.close() }
