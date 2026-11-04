import type { GarmentSlot } from '../data/garments'

type Props = {
  slot: GarmentSlot
  className?: string
}

// ไอคอนรูปทรงชุดแบบลายเส้นเดียวกันทุกชิ้น (เส้นหนา 1.6, ไม่มีเหลี่ยมคม)
function GarmentIcon({ slot, className }: Props) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
  }

  if (slot === 'top') {
    return (
      <svg {...common}>
        <path d="M9 3 4 6l1.5 3L8 8v11h8V8l2.5 1L20 6l-5-3c0 1.5-1.3 2.5-3 2.5S9 4.5 9 3Z" />
      </svg>
    )
  }

  if (slot === 'bottom') {
    return (
      <svg {...common}>
        <path d="M7 3h10l1 8-3 9h-3l-1-7-1 7H7l-3-9Z" />
      </svg>
    )
  }

  if (slot === 'full') {
    return (
      <svg {...common}>
        <path d="M9 3c0 1.3 1.3 2.3 3 2.3S15 4.3 15 3l2 4-2.5 1.8L17 21H7l2.5-12.2L7 7Z" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <path d="M6 4c3 5 9 11 12 16M7 18c3-1 4-4 3-7" />
    </svg>
  )
}

export default GarmentIcon
