import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { gsap } from '../lib/gsap'
import MenuPreview from './MenuPreview'

const links = [
  { to: '/', en: 'Home', th: 'หน้าแรก', note: 'ผ้า 3 มิติ และลุคแนะนำ' },
  { to: '/studio', en: 'Studio', th: 'สตูดิโอ', note: 'ออกแบบชุดเอง เลือกทรง ลาย สี และเนื้อผ้า' },
  { to: '/tryon', en: 'Try-On', th: 'ลองสวม', note: 'ส่องกล้อง ชุดขยับตามตัวแบบเรียลไทม์' },
  { to: '/patterns', en: 'Patterns', th: 'คลังลาย', note: 'รวมลายผ้าทั้งหมด พร้อมเรื่องราว' },
  { to: '/gallery', en: 'Gallery', th: 'แกลเลอรี', note: 'รูปที่ถ่ายไว้ตอนลองสวม' },
]

function Navbar() {
  const [open, setOpen] = useState(false) // สถานะที่ผู้ใช้สั่ง
  const [mounted, setMounted] = useState(false) // เมนูยังอยู่บนจอ (รอ animation ปิดจบ)
  const [hovered, setHovered] = useState<number | null>(null)
  const [solid, setSolid] = useState(true)
  const { pathname } = useLocation()
  const barTopRef = useRef<HTMLSpanElement>(null)
  const barMidRef = useRef<HTMLSpanElement>(null)
  const barBottomRef = useRef<HTMLSpanElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const isHome = pathname === '/'
  const activeIndex = Math.max(0, links.findIndex((l) => l.to === pathname))
  const shown = links[hovered ?? activeIndex]

  // หน้าแรกให้ header โปร่งทับ hero ก่อน แล้วค่อยเป็นพื้นขาวทึบเมื่อเลื่อนผ่าน (DESIGN.md ข้อ 4.1)
  useEffect(() => {
    if (!isHome) {
      setSolid(true)
      return
    }
    function update() {
      setSolid(window.scrollY > window.innerHeight - 120)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [isHome])

  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

  function animateBars(next: boolean) {
    const duration = reduced() ? 0 : 0.3
    gsap.to(barTopRef.current, { rotate: next ? 45 : 0, y: next ? 6 : 0, duration, ease: 'power2.out' })
    gsap.to(barMidRef.current, { opacity: next ? 0 : 1, duration: duration * 0.6, ease: 'power2.out' })
    gsap.to(barBottomRef.current, { rotate: next ? -45 : 0, y: next ? -6 : 0, duration, ease: 'power2.out' })
  }

  function openMenu() {
    setOpen(true)
    setMounted(true)
    animateBars(true)
  }

  function closeMenu() {
    if (!open) return
    setOpen(false)
    animateBars(false)
    const overlay = overlayRef.current
    if (!overlay || reduced()) {
      setMounted(false)
      return
    }
    gsap
      .timeline({ onComplete: () => setMounted(false) })
      .to(overlay.querySelectorAll('.menu-line'), { yPercent: 110, duration: 0.3, stagger: 0.03, ease: 'power2.in' })
      .to(overlay, { clipPath: 'inset(0 0 100% 0)', duration: 0.5, ease: 'power3.inOut' }, 0.15)
  }

  // เปิดเมนู: ม่านเลื่อนลง → ตัวหนังสือไล่ขึ้นทีละบรรทัด → การ์ดผ้าลอยเข้ามา
  useLayoutEffect(() => {
    if (!open || !mounted) return
    const overlay = overlayRef.current
    if (!overlay) return
    if (reduced()) {
      gsap.set(overlay, { clipPath: 'inset(0 0 0% 0)' })
      return
    }
    const tl = gsap.timeline()
    tl.fromTo(overlay, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 0.7, ease: 'power3.inOut' })
      .fromTo(
        overlay.querySelectorAll('.menu-line'),
        { yPercent: 110 },
        { yPercent: 0, duration: 0.8, stagger: 0.06, ease: 'power3.out' },
        0.35,
      )
      .fromTo(
        cardRef.current,
        { opacity: 0, y: 40, rotateY: -25 },
        { opacity: 1, y: 0, rotateY: 0, duration: 1, ease: 'power3.out' },
        0.45,
      )
      .fromTo(overlay.querySelectorAll('.menu-fade'), { opacity: 0 }, { opacity: 1, duration: 0.6, stagger: 0.05 }, 0.7)
    return () => {
      tl.kill()
    }
  }, [open, mounted])

  // ล็อกการเลื่อนหน้า + ปิดด้วย Esc
  useEffect(() => {
    if (!mounted) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, open])

  // การ์ดผ้าเอียงตามเมาส์ (3 มิติ)
  function onOverlayMove(e: PointerEvent<HTMLDivElement>) {
    const card = cardRef.current
    if (!card || reduced()) return
    const x = e.clientX / window.innerWidth - 0.5
    const y = e.clientY / window.innerHeight - 0.5
    gsap.to(card, { rotateY: x * 26, rotateX: y * -16, duration: 0.8, ease: 'power3.out', overwrite: 'auto' })
  }

  const light = solid && !open
  const btnTone = light
    ? 'border-line text-ink hover:border-ink hover:bg-stone'
    : 'border-white/40 text-white hover:border-white hover:bg-white/10'
  const barTone = light ? 'bg-ink' : 'bg-white'

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
          light ? 'border-b border-line bg-bg' : 'border-b border-transparent bg-transparent'
        }`}
      >
        <div className="relative flex h-14 items-center justify-between px-4">
          <button
            type="button"
            aria-label={open ? 'ปิดเมนู' : 'เปิดเมนู'}
            aria-expanded={open}
            onClick={open ? closeMenu : openMenu}
            className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${btnTone}`}
          >
            <span className="relative block h-[14px] w-4">
              <span ref={barTopRef} className={`absolute left-0 top-0 block h-px w-full transition-colors duration-300 ${barTone}`} />
              <span
                ref={barMidRef}
                className={`absolute left-0 top-1/2 block h-px w-full -translate-y-1/2 transition-colors duration-300 ${barTone}`}
              />
              <span ref={barBottomRef} className={`absolute bottom-0 left-0 block h-px w-full transition-colors duration-300 ${barTone}`} />
            </span>
          </button>

          <NavLink to="/" onClick={closeMenu} className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center">
            <span className={`font-wordmark text-lg italic tracking-[0.02em] transition-colors duration-300 ${light ? 'text-ink' : 'text-white'}`}>
              Long Look
            </span>
            <span className={`mt-1 h-px w-3.5 transition-colors duration-300 ${light ? 'bg-ink' : 'bg-white'}`} aria-hidden />
          </NavLink>

          <NavLink
            to="/tryon"
            onClick={closeMenu}
            aria-label="ลองสวม"
            className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${btnTone}`}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M3 7a1.5 1.5 0 0 1 1.5-1.5h1.1l.6-1h5.6l.6 1h1.1A1.5 1.5 0 0 1 15 7v6.5A1.5 1.5 0 0 1 13.5 15h-9A1.5 1.5 0 0 1 3 13.5V7Z"
                stroke="currentColor"
                strokeWidth="1.3"
              />
              <circle cx="9" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </NavLink>
        </div>
      </header>

      {mounted && (
        <div
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          aria-label="เมนู"
          onPointerMove={onOverlayMove}
          className="fixed inset-0 z-40 overflow-y-auto bg-night text-white"
          style={{ clipPath: 'inset(0 0 100% 0)' }}
        >
          {/* แสงสปอตไลต์จาง ๆ + ชื่อหน้าตัวยักษ์ด้านหลัง = ชั้นลึกสุด */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(ellipse 55% 60% at 72% 45%, rgba(255,255,255,0.09), transparent 70%)' }}
          />
          <p
            aria-hidden
            className="menu-fade pointer-events-none absolute -bottom-[4vw] right-0 select-none whitespace-nowrap font-wordmark text-[22vw] italic leading-none text-white/[0.04]"
          >
            {shown.en}
          </p>

          <div className="relative mx-auto grid min-h-full max-w-[1400px] grid-rows-[1fr_auto] px-6 pb-8 pt-24 sm:px-10 lg:grid-cols-12 lg:gap-10">
            {/* รายการเมนู */}
            <nav className="flex flex-col justify-center lg:col-span-7" onPointerLeave={() => setHovered(null)}>
              <ul className="flex flex-col">
                {links.map((link, index) => {
                  const isActive = index === activeIndex
                  const dim = hovered !== null && hovered !== index
                  return (
                    <li key={link.to} className="border-b border-white/10 first:border-t">
                      <NavLink
                        to={link.to}
                        onClick={closeMenu}
                        onPointerEnter={() => setHovered(index)}
                        onFocus={() => setHovered(index)}
                        className={`group flex items-baseline gap-4 py-3 transition-all duration-500 sm:gap-6 sm:py-4 ${
                          dim ? 'opacity-30' : 'opacity-100'
                        }`}
                      >
                        <span className="w-6 shrink-0 text-[11px] tracking-[0.12em] text-white/40">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="block overflow-hidden">
                          <span
                            className={`menu-line block font-wordmark text-[13vw] italic leading-[1.02] transition-transform duration-500 group-hover:translate-x-3 sm:text-[9vw] lg:text-[5.6vw] ${
                              isActive ? 'text-white' : 'text-white/85'
                            }`}
                          >
                            {link.en}
                          </span>
                        </span>
                        <span className="ml-auto flex items-center gap-3 text-sm text-white/55 transition-colors group-hover:text-white">
                          {isActive && <span className="h-1.5 w-1.5 rounded-full bg-white" aria-label="หน้าปัจจุบัน" />}
                          {link.th}
                        </span>
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </nav>

            {/* การ์ดผืนผ้า 3 มิติ เปลี่ยนตามเมนูที่ชี้ */}
            <div className="hidden items-center justify-center lg:col-span-5 lg:flex" style={{ perspective: '1200px' }}>
              <div ref={cardRef} className="relative w-full max-w-[380px] [transform-style:preserve-3d]">
                <div className="relative aspect-[3/4] overflow-hidden shadow-[0_60px_80px_-30px_rgba(0,0,0,0.8)]">
                  <MenuPreview index={hovered ?? activeIndex} />
                  <span aria-hidden className="absolute inset-0 z-10 bg-gradient-to-b from-transparent via-transparent via-55% to-black/85 pointer-events-none" />
                  <span className="absolute left-5 top-5 z-20 font-wordmark text-3xl italic text-white mix-blend-difference pointer-events-none">
                    {String((hovered ?? activeIndex) + 1).padStart(2, '0')}
                  </span>
                  <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-1 p-5">
                    <span className="text-[11px] uppercase tracking-[0.14em] text-white/60">{shown.en} · {shown.th}</span>
                    <span className="text-base text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.6)]">{shown.note}</span>
                  </div>
                </div>
                {/* เงาตกบนพื้น ลึกกว่าการ์ด */}
                <span
                  aria-hidden
                  className="absolute -bottom-10 left-1/2 h-8 w-3/4 -translate-x-1/2 rounded-full"
                  style={{
                    background: 'radial-gradient(ellipse, rgba(0,0,0,0.6), transparent 70%)',
                    transform: 'translateX(-50%) translateZ(-60px)',
                  }}
                />
              </div>
            </div>

            {/* แถบข้อมูลล่าง */}
            <div className="menu-fade mt-10 flex flex-col gap-4 border-t border-white/10 pt-5 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between lg:col-span-12">
              <span>ภาพจากกล้องประมวลผลในเครื่องคุณเท่านั้น ไม่ถูกส่งออกไปไหน</span>
              <span className="hidden sm:inline">โครงงานศิลปหัตถกรรมนักเรียน · Long Look</span>
              <NavLink to="/studio" onClick={closeMenu} className="btn h-11 self-start bg-white px-6 text-sm text-ink hover:opacity-85 sm:self-auto">
                เริ่มออกแบบชุด →
              </NavLink>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Navbar
