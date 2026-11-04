import camo from '../assets/patterns/camo.svg'
import polka from '../assets/patterns/polka.svg'
import microdot from '../assets/patterns/microdot.svg'
import gingham from '../assets/patterns/gingham.svg'
import pinstripe from '../assets/patterns/pinstripe.svg'
import herringbone from '../assets/patterns/herringbone.svg'
import chevron from '../assets/patterns/chevron.svg'
import checker from '../assets/patterns/checker.svg'
import zebra from '../assets/patterns/zebra.svg'
import waves from '../assets/patterns/waves.svg'
import stars from '../assets/patterns/stars.svg'
import hearts from '../assets/patterns/hearts.svg'
import leaves from '../assets/patterns/leaves.svg'
import argyle from '../assets/patterns/argyle.svg'
import paisley from '../assets/patterns/paisley.svg'
import scales from '../assets/patterns/scales.svg'
import awning from '../assets/patterns/awning.svg'
import floral from '../assets/patterns/floral.svg'
import geo from '../assets/patterns/geo.svg'
import leopard from '../assets/patterns/leopard.svg'
import plaid from '../assets/patterns/plaid.svg'
import stripes from '../assets/patterns/stripes.svg'

// หมวดสไตล์ (ใช้กรองในสตูดิโอ)
export const PATTERN_STYLES = ['คลาสสิก', 'สตรีท', 'มินิมอล', 'กราฟิก', 'หวาน'] as const

export type Pattern = {
  id: string
  name: string
  description: string
  style?: string // แท็กสไตล์สั้น ๆ แสดงใต้รูปในหน้าคลังลาย (ดู DESIGN.md ข้อ 5)
  src: string // ลายซ้ำได้แบบ seamless (ใช้กับ createPattern "repeat")
}

// รูปถ่ายลายผ้าจริง: วางไฟล์ชื่อตรงกับ id ของลาย (เช่น stripes.jpg) ไว้ที่โฟลเดอร์นี้
// แล้วระบบจะใช้รูปจริงแทนลายที่สร้างจากโค้ดโดยอัตโนมัติ
const photoModules = import.meta.glob<string>('../assets/patterns/photos/*.{jpg,jpeg,png,webp}', {
  eager: true,
  import: 'default',
})

function realPhotoFor(id: string): string | undefined {
  const match = Object.entries(photoModules).find(([path]) => {
    const filename = path.split('/').pop() ?? ''
    return filename.startsWith(`${id}.`)
  })
  return match?.[1]
}

function patternSrc(id: string, generated: string): string {
  return realPhotoFor(id) ?? generated
}

