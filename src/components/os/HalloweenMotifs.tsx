import type { CSSProperties } from 'react'

/** 节日纹样只改变装饰，不参与交互和读屏。由季节样式控制显隐。 */
export function HalloweenGlyph({ kind, size = 40, className = '', style }: { kind: 'ghost' | 'pumpkin' | 'bat' | 'web'; size?: number; className?: string; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" className={className} style={style}>
    {kind === 'ghost' ? <><path d="M14 50V27a18 18 0 0 1 36 0v23l-9-5-9 6-9-6-9 5Z" fill="currentColor" /><ellipse cx="25" cy="28" rx="3" ry="4" fill="#211b2c"/><ellipse cx="39" cy="28" rx="3" ry="4" fill="#211b2c"/><path d="M28 38q4 4 8 0" stroke="#211b2c" strokeWidth="2.5" strokeLinecap="round"/></> :
    kind === 'pumpkin' ? <><path d="M31 19q-3-11 8-12" stroke="#b9c093" strokeWidth="5" strokeLinecap="round"/><path d="M32 22C13 9 3 30 10 45q6 15 22 9c16 6 26-4 26-17S45 13 32 22Z" fill="currentColor"/><path d="M32 22c-12 0-14 26 0 32m0-32c12 0 14 26 0 32" stroke="#352334" strokeWidth="2" opacity=".3"/><path d="m18 34 9-6 2 10Zm28 0-9-6-2 10ZM20 43l8 3 4-3 4 3 8-3-5 8H25Z" fill="#211b2c"/></> :
    kind === 'bat' ? <path d="m29 25-4-9-3 8C13 17 5 16 3 17c5 4 4 11 2 15 9-3 14 0 15 7 5-2 8 1 12 9 4-8 7-11 12-9 1-7 6-10 15-7-2-4-3-11 2-15-2-1-10 0-19 7l-3-8-4 9Z" fill="currentColor"/> :
    <g stroke="currentColor" strokeWidth="1.4"><path d="M4 4h56M4 4v56M4 4l47 47M4 4l56 23M4 4l23 56"/><path d="M4 17q6-1 9-4 3-3 4-9M4 30q11-2 18-8 6-7 8-18M4 44q18-3 28-12 9-10 12-28M4 59q23-4 38-17 13-15 17-38"/></g>}
  </svg>
}
