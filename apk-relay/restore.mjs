import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const hash = data => createHash('sha256').update(data).digest('hex')
const [previousPath, outputPath, manifestPath, changesPath] = process.argv.slice(2)
const previous = readFileSync(previousPath)
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const changes = readFileSync(changesPath)
if (hash(previous) !== '3c73be4c4692a6e69e3a1adfdd1ad0fc1b7cd6d9f96e5d76bda23fd135aee1c1' ||
    hash(previous) !== manifest.base) throw new Error('Previous APK digest mismatch')
if (manifest.bytes !== 167691468 ||
    manifest.target !== '87cb8cde9dc4ee55873a0735313b3acb57db7559b580b2f309466113e4b0286d') {
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
