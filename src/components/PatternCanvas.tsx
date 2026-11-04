import { useRef, useState } from 'react'

type Props = {
  size?: number
  onSave: (dataUrl: string) => void
  onCancel: () => void
}

const SWATCHES = ['#1a1714', '#6e6862', '#8c6b3e', '#5c2027', '#5b5a33', '#ffffff']

function PatternCanvas({ size = 220, onSave, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const historyRef = useRef<ImageData[]>([])
  const [color, setColor] = useState('#1a1714')
  const [brushSize, setBrushSize] = useState(6)
  const [canUndo, setCanUndo] = useState(false)

  function getContext() {
    return canvasRef.current?.getContext('2d') ?? null
  }

  function initCanvas(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx || canvas.dataset.initialized) return
    canvas.dataset.initialized = 'true'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  function pointerPos(canvas: HTMLCanvasElement, e: React.PointerEvent) {
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  function pushHistory() {
    const canvas = canvasRef.current
    const ctx = getContext()
    if (!canvas || !ctx) return
    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
    if (historyRef.current.length > 20) historyRef.current.shift()
    setCanUndo(true)
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const ctx = getContext()
    if (!canvas || !ctx) return
    pushHistory()
    drawingRef.current = true
    canvas.setPointerCapture(e.pointerId)
    const { x, y } = pointerPos(canvas, e)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = color
    ctx.lineWidth = brushSize
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const canvas = canvasRef.current
    const ctx = getContext()
    if (!canvas || !ctx) return
    const { x, y } = pointerPos(canvas, e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function handlePointerUp() {
    drawingRef.current = false
  }

  function handleUndo() {
    const canvas = canvasRef.current
    const ctx = getContext()
    const last = historyRef.current.pop()
    if (!canvas || !ctx || !last) return
    ctx.putImageData(last, 0, 0)
    setCanUndo(historyRef.current.length > 0)
  }

  function handleClear() {
    const canvas = canvasRef.current
    const ctx = getContext()
    if (!canvas || !ctx) return
    pushHistory()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  function handleSave() {
    const canvas = canvasRef.current
    if (!canvas) return
    onSave(canvas.toDataURL('image/png'))
  }

  return (
    <div className="flex flex-col gap-3 rounded-[4px] bg-surface p-4">
      <div className="flex items-center gap-2">
        {SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            onClick={() => setColor(swatch)}
            aria-label={`เลือกสี ${swatch}`}
            className="h-7 w-7 rounded-full"
            style={{
              backgroundColor: swatch,
              outline: color === swatch ? '1px solid var(--color-ink)' : '1px solid var(--color-line)',
              outlineOffset: 2,
            }}
          />
        ))}
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-7 w-7 cursor-pointer rounded-full border-none bg-transparent"
          aria-label="เลือกสีเอง"
        />
      </div>

      <canvas
        ref={(node) => {
          if (node) initCanvas(node)
        }}
        width={size}
        height={size}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="touch-none rounded-[4px] border border-line"
        style={{ width: size, height: size }}
      />

      <label className="flex items-center gap-2 text-xs text-muted">
        <span>ขนาดพู่กัน</span>
        <input
          type="range"
          min={2}
          max={24}
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          className="flex-1"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleUndo}
          disabled={!canUndo}
          className="btn btn-text text-xs disabled:cursor-not-allowed disabled:opacity-40"
        >
          ย้อนกลับ
        </button>
        <button type="button" onClick={handleClear} className="btn btn-text text-xs">
          ล้างทั้งหมด
        </button>
        <button type="button" onClick={onCancel} className="btn btn-text text-xs">
          ยกเลิก
        </button>
        <button type="button" onClick={handleSave} className="btn btn-primary ml-auto h-9 px-4 text-xs">
          ใช้ลายนี้
        </button>
      </div>
    </div>
  )
}

export default PatternCanvas
