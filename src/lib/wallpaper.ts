import { readFileBytes } from './fileSnapshot.ts'

export function wallpaperMime(bytes: Uint8Array, declared: string): string {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)) return 'image/png'
  const head = String.fromCharCode(...bytes.subarray(0, 16))
  if (/^GIF8[79]a/.test(head)) return 'image/gif'
  if (head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP') return 'image/webp'
  if (head.slice(4, 8) === 'ftyp' && /avif|avis/.test(head.slice(8))) return 'image/avif'
  const text = new TextDecoder().decode(bytes.subarray(0, 1024)).replace(/^\uFEFF/, '').trim()
  if (/^(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(text)) return 'image/svg+xml'
  return declared.startsWith('image/') ? declared : 'application/octet-stream'
}

export async function importWallpaper(file: File): Promise<string> {
  if (file.size > 12 * 1024 * 1024) throw new Error('壁纸不能超过 12MB，请选择较小的图片')
  const bytes = await readFileBytes(file)
  if (!bytes.length) throw new Error('图片是空文件，请重新选择')
  if (bytes.length > 12 * 1024 * 1024) throw new Error('壁纸不能超过 12MB，请选择较小的图片')
  const type = wallpaperMime(bytes, file.type)
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('图片读取失败'))
    reader.onerror = () => reject(new Error('图片读取失败，请重新选择'))
    reader.onabort = () => reject(new Error('图片读取已取消，请重新选择'))
    reader.readAsDataURL(new Blob([bytes as BlobPart], { type }))
  })
  await new Promise<void>((resolve, reject) => {
    const image = new Image()
    image.onload = () => { image.onload = image.onerror = null; resolve() }
    image.onerror = () => { image.onload = image.onerror = null; reject(new Error('这张图片无法显示，请尝试 JPG、PNG、GIF 或 WebP 格式')) }
    image.src = data
  })
  return data
}
