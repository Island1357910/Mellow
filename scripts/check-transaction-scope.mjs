import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import assert from 'node:assert/strict'

// Regression guard for old WebViews: native async callbacks/foreign promises can
// cross an IndexedDB task boundary even when every awaited operation is a DB call.
const original = Dexie.prototype.transaction
Dexie.prototype.transaction = function (...args) {
  const scope = args.pop()
  assert.notEqual(scope[Symbol.toStringTag], 'AsyncFunction', 'Use Dexie promise chains inside database transaction scopes')
  args.push(function (...params) {
    const result = scope.apply(this, params)
    if (result && typeof result.then === 'function') assert.ok(result instanceof Dexie.Promise, 'Transaction continuations must use Dexie promises')
    return result
  })
  return original.apply(this, args)
}
