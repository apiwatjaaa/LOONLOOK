import { findPattern } from '../data/patterns'
import type { GarmentSlot } from '../data/garments'
import type { CustomPatterns, OutfitConfigs } from '../store/useOutfit'

// ผืนผ้าสี่เหลี่ยม (ลาย + สี + เนื้อผ้า) ที่ต่อกันได้ไร้รอย ใช้ "ย้อม" เสื้อจริงในกล้อง
// สร้างเป็นตาราง 8×8 ช่องลาย → เอาไปปูซ้ำ (repeat) ต่อได้พอดี

const TILE = 64 // ขนาดลาย 1 ช่อง (พิกเซล) ก่อนย่อ/ขยายตามตัวคน
const COUNT = 8

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('โหลดลายผ้าไม่สำเร็จ'))
    img.src = src
  })
}

export type Fabric = { canvas: HTMLCanvasElement; rotation: number }

export async function buildFabric(
  outfit: OutfitConfigs,
  slot: GarmentSlot,
  custom?: CustomPatterns,
): Promise<Fabric | null> {
  const config = outfit[slot]
  if (!config || config.enabled === false) return null
  const c = custom?.[slot]
  const pattern = c && c.id === config.patternId ? c : findPattern(config.patternId)
  const img = await loadImage(pattern.src)

  const tile = Math.max(8, Math.round(TILE * (config.scale || 1)))
  const size = tile * COUNT
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // 1) ปูลาย + ปรับโทน (hue/saturation)
  ctx.filter = `hue-rotate(${config.hue || 0}deg) saturate(${config.saturation ?? 100}%)`
  for (let y = 0; y < COUNT; y++) for (let x = 0; x < COUNT; x++) ctx.drawImage(img, x * tile, y * tile, tile, tile)
  ctx.filter = 'none'

  // 2) ย้อมสีผ้าจริง (เหมือนในสตูดิโอ)
  const tint = config.tint
  if (tint) {
    ctx.globalCompositeOperation = 'color'
    ctx.fillStyle = tint
    ctx.fillRect(0, 0, size, size)
    const r = parseInt(tint.slice(1, 3), 16) / 255
    const g = parseInt(tint.slice(3, 5), 16) / 255
    const b = parseInt(tint.slice(5, 7), 16) / 255
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    ctx.globalCompositeOperation = 'multiply'
    ctx.globalAlpha = Math.min(0.95, Math.max(0, (1 - lum) * 1.05))
    ctx.fillRect(0, 0, size, size)
    ctx.globalAlpha = 1
  }

  // 3) ผิวเนื้อผ้า (ลายถี่ ๆ ที่ต่อกันได้)
  const finish = config.finish ?? 'matte'
  ctx.globalCompositeOperation = 'multiply'
  if (finish === 'denim') {
    ctx.strokeStyle = 'rgba(40,50,70,0.22)'
    ctx.lineWidth = 1.2
    const gap = size / 96
    ctx.beginPath()
    for (let x = -size; x < size; x += gap) {
      ctx.moveTo(x, size)
      ctx.lineTo(x + size, 0)
    }
    ctx.stroke()
  } else if (finish === 'knit') {
    const gap = size / 64
    for (let x = 0; x < size; x += gap) {
      const g = ctx.createLinearGradient(x, 0, x + gap, 0)
      g.addColorStop(0, 'rgba(0,0,0,0.16)')
      g.addColorStop(0.5, 'rgba(0,0,0,0)')
      g.addColorStop(1, 'rgba(0,0,0,0.16)')
      ctx.fillStyle = g
      ctx.fillRect(x, 0, gap, size)
    }
  }
  ctx.globalCompositeOperation = 'source-over'
  return { canvas, rotation: config.rotation ?? 0 }
}
