import type { AppSettings } from '../types/index.ts'

function toMinutes(value: string): number {
  const [hour, minute] = value.split(':').map((part) => Number(part))
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0
  return hour * 60 + minute
}

/** 时段可以跨过午夜，例如 23:00 到 08:00。 */
export function inQuietHours(settings: AppSettings, now = new Date()): boolean {
  if (!settings.quietHours) return false
  const current = now.getHours() * 60 + now.getMinutes()
  const start = toMinutes(settings.dndStart)
  const end = toMinutes(settings.dndEnd)
  if (start === end) return true
  if (start < end) return current >= start && current < end
  return current >= start || current < end
}

export function shouldSuppressMessage(settings: AppSettings, now = new Date()): boolean {
  return !settings.banner || settings.dnd || inQuietHours(settings, now)
}
