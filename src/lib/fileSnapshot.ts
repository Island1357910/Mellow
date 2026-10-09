function readViaFileReader(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result))
        return
      }
      reject(new Error('文件读不出来'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('文件读不出来'))
    reader.readAsArrayBuffer(file)
  })
}

function readViaDataUrl(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string' || !result.includes(',')) {
        reject(new Error('文件读不出来'))
        return
      }
      const b64 = result.split(',')[1] ?? ''
      const binary = atob(b64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
      resolve(bytes)
    }
    reader.onerror = () => reject(reader.error ?? new Error('文件读不出来'))
    reader.readAsDataURL(file)
  })
}

/** 兼容手机 QQ/微信：arrayBuffer 失败时用 FileReader 再试。 */
export async function readFileBytes(file: File): Promise<Uint8Array> {
  try {
    return new Uint8Array(await file.arrayBuffer())
  } catch {
    try {
      return await readViaFileReader(file)
    } catch {
      return readViaDataUrl(file)
    }
  }
}

export async function readFileText(file: File): Promise<string> {
  try {
    const text = await file.text()
    if (text.trim()) return text
  } catch {
    // fall through
  }
  const bytes = await readFileBytes(file)
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

export async function snapshotFile(file: File): Promise<File> {
  const bytes = await readFileBytes(file)
  const type = file.type || 'application/octet-stream'
  const copy = new Uint8Array(bytes.length)
  copy.set(bytes)
  return new File([copy], file.name, { type, lastModified: file.lastModified })
}

export function deferTask<T>(fn: () => Promise<T>, ms = 80): Promise<T> {
  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      void fn().then(resolve, reject)
    }, ms)
  })
}
