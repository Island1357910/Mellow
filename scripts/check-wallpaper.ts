import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { importChatBackground, importWallpaper, wallpaperMime } from '../src/lib/wallpaper.ts'
import { storage } from '../src/storage/StorageService.ts'
import { MetaDB } from '../src/storage/db.ts'
import { BUNDLED_THEMES, themeFromUnknown } from '../src/theme/themes.ts'
import { effectiveTheme } from '../src/theme/seasonal.ts'

assert.equal(wallpaperMime(Uint8Array.from([137,80,78,71,13,10,26,10]), ''), 'image/png')
assert.equal(wallpaperMime(Uint8Array.from([255,216,255,224]), 'application/octet-stream'), 'image/jpeg')
assert.equal(wallpaperMime(new TextEncoder().encode('GIF89a'), ''), 'image/gif')
assert.equal(wallpaperMime(new TextEncoder().encode('RIFF1234WEBP'), ''), 'image/webp')
assert.equal(wallpaperMime(new TextEncoder().encode('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>'), ''), 'image/svg+xml')
await assert.rejects(importWallpaper(new File([], 'empty.png')), /空文件/)
await assert.rejects(importWallpaper(new File([new Uint8Array(12 * 1024 * 1024 + 1)], 'huge.png')), /12MB/)

// Simulate browser decoding and encoding to check the sizes passed to the canvas.
const encodedSizes: Array<[number, number]> = []
const canvas = {
  width: 0, height: 0,
  getContext: () => ({ drawImage: () => {} }),
  toBlob: (done: (blob: Blob) => void, type: string) => {
    encodedSizes.push([canvas.width, canvas.height])
    done(new Blob([new Uint8Array(canvas.width === 1600 ? 2 * 1024 * 1024 + 1 : 16)], { type }))
  },
}
Object.assign(globalThis, {
  document: { createElement: () => canvas },
  Image: class {
    naturalWidth = 6000
    naturalHeight = 3000
    onload?: () => void
    set src(_value: string) { queueMicrotask(() => this.onload?.()) }
  },
  FileReader: class {
    result = ''
    onload?: () => void
    readAsDataURL(blob: Blob) {
      this.result = `data:${blob.type};base64,`
      queueMicrotask(() => this.onload?.())
    }
  },
})
const largePhoto = new File([Uint8Array.of(255, 216, 255), new Uint8Array(13 * 1024 * 1024)], 'photo.jpg')
assert.match(await importChatBackground(largePhoto), /^data:image\/jpeg;base64,/)
assert.deepEqual(encodedSizes, [[1600, 800], [800, 400]])
assert.equal(canvas.width, 0)
for (const key of ['document', 'Image', 'FileReader']) Reflect.deleteProperty(globalThis, key)

const wallpaper = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
const boot = await storage.boot()
const theme = { ...BUNDLED_THEMES.find(t => t.id === 'theme_macaron')!, id: 'theme_user_wallpaper', wallpaper, customPalette: true }
await storage.saveTheme(theme)
await storage.saveSettings({ ...boot.settings, themeId: theme.id })
const reopened = new MetaDB()
await reopened.open()
assert.equal((await reopened.settings.get('global'))?.themeId, theme.id)
assert.equal((await reopened.themes.get(theme.id))?.wallpaper, wallpaper, 'wallpaper survives a new database connection')
assert.equal(themeFromUnknown(JSON.parse(JSON.stringify(theme)))?.wallpaper, wallpaper)
assert.equal(effectiveTheme(theme, new Date(2026, 9, 31)).wallpaper, wallpaper, 'holiday layers do not replace personal wallpaper')
assert.equal(effectiveTheme(theme, new Date(2026, 10, 1)).wallpaper, wallpaper)
await storage.saveTheme({ ...theme, wallpaper: '' })
assert.equal((await reopened.themes.get(theme.id))?.wallpaper, '', 'clearing persists and does not resurrect an old wallpaper')
reopened.close()
console.log('Wallpaper checks passed: mobile MIME detection, file validation, save/reopen/export/clear and holiday precedence')
process.exit(0)
