/**
 * 统一导入角色卡到 cardlib/cards/
 * 用法：node scripts/import-cards.mjs "路径1" "路径2" ...
 * 支持 .png / .json / .txt
 */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import {
  buildQuestions,
  displayNameFromPath,
  normalizeCard,
  plainTextCardJson,
  resolveId,
  tryParseStructuredDoc,
  writeCardBundle,
} from './card-import-utils.mjs'

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

function importPng(path) {
  const buf = readFileSync(path)
  const texts = readPngTexts(buf)
  const payload = texts.ccv3 || texts.chara
  if (!payload) throw new Error(`${basename(path)}：PNG 里没有 chara 数据`)
  const card = normalizeCard(decodePayload(payload))
  const name = card.data.name?.trim() || displayNameFromPath(path)
  const id = resolveId(name, path)
  const questions = buildQuestions(name, card.data, id)
  writeCardBundle({ id, name, card, questions, pngPath: path })
  console.log(`✓ PNG ${name} -> cards/${id}/`)
}

function importJson(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'))
  const card = normalizeCard(raw)
  const name = card.data.name?.trim() || displayNameFromPath(path)
  const id = resolveId(name, path)
  const questions = buildQuestions(name, card.data, id)
  writeCardBundle({ id, name, card, questions })
  console.log(`✓ JSON ${name} -> cards/${id}/`)
}

function importTxt(path) {
  const text = readFileSync(path, 'utf8')
  const fallbackName = displayNameFromPath(path)
  const card = tryParseStructuredDoc(text) || plainTextCardJson(text, fallbackName)
  const name = card.data.name?.trim() || fallbackName
  const id = resolveId(name, path)
  const questions = buildQuestions(name, card.data, id)
  writeCardBundle({ id, name, card, questions, txtPath: path })
  console.log(`✓ TXT ${name} -> cards/${id}/`)
}

function importOne(path) {
  const lower = path.toLowerCase()
  if (lower.endsWith('.png')) return importPng(path)
  if (lower.endsWith('.json')) return importJson(path)
  if (lower.endsWith('.txt')) return importTxt(path)
  throw new Error(`不支持的格式：${path}`)
}

const paths = process.argv.slice(2)
if (!paths.length) {
  console.error('用法: node scripts/import-cards.mjs "路径.png|.json|.txt" ...')
  process.exit(1)
}
for (const path of paths) importOne(path)
