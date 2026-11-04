import type { Finish } from '../store/useOutfit'

export type ComposeOptions = {
  hue?: number // องศา hue-rotate
  saturation?: number // % saturate เช่น 100 = ปกติ
  scale?: number // ขนาดลายเทียบกับต้นฉบับ
  tint?: string | null // สีผ้าจริง (hex) ย้อมทับลายแบบโหมด color
  rotation?: number // องศาหมุนลาย
  finish?: Finish // เนื้อผ้า: ด้าน / ซาติน / ยีนส์ / ไหมพรม
}

const imageCache = new Map<string, Promise<HTMLImageElement>>()

function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src)
  if (cached) return cached
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => {
      imageCache.delete(src)
      reject(new Error(`โหลดรูปไม่สำเร็จ: ${src.slice(0, 80)}`))
    }
    img.src = src
  })
  imageCache.set(src, promise)
  return promise
}

// รอยพับผ้าแนวตั้ง: แถบมืด-สว่างสลับกัน ทำให้ชุดดูมีปริมาตร (3 มิติ)
function drawFolds(ctx: CanvasRenderingContext2D, w: number, h: number, finish: Finish) {
  const strength = finish === 'satin' ? 1.25 : finish === 'denim' ? 0.7 : finish === 'knit' ? 0.8 : 1

  // ด้านข้างลำตัวมืดลง (เหมือนผ้าโค้งรอบตัว)
  const side = ctx.createLinearGradient(0, 0, w, 0)
  side.addColorStop(0, `rgba(0,0,0,${0.42 * strength})`)
  side.addColorStop(0.18, 'rgba(0,0,0,0.06)')
  side.addColorStop(0.5, 'rgba(0,0,0,0)')
  side.addColorStop(0.82, 'rgba(0,0,0,0.08)')
  side.addColorStop(1, `rgba(0,0,0,${0.48 * strength})`)
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = side
  ctx.fillRect(0, 0, w, h)

  // รอยพับย่อย
  const folds = ctx.createLinearGradient(0, 0, w, h * 0.15)
  const n = 7
  for (let i = 0; i <= n; i++) {
    const t = i / n
    folds.addColorStop(t, i % 2 ? `rgba(0,0,0,${0.16 * strength})` : 'rgba(0,0,0,0)')
  }
  ctx.fillStyle = folds
  ctx.fillRect(0, 0, w, h)

  // แสงจากด้านบนซ้าย + ชายผ้ามืดลงเล็กน้อย
  const light = ctx.createLinearGradient(0, 0, w * 0.4, h)
  light.addColorStop(0, `rgba(255,255,255,${0.22 * strength})`)
  light.addColorStop(0.5, 'rgba(255,255,255,0)')
  ctx.globalCompositeOperation = 'screen'
  ctx.fillStyle = light
  ctx.fillRect(0, 0, w, h)

  const hem = ctx.createLinearGradient(0, h * 0.6, 0, h)
  hem.addColorStop(0, 'rgba(0,0,0,0)')
  hem.addColorStop(1, 'rgba(0,0,0,0.18)')
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = hem
  ctx.fillRect(0, 0, w, h)
}

// ผิวผ้าเฉพาะแบบ
function drawFinish(ctx: CanvasRenderingContext2D, w: number, h: number, finish: Finish) {
  if (finish === 'satin') {
    // ไฮไลต์มันวาวเป็นแถบเฉียง
    ctx.globalCompositeOperation = 'screen'
    for (const [x, a] of [
      [0.32, 0.38],
      [0.62, 0.24],
    ] as const) {
      const g = ctx.createLinearGradient(w * (x - 0.12), 0, w * (x + 0.12), h * 0.25)
      g.addColorStop(0, 'rgba(255,255,255,0)')
      g.addColorStop(0.5, `rgba(255,255,255,${a})`)
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    }
  } else if (finish === 'denim') {
    // เส้นทอทแยง (twill) แบบผ้ายีนส์
    ctx.globalCompositeOperation = 'multiply'
    ctx.strokeStyle = 'rgba(40,50,70,0.22)'
    ctx.lineWidth = Math.max(1, w / 260)
    const gap = Math.max(3, w / 110)
    ctx.beginPath()
    for (let x = -h; x < w; x += gap) {
      ctx.moveTo(x, h)
      ctx.lineTo(x + h, 0)
    }
    ctx.stroke()
  } else if (finish === 'knit') {
    // ลายถักตั้ง (rib) แบบไหมพรม
    ctx.globalCompositeOperation = 'multiply'
    const gap = Math.max(4, w / 60)
    for (let x = 0; x < w; x += gap) {
      const g = ctx.createLinearGradient(x, 0, x + gap, 0)
      g.addColorStop(0, 'rgba(0,0,0,0.18)')
      g.addColorStop(0.5, 'rgba(0,0,0,0)')
      g.addColorStop(1, 'rgba(0,0,0,0.18)')
      ctx.fillStyle = g
      ctx.fillRect(x, 0, gap, h)
    }
  }
}

