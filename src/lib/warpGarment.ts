// ยืดรูปชุดให้ "ตามตัว" แทนการแปะรูปสี่เหลี่ยมทั้งก้อน
// วิธี: แบ่งรูปชุดเป็นตารางสามเหลี่ยมเล็ก ๆ แล้ววางแต่ละช่องลงบนจุดของร่างกาย (texture mapping แบบ affine)
// เสื้อ: ขอบบนตามแนวไหล่ ขอบล่างตามแนวสะโพก (เอียงตัว/บิดตัว เสื้อเอียงตาม)
// กางเกง: แบ่งครึ่งซ้าย-ขวา แต่ละข้างวิ่งตาม สะโพก → เข่า → ข้อเท้า (ก้าวขา ขากางเกงก้าวตาม)

export type Pt = { x: number; y: number }

// หนึ่งแถวของตาราง: ตำแหน่งขอบซ้าย/ขวาบนจอ ที่ความสูง v (0 = บนสุดของรูป, 1 = ล่างสุด)
export type Row = { v: number; left: Pt; right: Pt }

const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

// วาดรูปสามเหลี่ยมจากรูปต้นฉบับ (u,v พิกเซล) ไปยังจอ (x,y)
function drawTriangle(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  d0: Pt, d1: Pt, d2: Pt,
  s0: Pt, s1: Pt, s2: Pt,
) {
  const den = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y)
  if (Math.abs(den) < 1e-6) return
  const a = (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / den
  const b = (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / den
  const c = (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / den
  const d = (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / den
  const e =
    (d0.x * (s1.x * s2.y - s2.x * s1.y) + d1.x * (s2.x * s0.y - s0.x * s2.y) + d2.x * (s0.x * s1.y - s1.x * s0.y)) / den
  const f =
    (d0.y * (s1.x * s2.y - s2.x * s1.y) + d1.y * (s2.x * s0.y - s0.x * s2.y) + d2.y * (s0.x * s1.y - s1.x * s0.y)) / den

  // ขยายสามเหลี่ยมออกเล็กน้อย กันเส้นรอยต่อบาง ๆ ระหว่างช่อง
  const cx = (d0.x + d1.x + d2.x) / 3
  const cy = (d0.y + d1.y + d2.y) / 3
  const grow = (p: Pt) => {
    const dx = p.x - cx
    const dy = p.y - cy
    const len = Math.hypot(dx, dy) || 1
    return { x: p.x + (dx / len) * 1.2, y: p.y + (dy / len) * 1.2 }
  }
  const g0 = grow(d0)
  const g1 = grow(d1)
  const g2 = grow(d2)

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(g0.x, g0.y)
  ctx.lineTo(g1.x, g1.y)
  ctx.lineTo(g2.x, g2.y)
  ctx.closePath()
  ctx.clip()
  ctx.transform(a, b, c, d, e, f)
  ctx.drawImage(img, 0, 0)
  ctx.restore()
}

/**
 * วางรูปชุด (ช่วงแนวนอน u0..u1 ของรูป เป็นสัดส่วน 0–1) ลงบนแถวที่กำหนด
 * cols = จำนวนช่องแนวนอน (ยิ่งมากยิ่งโค้งเนียน)
 */
export function drawMesh(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  rows: Row[],
  u0 = 0,
  u1 = 1,
  cols = 2,
) {
  const W = img.naturalWidth
  const H = img.naturalHeight
  if (!W || !H || rows.length < 2) return
  for (let r = 0; r < rows.length - 1; r++) {
    const top = rows[r]
    const bot = rows[r + 1]
    for (let c = 0; c < cols; c++) {
      const t0 = c / cols
      const t1 = (c + 1) / cols
      const su0 = (u0 + (u1 - u0) * t0) * W
      const su1 = (u0 + (u1 - u0) * t1) * W
      const sv0 = top.v * H
      const sv1 = bot.v * H
      const p00 = lerp(top.left, top.right, t0)
      const p10 = lerp(top.left, top.right, t1)
      const p01 = lerp(bot.left, bot.right, t0)
      const p11 = lerp(bot.left, bot.right, t1)
      drawTriangle(ctx, img, p00, p10, p11, { x: su0, y: sv0 }, { x: su1, y: sv0 }, { x: su1, y: sv1 })
      drawTriangle(ctx, img, p00, p11, p01, { x: su0, y: sv0 }, { x: su1, y: sv1 }, { x: su0, y: sv1 })
    }
  }
}

const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y })
const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y })
const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k })
const len = (a: Pt) => Math.hypot(a.x, a.y)
const norm = (a: Pt): Pt => mul(a, 1 / (len(a) || 1))
const mid = (a: Pt, b: Pt): Pt => lerp(a, b, 0.5)

/**
 * ชิ้นที่ยึด ไหล่ → สะโพก (เสื้อ / เข็มขัด / ผ้าพันคอ)
 * sR/sL = ไหล่ขวา(12)/ซ้าย(11), hR/hL = สะโพกขวา(24)/ซ้าย(23)
 * widthScale = ความกว้างเทียบระยะไหล่, raise = ยกขอบบนขึ้นเหนือไหล่ (สัดส่วนความยาวลำตัว)
 */
