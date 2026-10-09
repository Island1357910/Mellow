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
    const compData = data.slice(dataStart, dataStart + compSize)
    offset = dataStart + compSize

    if (name !== want) continue

    if (compression === 0) return compData
    if (compression === 8) return inflateDeflateRaw(compData)
    return null
  }
  return null
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
