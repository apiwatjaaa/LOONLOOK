import accBelt from '../assets/garments/acc-belt.svg'
import accScarf from '../assets/garments/acc-scarf.svg'
import accSash from '../assets/garments/acc-sash.svg'
import bottomAline from '../assets/garments/bottom-aline.svg'
import bottomMidi from '../assets/garments/bottom-midi.svg'
import bottomPencil from '../assets/garments/bottom-pencil.svg'
import bottomShorts from '../assets/garments/bottom-shorts.svg'
import bottomWide from '../assets/garments/bottom-wide.svg'
import shadingNone from '../assets/garments/shading-none.svg'
import topCrop from '../assets/garments/top-crop.svg'
import topJacket from '../assets/garments/top-jacket.svg'
import topShirt from '../assets/garments/top-shirt.svg'
import topTank from '../assets/garments/top-tank.svg'
import topTee from '../assets/garments/top-tee.svg'

export type GarmentSlot = 'top' | 'bottom' | 'full' | 'accessory'

export type Garment = {
  id: string
  name: string
  slot: GarmentSlot
  maskSrc: string // SVG รูปทรงชุด (ขาว=พื้นที่ผ้า, โปร่งใส=นอกชุด)
  shadingSrc: string // SVG เงาเพิ่มเติม (ซ้อนแบบ multiply) — รอยพับหลักสร้างในโค้ดแล้ว (composeGarment)
  anchors: { from: number[]; to: number[] } // landmark index ของ MediaPipe
  widthScale: number // ความกว้างเทียบระยะ anchor
  offsetY: number // เลื่อนขึ้น/ลง (สัดส่วนของความยาวชิ้น)
}

// กรอบรูปของแต่ละชิ้น = กรอบที่ AR วางบนตัวจริง
// ท่อนบน: ไหล่ (11,12) → สะโพก (23,24), กว้าง 1.7 เท่าของระยะไหล่
// ท่อนล่าง: สะโพก (23,24) → ข้อเท้า (27,28), กว้าง 1.5 เท่าของระยะสะโพก
const TOP = { anchors: { from: [11, 12], to: [23, 24] }, widthScale: 1.7, offsetY: 0 }
const BOTTOM = { anchors: { from: [23, 24], to: [27, 28] }, widthScale: 1.5, offsetY: 0 }

// id เดิม (top-temp / bottom-temp / sash-temp) คงไว้ เพราะชุดที่บันทึกไว้แล้วอ้างถึง
export const garments: Garment[] = [
  { id: 'top-temp', name: 'เสื้อยืด', slot: 'top', maskSrc: topTee, shadingSrc: shadingNone, ...TOP },
  { id: 'top-crop', name: 'เสื้อครอป', slot: 'top', maskSrc: topCrop, shadingSrc: shadingNone, ...TOP },
  { id: 'top-shirt', name: 'เชิ้ตแขนยาว', slot: 'top', maskSrc: topShirt, shadingSrc: shadingNone, ...TOP },
  { id: 'top-tank', name: 'เสื้อกล้าม', slot: 'top', maskSrc: topTank, shadingSrc: shadingNone, ...TOP },
  { id: 'top-jacket', name: 'แจ็กเก็ต', slot: 'top', maskSrc: topJacket, shadingSrc: shadingNone, ...TOP },

  { id: 'bottom-temp', name: 'กระโปรงทรงเอ', slot: 'bottom', maskSrc: bottomAline, shadingSrc: shadingNone, ...BOTTOM },
  { id: 'bottom-pencil', name: 'กระโปรงทรงสอบ', slot: 'bottom', maskSrc: bottomPencil, shadingSrc: shadingNone, ...BOTTOM },
  { id: 'bottom-midi', name: 'กระโปรงยาวมิดี้', slot: 'bottom', maskSrc: bottomMidi, shadingSrc: shadingNone, ...BOTTOM },
  { id: 'bottom-wide', name: 'กางเกงขากว้าง', slot: 'bottom', maskSrc: bottomWide, shadingSrc: shadingNone, ...BOTTOM },
  { id: 'bottom-shorts', name: 'กางเกงขาสั้น', slot: 'bottom', maskSrc: bottomShorts, shadingSrc: shadingNone, ...BOTTOM },

  {
    id: 'sash-temp',
    name: 'สายคาดเฉียง',
    slot: 'accessory',
    maskSrc: accSash,
    shadingSrc: shadingNone,
    anchors: { from: [11], to: [24] },
    widthScale: 0.35,
    offsetY: 0,
  },
  { id: 'acc-scarf', name: 'ผ้าพันคอ', slot: 'accessory', maskSrc: accScarf, shadingSrc: shadingNone, ...TOP, widthScale: 1 },
  { id: 'acc-belt', name: 'เข็มขัด', slot: 'accessory', maskSrc: accBelt, shadingSrc: shadingNone, ...TOP, widthScale: 0.9 },
]

// ลำดับการวาด: ท่อนล่าง → ท่อนบน/เดรส → เครื่องประดับ (ตามข้อ 6.5)
export const SLOT_DRAW_ORDER: Record<GarmentSlot, number> = {
  bottom: 0,
  full: 1,
  top: 1,
  accessory: 2,
}