async function buildCanvas(
  maskSrc: string,
  patternSrc: string,
  shadingSrc: string,
  options: ComposeOptions = {},
): Promise<HTMLCanvasElement> {
  const { hue = 0, saturation = 100, scale = 1, tint = null, rotation = 0, finish = 'matte' } = options

  const [maskImg, patternImg, shadingImg] = await Promise.all([
    loadImage(maskSrc),
    loadImage(patternSrc),
    loadImage(shadingSrc),
  ])

  const width = maskImg.naturalWidth
  const height = maskImg.naturalHeight

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('ไม่สามารถสร้าง canvas context ได้')

  // 1. วาด mask (ทรงชุด)
  ctx.drawImage(maskImg, 0, 0, width, height)

  // 2. เติมลายผ้าแบบ repeat เฉพาะพื้นที่ mask (source-in) + หมุนลายได้
  // ขนาดลายเทียบความละเอียดของทรงชุด (ทรงชุดกว้าง ~570px → ลายใหญ่ขึ้นตาม) ไม่งั้นลายจะเล็กเป็นจุด
  const resolution = Math.max(1, width / 240)
  const tileWidth = Math.max(1, Math.round(patternImg.naturalWidth * scale * resolution))
  const tileHeight = Math.max(1, Math.round(patternImg.naturalHeight * scale * resolution))
  const tileCanvas = document.createElement('canvas')
  tileCanvas.width = tileWidth
  tileCanvas.height = tileHeight
  tileCanvas.getContext('2d')?.drawImage(patternImg, 0, 0, tileWidth, tileHeight)

  const pattern = ctx.createPattern(tileCanvas, 'repeat')
  if (pattern) {
    if (rotation) pattern.setTransform(new DOMMatrix().rotate(rotation))
    ctx.globalCompositeOperation = 'source-in'
    // 3. ปรับโทนลายด้วย hue-rotate / saturate
    ctx.filter = `hue-rotate(${hue}deg) saturate(${saturation}%)`
    ctx.fillStyle = pattern
    ctx.fillRect(0, 0, width, height)
    ctx.filter = 'none'
  }

  // 4. ย้อมสีผ้าจริง (เก็บความสว่างของลาย เปลี่ยนโทนเป็นสีที่เลือก)
  if (tint) {
    ctx.globalCompositeOperation = 'color'
    ctx.fillStyle = tint
    ctx.fillRect(0, 0, width, height)
    // สีเข้ม → ผ้าต้องเข้มตาม (โหมด color เก็บความสว่างเดิมไว้ ผ้าพื้นสว่างจะซีด)
    const r = parseInt(tint.slice(1, 3), 16) / 255
    const g = parseInt(tint.slice(3, 5), 16) / 255
    const b = parseInt(tint.slice(5, 7), 16) / 255
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
    ctx.globalCompositeOperation = 'multiply'
    ctx.globalAlpha = Math.min(0.95, Math.max(0, (1 - luminance) * 1.05))
    ctx.fillRect(0, 0, width, height)
    ctx.globalAlpha = 1
  }

  // 5. รอยพับ แสง และผิวผ้า → มิติ
  drawFolds(ctx, width, height, finish)
  drawFinish(ctx, width, height, finish)

  // 6. เงาเพิ่มเติมของชิ้นนั้น (ถ้ามี)
  ctx.globalCompositeOperation = 'multiply'
  ctx.drawImage(shadingImg, 0, 0, width, height)

  // 7. ตัดทุกอย่างให้อยู่ในทรงชุดเท่านั้น
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(maskImg, 0, 0, width, height)
  ctx.globalCompositeOperation = 'source-over'

  return canvas
}

// รวม mask + ลายผ้า + สี + เงา เป็นรูปชุดสำเร็จ (บน offscreen canvas) ตามข้อ 5
export async function composeGarment(
  maskSrc: string,
  patternSrc: string,
  shadingSrc: string,
  options: ComposeOptions = {},
): Promise<ImageBitmap> {
  const canvas = await buildCanvas(maskSrc, patternSrc, shadingSrc, options)
  return createImageBitmap(canvas)
}

// เหมือน composeGarment แต่คืนเป็น HTMLImageElement — ใช้ตอนวาดบน canvas ของหน้า
// Try-On (ar/renderGarment.ts รับเฉพาะ HTMLImageElement)
export async function composeGarmentToImage(
  maskSrc: string,
  patternSrc: string,
  shadingSrc: string,
  options: ComposeOptions = {},
): Promise<HTMLImageElement> {
  const canvas = await buildCanvas(maskSrc, patternSrc, shadingSrc, options)
  const img = new Image()
  img.src = canvas.toDataURL('image/png')
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('แปลงรูปชุดเป็นรูปภาพไม่สำเร็จ'))
  })
  return img
}
