// Isolated local QA: fail the first startup transaction, then allow real retry.
import '../../src/lib/runtimeCompat.ts'
import '../../src/index.css'
import Dexie from 'dexie'
import { createRoot } from 'react-dom/client'
import App from '../../src/App.tsx'

let injected = false
const transaction = Dexie.prototype.transaction
Dexie.prototype.transaction = function (...args: unknown[]) {
  if (!injected && this.name === 'mellow_meta') {
    injected = true
    return Dexie.Promise.reject(new Dexie.PrematureCommitError('Transaction committed too early. Simulated startup failure.'))
  }
  return transaction.apply(this, args as never)
} as typeof transaction
createRoot(document.getElementById('root')!).render(<App/>)
