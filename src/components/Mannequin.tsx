import type { Garment } from '../data/garments'

/**
 * หุ่นโชว์ชุดในสตูดิโอ (พิกัด 300 x 600)
 * จุดข้อต่อของหุ่นใช้เลข landmark เดียวกับ MediaPipe → วางชุดด้วยสูตรเดียวกับหน้า AR
 * ภาพหุ่นเป็นแบบกระจก (ไหล่ซ้ายของหุ่น = ฝั่งซ้ายของจอ) เหมือนตอนส่องกล้อง
 */
export const MANNEQUIN_W = 300
export const MANNEQUIN_H = 600

export const JOINTS: Record<number, { x: number; y: number }> = {
  11: { x: 94, y: 112 }, // ไหล่ซ้าย
  12: { x: 206, y: 112 }, // ไหล่ขวา
  23: { x: 108, y: 292 }, // สะโพกซ้าย
  24: { x: 192, y: 292 }, // สะโพกขวา
  25: { x: 122, y: 430 }, // เข่าซ้าย
  26: { x: 178, y: 430 }, // เข่าขวา
  27: { x: 130, y: 558 }, // ข้อเท้าซ้าย
  28: { x: 170, y: 558 }, // ข้อเท้าขวา
}

export type Placement = { cx: number; cy: number; w: number; h: number; angle: number }

const avg = (ids: number[]) => ({
  x: ids.reduce((s, i) => s + JOINTS[i].x, 0) / ids.length,
  y: ids.reduce((s, i) => s + JOINTS[i].y, 0) / ids.length,
})
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(b.x - a.x, b.y - a.y)

// สูตรเดียวกับ ar/fitGarment.ts (แต่จัดมุมให้ชุดตั้งตรงเสมอ)
export function placeGarment(garment: Garment): Placement {
  const { from, to } = garment.anchors
  const a = avg(from)
  const b = avg(to)
  const h = dist(a, b)
  const spread = from.length >= 2 ? from : to.length >= 2 ? to : null

  let w: number
  let angle: number
  if (spread) {
    const p1 = JOINTS[spread[0]]
    const p2 = JOINTS[spread[spread.length - 1]]
    w = dist(p1, p2) * garment.widthScale
    angle = Math.atan2(p2.y - p1.y, p2.x - p1.x)
    if (angle > Math.PI / 2) angle -= Math.PI
    if (angle < -Math.PI / 2) angle += Math.PI
  } else {
    w = dist(JOINTS[11], JOINTS[12]) * garment.widthScale
    angle = Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2
  }

  return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 + garment.offsetY * h, w, h, angle }
}

// ตัวหุ่น: ไล่เฉดแนวนอนทุกชิ้น ให้ดูเป็นทรงกระบอก (มีมิติ)
function MannequinFigure({ className }: { className?: string }) {
  return (
    <svg viewBox={`0 0 ${MANNEQUIN_W} ${MANNEQUIN_H}`} className={className} aria-hidden>
      <defs>
        <linearGradient id="mq-body" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#b9aea0" />
          <stop offset="0.32" stopColor="#efe9e1" />
          <stop offset="0.55" stopColor="#e4ddd3" />
          <stop offset="1" stopColor="#a99d8f" />
        </linearGradient>
        <radialGradient id="mq-head" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#f3eee7" />
          <stop offset="0.7" stopColor="#d6cdc1" />
          <stop offset="1" stopColor="#b3a796" />
        </radialGradient>
      </defs>
      <g fill="url(#mq-body)">
        {/* แขน */}
        <path d="M94 112 C80 128 76 190 74 250 L68 326 Q72 338 80 330 L90 252 C94 210 100 170 102 150 Z" />
        <path d="M206 112 C220 128 224 190 226 250 L232 326 Q228 338 220 330 L210 252 C206 210 200 170 198 150 Z" />
        {/* ขา */}
        <path d="M108 290 L150 296 L146 430 L140 556 Q132 568 122 560 L116 430 C110 380 106 330 108 290 Z" />
        <path d="M192 290 L150 296 L154 430 L160 556 Q168 568 178 560 L184 430 C190 380 194 330 192 290 Z" />
        {/* ลำตัว */}
        <path d="M128 98 C110 102 98 104 92 116 L98 162 C104 200 112 222 110 240 C106 262 104 280 106 298 L194 298 C196 280 194 262 190 240 C188 222 196 200 202 162 L208 116 C202 104 190 102 172 98 Z" />
        {/* คอ */}
        <path d="M138 76 L162 76 L164 102 Q150 108 136 102 Z" />
      </g>
      <ellipse cx="150" cy="48" rx="25" ry="31" fill="url(#mq-head)" />
    </svg>
  )
}

export default MannequinFigure
