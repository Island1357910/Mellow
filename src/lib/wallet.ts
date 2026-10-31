import { storage } from '../storage/StorageService.ts'

const locks = new Map<string, Promise<unknown>>()
/** 同一身份的钱包读写串行化，避免连续点击丢失余额。 */
export function walletTask<T>(namespace: string, task: () => Promise<T>): Promise<T> {
  const previous = locks.get(namespace) ?? Promise.resolve()
  const result = previous.catch(() => {}).then(task)
  locks.set(namespace, result)
  void result.finally(() => { if (locks.get(namespace) === result) locks.delete(namespace) }).catch(() => {})
  return result
}
export async function readCoins(namespace: string): Promise<number> {
  const value = await storage.getBag<number>(namespace, 'coins')
  return typeof value === 'number' && Number.isFinite(value) ? value : 20
}
export async function addCoins(namespace: string, delta: number): Promise<number> {
  return walletTask(namespace, async () => {
    const next = Math.max(0, (await readCoins(namespace)) + delta)
    await storage.setBag(namespace, 'coins', next)
    return next
  })
}
export async function spendCoins(namespace: string, cost: number): Promise<number> {
  return walletTask(namespace, async () => {
    if (!Number.isFinite(cost) || cost < 0) throw new Error('金额无效')
    const balance = await readCoins(namespace)
    if (balance < cost) throw new Error(`还差 ${cost - balance} 枚`)
    await storage.setBag(namespace, 'coins', balance - cost)
    return balance - cost
  })
}
