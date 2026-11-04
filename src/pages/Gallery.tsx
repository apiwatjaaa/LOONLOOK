import { useEffect, useState } from 'react'
import { readGalleryPhotos, removeGalleryPhoto, type GalleryPhoto } from '../lib/gallery'

function Gallery() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])

  useEffect(() => {
    setPhotos(readGalleryPhotos())
  }, [])

  function handleRemove(id: string) {
    setPhotos(removeGalleryPhoto(id))
  }

  if (photos.length === 0) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface">
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-muted" fill="none">
            <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.3" />
            <circle cx="9" cy="10.5" r="1.4" fill="currentColor" />
            <path
              d="M4 17.5 9 13l3 2.5 3.5-4L21 15"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="font-heading text-3xl text-ink">แกลเลอรีรูปภาพ</h1>
        <p className="max-w-sm text-muted">
          ยังไม่มีรูปที่ถ่ายไว้ — ลองไปที่หน้าลองสวมแล้วกดปุ่ม&nbsp;ถ่ายรูป
        </p>
      </section>
    )
  }

  return (
    <section className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
      <h1 className="font-heading text-3xl text-ink">แกลเลอรีรูปภาพ</h1>
      <p className="mt-1 text-muted">รูปที่ถ่ายไว้จากหน้าลองสวม ({photos.length} รูป)</p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {photos
          .slice()
          .reverse()
          .map((photo) => (
            <div key={photo.id} className="flex flex-col gap-2">
              <img
                src={photo.dataUrl}
                alt="รูปที่ถ่ายจากหน้าลองสวม"
                className="aspect-[3/4] w-full rounded-[4px] bg-surface object-cover"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">
                  {new Date(photo.capturedAt).toLocaleString('th-TH')}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(photo.id)}
                  className="btn btn-text text-xs"
                >
                  ลบ
                </button>
              </div>
            </div>
          ))}
      </div>
    </section>
  )
}

export default Gallery
