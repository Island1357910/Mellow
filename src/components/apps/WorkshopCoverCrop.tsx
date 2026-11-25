import { useEffect, useRef, useState } from 'react'
import { Crop } from 'lucide-react'

const clamp = (value: number) => Math.min(100, Math.max(0, value))

export function WorkshopCoverCrop({ image, onCancel, onConfirm }: {
  image: HTMLImageElement
  onCancel: () => void
  onConfirm: (source: string) => void
}) {
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 50, y: 50 })
  const [error, setError] = useState('')
  const canvas = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ id: number; startX: number; startY: number; x: number; y: number } | null>(null)
  const units = Math.max(1, Math.floor(Math.min(image.naturalWidth / 3, image.naturalHeight / 4) / zoom))
  const width = units * 3
  const height = units * 4
  const spareX = image.naturalWidth - width
  const spareY = image.naturalHeight - height
  const left = Math.round(spareX * position.x / 100)
  const top = Math.round(spareY * position.y / 100)

  useEffect(() => {
    const preview = canvas.current
    const context = preview?.getContext('2d')
    if (!preview || !context) return
    context.clearRect(0, 0, preview.width, preview.height)
    context.drawImage(image, left, top, width, height, 0, 0, preview.width, preview.height)
  }, [image, left, top, width, height])

  function confirm() {
    if (width * height > 24000000) { setError('取景范围太大，请放大图片后再裁切。'); return }
    const output = document.createElement('canvas')
    output.width = width
    output.height = height
    const context = output.getContext('2d')
    if (!context) { setError('暂时无法裁切图片。'); return }
    context.drawImage(image, left, top, width, height, 0, 0, width, height)
    const source = output.toDataURL('image/png')
    if (!source.startsWith('data:image/png;base64,')) { setError('暂时无法裁切图片。'); return }
    const base64 = source.slice('data:image/png;base64,'.length)
    const bytes = base64.length * 3 / 4 - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0)
    if (bytes > 2 * 1024 * 1024) { setError('裁切后的无损图片超过 2 MB，请放大取景或换一张较小的图。'); return }
    onConfirm(source)
  }

  return <section className="workshop-preview workshop-crop" aria-label="裁切封面">
    <h3><Crop size={17} aria-hidden="true" /> 裁切封面 · 3:4</h3>
    <p>拖动图片选择位置，也可以用下方滑杆精调。</p>
    <canvas ref={canvas} width={240} height={320} aria-label="封面裁切预览"
      onPointerDown={event => {
        if (event.button !== 0) return
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, ...position }
      }}
      onPointerMove={event => {
        const start = drag.current
        if (!start || start.id !== event.pointerId) return
        const bounds = event.currentTarget.getBoundingClientRect()
        setPosition({
          x: spareX ? clamp(start.x - (event.clientX - start.startX) * width / bounds.width / spareX * 100) : start.x,
          y: spareY ? clamp(start.y - (event.clientY - start.startY) * height / bounds.height / spareY * 100) : start.y,
        })
      }}
      onLostPointerCapture={() => { drag.current = null }} />
    <label>缩放<input type="range" min="1" max="6" step="0.01" value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label>
    <label>水平位置<input type="range" min="0" max="100" step="0.1" value={position.x} disabled={!spareX} onChange={event => setPosition({ ...position, x: Number(event.target.value) })} /></label>
    <label>垂直位置<input type="range" min="0" max="100" step="0.1" value={position.y} disabled={!spareY} onChange={event => setPosition({ ...position, y: Number(event.target.value) })} /></label>
    <div className="workshop-row">
      <button type="button" className="workshop-primary" onClick={confirm}>使用裁切结果</button>
      <button type="button" onClick={onCancel}>取消裁切</button>
    </div>
    {error && <p role="alert">{error}</p>}
  </section>
}
