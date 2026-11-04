import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { Piece, SceneApi } from '../three/mannequinScene'
import Mannequin3D from './Mannequin3D'
import MannequinLayers, { type MannequinItem } from './MannequinLayers'

export type CompareVariant = {
  name: string
  tint: string | null
  items: MannequinItem[]
  pieces: Piece[]
}

type Props = {
  items: MannequinItem[]
  pieces: Piece[]
  lookLabel: string
  canUndo: boolean
  onUndo: () => void
  onReset: () => void
  onRandomize: () => void
  compareOpen: boolean
  onToggleCompare: () => void
  compareVariants: CompareVariant[]
  onApplyCompare: (tint: string | null) => void
}

function FloorShadow({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`block h-6 w-[46%] rounded-full ${className}`}
      style={{ background: 'radial-gradient(ellipse, rgba(0,0,0,0.32) 0%, transparent 70%)' }}
    />
  )
}

/**
 * เวทีสตูดิโอ
 * - ปกติ: หุ่น 3 มิติจริง (WebGL) ลากหมุน ซูม เลือกมุมหน้า/เฉียง/ข้าง/หลัง
 * - เทียบ 3 สี หรือเครื่องไม่รองรับ WebGL2: ใช้หุ่น 2 มิติแบบเดิม
 * - สปอตไลต์บนฉากหลังขยับตามเมาส์
 */
