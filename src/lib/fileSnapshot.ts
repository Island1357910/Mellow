function readViaFileReader(file: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result))
        return
      }
      reject(new Error('文件读不出来'))
    }
    reader.onerror = reader.onabort = () => reject(new Error('文件读不出来，请从手机的「下载」文件夹重新选择'))
    reader.readAsArrayBuffer(file)
  })
}

export async function readFileText(file: File): Promise<string> {
  try {
    return await file.text()
  } catch {
    return readTextWithFileReader(file)
  }
}

function readTextWithFileReader(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('文件读不出来'))
    }
    reader.onerror = reader.onabort = () => reject(new Error('文件读不出来，请从手机的「下载」文件夹重新选择'))
    reader.readAsText(file)
  })
}

/** 兼容手机 QQ/微信：arrayBuffer 失败时用 FileReader 再试。 */
export async function readFileBytes(file: Blob): Promise<Uint8Array> {
  try {
    return new Uint8Array(await file.arrayBuffer())
  } catch {
    return readViaFileReader(file)
  }
}

export function checkImportSize(file: File, maxMB: number) {
  if (!file.size) throw new Error('文件为空，请重新选择')
  if (file.size > maxMB * 1024 * 1024) throw new Error(`文件超过 ${maxMB} MB，请拆分或缩小文件后再导入`)
}

export function deferTask<T>(fn: () => Promise<T>, ms = 80): Promise<T> {
  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      void fn().then(resolve, reject)
    }, ms)
  })
}
