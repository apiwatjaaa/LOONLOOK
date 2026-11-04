/**
 * รูปทรง 3 มิติของหุ่นและชุด (สร้างจากโค้ด ไม่ใช้ไฟล์โมเดล)
 * หน่วย = เมตร, แกน y ชี้ขึ้น, หุ่นหันหน้าไปทาง +z, เท้าอยู่ที่ y = 0
 * - loft: วงรีซ้อนกันตามความสูง (ลำตัว กระโปรง ศีรษะ)
 * - tube: ท่อตามเส้นทาง (แขน ขา แขนเสื้อ ขากางเกง)
 */

export type Mesh = { pos: number[]; nrm: number[]; uv: number[]; idx: number[] }
export type Vec3 = [number, number, number]
export type Section = { y: number; rx: number; rz: number; cz?: number }

export function newMesh(): Mesh {
  return { pos: [], nrm: [], uv: [], idx: [] }
}

// ตารางจุด (rows+1) x (cols+1) → สามเหลี่ยม
function addGrid(m: Mesh, rows: number, cols: number, at: (i: number, j: number) => { p: Vec3; uv: [number, number] }) {
  const base = m.pos.length / 3
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j <= cols; j++) {
      const { p, uv } = at(i, j)
      m.pos.push(p[0], p[1], p[2])
      m.nrm.push(0, 0, 0)
      m.uv.push(uv[0], uv[1])
    }
  }
  const w = cols + 1
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = base + i * w + j
      const b = a + 1
      const c = a + w
      const d = c + 1
      m.idx.push(a, c, b, b, c, d)
    }
  }
}

// normal เฉลี่ยจากหน้าสามเหลี่ยมรอบ ๆ (ผิวเรียบ)
export function computeNormals(m: Mesh) {
  const n = m.nrm
  n.fill(0)
  const p = m.pos
  for (let k = 0; k < m.idx.length; k += 3) {
    const a = m.idx[k] * 3
    const b = m.idx[k + 1] * 3
    const c = m.idx[k + 2] * 3
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2]
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2]
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    for (const i of [a, b, c]) {
      n[i] += nx
      n[i + 1] += ny
      n[i + 2] += nz
    }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1
    n[i] /= l
    n[i + 1] /= l
    n[i + 2] /= l
  }
}

const smooth = (t: number) => t * t * (3 - 2 * t)

// ค่าที่ความสูง y (สอดแทรกแบบนุ่มระหว่าง section)
export function sectionAt(sections: Section[], y: number): Section {
  const s = [...sections].sort((a, b) => a.y - b.y)
  if (y <= s[0].y) return s[0]
  if (y >= s[s.length - 1].y) return s[s.length - 1]
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i]
    const b = s[i + 1]
    if (y >= a.y && y <= b.y) {
      const t = smooth((y - a.y) / (b.y - a.y || 1))
      return {
        y,
        rx: a.rx + (b.rx - a.rx) * t,
        rz: a.rz + (b.rz - a.rz) * t,
        cz: (a.cz ?? 0) + ((b.cz ?? 0) - (a.cz ?? 0)) * t,
      }
    }
  }
  return s[0]
}

// ผิวรอบแกน y จาก y0 ถึง y1
export function addLoft(
  m: Mesh,
  sections: Section[],
  y0: number,
  y1: number,
  opts: { rows?: number; cols?: number; grow?: number; wave?: number } = {},
) {
  const rows = opts.rows ?? 48
  const cols = opts.cols ?? 64
  const grow = opts.grow ?? 0
  const wave = opts.wave ?? 0
  addGrid(m, rows, cols, (i, j) => {
    const y = y0 + ((y1 - y0) * i) / rows
    const s = sectionAt(sections, y)
    const a = (j / cols) * Math.PI * 2
    // ระบายรอบชายผ้า (wave) — มากขึ้นเมื่อห่างจากเอว
    const depth = Math.max(0, (y1 - y) / Math.abs(y1 - y0 || 1))
    const r = 1 + wave * depth * Math.sin(a * 11)
    const rx = (s.rx + grow) * r
    const rz = (s.rz + grow) * r
    const circumference = Math.PI * (rx + rz)
    return {
      p: [rx * Math.sin(a), y, (s.cz ?? 0) + rz * Math.cos(a)],
      uv: [(j / cols) * circumference, y],
    }
  })
}

