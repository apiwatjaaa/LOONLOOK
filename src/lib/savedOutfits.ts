import type { OutfitConfigs } from '../store/useOutfit'

export type SavedOutfit = {
  id: string
  outfit: OutfitConfigs
  savedAt: string
}

const STORAGE_KEY = 'longlook:saved-outfits'

export function readSavedOutfits(): SavedOutfit[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SavedOutfit[]) : []
  } catch {
    return []
  }
}

export function saveOutfit(outfit: OutfitConfigs): SavedOutfit[] {
  const list = readSavedOutfits()
  list.push({ id: Date.now().toString(), outfit, savedAt: new Date().toISOString() })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  return list
}
