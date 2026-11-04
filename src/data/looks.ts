import type { GarmentSlot } from './garments'
import type { SlotConfig } from '../store/useOutfit'

type Outfit = Partial<Record<GarmentSlot, SlotConfig>>

export type Look = {
  id: string
  name: string
  tag: string // สรุปสั้น ๆ ใต้ชื่อ
  description: string
  outfit: Outfit
}

// ลุคสำเร็จรูป — ใช้ทั้งหน้าแรกและสตูดิโอ (เปิด /studio?look=<id> จะใส่ลุคนั้นให้ทันที)
export const LOOKS: Look[] = [
  {
    id: 'minimal',
    name: 'มินิมอล',
    tag: 'ครีม · เบจ · เข็มขัดดำ',
    description: 'ผ้าไหมพรมสีครีม กับกางเกงขากว้างเบจ',
    outfit: {
      top: { garmentId: 'top-temp', patternId: 'solid', hue: 0, saturation: 100, scale: 1, tint: '#efe9df', finish: 'knit' },
      bottom: { garmentId: 'bottom-wide', patternId: 'solid', hue: 0, saturation: 100, scale: 1, tint: '#cdb89a', finish: 'matte' },
      accessory: { garmentId: 'acc-belt', patternId: 'solid', hue: 0, saturation: 100, scale: 1, tint: '#1c1a19', finish: 'matte' },
    },
  },
  {
    id: 'street',
    name: 'สตรีท',
    tag: 'ลายพราง · ยีนส์ · เสือดาว',
    description: 'แจ็กเก็ตลายพราง กางเกงยีนส์ สายคาดเสือดาว',
    outfit: {
      top: { garmentId: 'top-jacket', patternId: 'camo', hue: 0, saturation: 100, scale: 1.2, tint: null, finish: 'denim' },
      bottom: { garmentId: 'bottom-wide', patternId: 'solid', hue: 0, saturation: 100, scale: 1, tint: '#5b7da6', finish: 'denim' },
      accessory: { garmentId: 'sash-temp', patternId: 'leopard', hue: 0, saturation: 100, scale: 1, tint: null, finish: 'satin', enabled: true },
    },
  },
  {
    id: 'classic',
    name: 'คลาสสิก',
    tag: 'เชิ้ตครีม · สก็อตแดงไวน์',
    description: 'เชิ้ตซาติน กระโปรงสก็อต ผ้าพันคอกรมท่า',
    outfit: {
      top: { garmentId: 'top-shirt', patternId: 'solid', hue: 0, saturation: 100, scale: 1, tint: '#efe9df', finish: 'satin' },
      bottom: { garmentId: 'bottom-pencil', patternId: 'plaid', hue: 0, saturation: 100, scale: 0.9, tint: '#6d1f2a', finish: 'matte' },
      accessory: { garmentId: 'acc-scarf', patternId: 'stripes', hue: 0, saturation: 100, scale: 0.7, tint: '#1f2e4a', finish: 'knit' },
    },
  },
  {
    id: 'soft',
    name: 'หวานนิ่ม',
    tag: 'ชมพูดอกไม้ · ซาตินครีม',
    description: 'เสื้อครอปลายดอก กับกระโปรงมิดี้ซาติน',
    outfit: {
      top: { garmentId: 'top-crop', patternId: 'floral', hue: 0, saturation: 100, scale: 1, tint: '#d49aa3', finish: 'satin' },
      bottom: { garmentId: 'bottom-midi', patternId: 'solid', hue: 0, saturation: 100, scale: 1, tint: '#efe9df', finish: 'satin' },
      accessory: { garmentId: 'acc-belt', patternId: 'solid', hue: 0, saturation: 100, scale: 1, tint: '#9a6a3a', finish: 'matte', enabled: false },
    },
  },
]

