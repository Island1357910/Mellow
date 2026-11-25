import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const hash = data => createHash('sha256').update(data).digest('hex')
const [previousPath, outputPath, manifestPath, changesPath] = process.argv.slice(2)
const previous = readFileSync(previousPath)
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const changes = readFileSync(changesPath)
if (hash(previous) !== '3c44e8c91f132b1b5e10cffcebc4df24f0c42e30a74fc0b11f811f00539fa91e' ||
    hash(previous) !== manifest.base) throw new Error('Previous APK digest mismatch')
if (manifest.bytes !== 167691654 ||
    manifest.target !== '647acbf63685b371747e010c36893b8baa1331b79a5e7747d5eed56e5b7503a7') {
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
