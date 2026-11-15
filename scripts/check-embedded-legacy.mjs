import fs from 'node:fs'
import { parse } from 'acorn'

function walk(node, file) {
  if (!node || typeof node !== 'object') return
  if ((node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration' || node.type === 'ArrowFunctionExpression') && node.async && node.generator) {
    throw new Error(`${file} contains an async generator`)
  }
  if (node.type === 'ChainExpression') throw new Error(`${file} contains optional chaining`)
  if (node.type === 'LogicalExpression' && node.operator === '??') throw new Error(`${file} contains nullish coalescing`)
  if (node.type === 'ImportExpression') throw new Error(`${file} contains dynamic import`)
  if (node.regex && /\(\?<[=!]|\\[pP]\{/.test(node.regex.pattern)) throw new Error(`${file} contains a modern regexp`)
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(item => walk(item, file))
    else if (value && typeof value === 'object') walk(value, file)
  }
}

const legacy = ['public/bakery/assets', 'public/live-simulator/assets'].flatMap(dir =>
  fs.readdirSync(dir).filter(name => name.includes('-legacy-') && name.endsWith('.js')).map(name => `${dir}/${name}`),
)
for (const file of legacy) {
  walk(parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 2018, sourceType: 'script' }), file)
  console.log('legacy ok', file)
}
for (const file of ['public/bakery/compat.css', 'public/live-simulator/compat.css']) {
  const css = fs.readFileSync(file, 'utf8')
  if (/@layer\b/.test(css)) throw new Error(`${file} still has @layer`)
  if (file.includes('live-simulator') && !css.includes('height:100vh') && !css.includes('height: 100vh')) {
    throw new Error(`${file} lost the old viewport height`)
  }
  console.log('css ok', file)
}
for (const file of ['public/bakery/index.html', 'public/live-simulator/index.html']) {
  const html = fs.readFileSync(file, 'utf8')
  if (!html.includes('nomodule') || !html.includes('compat.css')) throw new Error(`${file} missing fallback`)
  if (/<script[^>]*crossorigin[^>]*src="\.\//.test(html)) throw new Error(`${file} local script still uses crossorigin`)
  console.log('html ok', file)
}
console.log('Embedded legacy checks passed.')
