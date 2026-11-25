import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import type { HttpOptions } from '@capacitor/core'
import type { PhoneItem } from '../src/lib/phoneAlbum.ts'
import type { Character } from '../src/types/index.ts'

let nativeRequest: (options: HttpOptions) => Promise<unknown>
Object.assign(globalThis, { Capacitor: {
  PluginHeaders: [{ name: 'CapacitorHttp', methods: [{ name: 'request', rtype: 'promise' }] }],
  nativePromise: (_name: string, _method: string, options: HttpOptions) => nativeRequest(options),
} })
const { Capacitor } = await import('@capacitor/core')
const { generatePhoneAlbum } = await import('../src/lib/phoneAlbum.ts')
const { storage } = await import('../src/storage/StorageService.ts')
const { addLiveSmsFriend } = await import('../src/domain/liveContact.ts')
const { isImageAvatar } = await import('../src/lib/avatar.ts')
const { listSaves } = await import('../src/engine/story.ts')
const { buildImagePrompt, generateImage, imageEndpoint, listImageModels, saveImageApi } = await import('../src/lib/imageApi.ts')
const { resolveImportJson } = await import('../src/lib/cardTextImport.ts')
const { importChatBackground } = await import('../src/lib/wallpaper.ts')
const { appImageDirection, attachAppImage, canGenerateAppImages, setAppImagesEnabled, smsImageDirection, takeSmsImage } = await import('../src/lib/appImages.ts')
const wrongPicture = 'anime | 古风女子手捧一盏灯'
const absSelfie = appImageDirection('messages', smsImageDirection(wrongPicture, '发张你的腹肌照给我看看', '性别：男'))
assert.equal(absSelfie.style, 'realistic')
assert.match(absSelfie.prompt, /male sender.*abdominal muscles/)
assert.doesNotMatch(absSelfie.prompt, /古风女子/)
assert.equal(smsImageDirection('', '想看看你的腹肌照', '性别：男'), '')
assert.equal(smsImageDirection(wrongPicture, '画一张古风插画，要画出腹肌', ''), wrongPicture)
const chest = appImageDirection('messages', smsImageDirection(wrongPicture, '发张胸肌照给我', '性别：男'))
assert.equal(chest.style, 'realistic')
assert.match(chest.prompt, /male sender.*pectoral muscles/)
assert.doesNotMatch(chest.prompt, /古风女子/)
const face = appImageDirection('messages', smsImageDirection('anime | 路人插画', '来张你的素颜自拍', '性别：女'))
assert.equal(face.style, 'realistic')
assert.match(face.prompt, /female sender.*face/)
const fullBody = appImageDirection('messages', smsImageDirection(wrongPicture, '发一张你的全身照', '性别：男，黑发'))
assert.match(fullBody.prompt, /full body/)
assert.match(fullBody.prompt, /黑发/)
assert.match(fullBody.prompt, /not a middle-aged uncle/)
const girl = smsImageDirection('selfie | 随便', '发一张你的自拍', '性别：女，17岁，黑色长发，棕色圆眼')
assert.match(girl, /female sender/)
assert.match(girl, /17岁/)
assert.match(girl, /黑色长发/)
assert.match(girl, /棕色圆眼/)
assert.match(girl, /no beard/)
assert.doesNotMatch(girl, /\bmale\b/)
const uncle = smsImageDirection('selfie | 随便', '发一张你的自拍', '性别：男，45岁，络腮胡')
assert.match(uncle, /45岁/)
assert.doesNotMatch(uncle, /no beard/)
assert.doesNotMatch(uncle, /young man/)
const asked = smsImageDirection('selfie | 随便', '发张你留胡子的照片', '性别：男，20岁，黑发')
assert.match(asked, /黑发/)
assert.doesNotMatch(asked, /no beard/)
const prior = smsImageDirection('selfie | 随便', '发一张你的自拍', '性别：女，黑发', '女性，黑发')
assert.match(prior, /女性，黑发/)
assert.match(prior, /female sender/)
assert.equal(smsImageDirection('watercolor | 今晚的面', '拍张你今晚吃的面', '性别：男'), 'watercolor | 今晚的面')
assert.equal(imageEndpoint('https://example.test/v1/models?sub_type=text-to-image#section'), 'https://example.test/v1/images/generations')
assert.equal(imageEndpoint('https://api.siliconflow.cn/v1?foo=1'), 'https://api.siliconflow.cn/v1/images/generations')
assert.throws(() => imageEndpoint('http://example.test/v1'), /HTTPS/)
assert.throws(() => imageEndpoint('https://user:secret@example.test/v1'), /密钥/)
assert.throws(() => imageEndpoint('https://example.test/v1?api_key=sk-test'), /密钥/)

