import { useEffect, useRef, useState } from 'react'
import { garments } from '../data/garments'
import { findPattern, patterns } from '../data/patterns'
import { composeGarment } from '../design/composeGarment'
import { readGalleryPhotos } from '../lib/gallery'
import { gsap } from '../lib/gsap'
import { useOutfitStore, type OutfitConfigs } from '../store/useOutfit'
import FabricHero from './FabricHero'
import MannequinFigure, { JOINTS, MANNEQUIN_H, MANNEQUIN_W } from './Mannequin'
import MannequinLayers, { type MannequinItem } from './MannequinLayers'

/**
 * ภาพตัวอย่างของแต่ละหน้าในเมนู (การ์ด 3:4)
 * 0 หน้าแรก = ผ้า 3 มิติ · 1 สตูดิโอ = หุ่นใส่ชุดที่กำลังออกแบบ · 2 ลองสวม = จอกล้อง + จุดจับท่าทาง
 * 3 คลังลาย = ผืนผ้าเรียงซ้อน · 4 แกลเลอรี = รูปโพลารอยด์
 */

// ชุดตัวอย่าง (ใช้เมื่อยังไม่ได้ออกแบบในสตูดิโอ)
const FALLBACK: OutfitConfigs = {
  top: { garmentId: 'top-temp', patternId: 'stripes', hue: 0, saturation: 100, scale: 1, finish: 'knit' },
  bottom: { garmentId: 'bottom-temp', patternId: 'solid', hue: 0, saturation: 100, scale: 1, tint: '#1f2e4a', finish: 'satin' },
}

