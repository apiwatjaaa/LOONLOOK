export type GalleryPhoto = {
  id: string
  dataUrl: string
  capturedAt: string
}

const GALLERY_KEY = 'longlook:gallery'

export function readGalleryPhotos(): GalleryPhoto[] {
  try {
    const raw = localStorage.getItem(GALLERY_KEY)
    return raw ? (JSON.parse(raw) as GalleryPhoto[]) : []
  } catch {
    return []
  }
}

export function addGalleryPhoto(dataUrl: string): GalleryPhoto[] {
  const list = readGalleryPhotos()
  list.push({ id: Date.now().toString(), dataUrl, capturedAt: new Date().toISOString() })
  localStorage.setItem(GALLERY_KEY, JSON.stringify(list))
  return list
}

export function removeGalleryPhoto(id: string): GalleryPhoto[] {
  const list = readGalleryPhotos().filter((photo) => photo.id !== id)
  localStorage.setItem(GALLERY_KEY, JSON.stringify(list))
  return list
}
