import { storage } from '../storage/StorageService.ts'

export async function readCoins(namespace: string): Promise<number> {
  const value = await storage.getBag<number>(namespace, 'coins')
  return typeof value === 'number' ? value : 20
}

export async function addCoins(namespace: string, delta: number): Promise<number> {
  const next = Math.max(0, (await readCoins(namespace)) + delta)
  await storage.setBag(namespace, 'coins', next)
  return next
}
