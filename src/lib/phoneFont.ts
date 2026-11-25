/** Scale inline font sizes the same way as the phone's stylesheet. */
export function phoneFontSize(px: number): string {
  return `calc(${px}px * var(--m-font-scale, 1))`
}
