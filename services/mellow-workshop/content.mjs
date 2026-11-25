import Ajv from 'ajv'

const ajv = new Ajv({ ownProperties: true })
const string = (maxLength, minLength = 0) => ({ type: 'string', minLength, maxLength })
const object = (properties, required) => ({ type: 'object', properties, required, additionalProperties: false })

export const validateWork = ajv.compile(object({
  title: string(80, 1),
  summary: string(800),
  endpoints: { type: 'array', maxItems: 12, uniqueItems: true, items: string(500, 1) },
  content: { type: 'object' },
  cover: string(2800000, 1),
}, ['title', 'summary', 'endpoints', 'content']))

const version = { const: 1 }
export const payloads = {
  character: ajv.compile(object({
    version, persona: string(24000, 1), world: string(16000), greeting: string(4000),
  }, ['version', 'persona'])),
  dlc: ajv.compile(object({
    version,
    app: { const: 'oracle' },
    theme_color: { type: 'string', pattern: '^#[a-fA-F0-9]{6}$' },
    system_prompt_addon: string(12000),
    custom_buttons: {
      type: 'array', maxItems: 8, items: object({
        label: string(40, 1), instruction: string(2000, 1),
      }, ['label', 'instruction']),
    },
  }, ['version'])),
}

const turns = { type: 'array', minItems: 1, maxItems: 24, items: object({
  role: { enum: ['user', 'assistant'] }, content: string(8000, 1),
}, ['role', 'content']) }

export const validateReviewPlay = ajv.compile(object({
  revision: { type: 'integer', minimum: 1 },
  action: { type: 'integer', minimum: 0, maximum: 7 },
  messages: turns,
}, ['revision', 'messages']))

export const validatePlay = ajv.compile(object({
  endpoint: string(500, 1), key: { type: 'string', minLength: 1, maxLength: 1024, pattern: '^[!-~]+$' }, model: string(120, 1),
  dlc: { type: 'array', maxItems: 4, uniqueItems: true, items: string(36, 36) },
  button: object({ id: string(36, 36), index: { type: 'integer', minimum: 0, maximum: 7 } }, ['id', 'index']),
  messages: turns,
}, ['endpoint', 'key', 'model', 'dlc', 'messages']))

export const validateProtectedPlay = ajv.compile({ ...object({
  endpoint: string(500, 1), key: { type: 'string', minLength: 1, maxLength: 1024, pattern: '^[!-~]+$' }, model: string(120, 1),
  channel: { enum: ['sms', 'offline', 'side'] },
  cast: { type: 'array', maxItems: 3, uniqueItems: true, items: string(36, 36) },
  dlc: { type: 'array', maxItems: 4, uniqueItems: true, items: string(36, 36) },
  button: object({ id: string(36, 36), index: { type: 'integer', minimum: 0, maximum: 7 } }, ['id', 'index']),
  messages: { ...turns, items: { oneOf: [
    object({ role: { const: 'user' }, content: string(8000, 1) }, ['role', 'content']),
    object({ role: { const: 'assistant' }, content: string(8000, 1), receipt: { type: 'string', pattern: '^[a-f0-9]{64}$' } }, ['role', 'content', 'receipt']),
  ] } },
}, ['dlc', 'messages']), dependencies: { endpoint: ['key', 'model'], key: ['endpoint', 'model'], model: ['endpoint', 'key'] } })

export function publicWork(row) {
  const { title, summary, endpoints, content, cover } = JSON.parse(row.published)
  const display = row.type === 'dlc'
    ? { app: content.app, theme_color: content.theme_color, buttons: content.custom_buttons?.map(({ label }) => label) ?? [], usesModel: Boolean(content.system_prompt_addon || content.custom_buttons?.length) }
    : { greeting: content.greeting }
  return { id: row.id, type: row.type, title, summary, endpoints, display, hasCover: Boolean(cover) }
}

function jpegOrientation(bytes, start, end) {
  if (end - start < 14 || bytes.toString('ascii', start, start + 6) !== 'Exif\0\0') return 1
  const base = start + 6
  const order = bytes.toString('ascii', base, base + 2)
  if (order !== 'II' && order !== 'MM') return 1
  const short = at => order === 'II' ? bytes.readUInt16LE(at) : bytes.readUInt16BE(at)
  const long = at => order === 'II' ? bytes.readUInt32LE(at) : bytes.readUInt32BE(at)
  if (short(base + 2) !== 42) return 1
  const directory = base + long(base + 4)
  if (directory + 2 > end) return 1
  const entries = short(directory)
  for (let index = 0; index < entries; index++) {
    const offset = directory + 2 + index * 12
    if (offset + 12 > end) break
    if (short(offset) === 0x0112 && short(offset + 2) === 3 && long(offset + 4) === 1) return short(offset + 8)
  }
  return 1
}