await saveImageApi('https://example.test/v1', 'image-test', 'test-key')
const controller = new AbortController()
const encoded = '/9j/2Q=='
const originalFetch = globalThis.fetch
const isNative = Capacitor.isNativePlatform
assert.equal(buildImagePrompt(' 雨中的桥 ', 'free', 'free'), '雨中的桥')
assert.match(buildImagePrompt('雨中的桥', 'scenery', 'pixel'), /环境[\s\S]*像素[\s\S]*雨中的桥/)
assert.match(buildImagePrompt('撑伞的人', 'character', 'realistic'), /人物[\s\S]*写实[\s\S]*撑伞的人/)
assert.deepEqual(takeSmsImage('看，雨停了。\n【发图：窗外雨后的街道】'), {
  body: '看，雨停了。', prompt: '窗外雨后的街道',
})
assert.deepEqual(takeSmsImage('看，雨停了。\n【发图：realistic | 窗外雨后的街道】'), {
  body: '看，雨停了。', prompt: 'realistic | 窗外雨后的街道',
})
assert.deepEqual(appImageDirection('flash', '姜茶'), { prompt: '姜茶', style: 'realistic' })
assert.deepEqual(appImageDirection('moments', 'watercolor | 手绘风景'), { prompt: '手绘风景', style: 'watercolor' })
assert.deepEqual(appImageDirection('messages', 'FREE | 聊天软件截图'), { prompt: '聊天软件截图', style: 'free' })

try {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://example.test/v1/models')
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-key')
    assert.equal(init?.redirect, 'error')
    return Response.json({ data: [{ id: 'image-test' }, null, { id: 'image-test' }, { id: 'another-model' }] })
  }
  assert.deepEqual(await listImageModels('https://example.test/v1/images/generations'), ['image-test', 'another-model'])
  await assert.rejects(listImageModels('https://other.example.test/v1'), /先填写此图片接口的密钥/)

  globalThis.fetch = async url => {
    assert.equal(url, 'https://api.siliconflow.cn/v1/models?sub_type=text-to-image')
    return Response.json({ data: [{ id: 'image-test' }] })
  }
  assert.deepEqual(await listImageModels('https://api.siliconflow.cn/v1', 'another-key'), ['image-test'])

  const cloudflare = 'https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/ai/'
  const flux = '@cf/black-forest-labs/flux-1-schnell'
  globalThis.fetch = async url => {
    const endpoint = new URL(String(url))
    assert.equal(endpoint.pathname, new URL(cloudflare + 'models/search').pathname)
    assert.equal(endpoint.searchParams.get('search'), flux)
    return Response.json({ result: [{ name: flux }, { name: '@cf/other/model' }] })
  }
  assert.deepEqual(await listImageModels(cloudflare + 'run/' + flux, 'cloudflare-key'), [flux])

  globalThis.fetch = async () => new Response(null, { status: 401 })
  await assert.rejects(listImageModels('https://example.test/v1'), /401.*密钥/)

  globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }
  await assert.rejects(generateImage('a river', controller.signal), /无法连接图片 API.*跨域/)

  globalThis.fetch = async () => new Response(JSON.stringify({ data: [{ b64_json: encoded }] }), {
    headers: { 'Content-Type': 'application/json' },
  })
  assert.equal((await generateImage('a river', controller.signal)).type, 'image/jpeg')

  Capacitor.isNativePlatform = () => true
  nativeRequest = async options => {
    assert.equal(options.url, 'https://example.test/v1/models')
    assert.equal(options.method, 'GET')
    assert.equal(options.headers?.Authorization, 'Bearer test-key')
    return { status: 200, headers: {}, data: { models: ['native-image'] } }
  }
  assert.deepEqual(await listImageModels('https://example.test/v1'), ['native-image'])
  const calls: string[] = []
  nativeRequest = async options => {
    calls.push(options.url)
    assert.equal(options.disableRedirects, true)
    if (options.method === 'POST') {
      assert.equal(options.headers?.Authorization, 'Bearer test-key')
      assert.match(options.data.prompt, /环境[\s\S]*水彩[\s\S]*a river/)
      return { status: 200, headers: { 'Content-Type': 'application/json' }, url: options.url,
        data: { data: [{ url: 'https://cdn.example.test/image.jpg' }] } }
    }
    assert.equal(options.headers?.Authorization, undefined)
    if (options.url === 'https://cdn.example.test/image.jpg') {
      return { status: 302, headers: { Location: '/final.jpg' }, url: options.url, data: '' }
    }
    return { status: 200, headers: { 'content-type': 'image/jpeg' }, url: options.url, data: encoded }
  }
  globalThis.fetch = async () => { throw new Error('Native image requests must use the bridge') }
  assert.equal((await generateImage('a river', controller.signal, 'scenery', 'watercolor')).type, 'image/jpeg')
  assert.deepEqual(calls, ['https://example.test/v1/images/generations', 'https://cdn.example.test/image.jpg', 'https://cdn.example.test/final.jpg'])
  controller.abort()
  await assert.rejects(generateImage('a river', controller.signal), /取消或超时/)
  assert.equal(calls.length, 3)
} finally {
  globalThis.fetch = originalFetch
  Capacitor.isNativePlatform = isNative
}

