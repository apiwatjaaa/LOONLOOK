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

export type Body = {
  sR: Pt; sL: Pt // ไหล่ขวา(12) / ซ้าย(11)
  hR: Pt; hL: Pt // สะโพก 24 / 23
  kR: Pt; kL: Pt // เข่า 26 / 25
  aR: Pt; aL: Pt // ข้อเท้า 28 / 27
  eR: Pt | null; eL: Pt | null // ศอก 14 / 13 (มองไม่เห็น = null)
  wR: Pt | null; wL: Pt | null // ข้อมือ 16 / 15
}

// ขนาดตัวจริงโดยประมาณ (จุดไหล่/สะโพกเป็น "ข้อต่อ" ซึ่งแคบกว่าตัว)
function measure(b: Body) {
  const shoulder = len(sub(b.sL, b.sR))
  const hip = len(sub(b.hL, b.hR))
  const S = mid(b.sR, b.sL)
  const H = mid(b.hR, b.hL)
  return {
    shoulder,
    S,
    H,
    torso: len(sub(H, S)),
    chestW: shoulder * 1.18, // ความกว้างอก (ขอบนอกไหล่ถึงไหล่)
    waistW: Math.max(hip * 1.7, shoulder * 0.9), // ความกว้างสะโพกจริง
  }
}

/** ข้อมูลรูปทรงของ mask (หาจากรูปจริงครั้งเดียวตอนโหลดชุด) */
export type MaskInfo = { x0: number; x1: number; waistFrac: number }

export function measureMask(img: HTMLImageElement): MaskInfo {
  const c = document.createElement('canvas')
  const w = (c.width = 120)
  const h = (c.height = 120)
  const x = c.getContext('2d', { willReadFrequently: true })
  if (!x) return { x0: 0, x1: 1, waistFrac: 1 }
  x.drawImage(img, 0, 0, w, h)
  const data = x.getImageData(0, 0, w, h).data
  const solid = (px: number, py: number) => data[(py * w + px) * 4 + 3] > 40
  let x0 = w
  let x1 = 0
  let firstRow = -1
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      if (!solid(px, py)) continue
      if (firstRow < 0) firstRow = py
      if (px < x0) x0 = px
      if (px > x1) x1 = px
    }
  }
  if (firstRow < 0) return { x0: 0, x1: 1, waistFrac: 1 }
  // ความกว้างช่วงเอว (แถวบน ๆ ของชิ้น)
  const row = Math.min(h - 1, firstRow + 3)
  let r0 = w
  let r1 = 0
  for (let px = 0; px < w; px++) if (solid(px, row)) { r0 = Math.min(r0, px); r1 = Math.max(r1, px) }
  const bw = x1 - x0 + 1
  return { x0: x0 / w, x1: (x1 + 1) / w, waistFrac: Math.max(0.2, (r1 - r0 + 1) / bw) }
}

/**
 * เสื้อ: ช่วงลำตัวของรูป (band) ยืดจากไหล่ → สะโพก
 * แขนเสื้อ: ตัดผ้าจากกลางลำตัวมาทำเป็นท่อ วิ่งตาม ไหล่ → ศอก → ข้อมือ
 */
export function drawTop(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  b: Body,
  band: [number, number],
  sleeve: 'none' | 'short' | 'long',
  hem = 1.04, // ชายเสื้อยาวเลยสะโพกเท่าไร (สัดส่วนลำตัว)
) {
  const m = measure(b)
  const down = norm(sub(m.H, m.S))
  const uS = norm(sub(b.sL, b.sR))
  const uH = norm(sub(b.hL, b.hR))
  const top = add(m.S, mul(down, -0.1 * m.torso))
  const bottom = add(m.S, mul(down, hem * m.torso))
  const botW = Math.max(m.waistW, m.chestW * 0.92)

  // แขนเสื้อวาดก่อน (อยู่ใต้ตัวเสื้อตรงหัวไหล่)
  if (sleeve !== 'none') {
    for (const [s, e, w, outward] of [
      [b.sR, b.eR, b.wR, mul(uS, -1)],
      [b.sL, b.eL, b.wL, uS],
    ] as [Pt, Pt | null, Pt | null, Pt][]) {
      // ไม่เห็นศอก → สมมติว่าแขนห้อยลงข้างตัว
      const elbow = e ?? add(s, add(mul(down, m.torso * 0.62), mul(outward, m.shoulder * 0.12)))
      const wrist = w ?? add(elbow, mul(down, m.torso * 0.55))
      const start = add(s, mul(outward, m.shoulder * 0.06))
      const end = sleeve === 'short' ? lerp(start, elbow, 0.55) : add(wrist, mul(norm(sub(wrist, elbow)), m.shoulder * 0.05))
      const pts = sleeve === 'short' ? [start, lerp(start, end, 0.5), end] : [start, elbow, end]
      const widths = sleeve === 'short' ? [0.42, 0.38, 0.36] : [0.4, 0.3, 0.25]
      const rows: Row[] = pts.map((p, i) => {
        const dir = norm(sub(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)]))
        let n = { x: -dir.y, y: dir.x }
        if (n.x * outward.x + n.y * outward.y < 0) n = mul(n, -1)
        const hw = (widths[i] * m.shoulder) / 2
        return { v: 0.3 + (i / (pts.length - 1)) * 0.3, left: add(p, mul(n, -hw)), right: add(p, mul(n, hw)) }
      })
      // ใช้ผ้าช่วงลำตัว (ไม่โดนคอเสื้อ/สาบเสื้อ) มาทำแขนเสื้อ
      drawMesh(ctx, img, rows, band[0] + (band[1] - band[0]) * 0.12, band[0] + (band[1] - band[0]) * 0.36, 1)
    }
  }

  const rows: Row[] = []
  const steps = 4
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const center = lerp(top, bottom, t)
    const dir = norm(lerp(uS, uH, t))
    const half = (m.chestW + (botW - m.chestW) * t) / 2
    rows.push({ v: t, left: add(center, mul(dir, -half)), right: add(center, mul(dir, half)) })
  }
  drawMesh(ctx, img, rows, band[0], band[1], 3)
}

