import { useState } from 'react'
import { PATTERN_STYLES, type Pattern } from '../data/patterns'
import { gsap } from '../lib/gsap'

type Props = {
  options: Pattern[]
  selectedId: string
  onSelect: (id: string) => void
}

// ตารางลายผ้า + ตัวกรองตามสไตล์ (ลายที่อัปโหลด/วาดเองแสดงทุกหมวด)
function PatternPicker({ options, selectedId, onSelect }: Props) {
  const [filter, setFilter] = useState<string>('ทั้งหมด')
  const shown = options.filter(
    (p) => filter === 'ทั้งหมด' || p.style === filter || p.id.startsWith('custom-') || p.id === 'solid',
  )
  return (
    <div className="flex flex-col gap-3">
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {['ทั้งหมด', ...PATTERN_STYLES].map((f) => {
        const count = f === 'ทั้งหมด' ? options.length : options.filter((p) => p.style === f).length
        return (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`h-8 shrink-0 rounded-full border px-3 text-[11px] transition-colors ${
              filter === f ? 'border-ink bg-ink text-white' : 'border-ink/20 text-ink hover:border-ink'
            }`}
          >
            {f} <span className={filter === f ? 'text-white/60' : 'text-muted'}>{count}</span>
          </button>
        )
      })}
    </div>
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5">
      {shown.map((pattern) => {
        const isSelected = selectedId === pattern.id
        return (
          <button
            key={pattern.id}
            type="button"
            aria-pressed={isSelected}
            onClick={(e) => {
              onSelect(pattern.id)
              gsap.fromTo(
                e.currentTarget,
                { scale: 0.95 },
                { scale: 1, duration: 0.25, ease: 'power2.out', overwrite: true },
              )
            }}
            className="group flex flex-col gap-1.5 text-left"
          >
            <span
              className={`relative block aspect-square w-full overflow-hidden bg-stone transition-transform group-hover:-translate-y-0.5 ${
                isSelected ? 'ring-1 ring-ink ring-offset-2 ring-offset-ivory' : ''
              }`}
            >
              <span
                className="absolute inset-0"
                style={{ backgroundImage: `url("${pattern.src}")`, backgroundSize: '48px 48px' }}
              />
              <span
                aria-hidden
                className="absolute inset-0 mix-blend-overlay"
                style={{
                  background:
                    'linear-gradient(105deg, rgba(0,0,0,.35), rgba(255,255,255,.3) 30%, rgba(0,0,0,.25) 55%, rgba(255,255,255,.25) 78%, rgba(0,0,0,.4))',
                }}
              />
            </span>
            <span className={`truncate text-[11px] ${isSelected ? 'text-ink' : 'text-muted'}`}>
              {pattern.name}
            </span>
          </button>
        )
      })}
    </div>
    </div>
  )
}

export default PatternPicker
