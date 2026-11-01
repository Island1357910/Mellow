import { useState, type InputHTMLAttributes } from 'react'
import { commitNumber } from '../../lib/numericDraft.ts'

/** Keep editing text separate from the saved number, including an empty draft. */
export function NumericInput({ value, onValueChange, min, max, onBlur, onKeyDown, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max'> & {
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = (text: string) => {
    const next = commitNumber(text, value, min, max)
    setDraft(null)
    if (next !== value) onValueChange(next)
  }
  return <input {...props} type="number" min={min} max={max} value={draft ?? value}
    onChange={event => setDraft(event.target.value)}
    onBlur={event => { commit(event.currentTarget.value); onBlur?.(event) }}
    onKeyDown={event => {
      if (event.key === 'Enter') commit(event.currentTarget.value)
      if (event.key === 'Escape') setDraft(null)
      onKeyDown?.(event)
    }}/>
}