function Stage({
  items,
  pieces,
  lookLabel,
  canUndo,
  onUndo,
  onReset,
  onRandomize,
  compareOpen,
  onToggleCompare,
  compareVariants,
  onApplyCompare,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const target = useRef({ x: 0, y: 0 })
  const current = useRef({ x: 0, y: 0 })
  const sceneApi = useRef<SceneApi | null>(null)
  const [no3d, setNo3d] = useState(false)
  const [view, setView] = useState('angle')
  const [spin, setSpin] = useState(true)
  const use3d = !no3d && !compareOpen

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const c = current.current
      const t = target.current
      c.x += (t.x - c.x) * 0.08
      c.y += (t.y - c.y) * 0.08
      const scene = sceneRef.current
      const root = rootRef.current
      if (scene) scene.style.transform = scene.dataset.flat ? 'none' : `rotateY(${c.x * 22}deg) rotateX(${c.y * -6}deg)`
      if (root) {
        root.style.setProperty('--spot-x', `${50 + c.x * 30}%`)
        root.style.setProperty('--spot-y', `${28 + c.y * 12}%`)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    target.current.x = ((e.clientX - r.left) / r.width - 0.5) * 2
    target.current.y = ((e.clientY - r.top) / r.height - 0.5) * 2
  }
  const onLeave = () => {
    target.current.x = 0
    target.current.y = 0
  }

  return (
    <div
      ref={rootRef}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="relative h-[72vh] w-full touch-pan-y overflow-hidden rounded-[4px] select-none lg:h-[calc(100vh-7rem)]"
      style={{
        background:
          'radial-gradient(ellipse 60% 55% at var(--spot-x, 50%) var(--spot-y, 28%), #ffffff 0%, #f1ede7 45%, #ddd6cc 100%)',
        perspective: '1400px',
      }}
    >
      {/* พื้นสตูดิโอ: เส้นขอบฟ้า + พื้นเอียงเข้าไปข้างใน */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[30%]"
        style={{
          background: 'linear-gradient(to bottom, rgba(230,224,215,0) 0%, rgba(222,215,205,0.9) 45%, #d9d1c6 100%)',
        }}
      />

      <span className="absolute left-5 top-5 z-30 text-[11px] uppercase tracking-[0.14em] text-muted">
        {lookLabel}
      </span>
      <span className="absolute right-5 top-5 z-30 hidden text-[11px] text-muted sm:block">
        {use3d ? 'ลากเพื่อหมุน · เลื่อนล้อเมาส์เพื่อซูม' : 'ชี้หรือลากเพื่อหมุนดูรอบหุ่น'}
      </span>

      <div ref={sceneRef} data-flat={use3d ? '1' : undefined} className="absolute inset-0 [transform-style:preserve-3d]">
        {/* ตัวหนังสือยักษ์ด้านหลัง = ฉากหลังที่ลึกที่สุด */}
        <p
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-[14%] text-center font-wordmark text-[20vw] italic leading-none text-ink/[0.05] lg:text-[11vw]"
          style={{ transform: 'translateZ(-220px) scale(1.15)' }}
        >
          Studio
        </p>

        {compareOpen ? (
          <div className="absolute inset-x-3 bottom-20 top-12 grid grid-cols-3 gap-2 sm:inset-x-5 sm:gap-3">
            {compareVariants.map((variant, i) => (
              <div
                key={variant.name}
                className="group relative flex min-w-0 flex-col overflow-hidden rounded-[4px] bg-white/35 ring-1 ring-black/5 transition-colors hover:bg-white/60"
              >
                <span className="absolute left-3 top-3 z-10 font-wordmark text-xl italic text-ink/30">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="relative min-h-0 flex-1">
                  <span
                    aria-hidden
                    className="absolute bottom-[7%] left-1/2 h-5 w-[62%] -translate-x-1/2 rounded-full"
                    style={{ background: 'radial-gradient(ellipse, rgba(0,0,0,0.28) 0%, transparent 70%)' }}
                  />
                  {no3d ? (
                    <div className="absolute inset-0 py-4">
                      <MannequinLayers items={variant.items} />
                    </div>
                  ) : (
                    <Mannequin3D pieces={variant.pieces} compact className="absolute inset-0 h-full w-full" />
                  )}
                </div>
                <div className="flex flex-col items-center gap-2 border-t border-black/5 px-2 py-3">
                  <span className="flex items-center gap-2 text-xs text-ink">
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10"
                      style={{ background: variant.tint ?? 'conic-gradient(#c78f9a,#8fa7c7,#c7b98f,#9ac78f,#c78f9a)' }}
                    />
                    <span className="truncate">{variant.name}</span>
                  </span>
                  {i === 0 ? (
                    <span className="h-8 text-[11px] leading-8 text-muted">สีที่ใช้อยู่</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onApplyCompare(variant.tint)}
                      className="h-8 rounded-full bg-ink px-4 text-[11px] text-white transition-opacity hover:opacity-85"
                    >
                      ใช้สีนี้
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : use3d ? (
          <>
            {/* เงาบนพื้นใต้หุ่น 3 มิติ */}
            <span
              aria-hidden
              className="absolute bottom-[9%] left-1/2 h-8 w-[38%] -translate-x-1/2 rounded-full"
              style={{ background: 'radial-gradient(ellipse, rgba(0,0,0,0.3) 0%, transparent 70%)' }}
            />
            <Mannequin3D
              pieces={pieces}
              className="absolute inset-0 h-full w-full"
              onReady={(api) => {
                sceneApi.current = api
              }}
              onUnsupported={() => setNo3d(true)}
            />
          </>
        ) : (
          <div
            className="absolute inset-0 flex flex-col items-center justify-end pb-[4.5rem]"
            style={{ transform: 'translateZ(40px)', transformStyle: 'preserve-3d' }}
          >
            <div className="h-[84%] w-full [transform-style:preserve-3d]">
              <MannequinLayers items={items} />
            </div>
            <FloorShadow className="-mt-4" />
          </div>
        )}
      </div>

      {use3d && (
        <div className="absolute right-4 top-12 z-30 flex flex-col items-end gap-2 sm:top-14">
          <div className="flex gap-1 rounded-full border border-white/60 bg-white/65 p-1 backdrop-blur-md">
            {[
              { id: 'front', label: 'หน้า', yaw: 0 },
              { id: 'angle', label: 'เฉียง', yaw: 0.6 },
              { id: 'side', label: 'ข้าง', yaw: Math.PI / 2 },
              { id: 'back', label: 'หลัง', yaw: Math.PI },
            ].map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setView(v.id)
                  setSpin(false)
                  sceneApi.current?.setAutoRotate(false)
                  sceneApi.current?.setView(v.yaw)
                }}
                className={`rounded-full px-3 py-1.5 text-[11px] transition-colors ${
                  view === v.id && !spin ? 'bg-ink text-white' : 'text-ink hover:bg-black/5'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 rounded-full border border-white/60 bg-white/65 p-1 backdrop-blur-md">
            <button
              type="button"
              aria-pressed={spin}
              onClick={() => {
                const next = !spin
                setSpin(next)
                sceneApi.current?.setAutoRotate(next)
              }}
              className={`rounded-full px-3 py-1.5 text-[11px] transition-colors ${spin ? 'bg-ink text-white' : 'text-ink hover:bg-black/5'}`}
            >
              หมุนเอง
            </button>
            <button type="button" aria-label="ซูมเข้า" onClick={() => sceneApi.current?.zoomBy(0.82)} className="h-7 w-7 rounded-full text-sm text-ink hover:bg-black/5">
              +
            </button>
            <button type="button" aria-label="ซูมออก" onClick={() => sceneApi.current?.zoomBy(1.22)} className="h-7 w-7 rounded-full text-sm text-ink hover:bg-black/5">
              −
            </button>
          </div>
        </div>
      )}

      {/* แถบเครื่องมือลอย (กระจกฝ้า) */}
      <div className="absolute inset-x-4 bottom-4 z-30 flex justify-center">
        <div className="flex gap-1 rounded-full border border-white/60 bg-white/65 p-1.5 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.3)] backdrop-blur-md">
          {[
            { label: 'ย้อนกลับ', onClick: onUndo, disabled: !canUndo },
            { label: 'สุ่มลุค', onClick: onRandomize },
            { label: compareOpen ? 'ปิดเทียบสี' : 'เทียบ 3 สี', onClick: onToggleCompare, active: compareOpen },
            { label: 'เริ่มใหม่', onClick: onReset },
          ].map((b) => (
            <button
              key={b.label}
              type="button"
              onClick={b.onClick}
              disabled={b.disabled}
              className={`rounded-full px-3.5 py-2 text-xs transition-colors disabled:opacity-35 ${
                b.active ? 'bg-ink text-white' : 'text-ink hover:bg-black/5'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Stage
