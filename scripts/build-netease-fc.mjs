import fs from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'
const root = process.cwd()
const output = path.join(root, 'artifacts/netease-fc-package')
await fs.mkdir(output, { recursive: true })
const source = await fs.readFile(path.join(root, 'src/lib/neteaseProtocol.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, reportDiagnostics: true })
if (compiled.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error)) throw Error('NetEase protocol compilation failed')
await fs.writeFile(path.join(output, 'netease.mjs'), compiled.outputText)
await fs.copyFile(path.join(root, 'services/mellow-netease-fc/index.mjs'), path.join(output, 'index.mjs'))
await fs.copyFile(path.join(root, 'public/licenses/netease-account.txt'), path.join(output, 'LICENSE.txt'))
console.log('FC code prepared: Node.js 20, index.handler, no runtime npm dependencies')