const parsed = await resolveImportJson(new File(['{"name":"测试角色"}'], '角色.json'))
assert.deepEqual(parsed, { card: { name: '测试角色' }, via: 'raw' })
const oversized = { size: 17 * 1024 * 1024, text: () => assert.fail('Oversized files must be rejected before reading') } as unknown as File
await assert.rejects(resolveImportJson(oversized), /超过 16 MB/)

const pngHeader = new Uint8Array(24)
pngHeader.set([137, 80, 78, 71, 13, 10, 26, 10])
const dimensions = new DataView(pngHeader.buffer)
dimensions.setUint32(16, 8000)
dimensions.setUint32(20, 8000)
await assert.rejects(importChatBackground(new File([pngHeader], 'large.png')), /像素过多/)

const settings = new Map<string, string>()
const savedStorage = globalThis.localStorage
const savedImage = globalThis.Image
const savedReader = globalThis.FileReader
const rows = [
  { item: { text: '雨后的街道', image: undefined }, imagePrompt: 'watercolor | 湿漉漉的路面' },
  { item: { text: '没人的码头', image: undefined }, imagePrompt: '傍晚的码头' },
]
try {
  Object.assign(globalThis, { localStorage: {
    getItem: (key: string) => settings.get(key) ?? null,
    setItem: (key: string, value: string) => settings.set(key, value),
  } })
  let requests = 0
  globalThis.fetch = async () => { requests++; throw new TypeError('Failed to fetch') }
  assert.equal(await canGenerateAppImages('moments'), false)
  assert.deepEqual(await attachAppImage('moments', rows), rows.map(row => row.item))
  assert.equal(requests, 0)
  setAppImagesEnabled('moments', true)
  assert.equal(await canGenerateAppImages('moments'), true)
  assert.equal(await canGenerateAppImages('star'), false)
  assert.deepEqual(await attachAppImage('moments', rows), rows.map(row => row.item))
  assert.equal(requests, 1, 'at most one image request should be made in a batch')

  Object.assign(globalThis, {
    Image: class {
      naturalWidth = 32
      naturalHeight = 32
      onload?: () => void
      set src(_value: string) { queueMicrotask(() => this.onload?.()) }
    },
    FileReader: class {
      result = ''
      onload?: () => void
      readAsDataURL() {
        this.result = `data:image/jpeg;base64,${encoded}`
        queueMicrotask(() => this.onload?.())
      }
    },
  })
  globalThis.fetch = async (_url, init) => {
    requests++
    const body = JSON.parse(String(init?.body))
    assert.match(body.prompt, /水彩[\s\S]*湿漉漉的路面/)
    assert.doesNotMatch(body.prompt, /watercolor\s*\|/)
    return Response.json({ data: [{ b64_json: encoded }] })
  }
  const illustrated = await attachAppImage('moments', rows)
  assert.equal(illustrated[0]?.image, `data:image/jpeg;base64,${encoded}`)
  assert.equal(illustrated[1]?.image, undefined)
  assert.equal(requests, 2)
  const anchor = { id: 'live-test-anchor', realName: '测试主播', stageName: '晚风',
    background: '在直播间唱歌', personality: '温和', chatStyle: '自然接话',
    appearance: '黑发、棕色眼睛', portraitUrl: 'characters/live-test.png' }
  const friendNamespace = 'live-contact-regression'
  let photoRequests = 0
  globalThis.fetch = async url => {
    photoRequests++
    assert.equal(String(url), 'https://example.test/live-simulator/characters/live-test.png')
    return new Response(Uint8Array.from([255, 216, 255, 217]), { headers: { 'Content-Type': 'image/jpeg' } })
  }
  const [friend, duplicate] = await Promise.all([
    addLiveSmsFriend(friendNamespace, anchor, 'https://example.test/live-simulator/index.html?identity=test', '玩家'),
    addLiveSmsFriend(friendNamespace, anchor, 'https://example.test/live-simulator/index.html?identity=test', '玩家'),
  ])
  assert.equal(friend.person.id, duplicate.person.id)
  assert.equal(friend.chat.id, duplicate.chat.id)
  assert.equal(photoRequests, 1)
  assert.equal(friend.person.avatar, `data:image/jpeg;base64,${encoded}`)
  assert.match(friend.person.description, /黑发、棕色眼睛/)
  assert.match(friend.person.scenario, /短信好友/)
  assert.equal((await listSaves(friendNamespace)).length, 0, 'adding an SMS friend must not start an offline save')
  assert.equal((await storage.listChats(friendNamespace)).length, 1)
  await storage.putCharacter(friendNamespace, { ...friend.person, avatar: 'https://old.example.test/photo.png' })
  const repaired = await addLiveSmsFriend(friendNamespace, anchor, 'https://example.test/live-simulator/index.html', '玩家')
  assert.equal(repaired.person.id, friend.person.id)
  assert.equal(repaired.chat.id, friend.chat.id)
  assert.equal(repaired.person.avatar, `data:image/jpeg;base64,${encoded}`)
  assert.equal(isImageAvatar('https://example.test/photo.png'), true)
  assert.equal(isImageAvatar('javascript:alert(1)'), false)
  assert.equal(isImageAvatar('晚'), false)

  globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }
  const remote = await addLiveSmsFriend(friendNamespace, { ...anchor, id: 'remote-anchor' }, 'https://example.test/live-simulator/index.html', '玩家')
  assert.equal(remote.person.avatar, 'https://example.test/live-simulator/characters/live-test.png')
  assert.equal(isImageAvatar(remote.person.avatar), true)
  assert.equal(await canGenerateAppImages('huizhen'), true)
  const albumNamespace = 'album-image-regression'
  const character = { id: 'album-character', description: '性别：男，黑发，20岁', personality: '', extensions: {} } as Character
  let albumCalls = 0
  let shown: PhoneItem[] = []
  globalThis.fetch = async (_url, init) => {
    albumCalls++
    if (albumCalls === 2) throw new TypeError('Failed to fetch')
    const body = JSON.parse(String(init?.body))
    assert.match(body.prompt, albumCalls === 1 ? /写实[\s\S]*书桌/ : /male sender/)
    return Response.json({ data: [{ b64_json: encoded }] })
  }
  const input = { namespace: albumNamespace, character,
    items: [{ title: '书桌', text: '窗边的书桌' }, { title: '自拍', text: '角色自拍', imagePrompt: 'selfie | 黑发男生的自拍' }],
    active: () => true, onUpdate: (items: PhoneItem[]) => { shown = items } }
  assert.match(await generatePhoneAlbum(input), /补全照片/)
  const cached = await storage.getBag<PhoneItem[]>(albumNamespace, 'phone_live_v2_album-character_album')
  assert.equal(cached?.[0]?.image, `data:image/jpeg;base64,${encoded}`)
  assert.equal(cached?.[1]?.image, undefined)
  assert.deepEqual(shown, cached)
  assert.equal(await generatePhoneAlbum({ ...input, items: cached! }), '')
  assert.equal(albumCalls, 3, 'retry generates only the missing photo')
  assert.equal(shown[1]?.image, `data:image/jpeg;base64,${encoded}`)
  await generatePhoneAlbum({ ...input, active: () => false })
  assert.equal(albumCalls, 3, 'leaving the album stops further photo requests')
  setAppImagesEnabled('huizhen', false)
  assert.match(await generatePhoneAlbum(input), /开启/)
  assert.equal(albumCalls, 3, 'disabled albums do not request images')
} finally {
  Object.assign(globalThis, { localStorage: savedStorage, Image: savedImage, FileReader: savedReader })
  globalThis.fetch = originalFetch
}
console.log('Mobile import and image API checks passed.')
