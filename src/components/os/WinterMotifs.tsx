import type { CSSProperties } from 'react'

function WinterGlyph({ kind }: { kind: 'cocoa' | 'bread' | 'cake' | 'snow' | 'snowman' | 'cloud' }) {
  return <svg viewBox="0 0 80 80" width="100%" height="100%" fill="none" aria-hidden="true">
    {kind === 'cocoa' ? <><ellipse cx="38" cy="66" rx="30" ry="5" fill="#D9AC73" opacity=".5"/><path d="M57 32h5c17 0 13 24-3 21" stroke="#805139" strokeWidth="6"/><path d="M14 29h46v24Q58 68 37 68T14 53Z" fill="#D99351"/><ellipse cx="37" cy="30" rx="23" ry="7" fill="#70452F"/><path d="m25 25 8-2 2 8-8 2Zm17 0 8 2-2 7-8-2Z" fill="#FFF6DA"/><path d="M29 17q-7-5 0-12m15 12q-7-5 0-12" stroke="#B48D70" strokeWidth="2" strokeLinecap="round"/></> :
      kind === 'bread' ? <><path d="M11 49Q6 24 29 24q12-16 28 0 22 0 15 26l-5 15H16Z" fill="#D99D55"/><path d="M21 43q2-10 8-13m7 17q2-14 8-19m7 18q2-11 6-14" stroke="#FFF0C2" strokeWidth="5" strokeLinecap="round"/></> :
      kind === 'cake' ? <><path d="M16 38h49l-5 28H22Z" fill="#D9A16E"/><path d="M12 38q-2-11 10-13 0-12 14-12 14 0 15 12 18-1 17 13Z" fill="#FFF0CE"/><circle cx="40" cy="13" r="7" fill="#A85F42"/><path d="M28 47v12m13-12v12m12-12v12" stroke="#805139" strokeWidth="2"/></> :
      kind === 'snow' ? <g stroke="#75B8D8" strokeWidth="3" strokeLinecap="round"><path d="M40 8v64M12 24l56 32M12 56l56-32M32 15l8 8 8-8M32 65l8-8 8 8M16 35l11-3-3-11M56 59l-3-11 11-3M16 45l11 3-3 11M56 21l-3 11 11 3"/></g> :
      kind === 'snowman' ? <><circle cx="40" cy="53" r="23" fill="#FAFDFF" stroke="#B8DDED"/><circle cx="40" cy="24" r="16" fill="#FAFDFF" stroke="#B8DDED"/><path d="M23 11h34M30 11V3h20v8" stroke="#304D70" strokeWidth="6"/><path d="M26 37h29l-2 8H27Z" fill="#75B8D8"/><path d="m41 24 12 4-12 2Z" fill="#D99351"/><g fill="#304D70"><circle cx="34" cy="22" r="2"/><circle cx="46" cy="22" r="2"/><circle cx="40" cy="51" r="2"/><circle cx="40" cy="61" r="2"/></g></> :
      <path d="M17 59C0 57 4 35 21 34 22 12 53 12 58 34 77 28 84 59 64 59Z" fill="#FAFDFF" stroke="#B8DDED" strokeWidth="2"/>}
  </svg>
}

export function WinterMotifs({ widget = false }: { widget?: boolean }) {
  return <>{(['cocoa', 'ice'] as const).map(pack => <div key={pack} aria-hidden="true" className={'winter-motifs winter-' + pack + (widget ? ' winter-widget' : ' winter-wallpaper')}>
    {(pack === 'cocoa' ? ['cocoa', 'bread', 'cake', 'cocoa', 'bread', 'cake'] as const : ['snow', 'snowman', 'cloud', 'snow', 'cloud', 'snow'] as const).map((kind, i) => <span key={i} style={{ left: [5, 76, 12, 78, 9, 74][i] + '%', top: [12, 25, 45, 61, 79, 88][i] + '%', width: (widget ? 30 : i % 2 ? 55 : 65), transform: `rotate(${i % 2 ? 12 : -12}deg)` } as CSSProperties}><WinterGlyph kind={kind}/></span>)}
  </div>)}</>
}
