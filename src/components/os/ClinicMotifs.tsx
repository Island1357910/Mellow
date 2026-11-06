type Kind = 'scope' | 'syringe' | 'iv' | 'thermometer' | 'vial' | 'monitor' | 'bandage' | 'mask' | 'clipboard' | 'case'

export function ClinicGlyph({ kind, size = 80 }: { kind: Kind; size?: number }) {
  const glass = '#FFFEFC'
  const rose = '#F2B9C7'
  const highlight = '#FBE1D8'
  return (
    <svg viewBox="0 0 80 80" width={size} height={size} fill="none" stroke="#B76173" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === 'scope' && <>
        <path d="M22 16v15a14 14 0 0 0 28 0V16M36 45v8a12 12 0 0 0 24 0v-6" strokeWidth="3" />
        <circle cx="22" cy="16" r="4" fill={rose} />
        <circle cx="50" cy="16" r="4" fill={rose} />
        <circle cx="60" cy="40" r="8" fill={glass} />
        <circle cx="60" cy="40" r="3" fill={rose} stroke="none" />
      </>}
      {kind === 'syringe' && <g transform="rotate(33 40 40)">
        <rect x="30" y="22" width="20" height="30" rx="3" fill={glass} />
        <path d="M32 38h16v11H32z" fill={rose} stroke="none" />
        <path d="M33 10h14M40 10v12M27 22h26M32 29h6m-6 6h4m-4 6h6M36 52v6h8v-6M40 58v12" />
      </g>}
      {kind === 'iv' && <>
        <path d="M34 12v-3a6 6 0 0 1 12 0v3M40 49v9c0 10 14 9 14 0v-3" />
        <rect x="25" y="13" width="30" height="36" rx="7" fill={glass} />
        <path d="M27 33c9-5 17 4 26-1v10a5 5 0 0 1-5 5H32a5 5 0 0 1-5-5Z" fill={rose} stroke="none" />
        <path d="M33 25h8m-8 6h5M37 49v5h6v-5" />
      </>}
      {kind === 'thermometer' && <g transform="rotate(-27 40 40)">
        <path d="M34 52V17a6 6 0 0 1 12 0v35a12 12 0 1 1-12 0Z" fill={glass} />
        <path d="M40 36v23" strokeWidth="3" />
        <circle cx="40" cy="62" r="6" fill={rose} stroke="none" />
        <path d="M46 22h5m-5 8h5m-5 8h5" />
      </g>}
      {kind === 'vial' && <>
        <rect x="25" y="22" width="30" height="43" rx="7" fill={glass} />
        <rect x="25" y="14" width="30" height="12" rx="3" fill={rose} />
        <path d="M32 17v6m8-6v6m8-6v6" />
        <rect x="27" y="36" width="26" height="18" fill={highlight} stroke="none" />
        <path d="M35 45h10m-5-5v10" />
      </>}
      {kind === 'monitor' && <>
        <rect x="9" y="18" width="62" height="39" rx="7" fill={glass} />
        <rect x="14" y="23" width="46" height="29" rx="3" fill={highlight} stroke="none" />
        <path d="M18 39h8l4-6 5 12 6-17 4 11h11M31 57l-2 7h22l-2-7" />
        <circle cx="65" cy="39" r="2" fill={rose} />
      </>}
      {kind === 'bandage' && <g transform="rotate(-14 40 40)">
        <rect x="10" y="29" width="60" height="22" rx="11" fill={highlight} />
        <rect x="30" y="31" width="20" height="18" rx="5" fill={glass} stroke="none" />
        <path d="M18 36h4m-4 8h4m36-8h4m-4 8h4M36 40h8m-4-4v8" />
      </g>}
      {kind === 'mask' && <>
        <path d="M19 31C3 24 4 52 21 49m40-18c16-7 15 21-2 18" />
        <path d="M19 28c14 5 28 5 42 0v16c-1 9-9 14-21 17-12-3-20-8-21-17Z" fill={glass} />
        <path d="M26 38c9 3 19 3 28 0m-27 8c8 3 18 3 26 0" />
      </>}
      {kind === 'clipboard' && <>
        <rect x="20" y="16" width="40" height="49" rx="6" fill={glass} />
        <rect x="31" y="12" width="18" height="11" rx="3" fill={rose} />
        <path d="M29 34h12m-12 18h22M29 44h7l4-6 5 6h6" />
      </>}
      {kind === 'case' && <>
        <path d="M30 27v-5a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v5" />
        <rect x="13" y="26" width="54" height="36" rx="8" fill={glass} />
        <path d="M13 39h54" />
        <rect x="34" y="34" width="12" height="11" rx="3" fill={rose} />
        <path d="M40 48v8m-4-4h8" />
      </>}
    </svg>
  )
}

type Placement = { kind: Kind; left: string; top: string; size: number; turn: number }
type WallpaperPlacement = Placement & { layer: 'main' | 'detail' | 'distant' }
const WALL: WallpaperPlacement[] = [
  { kind: 'clipboard', left: '5%', top: '66%', size: 116, turn: -24, layer: 'distant' },
  { kind: 'mask', left: '90%', top: '88%', size: 82, turn: 11, layer: 'distant' },
  { kind: 'scope', left: '91%', top: '68%', size: 138, turn: 19, layer: 'distant' },
  { kind: 'iv', left: '86%', top: '46%', size: 182, turn: 15, layer: 'main' },
  { kind: 'monitor', left: '18%', top: '78%', size: 196, turn: -13, layer: 'main' },
  { kind: 'case', left: '11%', top: '13%', size: 47, turn: -15, layer: 'detail' },
  { kind: 'syringe', left: '10%', top: '33%', size: 65, turn: -18, layer: 'detail' },
  { kind: 'thermometer', left: '22%', top: '41%', size: 34, turn: 8, layer: 'detail' },
  { kind: 'vial', left: '68%', top: '60%', size: 33, turn: -9, layer: 'detail' },
  { kind: 'bandage', left: '61%', top: '84%', size: 43, turn: 18, layer: 'detail' },
]
const WIDGET: Placement[] = [
  { kind: 'monitor', left: '77%', top: '49%', size: 50, turn: 8 },
  { kind: 'bandage', left: '4%', top: '70%', size: 35, turn: -8 },
]

export function ClinicMotifs({ widget = false }: { widget?: boolean }) {
  if (widget) {
    return (
      <div aria-hidden="true" className="clinic-motifs clinic-widget">
        {WIDGET.map(item => <span key={item.kind} style={{ left: item.left, top: item.top, width: item.size, transform: `rotate(${item.turn}deg)` }}><ClinicGlyph kind={item.kind} /></span>)}
      </div>
    )
  }

  return (
    <div aria-hidden="true" className="clinic-motifs clinic-wallpaper">
      <svg className="clinic-trace" viewBox="0 0 400 66" width="400" height="66" fill="none">
        <path d="M0 38h76l8-8 9 8h20l8-15 10 30 11-43 11 28h27l8-8 9 8h128" stroke="#DA94A2" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {WALL.map(item => (
        <span key={item.kind} className={`clinic-motif-${item.layer}`} style={{ left: item.left, top: item.top, width: item.size, transform: `translate(-50%, -50%) rotate(${item.turn}deg)` }}>
          <ClinicGlyph kind={item.kind} />
        </span>
      ))}
    </div>
  )
}
