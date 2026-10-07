import 'fake-indexeddb/auto'
import { writeCharacter } from '../src/domain/importing.ts'
import { storage } from '../src/storage/StorageService.ts'

const snap = await storage.boot()
if (snap.identities.length !== 1) throw new Error(`身份数量不对：${snap.identities.length}`)
if (snap.presets.length !== 8) throw new Error(`预设数量不对：${snap.presets.length}`)
if (!snap.themes.some((theme) => theme.id === 'theme_macaron')) throw new Error('缺少马卡龙主题')

const identity = snap.identities[0]
if (!identity) throw new Error('没有默认身份')
await writeCharacter({
  identity,
  name: '测试',
  personality: '说话很短',
  description: '说话很短',
  firstMes: '在吗',
})
const chats = await storage.listChats(identity.namespace)
const chat = chats[0]
if (!chat) throw new Error('没有生成短信')
const messages = await storage.listMessages(identity.namespace, chat.id)
if (messages[0]?.content !== '在吗') throw new Error('开场白没有写进短信')
const again = await storage.boot()
if (again.identities[0]?.id !== identity.id) throw new Error('第二次启动不应该换掉身份')
console.log('boot ok')
