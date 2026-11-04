import { useRef, type PointerEvent, type ReactNode } from 'react'

/**
 * การ์ดเอียง 3 มิติตามเมาส์ + แสงสะท้อนวิ่งตามนิ้ว
 * ใช้ CSS perspective ล้วน ไม่มี library — ปิดเองบนจอสัมผัสและเมื่อผู้ใช้ตั้งลดการเคลื่อนไหว
 */
type Props = {
  children: ReactNode
  className?: string
  max?: number // องศาเอียงสูงสุด
}

function Tilt({ children, className = '', max = 7 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const glareRef = useRef<HTMLSpanElement>(null)

  const canTilt = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el || !canTilt()) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    el.style.transform = `perspective(900px) rotateX(${(0.5 - py) * max}deg) rotateY(${(px - 0.5) * max}deg) scale(1.015)`
    if (glareRef.current) {
      glareRef.current.style.opacity = '1'
      glareRef.current.style.background = `radial-gradient(circle at ${px * 100}% ${py * 100}%, rgba(255,255,255,0.28), transparent 55%)`
    }
  }

  const onLeave = () => {
    if (ref.current) ref.current.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)'
    if (glareRef.current) glareRef.current.style.opacity = '0'
  }

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`relative transition-transform duration-500 ease-out will-change-transform [transform-style:preserve-3d] ${className}`}
    >
      {children}
      <span
        ref={glareRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500"
      />
    </div>
  )
}

export default Tilt
