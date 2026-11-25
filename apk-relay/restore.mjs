import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const hash = data => createHash('sha256').update(data).digest('hex')
const [previousPath, outputPath, manifestPath, changesPath] = process.argv.slice(2)
const previous = readFileSync(previousPath)
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const changes = readFileSync(changesPath)
if (hash(previous) !== '343c2c2c7b3ede26c3242688e2899fc3024bc130da7bb73d317efdaafd07b932' ||
    hash(previous) !== manifest.base) throw new Error('Previous APK digest mismatch')
if (manifest.bytes !== 167695843 ||
    manifest.target !== 'e3acdb1a9c4c70cbcc5f405fcd8dbed0932ce7116584603f88f7964409d1afc3') {
  throw new Error('Unexpected signed target')
}
const result = Buffer.alloc(manifest.bytes)
let changedOffset = 0
let cursor = 0
for (const [targetOffset, sourceOffset, size] of manifest.copies) {
  if (targetOffset < cursor || targetOffset + size > result.length ||
      sourceOffset < 0 || sourceOffset + size > previous.length) throw new Error('Invalid patch range')
  const gap = targetOffset - cursor
  changes.copy(result, cursor, changedOffset, changedOffset + gap)
  previous.copy(result, targetOffset, sourceOffset, sourceOffset + size)
  changedOffset += gap
  cursor = targetOffset + size
}
if (changedOffset + result.length - cursor !== changes.length) throw new Error('Unexpected change data length')
changes.copy(result, cursor, changedOffset)
if (hash(result) !== manifest.target) throw new Error('Restored APK differs from the signed build')
writeFileSync(outputPath, result)
console.log('Restored', result.length, 'bytes, SHA-256', hash(result))