export function readCover(value, maxBytes = 2 * 1024 * 1024) {
  if (typeof value !== 'string' || value.length > Math.ceil(maxBytes / 3) * 4 + 32) return null
  const declared = /^data:(image\/(?:jpeg|png|webp));base64,/.exec(value)
  const base64 = declared ? value.slice(declared[0].length) : value
  const bytes = Buffer.from(base64, 'base64')
  if (bytes.length < 24 || bytes.length > maxBytes || bytes.toString('base64') !== base64) return null
  function image(type, width, height) {
    if ((!declared && type !== 'image/jpeg') || (declared && declared[1] !== type) ||
        width < 1 || height < 1 || width * height > 24000000) return null
    return { bytes, type, width, height }
  }
  if (bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) && bytes.toString('ascii', 12, 16) === 'IHDR') {
    return image('image/png', bytes.readUInt32BE(16), bytes.readUInt32BE(20))
  }
  if (bytes.length >= 30 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' && bytes.readUInt32LE(4) === bytes.length - 8) {
    const chunk = bytes.toString('ascii', 12, 16)
    if (chunk === 'VP8X') return image('image/webp', 1 + bytes.readUIntLE(24, 3), 1 + bytes.readUIntLE(27, 3))
    if (chunk === 'VP8L' && bytes[20] === 0x2f) {
      const size = bytes.readUInt32LE(21)
      return image('image/webp', 1 + (size & 0x3fff), 1 + ((size >>> 14) & 0x3fff))
    }
    if (chunk === 'VP8 ' && bytes.subarray(23, 26).equals(Buffer.from('9d012a', 'hex'))) {
      return image('image/webp', bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff)
    }
    return null
  }
  if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255 || bytes.readUInt16BE(bytes.length - 2) !== 0xffd9) return null
  let orientation = 1
  let dimensions
  for (let offset = 2; offset + 4 <= bytes.length;) {
    if (bytes[offset] !== 255) return null
    const marker = bytes[offset + 1]
    const length = bytes.readUInt16BE(offset + 2)
    if (length < 2 || offset + 2 + length > bytes.length) return null
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      if (length < 11 || bytes[offset + 4] !== 8) return null
      const height = bytes.readUInt16BE(offset + 5)
      const width = bytes.readUInt16BE(offset + 7)
      dimensions = { width, height }
    }
    if (marker === 0xe1) orientation = jpegOrientation(bytes, offset + 4, offset + 2 + length)
    if (marker === 0xda) {
      if (!dimensions) return null
      const { width, height } = dimensions
      return orientation >= 5 && orientation <= 8 ? image('image/jpeg', height, width) : image('image/jpeg', width, height)
    }
    offset += 2 + length
  }
  return null
}

function publicPng(bytes) {
  const fixed = new Map([['IHDR', 13], ['IEND', 0], ['sRGB', 1], ['gAMA', 4], ['cHRM', 32], ['pHYs', 9]])
  const chunks = [bytes.subarray(0, 8)]
  for (let at = 8; at + 12 <= bytes.length;) {
    const size = bytes.readUInt32BE(at)
    const end = at + 12 + size
    if (end > bytes.length) return null
    const type = bytes.toString('ascii', at + 4, at + 8)
    if (fixed.get(type) === size || type === 'IDAT' ||
        (type === 'PLTE' && size <= 768 && size % 3 === 0) || (type === 'tRNS' && size <= 256)) chunks.push(bytes.subarray(at, end))
    if (type === 'IEND') return Buffer.concat(chunks)
    at = end
  }
  return null
}

