import { useState } from 'react'

export function RemoveChip(props: { onRemove: () => void; label?: string }) {
  const [ask, setAsk] = useState(false)
  if (ask) {
    return (
      <span className="inline-flex gap-1.5">
        <button type="button" className="chip" onClick={() => setAsk(false)}>留下</button>
        <button type="button" className="chip chip-solid" onClick={props.onRemove}>确认删除</button>
      </span>
    )
  }
  return <button type="button" className="chip" onClick={() => setAsk(true)}>{props.label ?? '删除'}</button>
}
