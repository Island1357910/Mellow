export type TableMoment = { text: string; finished?: boolean; roundStart?: boolean }

/** One request at a time. New public events wait for the current reply. */
export function createTableReactions(options: {
  answer: (events: TableMoment[], history: string[]) => Promise<string>
  onLines: (lines: string[]) => void
  onBusy: (busy: boolean) => void
  onError: (message: string) => void
}) {
  let pending: TableMoment[] = [], history: string[] = [], active = true, running = false
  let failed: TableMoment[] = []
  const drain = async () => {
    if (!active || running || !pending.length) return
    running = true
    options.onBusy(true)
    options.onError('')
    const batch = [...failed, ...pending]
    failed = []
    pending = []
    try {
      const answer = await options.answer(batch, history.slice(-12))
      if (!active) return
      if (!answer.trim()) throw new Error('角色本次没有返回内容，请重试互动')
      history = [...history, ...batch.map(e => `本局事件：${e.text}`), answer].slice(-24)
      failed = []
      options.onLines([...history])
    } catch (error) {
      if (active) {
        failed = batch.slice(-12)
        options.onError(error instanceof Error ? error.message : '角色互动暂时没接上')
      }
    } finally {
      running = false
      if (active) {
        options.onBusy(false)
        void drain()
      }
    }
  }
  return {
    push(event: TableMoment) {
      if (!active || !event.text.trim()) return
      pending.push(event)
      // Long matches keep recent moves and always retain the final result.
      if (pending.length > 12) pending.splice(0, pending.length - 12)
      void drain()
    },
    retry() {
      if (!active || running || !failed.length) return
      pending = [...failed, ...pending]
      failed = []
      void drain()
    },
    dispose() { active = false; pending = []; failed = [] },
  }
}