// ท่อตามเส้นทาง (จุด + รัศมี) ตั้งแต่สัดส่วน t0 ถึง t1 ของความยาว
export function addTube(
  m: Mesh,
  pts: Vec3[],
  radii: number[],
  opts: { t0?: number; t1?: number; grow?: number; flare?: number; rows?: number; cols?: number } = {},
) {
  const t0 = opts.t0 ?? 0
  const t1 = opts.t1 ?? 1
  const grow = opts.grow ?? 0
  const flare = opts.flare ?? 0
  const rows = opts.rows ?? 40
  const cols = opts.cols ?? 28

  const lens = [0]
  for (let i = 1; i < pts.length; i++) {
    lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]))
  }
  const total = lens[lens.length - 1]

  const sample = (t: number) => {
    const d = t * total
    let k = 0
    while (k < pts.length - 2 && lens[k + 1] < d) k++
    const f = (d - lens[k]) / (lens[k + 1] - lens[k] || 1)
    const a = pts[k]
    const b = pts[k + 1]
    const p: Vec3 = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
    const r = radii[k] + (radii[k + 1] - radii[k]) * smooth(f)
    const tan: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const tl = Math.hypot(...tan) || 1
    return { p, r, tan: [tan[0] / tl, tan[1] / tl, tan[2] / tl] as Vec3, d }
  }

  addGrid(m, rows, cols, (i, j) => {
    const tt = t0 + ((t1 - t0) * i) / rows
    const { p, r, tan, d } = sample(tt)
    const local = (tt - t0) / (t1 - t0 || 1)
    const rr = r + grow + flare * local * local
    // ระนาบตั้งฉากกับทิศของท่อ
    const ref: Vec3 = Math.abs(tan[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1]
    let ux = tan[1] * ref[2] - tan[2] * ref[1]
    let uy = tan[2] * ref[0] - tan[0] * ref[2]
    let uz = tan[0] * ref[1] - tan[1] * ref[0]
    const ul = Math.hypot(ux, uy, uz) || 1
    ux /= ul
    uy /= ul
    uz /= ul
    const vx = tan[1] * uz - tan[2] * uy
    const vy = tan[2] * ux - tan[0] * uz
    const vz = tan[0] * uy - tan[1] * ux
    const a = (j / cols) * Math.PI * 2
    const c = Math.cos(a) * rr
    const s = Math.sin(a) * rr
    return {
      p: [p[0] + ux * c + vx * s, p[1] + uy * c + vy * s, p[2] + uz * c + vz * s],
      uv: [(j / cols) * Math.PI * 2 * rr, d],
    }
  })
}

// แถบแบน (ริบบิ้น) ตามเส้นทาง — ใช้กับชายผ้าพันคอ / สายคาด
export function addRibbon(m: Mesh, path: (t: number) => { p: Vec3; side: Vec3 }, width: number, rows = 40) {
  addGrid(m, rows, 2, (i, j) => {
    const t = i / rows
    const { p, side } = path(t)
    const k = (j / 2 - 0.5) * width
    return { p: [p[0] + side[0] * k, p[1] + side[1] * k, p[2] + side[2] * k], uv: [k + width, t * 0.6] }
  })
}

// ---------------- หุ่น ----------------

export const TORSO: Section[] = [
  { y: 0.8, rx: 0.13, rz: 0.1 },
  { y: 0.88, rx: 0.172, rz: 0.118 },
  { y: 0.98, rx: 0.158, rz: 0.106 },
  { y: 1.06, rx: 0.128, rz: 0.092 },
  { y: 1.18, rx: 0.145, rz: 0.104, cz: 0.004 },
  { y: 1.28, rx: 0.165, rz: 0.116, cz: 0.01 },
  { y: 1.35, rx: 0.182, rz: 0.106, cz: 0.004 },
  { y: 1.405, rx: 0.172, rz: 0.088 },
  { y: 1.44, rx: 0.1, rz: 0.066 },
  { y: 1.47, rx: 0.056, rz: 0.05 },
  { y: 1.57, rx: 0.048, rz: 0.046 },
]

const HEAD: Section[] = [
  { y: 1.55, rx: 0.001, rz: 0.001 },
  { y: 1.575, rx: 0.06, rz: 0.07 },
  { y: 1.63, rx: 0.085, rz: 0.097, cz: 0.006 },
  { y: 1.69, rx: 0.09, rz: 0.102, cz: 0.004 },
  { y: 1.745, rx: 0.08, rz: 0.09 },
  { y: 1.785, rx: 0.05, rz: 0.056 },
  { y: 1.802, rx: 0.001, rz: 0.001 },
]

