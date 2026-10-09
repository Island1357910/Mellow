function readU32(data: Uint8Array, offset: number): number {
  return (
    (data[offset] ?? 0)
    | ((data[offset + 1] ?? 0) << 8)
    | ((data[offset + 2] ?? 0) << 16)
    | ((data[offset + 3] ?? 0) << 24)
  ) >>> 0
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

async function inflateDeflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new Error('浏览器不支持解压 docx')
  const copy = new Uint8Array(data)
  const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function decompressEntry(compression: number, compData: Uint8Array): Promise<Uint8Array | null> {
  if (compression === 0) return compData
  if (compression === 8) return inflateDeflateRaw(compData)
  return null
}

async function readLocalEntry(data: Uint8Array, offset: number, compSize: number): Promise<Uint8Array | null> {
  if (offset + 30 > data.length) return null
  if (data[offset] !== 0x50 || data[offset + 1] !== 0x4b || data[offset + 2] !== 0x03 || data[offset + 3] !== 0x04) return null
  const compression = (data[offset + 8] ?? 0) | ((data[offset + 9] ?? 0) << 8)
  const localNameLen = (data[offset + 26] ?? 0) | ((data[offset + 27] ?? 0) << 8)
  const localExtraLen = (data[offset + 28] ?? 0) | ((data[offset + 29] ?? 0) << 8)
  const dataStart = offset + 30 + localNameLen + localExtraLen
  const size = compSize || readU32(data, offset + 18)
  const compData = data.slice(dataStart, dataStart + size)
  return decompressEntry(compression, compData)
}

async function extractZipEntryViaCentralDir(data: Uint8Array, targetName: string): Promise<Uint8Array | null> {
  const want = targetName.replace(/\\/g, '/')
  for (let scan = Math.max(0, data.length - 65_536); scan < data.length - 22; scan += 1) {
    if (data[scan] !== 0x50 || data[scan + 1] !== 0x4b || data[scan + 2] !== 0x05 || data[scan + 3] !== 0x06) continue
    const centralOffset = readU32(data, scan + 16)
    let cursor = centralOffset
    while (cursor + 46 <= data.length) {
      if (data[cursor] !== 0x50 || data[cursor + 1] !== 0x4b || data[cursor + 2] !== 0x01 || data[cursor + 3] !== 0x02) break
      const compression = (data[cursor + 10] ?? 0) | ((data[cursor + 11] ?? 0) << 8)
      const compSize = readU32(data, cursor + 20)
      const nameLen = (data[cursor + 28] ?? 0) | ((data[cursor + 29] ?? 0) << 8)
      const extraLen = (data[cursor + 30] ?? 0) | ((data[cursor + 31] ?? 0) << 8)
      const commentLen = (data[cursor + 32] ?? 0) | ((data[cursor + 33] ?? 0) << 8)
      const localOffset = readU32(data, cursor + 42)
      const nameStart = cursor + 46
      const name = new TextDecoder().decode(data.slice(nameStart, nameStart + nameLen)).replace(/\\/g, '/')
      cursor = nameStart + nameLen + extraLen + commentLen
      if (name !== want) continue
      const local = await readLocalEntry(data, localOffset, compSize)
      if (local) return local
      return decompressEntry(compression, data.slice(localOffset))
    }
    break
  }
  return null
}

async function extractZipEntry(data: Uint8Array, targetName: string): Promise<Uint8Array | null> {
  const want = targetName.replace(/\\/g, '/')
  let offset = 0
  while (offset + 30 <= data.length) {
    if (data[offset] !== 0x50 || data[offset + 1] !== 0x4b || data[offset + 2] !== 0x03 || data[offset + 3] !== 0x04) {
      offset += 1
      continue
    }
    const compression = (data[offset + 8] ?? 0) | ((data[offset + 9] ?? 0) << 8)
    const compSize = readU32(data, offset + 18)
    const nameLen = (data[offset + 26] ?? 0) | ((data[offset + 27] ?? 0) << 8)
    const extraLen = (data[offset + 28] ?? 0) | ((data[offset + 29] ?? 0) << 8)
    const nameStart = offset + 30
    const name = new TextDecoder().decode(data.slice(nameStart, nameStart + nameLen)).replace(/\\/g, '/')
    const dataStart = nameStart + nameLen + extraLen
    const compData = data.slice(dataStart, dataStart + (compSize || data.length - dataStart))
    offset = dataStart + (compSize || 0)

    if (name !== want) continue

    const out = await decompressEntry(compression, compData)
    if (out) return out
  }
  return extractZipEntryViaCentralDir(data, targetName)
}

function textFromWordXml(xml: string): string {
  const paragraphs: string[] = []
  for (const block of xml.split(/<w:p\b[^>]*>/)) {
    const runs = [...block.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((match) => decodeXml(match[1]))
    const line = runs.join('').replace(/\u00a0/g, ' ').trim()
    if (line) paragraphs.push(line)
  }
  if (paragraphs.length > 0) return paragraphs.join('\n')
  const flat = [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => decodeXml(match[1]))
    .join('')
    .replace(/\u00a0/g, ' ')
    .trim()
  return flat
}

/** 从二进制里兜底扫描 XML 片段（兼容部分非标准 docx） */
function scanWtFromBinary(bytes: Uint8Array): string {
  const raw = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  return textFromWordXml(raw)
}

export async function readDocxBytes(bytes: Uint8Array): Promise<string> {
  const entry = await extractZipEntry(bytes, 'word/document.xml')
  const xml = entry ? new TextDecoder('utf-8').decode(entry) : ''
  const text = xml ? textFromWordXml(xml) : scanWtFromBinary(bytes)
  if (text.trim().length > 10) return text.trim()
  throw new Error('docx 读不出来，请另存为 .txt 再导入')
}

export async function readDocxFile(file: File): Promise<string> {
  return readDocxBytes(new Uint8Array(await file.arrayBuffer()))
}
