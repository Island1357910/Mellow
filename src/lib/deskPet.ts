import { useMellow } from '../store/useMellow.ts'
import type { DeskPetPlace } from '../types/index.ts'

let pending = Promise.resolve()

export function updateDeskPet(change: (current: DeskPetPlace) => DeskPetPlace): Promise<void> {
  const next = pending.catch(() => {}).then(() => {
    const { settings, patchSettings } = useMellow.getState()
    const pet = settings.home.pet ?? { shown: false, x: 16, y: 240 }
    const updated = change(pet)
    if (updated !== pet) return patchSettings({ home: { ...settings.home, pet: updated } })
  })
  pending = next
  return next
}
