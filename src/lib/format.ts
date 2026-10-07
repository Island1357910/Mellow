const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

export function formatLockDate(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS[date.getDay()]}`
}

export function formatClock(date: Date): string {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function formatChatTime(ts: number, now = Date.now()): string {
  const date = new Date(ts)
  const today = new Date(now)
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  if (sameDay) return formatClock(date)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export function initialOf(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '？'
  return [...trimmed][0] ?? '？'
}
