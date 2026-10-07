import type { CSSProperties } from 'react'

export function candyStyle(candy: string, candy2: string, candy3?: string): CSSProperties {
  return {
    ['--candy' as string]: candy,
    ['--candy-2' as string]: candy2,
    ...(candy3 ? { ['--candy-3' as string]: candy3 } : {}),
  }
}
