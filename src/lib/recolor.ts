import type { Fabric } from './fabric'

// "ย้อมลายบนเสื้อจริง" — ใช้ร่วมกันทั้งโหมดสด และโหมดถ่ายรูปแล้วแต่ง
// ขั้นตอน: ปูผืนผ้าที่ออกแบบ → ตัดให้อยู่ในเสื้อผ้า (mask จาก AI) → ใส่แสงเงา/รอยยับของเสื้อจริง

export type Landmark = { x: number; y: number; visibility?: number }

export type RecolorBuffers = {
  fitted: HTMLCanvasElement
  base: HTMLCanvasElement
  lit: HTMLCanvasElement
  shade: HTMLCanvasElement
  soft: HTMLCanvasElement
}

export function makeBuffers(): RecolorBuffers {
  const mk = () => document.createElement('canvas')
  return { fitted: mk(), base: mk(), lit: mk(), shade: mk(), soft: mk() }
}

/** เห็นไหล่และสะโพกชัดไหม (ใช้ตัดสินว่าจะแบ่งลายบน/ล่าง) */
export function hipsVisible(lm?: Landmark[]) {
  const ok = (i: number) => !!lm && (lm[i].visibility ?? 1) > 0.6 && lm[i].y > 0 && lm[i].y < 1
  return ok(23) && ok(24) && ok(11) && ok(12)
}

type Opts = {
  src: CanvasImageSource // ภาพจริง (ขนาดเดียวกับที่จะแปะทับ)
  w: number // ความละเอียดที่ใช้คำนวณ
  h: number
  mask: CanvasImageSource // ภาพขาว-โปร่งใส ตำแหน่งเสื้อผ้า (ขนาดใดก็ได้ จะยืดให้เต็ม)
  top: Fabric | null
  bottom: Fabric | null
  lm?: Landmark[]
  gapY: number | null // เส้นแบ่งเสื้อ/กางเกงที่หาได้ (สัดส่วนความสูง) หรือ null
  buf: RecolorBuffers
  strength?: number // ความแรงของรอยยับจากเสื้อจริง
}

/** คืน canvas ลายผ้าที่ย้อมแล้ว (โปร่งใสนอกเสื้อผ้า) ขนาด w×h */
export function paintRecolor({ src, w, h, mask, top, bottom, lm, gapY, buf, strength = 0.9 }: Opts) {
  const prep = (c: HTMLCanvasElement) => {
    if (c.width !== w) c.width = w
    if (c.height !== h) c.height = h
    const x = c.getContext('2d')
    if (!x) throw new Error('canvas')
    x.setTransform(1, 0, 0, 1, 0, 0)
    x.globalCompositeOperation = 'source-over'
    x.globalAlpha = 1
    x.imageSmoothingEnabled = true
    x.imageSmoothingQuality = 'high'
    x.clearRect(0, 0, w, h)
    return x
  }
  const fctx = prep(buf.fitted)
  const bctx = prep(buf.base)
  const lctx = prep(buf.lit)
  const sctx = prep(buf.shade)

  // ขนาดลาย: ราว 4 ช่องลายต่อความกว้างไหล่ / เส้นเอว
  let unit = h * 0.05
  let center = { x: w / 2, y: h / 2 }
  let waist: [{ x: number; y: number }, { x: number; y: number }] | null = null
  if (lm) {
    const p = (i: number) => ({ x: lm[i].x * w, y: lm[i].y * h })
    const sR = p(12), sL = p(11), hR = p(24), hL = p(23)
    unit = Math.hypot(sL.x - sR.x, sL.y - sR.y) / 4 || unit
    center = { x: (sR.x + sL.x) / 2, y: (sR.y + sL.y) / 2 }
    if (hipsVisible(lm)) {
      if (gapY !== null) {
        // เจอช่องว่างผ้า (เช่น เสื้อครอป) → แบ่งตรงนั้น เอียงตามแนวสะโพก
        const dy = gapY * h - (hR.y + hL.y) / 2
        waist = [{ x: hR.x, y: hR.y + dy }, { x: hL.x, y: hL.y + dy }]
      } else {
        const torso = Math.hypot((hR.x + hL.x) / 2 - center.x, (hR.y + hL.y) / 2 - center.y)
        waist = [{ x: hR.x, y: hR.y - torso * 0.02 }, { x: hL.x, y: hL.y - torso * 0.02 }]
      }
    }
  }

  const fill = (fab: Fabric) => {
    const pat = fctx.createPattern(fab.canvas, 'repeat')
    if (!pat) return
    pat.setTransform(new DOMMatrix().translate(center.x, center.y).rotate(fab.rotation).scale(unit / 64))
    fctx.fillStyle = pat
    fctx.fillRect(0, 0, w, h)
  }
  if (top) fill(top)
  if (bottom && waist) {
    const [a, b] = waist
    const slope = (b.y - a.y) / (b.x - a.x || 1)
    const yAt = (x: number) => a.y + (x - a.x) * slope
    fctx.save()
    fctx.beginPath()
    fctx.moveTo(0, yAt(0))
    fctx.lineTo(w, yAt(w))
    fctx.lineTo(w, h)
    fctx.lineTo(0, h)
    fctx.closePath()
    fctx.clip()
    fill(bottom)
    fctx.restore()
  } else if (bottom && !top) fill(bottom)

  // ตัดให้อยู่เฉพาะเสื้อผ้า
  fctx.globalCompositeOperation = 'destination-in'
  fctx.drawImage(mask, 0, 0, w, h)
  fctx.globalCompositeOperation = 'source-over'

  // แสงเงา + รอยยับจากเสื้อจริง: ภาพขาวดำ แล้วหักแสงรวม (ภาพเบลอกลับสี) ออก
  sctx.drawImage(src, 0, 0, w, h)
  sctx.globalCompositeOperation = 'saturation'
  sctx.fillStyle = '#808080'
  sctx.fillRect(0, 0, w, h)
  sctx.globalCompositeOperation = 'source-over'
  const soft = buf.soft
  const tw = Math.max(8, Math.round(w / 24))
  const th = Math.max(8, Math.round(h / 24))
  if (soft.width !== tw) soft.width = tw
  if (soft.height !== th) soft.height = th
  const tctx = soft.getContext('2d')
  if (tctx) {
    tctx.globalCompositeOperation = 'source-over'
    tctx.drawImage(buf.shade, 0, 0, tw, th)
    tctx.globalCompositeOperation = 'difference'
    tctx.fillStyle = '#ffffff'
    tctx.fillRect(0, 0, tw, th)
    tctx.globalCompositeOperation = 'source-over'
  }
  bctx.drawImage(buf.fitted, 0, 0)
  lctx.drawImage(buf.base, 0, 0)
  lctx.globalCompositeOperation = 'soft-light'
  lctx.globalAlpha = strength
  lctx.drawImage(buf.shade, 0, 0)
  lctx.drawImage(soft, 0, 0, w, h)
  lctx.globalCompositeOperation = 'multiply'
  lctx.globalAlpha = 0.2
  lctx.drawImage(buf.shade, 0, 0)
  lctx.globalAlpha = 1
  lctx.globalCompositeOperation = 'destination-in'
  lctx.drawImage(buf.base, 0, 0)
  lctx.globalCompositeOperation = 'source-over'
  return buf.lit
}