// ลายตัวอย่างสร้างด้วยโค้ด (seamless) รอรูปถ่ายลายผ้าจริง — ผู้ใช้อัปโหลดลายเองได้ในสตูดิโอ
export const patterns: Pattern[] = [
  {
    id: 'stripes',
    name: 'ลายทาง',
    description: 'ลายทางเฉียงทันสมัย ตัดเส้นบางสีสด',
    style: 'คลาสสิก',
    src: patternSrc('stripes', stripes),
  },
  {
    id: 'plaid',
    name: 'ลายเช็ก',
    description: 'ลายตารางสก็อตคลาสสิก ตัดเส้นสีสดซ้อนทับ',
    style: 'คลาสสิก',
    src: patternSrc('plaid', plaid),
  },
  {
    id: 'leopard',
    name: 'ลายเสือดาว',
    description: 'ลายจุดโรเซตต์บนพื้นสีน้ำตาลทอง',
    style: 'สตรีท',
    src: patternSrc('leopard', leopard),
  },
  {
    id: 'floral',
    name: 'ลายดอกไม้มินิมอล',
    description: 'ลายดอกเส้นเรียบง่ายบนพื้นเข้ม',
    style: 'มินิมอล',
    src: patternSrc('floral', floral),
  },
  {
    id: 'camo',
    name: 'ลายคาโมฟลาจ',
    description: 'ลายพรางทหารโทนมืด ซ้อนเหลี่ยมมุม',
    style: 'สตรีท',
    src: patternSrc('camo', camo),
  },
  {
    id: 'geo',
    name: 'ลายเรขาคณิต',
    description: 'ลายสามเหลี่ยมกราฟิก สีสดตัดกัน',
    style: 'กราฟิก',
    src: patternSrc('geo', geo),
  },
  {
    id: 'polka',
    name: 'ลายจุด',
    description: 'จุดกลมดำบนพื้นครีม แบบเรโทร',
    style: 'หวาน',
    src: patternSrc('polka', polka),
  },
  {
    id: 'microdot',
    name: 'ลายจุดจิ๋ว',
    description: 'จุดเล็กสีแดงไวน์ เรียบร้อย',
    style: 'มินิมอล',
    src: patternSrc('microdot', microdot),
  },
  {
    id: 'gingham',
    name: 'ลายกิงแฮม',
    description: 'ตารางชมพูโปร่ง แบบปิกนิก',
    style: 'หวาน',
    src: patternSrc('gingham', gingham),
  },
  {
    id: 'pinstripe',
    name: 'ลายพินสไตรป์',
    description: 'เส้นบางบนพื้นกรมท่า แบบสูท',
    style: 'คลาสสิก',
    src: patternSrc('pinstripe', pinstripe),
  },
  {
    id: 'herringbone',
    name: 'ลายก้างปลา',
    description: 'ลายทอก้างปลาแบบผ้าวูล',
    style: 'คลาสสิก',
    src: patternSrc('herringbone', herringbone),
  },
  {
    id: 'chevron',
    name: 'ลายบั้ง',
    description: 'ซิกแซกดำบนพื้นมัสตาร์ด',
    style: 'กราฟิก',
    src: patternSrc('chevron', chevron),
  },
  {
    id: 'checker',
    name: 'ลายหมากรุก',
    description: 'ช่องสี่เหลี่ยมขาวดำสลับ',
    style: 'สตรีท',
    src: patternSrc('checker', checker),
  },
  {
    id: 'zebra',
    name: 'ลายม้าลาย',
    description: 'แถบคลื่นดำบนพื้นครีม',
    style: 'สตรีท',
    src: patternSrc('zebra', zebra),
  },
  {
    id: 'waves',
    name: 'ลายคลื่น',
    description: 'เส้นคลื่นน้ำเงินบนพื้นฟ้าอ่อน',
    style: 'มินิมอล',
    src: patternSrc('waves', waves),
  },
  {
    id: 'stars',
    name: 'ลายดาว',
    description: 'ดาวทองบนพื้นกรมท่า',
    style: 'หวาน',
    src: patternSrc('stars', stars),
  },
  {
    id: 'hearts',
    name: 'ลายหัวใจ',
    description: 'หัวใจแดงบนพื้นชมพู',
    style: 'หวาน',
    src: patternSrc('hearts', hearts),
  },
  {
    id: 'leaves',
    name: 'ลายใบไม้',
    description: 'ใบไม้เขียวแบบรีสอร์ต',
    style: 'หวาน',
    src: patternSrc('leaves', leaves),
  },
  {
    id: 'argyle',
    name: 'ลายอาร์ไกล์',
    description: 'ข้าวหลามตัดแบบเสื้อถักอังกฤษ',
    style: 'คลาสสิก',
    src: patternSrc('argyle', argyle),
  },
  {
    id: 'paisley',
    name: 'ลายเพสลีย์',
    description: 'ลายหยดน้ำหลายสีแบบวินเทจ',
    style: 'คลาสสิก',
    src: patternSrc('paisley', paisley),
  },
  {
    id: 'scales',
    name: 'ลายเกล็ด',
    description: 'เกล็ดครึ่งวงกลมสีฟ้า',
    style: 'กราฟิก',
    src: patternSrc('scales', scales),
  },
  {
    id: 'awning',
    name: 'ลายแถบกว้าง',
    description: 'แถบส้มอิฐสลับครีม แบบกันสาด',
    style: 'กราฟิก',
    src: patternSrc('awning', awning),
  },
]

// ผ้าพื้น (ไม่มีลาย) — ใช้คู่กับ "สีผ้า" ให้ได้ผ้าสีล้วน ไม่แสดงในคลังลาย/หน้าแรก
export const SOLID_PATTERN: Pattern = {
  id: 'solid',
  name: 'ผ้าพื้น',
  description: 'ผ้าสีล้วน ไม่มีลาย',
  style: 'เบสิก',
  src:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23efebe5'/%3E%3C/svg%3E",
}

// หา pattern จาก id (รวมผ้าพื้น) — ไม่เจอให้ใช้ลายแรก
export function findPattern(id: string): Pattern {
  if (id === SOLID_PATTERN.id) return SOLID_PATTERN
  return patterns.find((p) => p.id === id) ?? patterns[0]
}