export const ARM = (side: 1 | -1): Vec3[] => [
  [side * 0.168, 1.4, 0],
  [side * 0.2, 1.37, 0],
  [side * 0.228, 1.1, -0.012],
  [side * 0.246, 0.85, 0.012],
  [side * 0.25, 0.76, 0.02],
]
export const ARM_R = [0.052, 0.05, 0.036, 0.028, 0.02]

export const LEG = (side: 1 | -1): Vec3[] => [
  [side * 0.086, 0.9, 0],
  [side * 0.084, 0.47, 0.01],
  [side * 0.078, 0.09, -0.006],
  [side * 0.078, 0.03, 0.06],
]
export const LEG_R = [0.09, 0.055, 0.036, 0.03]

export function buildMannequin(): Mesh {
  const m = newMesh()
  addLoft(m, TORSO, 0.8, 1.57, { rows: 70 })
  addLoft(m, HEAD, 1.55, 1.802, { rows: 30, cols: 48 })
  for (const s of [1, -1] as const) {
    addTube(m, ARM(s), ARM_R, { rows: 50 })
    addTube(m, LEG(s), LEG_R, { rows: 60 })
  }
  computeNormals(m)
  return m
}

// ---------------- ชุด ----------------

export type GarmentKind = { mesh: Mesh; fold: number }

const pick = (s: Section, add: number) => ({ rx: s.rx + add, rz: s.rz + add })

function torsoGarment(yEnd: number, grow: number, neck: Section, sleeve: number, sleeveFlare = 0.012, hemFlare = 0.02): Mesh {
  const m = newMesh()
  // ลำตัวเสื้อ: ใช้ทรงลำตัวหุ่น + ระยะห่าง, ช่วงล่างบานออกเล็กน้อย, คอเสื้อเปิดตาม neck
  const body = TORSO.filter((s) => s.y < neck.y - 0.01).map((s) => ({ ...s }))
  body.push(neck)
  // ช่วงเอวลงไป: ชายเสื้อต้องคลุมทับกระโปรง/กางเกงได้ (ไม่ให้ผ้าสองชั้นซ้อนที่ระยะเดียวกัน)
  for (const sec of body) {
    if (sec.y < 1.09) {
      const h = sectionAt(HIPS, sec.y)
      sec.rx = Math.max(sec.rx, h.rx + 0.026)
      sec.rz = Math.max(sec.rz, h.rz + 0.026)
    }
  }
  const hem = sectionAt(yEnd < 1.09 ? HIPS : TORSO, yEnd)
  const extra = yEnd < 1.09 ? 0.026 : 0
  body.push({ y: yEnd - 0.001, rx: hem.rx + extra + hemFlare, rz: hem.rz + extra + hemFlare * 0.8 })
  if (yEnd < 1.09) body.push({ y: 1.09, ...pick(sectionAt(HIPS, 1.075), 0.026) })
  addLoft(m, body, yEnd, neck.y, { grow, rows: 60 })
  if (sleeve > 0) {
    for (const s of [1, -1] as const) addTube(m, ARM(s), ARM_R, { t0: 0.02, t1: sleeve, grow: grow + 0.006, flare: sleeveFlare })
  }
  computeNormals(m)
  return m
}

function waistDown(sections: Section[], yEnd: number, grow = 0.016, wave = 0): Mesh {
  const m = newMesh()
  addLoft(m, sections, yEnd, 1.075, { grow, rows: 60, cols: 80, wave })
  computeNormals(m)
  return m
}

const HIPS: Section[] = [
  { y: 1.075, rx: 0.135, rz: 0.096 },
  { y: 0.98, rx: 0.165, rz: 0.112 },
  { y: 0.89, rx: 0.18, rz: 0.124 },
]

function pants(legRadii: number[], yEnd: number): Mesh {
  const m = newMesh()
  addLoft(m, [...HIPS, { y: 0.82, rx: 0.19, rz: 0.13 }], 0.82, 1.075, { grow: 0.016, rows: 30 })
  const total = 0.9 - 0.03
  const t1 = Math.min(1, (0.9 - yEnd) / total)
  for (const s of [1, -1] as const) addTube(m, LEG(s), legRadii, { t0: 0, t1, rows: 50 })
  computeNormals(m)
  return m
}

