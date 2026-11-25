export function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('已停止生成', 'AbortError')
}

export function waitForAbort<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', cancel)
    const cancel = () => {
      cleanup()
      reject(new DOMException('请求已中止', 'AbortError'))
    }
    signal.addEventListener('abort', cancel)
    if (signal.aborted) cancel()
    work.then(value => { cleanup(); resolve(value) }, error => { cleanup(); reject(error) })
  })
}
