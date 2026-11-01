import 'core-js/actual/structured-clone'
// The package's browser entry only re-exports native APIs; use its actual polyfill.
import { AbortController as CompatibleAbortController, AbortSignal as CompatibleAbortSignal } from 'abort-controller/dist/abort-controller.js'
import CompatibleResizeObserver from 'resize-observer-polyfill'

if (typeof globalThis.ResizeObserver !== 'function') {
  globalThis.ResizeObserver = CompatibleResizeObserver
}

if (typeof globalThis.AbortController !== 'function') {
  globalThis.AbortController = CompatibleAbortController as unknown as typeof AbortController
}
if (typeof globalThis.AbortSignal === 'undefined') {
  globalThis.AbortSignal = CompatibleAbortSignal as unknown as typeof AbortSignal
}
if (typeof AbortSignal.timeout !== 'function') {
  AbortSignal.timeout = (milliseconds: number) => {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new RangeError('Invalid timeout')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), milliseconds)
    controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
    return controller.signal
  }
}
