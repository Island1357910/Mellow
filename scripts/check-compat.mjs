import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { parse } from 'acorn'
import postcss from 'postcss'

const boot = fs.readFileSync('public/boot.js', 'utf8')
parse(boot, { ecmaVersion: 5 })
function startup(oldCss = false) {
  const elements = Object.fromEntries(['mellow-startup', 'mellow-startup-message', 'mellow-startup-help', 'mellow-startup-diagnostic'].map(id => [id, { textContent: '', style: {} }]))
  const listeners = {}, timers = new Map()
  const styles = []
  const window = { CSSLayerBlockRule: function () {}, CSS: { supports: () => !oldCss }, addEventListener: (name, callback) => { listeners[name] = callback } }
  const context = { window, document: { getElementById: id => elements[id], createElement: () => ({}), currentScript: { src: 'https://localhost/boot.js' }, head: { appendChild: style => styles.push(style) } }, navigator: { userAgent: 'OPPO A7 / compatibility fixture' },
    setTimeout: callback => { timers.set(1, callback); return 1 }, clearTimeout: id => timers.delete(id) }
  vm.runInNewContext(boot, context)
  return { elements, window, listeners, timers, styles }
}
let fixture = startup()
fixture.listeners.error({ message: 'Unexpected token ?' })
assert.notEqual(fixture.elements['mellow-startup-help'].style.display, 'block', 'modern syntax errors must not interrupt legacy fallback')
fixture.timers.get(1)()
assert.equal(fixture.elements['mellow-startup-help'].style.display, 'block')
assert.match(fixture.elements['mellow-startup-diagnostic'].textContent, /Unexpected token/)
fixture = startup(); fixture.window.__mellowStartup.ready()
assert.equal(fixture.timers.size, 0, 'successful startup cancels the watchdog')
fixture = startup(); fixture.window.__mellowStartup.fail('module download failed')
assert.match(fixture.elements['mellow-startup-message'].textContent, /没能启动/)
assert.match(fixture.elements['mellow-startup-diagnostic'].textContent, /module download failed/)
assert.equal(startup().styles.length, 0, 'modern browsers retain the normal CSS cascade')
assert.equal(startup(true).styles[0].href, 'https://localhost/compat.css')

const html = fs.readFileSync('dist/index.html', 'utf8')
assert.match(html, /nomodule/)
assert.match(html, /polyfills-legacy/)
assert.match(html, /id="mellow-startup"/)
const assets = fs.readdirSync('dist/assets')
const legacy = assets.filter(name => name.includes('-legacy-') && name.endsWith('.js'))
assert.ok(legacy.some(name => name.startsWith('renderApp-legacy-')))
function checkChrome60(code) {
  // Chrome 60 already supports object spread (ES2018), but not async generators,
  // dynamic import, Unicode property escapes or regexp lookbehind.
  const tree = parse(code, { ecmaVersion: 2018 })
  const walk = node => {
    if (!node || typeof node !== 'object') return
    if (node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration') assert.ok(!(node.async && node.generator))
    if (node.regex) assert.doesNotMatch(node.regex.pattern, /\(\?<([=!])|\\[pP]\{/)
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk)
      else if (value && typeof value === 'object') walk(value)
    }
  }
  walk(tree)
}
for (const name of legacy) checkChrome60(fs.readFileSync('dist/assets/' + name, 'utf8'))
checkChrome60(fs.readFileSync('node_modules/@capacitor/android/capacitor/src/main/assets/native-bridge.js', 'utf8'))
const css = fs.readFileSync('dist/compat.css', 'utf8')
assert.doesNotMatch(css, /@layer\b/, 'old WebViews ignore the contents of unsupported cascade layers')
assert.match(css, /height:100vh/)
assert.ok(fs.existsSync('dist/startup-error.html'))
const cap = JSON.parse(fs.readFileSync('capacitor.config.json', 'utf8'))
assert.equal(cap.server.errorPath, 'startup-error.html')
console.log(`Compatibility checks passed: ES5 loader/watchdog, ${legacy.length} Chrome 60 syntax-checked legacy chunks, native bridge syntax, flattened CSS layers and old viewport fallback`)

// Old engines discard whole @scope blocks. Inactive decorations must still be hidden.
const legacyTree = postcss.parse(css)
legacyTree.walkAtRules('scope', rule => rule.remove())
for (const selector of ['.apple-atmosphere', '.apple-widget-motifs', '.halloween-widget-motifs']) {
  let hidden = false
  legacyTree.walkRules(rule => {
    if (rule.selector.includes(selector) && !/:is\(|:where\(|:has\(/.test(rule.selector)) {
      rule.walkDecls('display', decl => { if (decl.value === 'none') hidden = true })
    }
  })
  assert(hidden, selector + ' needs a baseline hide rule outside unsupported scope blocks')
}
for (const selector of ['.launcher-col', '.dock-bar', '.home-search-wrap']) {
  let usableWidth = false
  legacyTree.walkRules(rule => {
    if (rule.selector.startsWith(selector)) rule.walkDecls('width', decl => {
      if (!/min\(|max\(|clamp\(/.test(decl.value)) usableWidth = true
    })
  })
  assert(usableWidth, selector + ' needs a width that works without CSS min/max/clamp')
}
assert.match(fs.readFileSync('android/app/src/main/AndroidManifest.xml','utf8'), /windowSoftInputMode="adjustResize"/)
console.log('Home compatibility checks passed: inactive motifs hidden without scope, legacy widths and IME resize policy')

// The PIN must remain visible even when the engine discards scoped theme rules.
function pinDeclaration(selector, property, expected) {
  let found = false
  legacyTree.walkRules(rule => {
    // Cascade-layer flattening adds synthetic :not(#...) specificity guards.
    const normalized = rule.selector.replace(/:not\(#[^)]*\)/g, '')
    if (!normalized.split(',').map(part => part.trim()).includes(selector)) return
    rule.walkDecls(property, decl => { if (expected.test(decl.value)) found = true })
  })
  assert(found, `${selector} needs compatible ${property} outside @scope`)
}
pinDeclaration('.secret-lock', 'overflow-y', /^auto$/)
pinDeclaration('.secret-lock .pin-content', 'margin', /^auto$/)
pinDeclaration('.pin-ui .pin-dot', 'width', /^11px$/)
pinDeclaration('.pin-ui .pin-dot', 'margin', /^0 7px$/)
pinDeclaration('.pin-ui .pin-pad', 'width', /^100%$/)
pinDeclaration('.pin-ui .pin-pad', 'max-width', /^252px$/)
pinDeclaration('.pin-ui .lock-key', 'background', /#fffaf6/)
pinDeclaration('.pin-ui .lock-key', 'border', /1px solid/)
console.log('PIN compatibility checks passed: unscoped dots, bounded keypad width, visible keys and scrollable layout')
