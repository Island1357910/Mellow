import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { importWallpaper, wallpaperMime } from '../src/lib/wallpaper.ts'
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