function publicJpeg(bytes) {
  const chunks = [bytes.subarray(0, 2)]
  let orientation = 1
  let scanning = false
  for (let at = 2; at < bytes.length;) {
    if (scanning) {
      let marker = bytes.indexOf(0xff, at)
      while (marker >= 0) {
        let next = marker + 1
        while (bytes[next] === 0xff) next++
        if (bytes[next] !== 0 && !(bytes[next] >= 0xd0 && bytes[next] <= 0xd7)) break
        marker = bytes.indexOf(0xff, next + 1)
      }
      if (marker < 0) return null
      chunks.push(bytes.subarray(at, marker))
      at = marker
      scanning = false
    }
    const start = at
    if (bytes[at++] !== 0xff) return null
    while (bytes[at] === 0xff) at++
    const marker = bytes[at++]
    if (marker === 0xd9) {
      chunks.push(Buffer.from([0xff, 0xd9]))
      if (orientation >= 2 && orientation <= 8) {
        const exif = Buffer.from('ffe1002245786966000049492a0008000000010012010300010000000100000000000000', 'hex')
        exif[28] = orientation
        chunks.splice(1, 0, exif)
      }
      return Buffer.concat(chunks)
    }
    if (marker === 0x01) { chunks.push(bytes.subarray(start, at)); continue }
    if (at + 2 > bytes.length) return null
    const size = bytes.readUInt16BE(at)
    const end = at + size
    if (size < 2 || end > bytes.length) return null
    if (marker === 0xe1 && bytes.toString('ascii', at + 2, at + 8) === 'Exif\0\0') orientation = jpegOrientation(bytes, at + 2, end)
    if (marker === 0xee && size === 14 && bytes.toString('ascii', at + 2, at + 7) === 'Adobe') {
      const adobe = Buffer.from('ffee000e41646f626500640000000000', 'hex')
      adobe[15] = bytes[end - 1]
      chunks.push(adobe)
    } else if (marker !== 0xfe && !(marker >= 0xe0 && marker <= 0xef)) chunks.push(bytes.subarray(start, end))
    at = end
    scanning = marker === 0xda
  }
  return null
}

function webpChunk(type, data) {
  const header = Buffer.alloc(8)
  header.write(type, 0, 'ascii')
  header.writeUInt32LE(data.length, 4)
  return Buffer.concat([header, data, Buffer.alloc(data.length % 2)])
}

function webpChunks(bytes, start, last, frame = false) {
  const render = new Set(frame ? ['ALPH', 'VP8 ', 'VP8L'] : ['ALPH', 'VP8 ', 'VP8L', 'ANIM'])
  const result = []
  for (let at = start; at < last;) {
    if (at + 8 > last) return null
    const size = bytes.readUInt32LE(at + 4)
    const end = at + 8 + size
    if (end + size % 2 > last) return null
    const type = bytes.toString('ascii', at, at + 4)
    const data = bytes.subarray(at + 8, end)
    if (render.has(type)) result.push(webpChunk(type, type === 'ANIM' ? data.subarray(0, 6) : data))
    else if (!frame && type === 'VP8X' && data.length >= 10) {
      const header = Buffer.from(data.subarray(0, 10))
      header[0] &= 0x12
      header.fill(0, 1, 4)
      result.push(webpChunk(type, header))
    } else if (!frame && type === 'ANMF' && data.length >= 16) {
      const frameChunks = webpChunks(data, 16, data.length, true)
      if (!frameChunks) return null
      result.push(webpChunk(type, Buffer.concat([data.subarray(0, 16), ...frameChunks])))
    }
    at = end + size % 2
  }
  return result
}

export function publicCover(image) {
  if (image.type === 'image/png') return publicPng(image.bytes)
  if (image.type === 'image/jpeg') return publicJpeg(image.bytes)
  const chunks = webpChunks(image.bytes, 12, image.bytes.length)
  if (!chunks?.length) return null
  const header = Buffer.from(image.bytes.subarray(0, 12))
  header.writeUInt32LE(4 + chunks.reduce((size, chunk) => size + chunk.length, 0), 4)
  return Buffer.concat([header, ...chunks])
}

export function uploadedMod(input) {
  if (!input || typeof input !== 'object' || Object.keys(input).some(key => key !== 'manifest' && key !== 'cover') ||
      typeof input.manifest !== 'string' || input.manifest.length > 64000) return null
  try {
    const manifest = JSON.parse(input.manifest)
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return null
    const { type, category, title, summary, endpoints, content, ...extra } = manifest
    if ((type !== undefined && type !== 'dlc') || (category !== undefined && category !== 'mod') || Object.keys(extra).length) return null
    return { title, summary, endpoints: endpoints ?? [], content, cover: input.cover }
  } catch { return null }
}
