import { storage } from '../storage/StorageService.ts'
import { withRemote } from './spaceRules.ts'

export {
  canEnterScene,
  describeSpace,
  endScene,
  enterScene,
  leaveScene,
  locationLabel,
} from './spaceRules.ts'

export async function noteRemoteChat(namespace: string, charId: string, active: boolean): Promise<void> {
  const space = await storage.getSpace(namespace)
  const next = withRemote(space, charId, active)
  if (next === space) return
  await storage.saveSpace(namespace, next)
}