export function useOutfitPreview(): MannequinItem[] {
  const configs = useOutfitStore((s) => s.configs)
  const customPatterns = useOutfitStore((s) => s.customPatterns)
  const [items, setItems] = useState<MannequinItem[]>([])

  useEffect(() => {
    let cancelled = false
    const source = Object.keys(configs).length ? configs : FALLBACK
    Promise.all(
      Object.entries(source).map(async ([slot, config]): Promise<MannequinItem | null> => {
        if (!config || config.enabled === false) return null
        const garment = garments.find((g) => g.id === config.garmentId)
        if (!garment) return null
        const custom = customPatterns[slot as keyof typeof customPatterns]
        const pattern = custom && custom.id === config.patternId ? custom : findPattern(config.patternId)
        const bitmap = await composeGarment(garment.maskSrc, pattern.src, garment.shadingSrc, {
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
  }, [configs, customPatterns])

  return items
}

const FOLDS =
  'linear-gradient(100deg, rgba(0,0,0,.6) 0%, rgba(255,255,255,.45) 14%, rgba(0,0,0,.5) 30%, rgba(255,255,255,.35) 48%, rgba(0,0,0,.55) 66%, rgba(255,255,255,.4) 82%, rgba(0,0,0,.65) 100%)'

function HomeScene() {
  return (
    <div className="absolute inset-0 bg-night">
      <FabricHero className="absolute inset-0 h-full w-full" offset={[0, 0.25, -5.4]} />
      <p className="absolute inset-x-0 top-[58%] text-center font-wordmark text-[56px] italic leading-none text-white mix-blend-difference">
        Long Look
      </p>
    </div>
  )
}

export function StudioScene({ items }: { items: MannequinItem[] }) {
  return (
    <div
      className="absolute inset-0"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #ffffff 0%, #f1ede7 45%, #d9d1c6 100%)' }}
    >
      <p className="absolute inset-x-0 top-[10%] text-center font-wordmark text-[88px] italic leading-none text-ink/[0.06]">
        Studio
      </p>
      <div className="absolute inset-x-0 bottom-[16%] top-[6%]">
        <MannequinLayers items={items} />
      </div>
      <span
        className="absolute bottom-[13%] left-1/2 h-4 w-1/2 -translate-x-1/2 rounded-full"
        style={{ background: 'radial-gradient(ellipse, rgba(0,0,0,0.3), transparent 70%)' }}
      />
    </div>
  )
}

// จุดข้อต่อที่ระบบ AR จับได้ เชื่อมเป็นโครงกระดูก
const BONES: [number, number][] = [
  [11, 12],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
]

export function TryOnScene({ items }: { items: MannequinItem[] }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#1a1816]">
      {/* ห้องมืด ๆ หลังคน */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,#3a352f_0%,#1a1816_70%)]" />
      <div className="absolute inset-x-0 bottom-[16%] top-[6%]">
        <div className="relative mx-auto aspect-[1/2] h-full max-w-full">
          {/* คนในกล้อง (โทนมืด) + ชุดที่ AR สวมให้ */}
          <div className="absolute inset-0 [filter:grayscale(1)_brightness(0.5)]">
            <MannequinFigure className="h-full w-full" />
          </div>
          <div className="absolute inset-0">
            <MannequinLayers items={items} hideFigure />
          </div>
          {/* โครงกระดูก + จุดข้อต่อ */}
          <svg viewBox={`0 0 ${MANNEQUIN_W} ${MANNEQUIN_H}`} className="absolute inset-0 z-40 h-full w-full" aria-hidden>
            {BONES.map(([a, b]) => (
              <line
                key={`${a}-${b}`}
                x1={JOINTS[a].x}
                y1={JOINTS[a].y}
                x2={JOINTS[b].x}
                y2={JOINTS[b].y}
                stroke="rgba(255,255,255,0.7)"
                strokeWidth="2.5"
              />
            ))}
            {Object.entries(JOINTS).map(([id, p]) => (
              <g key={id}>
                <circle cx={p.x} cy={p.y} r="13" fill="rgba(255,255,255,0.18)" className="animate-pulse" />
                <circle cx={p.x} cy={p.y} r="6.5" fill="#fff" />
              </g>
            ))}
          </svg>
        </div>
      </div>
      {/* เส้นสแกนวิ่งลง */}
      <style>{'@keyframes ll-scan{from{top:-12%}to{top:100%}}'}</style>
      <span
        className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-white/15 to-transparent motion-reduce:hidden"
        style={{ animation: 'll-scan 2.6s linear infinite' }}
      />
      {/* กรอบช่องมองภาพ */}
      {['left-4 top-4 border-l border-t', 'right-4 top-4 border-r border-t', 'left-4 bottom-4 border-b border-l', 'right-4 bottom-4 border-b border-r'].map(
        (c) => (
          <span key={c} className={`absolute h-6 w-6 border-white/80 ${c}`} />
        ),
      )}
      <span className="absolute right-6 top-6 flex items-center gap-1.5 text-[10px] tracking-[0.14em] text-white/80">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> LIVE
      </span>
      <span className="absolute bottom-[4.5%] left-1/2 h-11 w-11 -translate-x-1/2 rounded-full border-2 border-white/90 p-1">
        <span className="block h-full w-full rounded-full bg-white/90" />
      </span>
    </div>
  )
}

export function PatternsScene() {
  const shown = patterns.slice(0, 4)
  return (
    <div className="absolute inset-0 bg-stone [perspective:900px]">
      <p className="absolute inset-x-0 top-[8%] text-center font-wordmark text-[64px] italic leading-none text-ink/[0.08]">
        Patterns
      </p>
      {shown.map((p, i) => (
        <span
          key={p.id}
          className="menu-swatch absolute left-1/2 top-1/2 aspect-[3/4] w-[46%] overflow-hidden shadow-[0_24px_40px_-18px_rgba(0,0,0,0.55)]"
          style={{
            transform: `translate(-50%, -50%) translateX(${(i - 1.5) * 19}%) translateY(${Math.abs(i - 1.5) * 6}%) rotate(${(i - 1.5) * 9}deg) translateZ(${i * 14}px)`,
            zIndex: i,
          }}
        >
          <span className="absolute inset-0" style={{ backgroundImage: `url("${p.src}")`, backgroundSize: '56px 56px' }} />
          <span className="absolute inset-0 mix-blend-overlay" style={{ background: FOLDS }} />
          <span className="absolute inset-0 bg-gradient-to-b from-white/15 to-black/35" />
        </span>
      ))}
    </div>
  )
}

export function GalleryScene({ items }: { items: MannequinItem[] }) {
  const photos = readGalleryPhotos().slice(-3).reverse()
  const frames = [0, 1, 2]
  return (
    <div className="absolute inset-0 bg-ivory">
      <p className="absolute inset-x-0 top-[8%] text-center font-wordmark text-[64px] italic leading-none text-ink/[0.08]">
        Gallery
      </p>
      {frames.map((i) => {
        const photo = photos[i]
        const pattern = patterns[(i + 2) % patterns.length]
        return (
          <div
            key={i}
            className="menu-polaroid absolute left-1/2 top-1/2 w-[58%] bg-white p-2.5 pb-9 shadow-[0_22px_40px_-16px_rgba(0,0,0,0.45)]"
            style={{
              transform: `translate(-50%, -50%) translate(${(i - 1) * 18}%, ${(1 - i) * 4}%) rotate(${(i - 1) * 8 + (i === 2 ? 2 : 0)}deg)`,
              zIndex: i,
            }}
          >
            <div className="relative aspect-square overflow-hidden bg-night">
              {photo ? (
                <img src={photo.dataUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <>
                  <span
                    className="absolute inset-0 opacity-50"
                    style={{ backgroundImage: `url("${pattern.src}")`, backgroundSize: '48px 48px' }}
                  />
                  <div className="absolute inset-x-0 bottom-0 top-[6%]">
                    <MannequinLayers items={items} />
                  </div>
                </>
              )}
            </div>
            <span className="absolute bottom-2.5 left-3 font-wordmark text-sm italic text-ink/70">
              Look {String(i + 1).padStart(2, '0')}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function MenuPreview({ index }: { index: number }) {
  const items = useOutfitPreview()
  const sceneRef = useRef<HTMLDivElement>(null)

  // สลับฉาก: จางเข้า + ขยับขึ้นเล็กน้อย / ของในฉากไล่เข้ามาทีละชิ้น
  useEffect(() => {
    const el = sceneRef.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const tl = gsap.timeline()
    tl.fromTo(el, { opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'power3.out' })
    const pieces = el.querySelectorAll('.menu-swatch, .menu-polaroid')
    if (pieces.length) tl.from(pieces, { top: '62%', opacity: 0, duration: 0.6, stagger: 0.07, ease: 'power3.out' }, 0.05)
    return () => {
      tl.kill()
    }
  }, [index])

  return (
    <div ref={sceneRef} key={index} className="absolute inset-0">
      {index === 0 && <HomeScene />}
      {index === 1 && <StudioScene items={items} />}
      {index === 2 && <TryOnScene items={items} />}
      {index === 3 && <PatternsScene />}
      {index === 4 && <GalleryScene items={items} />}
    </div>
  )
}

export default MenuPreview