export function drawTorso(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  sR: Pt, sL: Pt, hR: Pt, hL: Pt,
  widthScale: number,
  raise: number,
) {
  const S = mid(sR, sL)
  const Hc = mid(hR, hL)
  const torso = len(sub(Hc, S))
  const down = norm(sub(Hc, S))
  const half = (len(sub(sL, sR)) * widthScale) / 2
  const uS = norm(sub(sL, sR)) // แนวไหล่
  const uH = norm(sub(hL, hR)) // แนวสะโพก

  const top = add(S, mul(down, -raise * torso))
  const rows: Row[] = []
  const steps = 4
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    // ค่อย ๆ เปลี่ยนแนวจาก "เอียงตามไหล่" (บน) → "เอียงตามสะโพก" (ล่าง)
    const center = lerp(top, Hc, t)
    const dir = norm(lerp(uS, uH, t))
    rows.push({ v: t, left: add(center, mul(dir, -half)), right: add(center, mul(dir, half)) })
  }
  drawMesh(ctx, img, rows, 0, 1, 3)
}

/**
 * กางเกง: ครึ่งซ้ายของรูป → ขาข้างหนึ่ง, ครึ่งขวา → อีกข้าง
 * แต่ละข้างวิ่งตาม สะโพก → เข่า → ข้อเท้า
 */
export function drawLegs(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  hR: Pt, hL: Pt, kR: Pt, kL: Pt, aR: Pt, aL: Pt,
  widthScale: number,
  raise: number,
) {
  const Hc = mid(hR, hL)
  const hipDist = len(sub(hL, hR))
  const legW = (hipDist * widthScale) / 2 // ความกว้างขาแต่ละข้าง
  const legLen = len(sub(mid(aR, aL), Hc))
  const up = norm(sub(Hc, mid(kR, kL)))
  const waist = add(Hc, mul(up, raise * legLen))

  const side = (hip: Pt, knee: Pt, ankle: Pt, outward: Pt, u0: number, u1: number, outerIsLeft: boolean) => {
    // แนวตั้งฉากกับขา ชี้ออกด้านนอก
    const perp = (from: Pt, to: Pt) => {
      const d = norm(sub(to, from))
      let p = { x: -d.y, y: d.x }
      if (p.x * outward.x + p.y * outward.y < 0) p = mul(p, -1)
      return p
    }
    const pThigh = perp(hip, knee)
    const pShin = perp(knee, ankle)
    const kneeDir = norm(lerp(pThigh, pShin, 0.5))
    // แถวบนสุด: ขอบในชนกันตรงกลางเอว
    const wOuter = add(waist, mul(outward, legW))
    const rows: Row[] = [
      { v: 0, inner: waist, outer: wOuter },
      { v: 0.25, inner: add(lerp(hip, knee, 0.5), mul(pThigh, -legW * 0.5)), outer: add(lerp(hip, knee, 0.5), mul(pThigh, legW * 0.5)) },
      { v: 0.5, inner: add(knee, mul(kneeDir, -legW * 0.5)), outer: add(knee, mul(kneeDir, legW * 0.5)) },
      { v: 0.75, inner: add(lerp(knee, ankle, 0.5), mul(pShin, -legW * 0.5)), outer: add(lerp(knee, ankle, 0.5), mul(pShin, legW * 0.5)) },
      { v: 1.02, inner: add(ankle, mul(pShin, -legW * 0.5)), outer: add(ankle, mul(pShin, legW * 0.5)) },
    ].map((r) => ({ v: Math.min(1, r.v), left: outerIsLeft ? r.outer : r.inner, right: outerIsLeft ? r.inner : r.outer }))
    drawMesh(ctx, img, rows, u0, u1, 1)
  }

  const toR = norm(sub(hR, hL))
  const toL = mul(toR, -1)
  // ครึ่งซ้ายของรูป (u 0–0.5) = ฝั่งขวาของคน (12/24/26/28) — ตรงกับฝั่งที่เสื้อใช้
  side(hR, kR, aR, toR, 0, 0.5, true)
  side(hL, kL, aL, toL, 0.5, 1, false)
}

/**
 * กระโปรง: ไม่แยกขา (ผ้าผืนเดียว) แต่ขอบเอวเอียงตามสะโพก และชายกระโปรงตามเข่า/ข้อเท้า
 */
export function drawSkirt(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  hR: Pt, hL: Pt, kR: Pt, kL: Pt, aR: Pt, aL: Pt,
  widthScale: number,
  raise: number,
) {
  const Hc = mid(hR, hL)
  const A = mid(aR, aL)
  const K = mid(kR, kL)
  const legLen = len(sub(A, Hc))
  const half = (len(sub(hL, hR)) * widthScale) / 2
  const up = norm(sub(Hc, K))
  const waist = add(Hc, mul(up, raise * legLen))
  const uH = norm(sub(hL, hR))
  const uK = norm(sub(kL, kR))
  const uA = norm(sub(aL, aR))
  const at = (center: Pt, dir: Pt, v: number): Row => ({ v, left: add(center, mul(dir, -half)), right: add(center, mul(dir, half)) })
  drawMesh(
    ctx,
    img,
    [at(waist, uH, 0), at(lerp(waist, K, 0.5), norm(lerp(uH, uK, 0.5)), 0.25), at(K, uK, 0.5), at(lerp(K, A, 0.5), norm(lerp(uK, uA, 0.5)), 0.75), at(A, uA, 1)],
    0,
    1,
    3,
  )
}
