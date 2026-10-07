import { useMellow } from '../store/useMellow.ts'

const running = new Set<string>()

export function isAiJobRunning(key: string): boolean {
  return running.has(key)
}

/** 后台跑 AI 任务：退出界面也会继续，完成后 touchData 刷新 UI。同 key 不重复跑。 */
export function runAiJob(key: string, task: () => Promise<void>): boolean {
  if (running.has(key)) return false
  running.add(key)
  void (async () => {
    try {
      await task()
    } finally {
      running.delete(key)
      useMellow.getState().touchData()
    }
  })()
  return true
}

export function jobKey(namespace: string, scope: string, id?: string): string {
  return id ? `${namespace}:${scope}:${id}` : `${namespace}:${scope}`
}
