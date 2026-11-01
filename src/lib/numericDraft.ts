export function commitNumber(text: string, previous: number, min?: number, max?: number) {
  const parsed = text.trim() ? Number(text) : previous
  const value = Number.isFinite(parsed) ? parsed : previous
  return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value))
}
