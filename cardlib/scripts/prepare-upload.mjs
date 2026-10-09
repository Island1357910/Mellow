/**
 * 从 cards/* 生成待上传云存储的文件 + 云数据库记录（含答案，勿公开）
 * 用法：node scripts/prepare-upload.mjs
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync, copyFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

const root = fileURLToPath(new URL('..', import.meta.url))
const sourceRoot = join(root, 'cards')
const outRoot = join(root, 'upload-out')

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodeTextChunk(key, text) {
  const keyBuf = Buffer.from(key, 'latin1')
  const out = Buffer.alloc(keyBuf.length + 1 + Buffer.byteLength(text, 'latin1'))
  keyBuf.copy(out, 0)
  out[keyBuf.length] = 0
  Buffer.from(text, 'latin1').copy(out, keyBuf.length + 1)
  return out
}

function buildTavernPng(cardJson, coverPath) {
  if (coverPath && existsSync(coverPath)) {
    const pngBytes = readFileSync(coverPath)
    const payload = Buffer.from(JSON.stringify(cardJson)).toString('base64')
    const textChunk = pngChunk('tEXt', encodeTextChunk('chara', payload))
    const end = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130])
    const index = pngBytes.indexOf(end)
    if (index >= 0) return Buffer.concat([pngBytes.slice(0, index), textChunk, pngBytes.slice(index)])
    return Buffer.concat([pngBytes, textChunk, end.slice(-12)])
  }
  const width = 512
  const height = 512
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const row = Buffer.alloc(1 + width * 3)
  row[0] = 0
  for (let x = 0; x < width; x += 1) {
    const offset = 1 + x * 3
    row[offset] = 255
    row[offset + 1] = 213
    row[offset + 2] = 221
  }
  const raw = Buffer.alloc(row.length * height)
  for (let y = 0; y < height; y += 1) row.copy(raw, y * row.length)
  const idat = zlib.deflateSync(raw)
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const payload = Buffer.from(JSON.stringify(cardJson)).toString('base64')
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('tEXt', encodeTextChunk('chara', payload)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

function prepareOne(dirName) {
  const dir = join(sourceRoot, dirName)
  const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'))
  const card = JSON.parse(readFileSync(join(dir, 'card.json'), 'utf8'))
  const questions = JSON.parse(readFileSync(join(dir, 'questions.json'), 'utf8'))
  const id = meta.id || dirName
  const outDir = join(outRoot, id)
  mkdirSync(outDir, { recursive: true })

  writeFileSync(join(outDir, 'card.json'), `${JSON.stringify(card, null, 2)}\n`)
  const pngPath = ['card.png', 'cover.png'].map((name) => join(dir, name)).find((path) => existsSync(path))
  writeFileSync(join(outDir, 'character.png'), buildTavernPng(card, pngPath))

  const coverSrc = ['cover.jpg', 'cover.png', 'cover.webp'].map((name) => join(dir, name)).find((path) => existsSync(path))
  if (coverSrc) copyFileSync(coverSrc, join(outDir, `cover.${basename(coverSrc).split('.').pop()}`))

  const dbRecord = {
    _id: id,
    id,
    name: meta.name || id,
    summary: meta.summary || '',
    tags: meta.tags || [],
    author: meta.author || '半糖',
    version: meta.version || '1.0.0',
    coverFileId: '',
    jsonFileId: '',
    pngFileId: '',
    questions: questions.map((item, index) => ({
      id: item.id || `q${index + 1}`,
      prompt: item.prompt,
      answers: item.answers || [],
    })),
  }

  writeFileSync(join(outDir, 'db-record.json'), `${JSON.stringify(dbRecord, null, 2)}\n`)
  writeFileSync(join(outDir, 'manifest-public.json'), `${JSON.stringify({
    id,
    name: dbRecord.name,
    summary: dbRecord.summary,
    tags: dbRecord.tags,
    questions: dbRecord.questions.map((item) => ({ id: item.id, prompt: item.prompt })),
  }, null, 2)}\n`)

  console.log(`✓ ${id} -> upload-out/${id}/`)
}

const dirs = readdirSync(sourceRoot, { withFileTypes: true }).filter((item) => item.isDirectory()).map((item) => item.name)
mkdirSync(outRoot, { recursive: true })
dirs.forEach(prepareOne)
console.log('\n下一步：把 upload-out 里的文件上传到云存储，把 db-record.json 填入云数据库 cards 集合。')
