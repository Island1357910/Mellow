import { Capacitor } from '@capacitor/core'

export function downloadJson(filename: string, data: unknown): void {
  downloadBlob(filename, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
}

export function downloadBlob(filename: string, blob: Blob): void {
  if (Capacitor.isNativePlatform()) {
    void shareNativeFile(filename, blob).catch((error: unknown) => {
      window.alert(`文件未导出：${error instanceof Error ? error.message : String(error)}`)
    })
    return
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

async function shareNativeFile(filename: string, blob: Blob): Promise<void> {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ])
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'))
    reader.readAsDataURL(blob)
  })
  const safeName = filename.replace(/[\\/\u0000-\u001f]/g, '_') || 'mellow-export.json'
  const { uri } = await Filesystem.writeFile({
    path: `exports/${Date.now()}-${safeName}`,
    data,
    directory: Directory.Cache,
    recursive: true,
  })
  await Share.share({ title: filename, url: uri, dialogTitle: '保存或分享文件' })
}

export function downloadBytes(filename: string, bytes: Uint8Array, mime: string): void {
  downloadBlob(filename, new Blob([bytes as BlobPart], { type: mime }))
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
