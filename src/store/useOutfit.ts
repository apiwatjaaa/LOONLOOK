import { create } from 'zustand'
import type { GarmentSlot } from '../data/garments'
import type { Pattern } from '../data/patterns'

export type Finish = 'matte' | 'satin' | 'denim' | 'knit'

export type SlotConfig = {
  garmentId: string
  patternId: string
  hue: number
  saturation: number
  scale: number
  // ตัวเลือกเพิ่ม (ไม่บังคับ — ชุดที่บันทึกไว้ก่อนหน้ายังเปิดได้)
  tint?: string | null // สีผ้าจริง (hex) ย้อมทับลาย, null = สีเดิมของลาย
  rotation?: number // องศาหมุนลาย
  finish?: Finish // เนื้อผ้า
  enabled?: boolean // false = ไม่ใส่ชิ้นนี้
}

export type OutfitConfigs = Partial<Record<GarmentSlot, SlotConfig>>
export type CustomPatterns = Partial<Record<GarmentSlot, Pattern>>

type OutfitStore = {
  configs: OutfitConfigs
  customPatterns: CustomPatterns
  setOutfit: (configs: OutfitConfigs, customPatterns: CustomPatterns) => void
}

// เก็บชุดที่กำลังออกแบบอยู่ในสตูดิโอ ส่งข้ามหน้าไปให้ Try-On ใช้เรนเดอร์ AR (ดู CLAUDE.md ข้อ 3, เฟส 6)
export const useOutfitStore = create<OutfitStore>((set) => ({
  configs: {},
  customPatterns: {},
  setOutfit: (configs, customPatterns) => set({ configs, customPatterns }),
}))
