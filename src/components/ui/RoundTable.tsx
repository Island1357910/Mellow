import type { ReactNode } from 'react'
import { initialOf } from '../../lib/format.ts'

export function RoundTable(props: {
  names: string[]
  turn?: number | null
  center?: ReactNode
  badges?: Array<string | undefined>
  out?: boolean[]
  host?: number
  caption?: string
}) {
  const count = props.names.length
  if (count === 0) return null

  return (
    <div className="round-table-wrap">
      {props.caption ? <p className="round-table-caption">{props.caption}</p> : null}
      <div className="round-table" aria-label="圆桌座位">
        <div className="round-table-center">{props.center ?? <span className="round-table-mark">圆桌</span>}</div>
        {props.names.map((name, index) => {
          const angle = ((360 / count) * index + 90) * (Math.PI / 180)
          const radius = 44
          const x = 50 + radius * Math.cos(angle)
          const y = 50 + radius * Math.sin(angle)
          const active = props.turn === index
          const out = props.out?.[index]
          const host = props.host === index
          return (
            <div
              key={`${index}-${name}`}
              className={`round-seat${active ? ' is-turn' : ''}${out ? ' is-out' : ''}${index === 0 ? ' is-self' : ''}${host ? ' is-host' : ''}`}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <span className="round-seat-ring">
                <span className="round-seat-avatar">{initialOf(name)}</span>
              </span>
              <span className="round-seat-name">{index === 0 ? `${name}（我）` : name}</span>
              {props.badges?.[index] ? <span className="round-seat-badge">{props.badges[index]}</span> : null}
              {host ? <span className="round-seat-tag">主持</span> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