function sash(): Mesh {
  const m = newMesh()
  // พาดจากไหล่ซ้ายของหุ่นลงสะโพกขวา ตามผิวลำตัว
  addRibbon(
    m,
    (t) => {
      const y = 1.41 - t * 0.5
      const a = 0.62 - t * 1.5 // มุมรอบตัว (0 = ด้านหน้า)
      const s = sectionAt(TORSO, y)
      const g = 0.058
      const p: Vec3 = [(s.rx + g) * Math.sin(a), y, (s.cz ?? 0) + (s.rz + g) * Math.cos(a)]
      return { p, side: [0.84, -0.54, 0] }
    },
    0.1,
    60,
  )
  computeNormals(m)
  return m
}

function scarf(): Mesh {
  const m = newMesh()
  addLoft(
    m,
    [
      { y: 1.42, rx: 0.1, rz: 0.088 },
      { y: 1.46, rx: 0.095, rz: 0.085 },
      { y: 1.5, rx: 0.075, rz: 0.07 },
    ],
    1.42,
    1.5,
    { grow: 0.012, rows: 12, cols: 48 },
  )
  for (const [x, len] of [
    [0.035, 0.32],
    [-0.02, 0.24],
  ] as const) {
    addRibbon(
      m,
      (t) => {
        const y = 1.44 - t * len
        const s = sectionAt(TORSO, y)
        return { p: [x + t * 0.02, y, (s.cz ?? 0) + s.rz + 0.045 + Math.sin(t * 3) * 0.008], side: [1, 0, 0] }
      },
      0.06,
      30,
    )
  }
  computeNormals(m)
  return m
}

function belt(): Mesh {
  const m = newMesh()
  addLoft(m, HIPS, 1.03, 1.075, { grow: 0.034, rows: 6 })
  computeNormals(m)
  return m
}

const CREW: Section = { y: 1.455, rx: 0.088, rz: 0.072 }

// garmentId → ทรง 3 มิติ (fold = ความลึกรอยพับของผ้า)
export function buildGarment(id: string): GarmentKind | null {
  switch (id) {
    case 'top-temp':
      return { mesh: torsoGarment(0.93, 0.014, CREW, 0.3, 0.02), fold: 0.12 }
    case 'top-crop':
      return { mesh: torsoGarment(1.13, 0.016, CREW, 0.22, 0.025, 0.03), fold: 0.1 }
    case 'top-shirt':
      return { mesh: torsoGarment(0.9, 0.018, { y: 1.475, rx: 0.07, rz: 0.062 }, 0.86, 0.01), fold: 0.14 }
    case 'top-tank':
      return { mesh: torsoGarment(0.95, 0.012, { y: 1.385, rx: 0.15, rz: 0.08 }, 0), fold: 0.08 }
    case 'top-jacket':
      return { mesh: torsoGarment(0.84, 0.032, { y: 1.455, rx: 0.1, rz: 0.084 }, 0.88, 0.014, 0.03), fold: 0.16 }
    case 'bottom-temp':
      return { mesh: waistDown([...HIPS, { y: 0.5, rx: 0.29, rz: 0.24 }], 0.5, 0.016, 0.035), fold: 0.28 }
    case 'bottom-pencil':
      return {
        mesh: waistDown([...HIPS, { y: 0.72, rx: 0.17, rz: 0.12 }, { y: 0.5, rx: 0.155, rz: 0.11 }], 0.5),
        fold: 0.08,
      }
    case 'bottom-midi':
      return { mesh: waistDown([...HIPS, { y: 0.26, rx: 0.33, rz: 0.28 }], 0.26, 0.016, 0.05), fold: 0.3 }
    case 'bottom-wide':
      return { mesh: pants([0.1, 0.098, 0.112, 0.125], 0.05), fold: 0.2 }
    case 'bottom-shorts':
      return { mesh: pants([0.1, 0.105, 0.11, 0.11], 0.66), fold: 0.12 }
    case 'sash-temp':
      return { mesh: sash(), fold: 0.05 }
    case 'acc-scarf':
      return { mesh: scarf(), fold: 0.15 }
    case 'acc-belt':
      return { mesh: belt(), fold: 0 }
    default:
      return null
  }
}
