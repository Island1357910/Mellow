import assert from 'node:assert/strict'
import { strToU8, Zip, ZipDeflate, zipSync } from 'fflate'
import { readDocxBytes, readDocxFile } from '../src/lib/docxText.ts'

const xml = strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:tabs/></w:pPr><w:r><w:t>关系 &amp; 规则</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>表格里的设定</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>')
const expected = '关系 & 规则\n表格里的设定'
const documentPath = 'word/document.xml'
const ordinary = zipSync({ '[Content_Types].xml': strToU8('<Types/>'), [documentPath]: xml })
const originalStream = globalThis.DecompressionStream
try {
  Object.defineProperty(globalThis, 'DecompressionStream', { configurable: true, value: undefined })
  assert.equal(await readDocxFile(new File([new Uint8Array(ordinary)], '世界书.docx')), expected)
  assert.equal(await readDocxBytes(zipSync({ [documentPath]: xml }, { level: 0 })), expected)

  const streamed = await new Promise<Uint8Array>((resolve, reject) => {
    const chunks: Uint8Array[] = []
    const zip = new Zip((error, chunk, final) => {
      if (error) return reject(error)
      chunks.push(chunk)
      if (final) resolve(new Uint8Array(Buffer.concat(chunks)))
    })
    const entry = new ZipDeflate(documentPath)
    zip.add(entry)
    entry.push(xml, true)
    zip.end()
  })
  assert.equal(new DataView(streamed.buffer).getUint16(6, true) & 8, 8)
  assert.equal(await readDocxBytes(streamed), expected)
} finally {
  Object.defineProperty(globalThis, 'DecompressionStream', { configurable: true, writable: true, value: originalStream })
}

await assert.rejects(readDocxBytes(ordinary.subarray(0, ordinary.length - 1)), /不完整/)
await assert.rejects(readDocxBytes(zipSync({ 'word/media/image.png': new Uint8Array(5) })), /没有找到 DOCX 正文/)
await assert.rejects(readDocxBytes(zipSync({ [documentPath]: new Uint8Array(8 * 1024 * 1024 + 1) })), /超过 8 MB/)
console.log('DOCX import checks passed, including compressed and streamed ZIPs with no browser decompression API.')
