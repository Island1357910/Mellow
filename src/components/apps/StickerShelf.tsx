import { useEffect, useState } from 'react'
import type { Sticker } from '../../data/stickers.ts'
import { addStickers, loadStickerLibrary, parseStickerBatch, removeSticker, visibleStickers } from '../../lib/stickerLibrary.ts'

export function StickerShelf(props: { onBack: () => void; onSend: (url: string) => void }) {
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [mode, setMode] = useState<'pick' | 'add' | 'edit'>('pick')
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState<Sticker | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    void loadStickerLibrary().then((library) => {
      if (live) setStickers(visibleStickers(library))
    })
    return () => { live = false }
  }, [])

  const saveBatch = async () => {
    const parsed = parseStickerBatch(draft)
    if (parsed.error) {
      setNote(parsed.error)
      return
    }
    setBusy(true)
    try {
      const next = await addStickers(parsed.stickers)
      setStickers(next)
      setDraft('')
      setNote(`已录入 ${parsed.stickers.length} 个`)
      setMode('pick')
    } catch (error) {
      setNote(error instanceof Error ? error.message : '没录进去')
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!pending || busy) return
    setBusy(true)
    try {
      const next = await removeSticker(pending.url)
      setStickers(next)
      setPending(null)
      setNote('已删掉')
    } catch (error) {
      setNote(error instanceof Error ? error.message : '没删掉')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button type="button" className="chip px-2.5 py-1 text-[11px]" onClick={() => { setPending(null); setNote(''); if (mode === 'pick') props.onBack(); else setMode('pick') }}>‹ {mode === 'pick' ? '返回' : '表情'}</button>
        {mode === 'pick' ? (
          <span className="flex gap-1">
            <button type="button" className="chip px-2.5 py-1 text-[11px]" onClick={() => { setNote(''); setMode('add') }}>添加</button>
            <button type="button" className="chip px-2.5 py-1 text-[11px]" onClick={() => { setNote(''); setMode('edit') }}>整理</button>
          </span>
        ) : mode === 'edit' ? (
          <button type="button" className="chip px-2.5 py-1 text-[11px]" onClick={() => { setPending(null); setMode('pick') }}>完成</button>
        ) : (
          <button type="button" className="chip px-2.5 py-1 text-[11px]" disabled={busy || !draft.trim()} onClick={() => void saveBatch()}>{busy ? '在录…' : '录入'}</button>
        )}
      </div>
      {note ? <p role="status" className="mb-2 text-xs" style={{ color: 'var(--m-text-secondary)' }}>{note}</p> : null}
      {mode === 'add' ? (
        <label className="block text-xs" style={{ color: 'var(--m-text-secondary)' }}>
          第一行是图片网址，第二行是这个表情的意思。要加多个，就按这个顺序接着写。
          <textarea aria-label="批量录入表情包" className="soft-input mt-2 h-36 w-full resize-none text-sm" placeholder={'https://example.com/a.jpg\n开心\nhttps://example.com/b.jpg\n无语'} value={draft} onChange={(event) => setDraft(event.target.value)} />
        </label>
      ) : (
        <>
          <p className="mb-2 text-xs" style={{ color: 'var(--m-text-secondary)' }}>{mode === 'edit' ? '点一张，再确认删掉。' : '点一下就发出'}</p>
          {pending ? (
            <p className="mb-2 flex flex-wrap items-center gap-2 text-xs">
              删掉「{pending.label}」？
              <button type="button" className="chip px-2.5 py-1 text-[11px]" disabled={busy} onClick={() => void confirmDelete()}>删掉</button>
              <button type="button" className="chip px-2.5 py-1 text-[11px]" disabled={busy} onClick={() => setPending(null)}>留下</button>
            </p>
          ) : null}
          <div className="grid max-h-52 grid-cols-4 gap-2 overflow-y-auto">
            {stickers.map((item) => (
              <button
                key={item.url}
                type="button"
                title={item.label}
                aria-label={mode === 'edit' ? `删除${item.label}` : item.label}
                className="overflow-hidden rounded-2xl bg-[#FFF8EC] transition-transform active:scale-95"
                onClick={() => {
                  if (mode === 'edit') setPending(item)
                  else props.onSend(item.url)
                }}
              >
                <img src={item.url} alt={item.label} className="aspect-square w-full object-contain p-1" loading="lazy" />
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
