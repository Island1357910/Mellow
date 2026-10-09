/**
 * 从酒馆 PNG 导入到 cardlib/cards/
 * 用法：node scripts/import-png-cards.mjs "路径1.png" "路径2.png"
 */
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const cardsRoot = join(root, 'cards')

const ID_MAP = {
  方唐: 'fangtang',
  殷折安: 'yinzhean',
  严长知: 'yanchangzhi',
  徐兰青: 'xulanqing',
  路怀远: 'luhuaiyuan',
  蓝与舟: 'lanyuzhou',
}

function readPngTexts(buf) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  for (let i = 0; i < signature.length; i += 1) {
    if (buf[i] !== signature[i]) throw new Error('不是 PNG 角色卡')
  }
  const texts = {}
  let offset = 8
  while (offset + 8 <= buf.length) {
    const len = buf.readUInt32BE(offset)
    const type = buf.toString('ascii', offset + 4, offset + 8)
    const start = offset + 8
    const end = start + len
    if (type === 'tEXt') {
      const zero = buf.indexOf(0, start)
      if (zero > 0) {
        const key = buf.toString('utf8', start, zero)
        texts[key] = buf.toString('latin1', zero + 1, end)
      }
    }
    offset = end + 4
    if (type === 'IEND') break
  }
  return texts
}

function decodePayload(payload) {
  const cleaned = payload.replace(/\s/g, '')
  const bytes = Buffer.from(cleaned, 'base64')
  try {
    return JSON.parse(bytes.toString('utf8'))
  } catch {
    return JSON.parse(Buffer.from(cleaned, 'base64').toString('latin1'))
  }
}

function stripTags(text) {
  return String(text || '').replace(/<[^>]+>/g, '').trim()
}

function pickEnglishName(desc) {
  const match = desc.match(/english_name:\s*["']?([^"'\n]+)/i)
  return match?.[1]?.trim() || ''
}

function pickSnippet(desc, max = 40) {
  const plain = desc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const lines = plain.split(/[。.\n]/).map((item) => item.trim()).filter(Boolean)
  const line = lines.find((item) => (
    item.length >= 8
    && !item.startsWith('#')
    && !/character profile|basic_information|english_name/i.test(item)
  ))
  return (line || nameFromDesc(desc) || '').slice(0, max).trim()
}

function nameFromDesc(desc) {
  const m = desc.match(/full_name:\s*["']?([^"'\n]+)/i)
  return m?.[1]?.trim() || ''
}

function summaryText(data, name) {
  const personality = stripTags(data.personality || '').slice(0, 80)
  if (personality) return personality
  const scenario = stripTags(data.scenario || '').slice(0, 72)
  if (scenario) return scenario
  const snippet = pickSnippet(String(data.description || ''), 72)
  if (snippet && !snippet.startsWith('#')) return snippet
  return `${name} · 半糖官方角色卡`
}

function buildQuestions(name, data) {
  const desc = String(data.description || '')
  const english = pickEnglishName(desc)
  const first = stripTags(data.first_mes || '')
  const scenario = stripTags(data.scenario || '').slice(0, 30)
  const snippet = pickSnippet(desc, 24)

  const questions = [
    {
      id: 'q1',
      prompt: `${name}的全名是？（两个字或三个字）`,
      answers: [name],
    },
  ]

  if (english) {
    questions.push({
      id: 'q2',
      prompt: `${name}的英文名是？（姓和名之间可有空格）`,
      answers: [english, english.replace(/\s+/g, '')],
    })
  }

  if (first && first.length <= 40) {
    questions.push({
      id: 'q3',
      prompt: `开场白/标题里，与${name}相关的那句是？（照抄，不含尖括号）`,
      answers: [first, first.replace(/[「」"'""]/g, '')],
    })
  }

  if (scenario) {
    questions.push({
      id: 'q4',
      prompt: `和${name}相关的场景关键词？（从设定里找，4～12字）`,
      answers: [scenario, scenario.slice(0, 12)],
    })
  }

  if (snippet && !snippet.startsWith('#') && !/profile|information/i.test(snippet)) {
    questions.push({
      id: 'q5',
      prompt: `设定里与${name}有关的一句描述？（答其中连续4～10个字即可）`,
      answers: [snippet, snippet.slice(0, 10), snippet.slice(0, 8)].filter(Boolean),
    })
  }

  questions.push({
    id: 'q6',
    prompt: `这张卡的角色叫什么？`,
    answers: [name],
  })

  return questions.slice(0, 8)
}

function normalizeCard(raw) {
  if (raw.data && typeof raw.data === 'object') {
    return { spec: raw.spec || 'chara_card_v2', spec_version: raw.spec_version || '2.0', data: raw.data }
  }
  return { spec: 'chara_card_v2', spec_version: '2.0', data: raw }
}

function importOne(pngPath) {
  const fileName = basename(pngPath).replace(/\.png$/i, '')
  const buf = readFileSync(pngPath)
  const texts = readPngTexts(buf)
  const payload = texts.ccv3 || texts.chara
  if (!payload) throw new Error(`${fileName}：PNG 里没有 chara 数据`)
  const raw = decodePayload(payload)
  const card = normalizeCard(raw)
  const name = card.data.name?.trim() || fileName
  const id = ID_MAP[name] || ID_MAP[fileName] || fileName.replace(/\s+/g, '').toLowerCase()

  const dir = join(cardsRoot, id)
  mkdirSync(dir, { recursive: true })

  writeFileSync(join(dir, 'card.json'), `${JSON.stringify(card, null, 2)}\n`)
  copyFileSync(pngPath, join(dir, 'card.png'))
  copyFileSync(pngPath, join(dir, 'cover.png'))

  const meta = {
    id,
    name,
    summary: summaryText(card.data, name),
    tags: ['官方', ...(Array.isArray(card.data.tags) ? card.data.tags.slice(0, 4) : [])],
    author: card.data.creator || '半糖',
    version: card.data.character_version || '1.0.0',
  }
  writeFileSync(join(dir, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`)

  const questions = buildQuestions(name, card.data)
  writeFileSync(join(dir, 'questions.json'), `${JSON.stringify(questions, null, 2)}\n`)

  console.log(`✓ ${name} -> cards/${id}/`)
}

const paths = process.argv.slice(2)
if (!paths.length) {
  console.error('用法: node scripts/import-png-cards.mjs "路径.png" ...')
  process.exit(1)
}
for (const path of paths) importOne(path)
