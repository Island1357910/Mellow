/** 选文件后立即读入内存，避免手机/QQ 浏览器在异步回调里读文件触发 Failed to fetch。 */
export async function snapshotFile(file: File): Promise<File> {
  const bytes = await file.arrayBuffer()
  const type = file.type || 'application/octet-stream'
  return new File([bytes], file.name, { type, lastModified: file.lastModified })
}

export function deferTask<T>(fn: () => Promise<T>, ms = 80): Promise<T> {
  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      void fn().then(resolve, reject)
    }, ms)
  })
}
