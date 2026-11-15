import { inflateSync } from 'fflate'
import { checkImportSize, readFileBytes } from './fileSnapshot.ts'

const maxDocumentBytes = 8 * 1024 * 1024

function extractBody(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const invalid = () => new Error('DOCX 文件不完整或格式无法识别，请重新保存后导入')
  let end = bytes.length - 22
  while (end >= Math.max(0, bytes.length - 22 - 65_535)) {
    if (view.getUint32(end, true) === 0x06054b50 && end + 22 + view.getUint16(end + 20, true) === bytes.length) break
    end--
  }
  if (end < Math.max(0, bytes.length - 22 - 65_535)) throw invalid()

  const decoder = new TextDecoder()
  let cursor = view.getUint32(end + 16, true)
  const count = view.getUint16(end + 10, true)
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50) throw invalid()
    const nameStart = cursor + 46
    const nameEnd = nameStart + view.getUint16(cursor + 28, true)
    const next = nameEnd + view.getUint16(cursor + 30, true) + view.getUint16(cursor + 32, true)
    if (next > end) throw invalid()
    if (decoder.decode(bytes.subarray(nameStart, nameEnd)).replace(/\\/g, '/') !== 'word/document.xml') {
      cursor = next
      continue
    }
    if (view.getUint16(cursor + 8, true) & 1) throw new Error('DOCX 有密码保护，请解除保护后再导入')
    const method = view.getUint16(cursor + 10, true)
    const size = view.getUint32(cursor + 24, true)
    const packedSize = view.getUint32(cursor + 20, true)
    if (size > maxDocumentBytes) throw new Error('DOCX 正文解压后超过 8 MB，请拆分后再导入')
    const local = view.getUint32(cursor + 42, true)
    if (local + 30 > cursor || view.getUint32(local, true) !== 0x04034b50) throw invalid()
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
    if (start + packedSize > cursor) throw invalid()
    const packed = bytes.subarray(start, start + packedSize)
    if (method !== 0 && method !== 8) throw new Error('DOCX 使用了不支持的压缩格式，请用 Word 或 WPS 重新保存')
    let body = packed
    if (method === 8) {
      try {
        body = inflateSync(packed, { out: new Uint8Array(size + 1) })
      } catch {
        throw invalid()
      }
    }
    if (body.byteLength !== size) throw invalid()
    return body
  }
  throw new Error('没有找到 DOCX 正文')
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function textFromWordXml(xml: string): string {
  const paragraphs: string[] = []
  for (const block of xml.split(/<w:p\b[^>]*>/)) {
    const runs = [...block.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((match) => decodeXml(match[1]))
    const line = runs.join('').replace(/\u00a0/g, ' ').trim()
    if (line) paragraphs.push(line)
  }
  if (paragraphs.length > 0) return paragraphs.join('\n')
  const flat = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((match) => decodeXml(match[1]))
    .join('')
    .replace(/\u00a0/g, ' ')
    .trim()
  return flat
}

export async function readDocxBytes(bytes: Uint8Array): Promise<string> {
  const body = extractBody(bytes)
  const text = textFromWordXml(new TextDecoder().decode(body))
  if (!text.trim()) throw new Error('DOCX 正文为空，扫描图片需要先转换为文字')
  return text.trim()
}

export async function readDocxFile(file: File): Promise<string> {
  checkImportSize(file, 16)
  const bytes = await readFileBytes(file).catch(() => {
    throw new Error('手机浏览器没能读取 DOCX 文件，请先保存到「下载」文件夹再选择')
  })
  return readDocxBytes(bytes)
}
