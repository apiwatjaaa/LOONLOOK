import type { Garment } from '../data/garments'

type Props = {
  options: Garment[]
  selectedId: string
  onSelect: (id: string) => void
}

// การ์ดเลือกทรงชุด: แสดงเงาทรงจริงของแต่ละแบบ (จากไฟล์ mask เดียวกับที่ใช้วาดชุด)
function GarmentPicker({ options, selectedId, onSelect }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-3 xl:grid-cols-5">
      {options.map((garment) => {
        const isSelected = selectedId === garment.id
        return (
          <button
            key={garment.id}
            type="button"
            onClick={() => onSelect(garment.id)}
            aria-pressed={isSelected}
            className={`group flex flex-col items-center gap-2 bg-white/70 px-2 pb-2.5 pt-3 transition-all hover:-translate-y-0.5 hover:bg-white ${
              isSelected ? 'ring-1 ring-ink' : 'ring-1 ring-transparent'
            }`}
          >
            <span className="flex h-16 w-full items-center justify-center">
              <img
                src={garment.maskSrc}
                alt=""
                className={`max-h-full max-w-[70%] object-contain transition-opacity [filter:brightness(0)] ${
                  isSelected ? 'opacity-90' : 'opacity-45 group-hover:opacity-70'
                }`}
              />
            </span>
            <span className={`text-center text-[11px] leading-tight ${isSelected ? 'text-ink' : 'text-muted'}`}>
              {garment.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default GarmentPicker