/** เครื่องประดับช่วงลำตัว (ผ้าพันคอ / เข็มขัด): ความกว้างของชิ้นจริง (ไม่รวมขอบใส) เทียบความกว้างไหล่ */
export function drawAccessory(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  b: Body,
  info: MaskInfo,
  widthOfShoulder: number,
  raise: number,
) {
  const m = measure(b)
  const down = norm(sub(m.H, m.S))
  const uS = norm(sub(b.sL, b.sR))
  const uH = norm(sub(b.hL, b.hR))
  const top = add(m.S, mul(down, -raise * m.torso))
  const half = (m.shoulder * widthOfShoulder) / 2
  const rows: Row[] = [0, 0.5, 1].map((t) => {
    const center = lerp(top, m.H, t)
    const dir = norm(lerp(uS, uH, t))
    return { v: t, left: add(center, mul(dir, -half)), right: add(center, mul(dir, half)) }
  })
  drawMesh(ctx, img, rows, info.x0, info.x1, 2)
}

/**
 * ท่อนล่าง: ความกว้างที่เอวของชิ้น = สะโพกจริง
 * legs=true (กางเกง): ครึ่งซ้าย/ขวาของรูปวิ่งตามขาแต่ละข้าง สะโพก → เข่า → ข้อเท้า
 * legs=false (กระโปรง): ผ้าผืนเดียว เอวเอียงตามสะโพก ชายตามเข่า/ข้อเท้า
 */
export function drawBottom(ctx: CanvasRenderingContext2D, img: HTMLImageElement, b: Body, info: MaskInfo, legs: boolean) {
  const m = measure(b)
  const K = mid(b.kR, b.kL)
  const A = mid(b.aR, b.aL)
  const legLen = len(sub(A, m.H))
  const up = norm(sub(m.H, K))
  const waist = add(m.H, mul(up, 0.07 * legLen))
  const rowW = m.waistW / info.waistFrac // ความกว้างกรอบ (ช่วงที่มีผ้าในรูป)
  const toR = norm(sub(b.hR, b.hL))
  const toL = mul(toR, -1)

  if (!legs) {
    const uH = norm(sub(b.hL, b.hR))
    const uK = norm(sub(b.kL, b.kR))
    const uA = norm(sub(b.aL, b.aR))
    const at = (c: Pt, d: Pt, v: number): Row => ({ v, left: add(c, mul(d, -rowW / 2)), right: add(c, mul(d, rowW / 2)) })
    drawMesh(
      ctx,
      img,
      [at(waist, uH, 0), at(lerp(waist, K, 0.5), norm(lerp(uH, uK, 0.5)), 0.25), at(K, uK, 0.5), at(lerp(K, A, 0.5), norm(lerp(uK, uA, 0.5)), 0.75), at(A, uA, 1)],
      info.x0,
      info.x1,
      3,
    )
    return
  }

  const legW = rowW / 2
  // ช่วงเข่า-ข้อเท้า: จำกัดความกว้างขาไม่ให้สองข้างซ้อนกันจนดูเป็นกระโปรง
  const legLow = Math.min(legW, m.waistW * 0.5)
  const side = (hip: Pt, knee: Pt, ankle: Pt, outward: Pt, u0: number, u1: number, outerIsLeft: boolean) => {
    const perp = (from: Pt, to: Pt) => {
      const d = norm(sub(to, from))
      let p = { x: -d.y, y: d.x }
      if (p.x * outward.x + p.y * outward.y < 0) p = mul(p, -1)
      return p
    }
    const pThigh = perp(hip, knee)
    const pShin = perp(knee, ankle)
    const pKnee = norm(lerp(pThigh, pShin, 0.5))
    // ขาแต่ละข้างเริ่มจากกึ่งกลางเอว ค่อย ๆ ไปอยู่ตรงขา
    const thighC = lerp(add(waist, mul(outward, legW / 2)), knee, 0.5)
    const raw = [
      { v: 0, inner: waist, outer: add(waist, mul(outward, legW)) },
      { v: 0.25, inner: add(thighC, mul(pThigh, -(legW + legLow) / 4)), outer: add(thighC, mul(pThigh, (legW + legLow) / 4)) },
      { v: 0.5, inner: add(knee, mul(pKnee, -legLow / 2)), outer: add(knee, mul(pKnee, legLow / 2)) },
      { v: 0.75, inner: add(lerp(knee, ankle, 0.5), mul(pShin, -legLow / 2)), outer: add(lerp(knee, ankle, 0.5), mul(pShin, legLow / 2)) },
      { v: 1, inner: add(ankle, mul(pShin, -legLow / 2)), outer: add(ankle, mul(pShin, legLow / 2)) },
    ]
    drawMesh(ctx, img, raw.map((r) => ({ v: r.v, left: outerIsLeft ? r.outer : r.inner, right: outerIsLeft ? r.inner : r.outer })), u0, u1, 1)
  }
  side(b.hR, b.kR, b.aR, toR, info.x0, 0.5, true)
  side(b.hL, b.kL, b.aL, toL, 0.5, info.x1, false)
}
