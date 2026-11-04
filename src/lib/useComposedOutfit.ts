import { useEffect, useState } from 'react'
import type { MannequinItem } from '../components/MannequinLayers'
import { garments, type GarmentSlot } from '../data/garments'
import { findPattern } from '../data/patterns'
import { composeGarment } from '../design/composeGarment'
import type { SlotConfig } from '../store/useOutfit'

// แปลงชุด (ค่าตั้งของแต่ละชิ้น) → รูปชุดที่พร้อมวางบนหุ่น
export function useComposedOutfit(outfit: Partial<Record<GarmentSlot, SlotConfig>>): MannequinItem[] {
  const [items, setItems] = useState<MannequinItem[]>([])
  const key = JSON.stringify(outfit)

  useEffect(() => {
    let cancelled = false
    Promise.all(
      Object.entries(outfit).map(async ([slot, config]): Promise<MannequinItem | null> => {
        if (!config || config.enabled === false) return null
        const garment = garments.find((g) => g.id === config.garmentId)
        if (!garment) return null
        const bitmap = await composeGarment(garment.maskSrc, findPattern(config.patternId).src, garment.shadingSrc, {
          hue: config.hue,
          saturation: config.saturation,
          scale: config.scale,
          tint: config.tint ?? null,
          rotation: config.rotation ?? 0,
          finish: config.finish ?? 'matte',
        }).catch(() => null)
        return { slot, bitmap, garmentId: garment.id }
      }),
    ).then((list) => {
      if (!cancelled) setItems(list.filter((x): x is MannequinItem => x !== null))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return items
}
