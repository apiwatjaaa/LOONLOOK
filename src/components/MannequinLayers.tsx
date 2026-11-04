import { useEffect, useRef } from 'react'
import { garments, SLOT_DRAW_ORDER, type GarmentSlot } from '../data/garments'
import { gsap } from '../lib/gsap'
import MannequinFigure, { MANNEQUIN_H, MANNEQUIN_W, placeGarment } from './Mannequin'

export type MannequinItem = {
  slot: string
  bitmap: ImageBitmap | null
  garmentId?: string
}

function Layer({ bitmap }: { bitmap: ImageBitmap | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !bitmap) return
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    ctx?.clearRect(0, 0, canvas.width, canvas.height)
    ctx?.drawImage(bitmap, 0, 0)

    // เปลี่ยนลายบนหุ่น: crossfade + scale 0.98 → 1 (DESIGN.md ข้อ 11, เหลือแค่จางถ้า reduced motion)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    gsap.fromTo(
      canvas,
      { opacity: 0, scale: reduced ? 1 : 0.98 },
      { opacity: 1, scale: 1, duration: reduced ? 0.15 : 0.35, ease: 'power1.out', overwrite: true },
    )
  }, [bitmap])

  return <canvas ref={canvasRef} className="block h-full w-full" />
}

// หุ่น + ชุดแต่ละชิ้นวางตามจุดข้อต่อ (สูตรเดียวกับ AR) — กล่องสัดส่วน 1:2
function MannequinLayers({ items, hideFigure = false }: { items: MannequinItem[]; hideFigure?: boolean }) {
  const ordered = [...items].sort(
    (a, b) => (SLOT_DRAW_ORDER[a.slot as GarmentSlot] ?? 0) - (SLOT_DRAW_ORDER[b.slot as GarmentSlot] ?? 0),
  )

  return (
    <div className="relative mx-auto aspect-[1/2] h-full max-w-full">
      {!hideFigure && <MannequinFigure className="absolute inset-0 h-full w-full drop-shadow-[0_10px_18px_rgba(0,0,0,0.12)]" />}
      {ordered.map((item, index) => {
        const garment = garments.find((g) => g.id === item.garmentId)
        if (!garment) return null
        const p = placeGarment(garment)
        return (
          <div
            key={item.slot}
            className="absolute drop-shadow-[0_8px_10px_rgba(0,0,0,0.22)]"
            style={{
              left: `${((p.cx - p.w / 2) / MANNEQUIN_W) * 100}%`,
              top: `${((p.cy - p.h / 2) / MANNEQUIN_H) * 100}%`,
              width: `${(p.w / MANNEQUIN_W) * 100}%`,
              height: `${(p.h / MANNEQUIN_H) * 100}%`,
              transform: `rotate(${p.angle}rad) translateZ(${12 + index * 6}px)`,
              zIndex: 10 + index,
            }}
          >
            {item.bitmap ? <Layer bitmap={item.bitmap} /> : null}
          </div>
        )
      })}
    </div>
  )
}

export default MannequinLayers
