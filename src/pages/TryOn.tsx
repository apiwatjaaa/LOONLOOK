import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import BodyOutline from '../components/BodyOutline'
import { fitGarment } from '../ar/fitGarment'
import { detectPose, getPoseLandmarker } from '../ar/poseDetector'
import { renderGarment } from '../ar/renderGarment'
import { createSmoother, type Fit } from '../ar/smoothing'
import type { Garment, GarmentSlot } from '../data/garments'
import { garments, SLOT_DRAW_ORDER } from '../data/garments'
import { LOOKS } from '../data/looks'
import { findPattern } from '../data/patterns'
import { composeGarmentToImage } from '../design/composeGarment'
import { addGalleryPhoto } from '../lib/gallery'
import { drawLegs, drawSkirt, drawTorso, type Pt } from '../lib/warpGarment'
import { readSavedOutfits, type SavedOutfit } from '../lib/savedOutfits'
import type { CustomPatterns, OutfitConfigs } from '../store/useOutfit'
import { useOutfitStore } from '../store/useOutfit'

type Phase = 'intro' | 'loading' | 'ready' | 'error'
type Facing = 'user' | 'environment'

type EquippedItem = {
  garment: Garment
  image: HTMLImageElement
  smooth: ReturnType<typeof createSmoother>
}

// ตัวเลือกชุดในแถบล่าง: ชุดจากสตูดิโอ / ลุคสำเร็จรูป / ชุดที่บันทึกไว้
type LookOption = { id: string; label: string; outfit: OutfitConfigs; custom?: CustomPatterns }

// เข้าหน้านี้ตรง ๆ (ยังไม่ได้ออกแบบ) ใช้ลุค "คลาสสิก" เป็นชุดเริ่มต้น
const DEFAULT_LOOK = LOOKS.find((l) => l.id === 'classic') ?? LOOKS[0]

// มุมของเส้นไหล่/สะโพกจาก MediaPipe อาจกลับหัว (ซ้าย-ขวาสลับกัน → มุม ≈ 180°)
// บีบมุมให้อยู่ในช่วง -90°..90° ให้เสื้อตั้งตรงเสมอ (สูตรเดียวกับ placeGarment ในสตูดิโอ)
function uprightFit(fit: Fit): Fit {
  let angle = fit.angle
  if (angle > Math.PI / 2) angle -= Math.PI
  if (angle < -Math.PI / 2) angle += Math.PI
  return { ...fit, angle }
}

// ปรับขนาดเฉพาะตอนลองสวมจริง (สตูดิโอใช้ค่าเดิม)
// จุดไหล่/สะโพกที่ MediaPipe ให้มาคือ "ข้อต่อ" ซึ่งแคบกว่าตัวจริง ชุดเลยดูเล็ก
// → ขยายความกว้าง + ยืดขึ้นให้คลุมไหล่ และให้เสื้อทับขอบกางเกงเล็กน้อย
const AR_TUNE = {
  top: { w: 1.28, h: 1.14, up: 0.07 }, // เสื้อ + ของที่ยึดไหล่→สะโพก (เข็มขัด/ผ้าพันคอ)
  bottom: { w: 1.45, h: 1.06, up: 0.05 }, // กระโปรง/กางเกง
  diagonal: { w: 1.15, h: 1.05, up: 0 }, // สายคาดเฉียง
}

function tuneForBody(fit: Fit, garment: Garment): Fit {
  const t =
    garment.anchors.from.length < 2
      ? AR_TUNE.diagonal
      : garment.anchors.from[0] === 23
        ? AR_TUNE.bottom
        : AR_TUNE.top
  const shift = t.up * fit.height
  // เลื่อน "ขึ้น" ตามแนวเอียงของตัว (หมุนตามมุมไหล่/สะโพก)
  return {
    x: fit.x + shift * Math.sin(fit.angle),
    y: fit.y - shift * Math.cos(fit.angle),
    width: fit.width * t.w,
    height: fit.height * t.h,
    angle: fit.angle,
  }
}

// สีตัวแทนของชุด (ใช้ทำปุ่มในแถบเลือกชุด)
function swatchOf(outfit: OutfitConfigs) {
  const config = outfit.top ?? outfit.full ?? outfit.bottom
  if (!config) return { src: '', tint: '#444' }
  return { src: findPattern(config.patternId).src, tint: config.tint ?? null }
}

function TryOn() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const equippedRef = useRef<EquippedItem[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef(0)
  const cancelledRef = useRef(false)
  const facingRef = useRef<Facing>('user')
  const hintRef = useRef('')
  const pointsRef = useRef<Record<number, Pt>>({})
  const layerRef = useRef<HTMLCanvasElement | null>(null)

  const [phase, setPhase] = useState<Phase>('intro')
  const [errorMsg, setErrorMsg] = useState('')
  const [hint, setHint] = useState('')
  const [facing, setFacing] = useState<Facing>('user')
  const [timer, setTimer] = useState<0 | 3 | 10>(0)
  const [countdown, setCountdown] = useState(0)
  const [flash, setFlash] = useState(false)
  const [shot, setShot] = useState<string | null>(null)
  const [savedNote, setSavedNote] = useState('')
  const [savedLooks, setSavedLooks] = useState<SavedOutfit[]>([])
  const [activeId, setActiveId] = useState('current')

  const storeConfigs = useOutfitStore((s) => s.configs)
  const storeCustomPatterns = useOutfitStore((s) => s.customPatterns)

  useEffect(() => {
    setSavedLooks(readSavedOutfits())
  }, [])

  const hasStoreOutfit = Object.keys(storeConfigs).length > 0
  const options: LookOption[] = [
    hasStoreOutfit
      ? { id: 'current', label: 'ชุดของฉัน', outfit: storeConfigs, custom: storeCustomPatterns }
      : { id: 'current', label: DEFAULT_LOOK.name, outfit: DEFAULT_LOOK.outfit },
    ...LOOKS.filter((l) => hasStoreOutfit || l.id !== DEFAULT_LOOK.id).map((l) => ({
      id: `look-${l.id}`,
      label: l.name,
      outfit: l.outfit as OutfitConfigs,
    })),
    ...savedLooks.map((s, i) => ({ id: `saved-${s.id}`, label: `บันทึก ${i + 1}`, outfit: s.outfit })),
  ]
  const active = options.find((o) => o.id === activeId) ?? options[0]
  const activeKey = JSON.stringify([active.id, active.outfit])

  // คอมโพสชุดที่เลือกให้เป็นรูป สำหรับวาดทับกล้อง (ทำใหม่ทุกครั้งที่สลับชุด)
  useEffect(() => {
    let cancelled = false
    async function build() {
      const next: EquippedItem[] = []
      for (const slot of Object.keys(active.outfit) as GarmentSlot[]) {
        const config = active.outfit[slot]
        if (!config || config.enabled === false) continue
        const garment = garments.find((g) => g.id === config.garmentId)
        if (!garment) continue
        const custom = active.custom?.[slot]
        const pattern = custom && custom.id === config.patternId ? custom : findPattern(config.patternId)
        try {
          const image = await composeGarmentToImage(garment.maskSrc, pattern.src, garment.shadingSrc, {
            hue: config.hue,
            saturation: config.saturation,
            scale: config.scale,
            tint: config.tint ?? null,
            rotation: config.rotation ?? 0,
            finish: config.finish ?? 'matte',
          })
          next.push({ garment, image, smooth: createSmoother(0.4) })
        } catch (err) {
          console.error(err)
        }
      }
      next.sort((a, b) => SLOT_DRAW_ORDER[a.garment.slot] - SLOT_DRAW_ORDER[b.garment.slot])
      if (!cancelled) equippedRef.current = next
    }
    build()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey])

  function stopStream() {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  useEffect(
    () => () => {
      cancelledRef.current = true
      stopStream()
    },
    [],
  )

  function updateHint(next: string) {
    if (hintRef.current === next) return
    hintRef.current = next
    setHint(next)
  }

  async function startCamera(nextFacing: Facing = facingRef.current) {
    stopStream()
    setPhase('loading')
    cancelledRef.current = false
    facingRef.current = nextFacing
    setFacing(nextFacing)

    try {
      const [landmarker, mediaStream] = await Promise.all([
        getPoseLandmarker(),
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextFacing, width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        }),
      ])
      if (cancelledRef.current) {
        mediaStream.getTracks().forEach((track: MediaStreamTrack) => track.stop())
        return
      }
      streamRef.current = mediaStream

      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) return
      video.srcObject = mediaStream
      await video.play()
      setPhase('ready')

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      let lastTs = 0

      const loop = () => {
        if (cancelledRef.current) return
        if (video.videoWidth && video.videoHeight) {
          if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth
          if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight

          // timestamp ต้องเพิ่มขึ้นเสมอ ไม่งั้น MediaPipe จะ error
          const ts = Math.max(performance.now(), lastTs + 1)
          lastTs = ts
          const result = detectPose(landmarker, video, ts)
          // กล้องหน้า = กลับด้านแบบกระจก / กล้องหลัง = ภาพตรง
          const mirror = facingRef.current === 'user'

          ctx.save()
          if (mirror) {
            ctx.scale(-1, 1)
            ctx.translate(-canvas.width, 0)
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

          const landmarks = result.landmarks[0]
          if (!landmarks) {
            updateHint('ยืนให้กล้องเห็นตัวคุณ')
          } else {
            // ทำให้จุดข้อต่อนิ่งขึ้น (EMA) ก่อนเอาไปยืดชุด
            const P = (i: number): Pt => {
              const raw = { x: landmarks[i].x * canvas.width, y: landmarks[i].y * canvas.height }
              const prev = pointsRef.current[i]
              const next = prev ? { x: prev.x + 0.45 * (raw.x - prev.x), y: prev.y + 0.45 * (raw.y - prev.y) } : raw
              pointsRef.current[i] = next
              return next
            }
            const seen = (i: number) => (landmarks[i]?.visibility ?? 1) >= 0.5
            const pts: Record<number, Pt> = {}
            for (const i of [11, 12, 23, 24, 25, 26, 27, 28]) pts[i] = P(i)
            // เข่ามองไม่เห็น → ประมาณกึ่งกลางสะโพก-ข้อเท้า
            const kneeR = seen(26) ? pts[26] : { x: (pts[24].x + pts[28].x) / 2, y: (pts[24].y + pts[28].y) / 2 }
            const kneeL = seen(25) ? pts[25] : { x: (pts[23].x + pts[27].x) / 2, y: (pts[23].y + pts[27].y) / 2 }

            // วาดชุดทุกชิ้นลงชั้นแยก แล้วค่อยแปะลงภาพพร้อมเงา (เงาจะได้ไม่แตกเป็นช่อง ๆ)
            const layer = layerRef.current ?? (layerRef.current = document.createElement('canvas'))
            if (layer.width !== canvas.width) layer.width = canvas.width
            if (layer.height !== canvas.height) layer.height = canvas.height
            const lctx = layer.getContext('2d')
            if (lctx) lctx.clearRect(0, 0, layer.width, layer.height)

            let drawn = 0
            let shoulderW = 0
            for (const item of equippedRef.current) {
              const g = item.garment
              // ใช้ fitGarment เช็กว่ากล้องเห็นจุดยึดของชิ้นนี้ครบไหม
              const fit = fitGarment(landmarks, g.anchors, g.widthScale, g.offsetY, canvas.width, canvas.height)
              if (!fit || !lctx) continue
              drawn++
              shoulderW = Math.max(shoulderW, Math.hypot(pts[11].x - pts[12].x, pts[11].y - pts[12].y))
              if (g.anchors.from.length < 2) {
                // สายคาดเฉียง: วางแบบเดิม (หมุนตามแนวเฉียง)
                renderGarment(lctx, item.image, item.smooth(tuneForBody(uprightFit(fit), g)))
              } else if (g.anchors.from[0] === 23) {
                const isPants = g.id === 'bottom-wide' || g.id === 'bottom-shorts'
                const draw = isPants ? drawLegs : drawSkirt
                draw(lctx, item.image, pts[24], pts[23], kneeR, kneeL, pts[28], pts[27], g.widthScale * AR_TUNE.bottom.w, 0.07)
              } else {
                drawTorso(lctx, item.image, pts[12], pts[11], pts[24], pts[23], g.widthScale * AR_TUNE.top.w, 0.14)
              }
            }
            if (drawn) {
              // เงานุ่ม ๆ ใต้ชุด ให้ดูซ้อนอยู่บนตัว ไม่แบนเหมือนกระดาษ
              ctx.shadowColor = 'rgba(0,0,0,0.35)'
              ctx.shadowBlur = shoulderW * 0.12
              ctx.shadowOffsetY = shoulderW * 0.04
              ctx.drawImage(layer, 0, 0)
              ctx.shadowColor = 'transparent'
            }
            updateHint(drawn < equippedRef.current.length ? 'ถอยห่างอีกนิด ให้กล้องเห็นถึงเข่า' : '')
          }
          ctx.restore()
        }
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
    } catch (err) {
      if (cancelledRef.current) return
      console.error(err)
      setPhase('error')
      setErrorMsg(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'เว็บยังไม่ได้รับอนุญาตให้ใช้กล้อง กดอนุญาตในหน้าต่างที่เด้งขึ้น หรือเปิดสิทธิ์กล้องในการตั้งค่าเบราว์เซอร์'
          : 'เปิดกล้องไม่ได้ ลองเปิดเว็บนี้ใน Safari หรือ Chrome แทนแอปอื่น (เช่น Instagram / LINE)',
      )
    }
  }

  function takePhoto() {
    const canvas = canvasRef.current
    if (!canvas || phase !== 'ready') return

    // รูปจากกล้อง + ชุด + ลายน้ำชื่อโครงงาน
    const snap = document.createElement('canvas')
    // ตัดภาพให้ตรงกับที่เห็นบนจอ (จอแสดงแบบ object-cover)
    const view = canvas.getBoundingClientRect()
    const viewRatio = view.width / view.height
    let sw = canvas.width
    let sh = canvas.height
    if (sw / sh > viewRatio) sw = Math.round(sh * viewRatio)
    else sh = Math.round(sw / viewRatio)
    snap.width = sw
    snap.height = sh
    const ctx = snap.getContext('2d')
    if (!ctx) return
    ctx.drawImage(canvas, (canvas.width - sw) / 2, (canvas.height - sh) / 2, sw, sh, 0, 0, sw, sh)
    const size = Math.max(18, Math.round(sw * 0.05))
    ctx.font = `italic ${size}px "Bodoni Moda", serif`
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    const margin = Math.round(sw * 0.045)
    ctx.fillText('Long Look', sw - margin, sh - margin)

    // ใช้ JPEG ให้ไฟล์เล็ก (ที่เก็บในเบราว์เซอร์มีจำกัด)
    const dataUrl = snap.toDataURL('image/jpeg', 0.88)
    try {
      addGalleryPhoto(dataUrl)
      setSavedNote('เก็บไว้ในแกลเลอรีแล้ว')
    } catch {
      setSavedNote('แกลเลอรีเต็ม — กดบันทึกรูปลงเครื่องแทน')
    }
    setShot(dataUrl)

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setFlash(true)
    window.setTimeout(() => setFlash(false), reduced ? 0 : 140)
  }

  function handleShutter() {
    if (countdown > 0) return
    if (timer === 0) return takePhoto()
    // ตั้งเวลาถ่าย: วางมือถือแล้วถอยไปยืนเต็มตัวได้
    let left: number = timer
    setCountdown(left)
    const id = window.setInterval(() => {
      left -= 1
      setCountdown(left)
      if (left <= 0) {
        window.clearInterval(id)
        takePhoto()
      }
    }, 1000)
  }

  async function sharePhoto() {
    if (!shot) return
    const blob = await (await fetch(shot)).blob()
    const file = new File([blob], `longlook-${Date.now()}.jpg`, { type: 'image/jpeg' })
    // มือถือ: เปิดเมนูแชร์ (บันทึกลงอัลบั้ม / ส่ง LINE / IG) · คอม: ดาวน์โหลดไฟล์
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Long Look' })
        return
      } catch {
        /* ผู้ใช้กดยกเลิก */
        return
      }
    }
    const link = document.createElement('a')
    link.href = shot
    link.download = file.name
    link.click()
  }

  const iconBtn =
    'flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md transition-colors hover:bg-black/55'

  return (
    <div className="relative flex flex-1 flex-col">
      {phase === 'intro' && (
        <div className="relative flex flex-1 flex-col items-center justify-center gap-7 overflow-hidden bg-night px-6 py-16 text-center">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-[12%] select-none text-center font-wordmark text-[26vw] italic leading-none text-white/[0.04] sm:text-[180px]"
          >
            Try-On
          </span>
          <BodyOutline className="relative h-44 w-auto text-white/25" />
          <h1 className="relative font-heading text-3xl text-white">ลองสวมผ่านกล้อง</h1>

          <ol className="relative flex w-full max-w-xs flex-col gap-2.5 text-left text-sm text-white/75">
            {[
              'วางมือถือพิงไว้ หรือให้เพื่อนถือ',
              'ถอยห่าง 1.5–2 เมตร ให้เห็นตั้งแต่หัวถึงเข่า',
              'อยู่ในที่สว่าง แล้วกดถ่าย (ตั้งเวลาได้)',
            ].map((t, i) => (
              <li key={t} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5">
                <span className="font-wordmark text-lg italic text-white/50">0{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>

          <button
            type="button"
            onClick={() => startCamera('user')}
            className="btn btn-primary relative bg-white px-8 text-ink hover:opacity-85"
          >
            เปิดกล้อง
          </button>
          <p className="relative max-w-xs text-xs text-white/60">
            ภาพจากกล้องประมวลผลในเครื่องคุณเท่านั้น ไม่ถูกส่งออกไปไหน
          </p>
        </div>
      )}

      {phase !== 'intro' && (
        // กล้องเต็มจอ (สูงเท่าจอลบแถบเมนูบน)
        <div className="relative h-[calc(100svh-3.5rem)] w-full overflow-hidden bg-night">
          <video ref={videoRef} className="hidden" playsInline muted />
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover" />

          {flash && <div className="pointer-events-none absolute inset-0 z-40 bg-white/80" />}

          {phase === 'loading' && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-night text-white">
              <span aria-hidden className="h-9 w-9 animate-spin rounded-full border-[3px] border-white/25 border-t-white" />
              <p className="text-sm">กำลังเปิดกล้องและโหลดโมเดล...</p>
            </div>
          )}

          {phase === 'error' && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-night px-8 text-center text-white">
              <p className="max-w-xs text-sm leading-relaxed">{errorMsg}</p>
              <button type="button" onClick={() => startCamera()} className="btn bg-white px-6 text-ink">
                ลองอีกครั้ง
              </button>
            </div>
          )}

          {phase === 'ready' && (
            <>
              {/* แถบบน: ตั้งเวลา / สลับกล้อง */}
              <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent p-4">
                <button
                  type="button"
                  onClick={() => setTimer((t) => (t === 0 ? 3 : t === 3 ? 10 : 0))}
                  className={`${iconBtn} w-auto gap-1.5 px-3.5 text-xs`}
                  aria-label="ตั้งเวลาถ่าย"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                    <circle cx="12" cy="13" r="8" />
                    <path d="M12 9v4l2.5 2M9 2h6" strokeLinecap="round" />
                  </svg>
                  {timer === 0 ? 'ปิด' : `${timer} วิ`}
                </button>
                {hint ? (
                  <span className="rounded-full bg-black/55 px-3.5 py-1.5 text-xs text-white backdrop-blur-md">{hint}</span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[10px] tracking-[0.14em] text-white/80">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> LIVE
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => startCamera(facing === 'user' ? 'environment' : 'user')}
                  className={iconBtn}
                  aria-label="สลับกล้องหน้า/หลัง"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                    <path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" />
                    <path d="M9.5 13.5a2.5 2.5 0 0 0 4.6 1.3M14.5 12.5a2.5 2.5 0 0 0-4.6-1.3" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {countdown > 0 && (
                <span className="pointer-events-none absolute inset-0 z-20 grid place-items-center font-wordmark text-[38vw] italic leading-none text-white/90 drop-shadow-[0_6px_30px_rgba(0,0,0,0.5)] sm:text-[220px]">
                  {countdown}
                </span>
              )}

              {/* แถบล่าง: เลือกชุด + ปุ่มถ่าย */}
              <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-4 bg-gradient-to-t from-black/70 via-black/35 to-transparent pb-6 pt-10">
                <div className="flex gap-2.5 overflow-x-auto px-4 [scrollbar-width:none]">
                  {options.map((o) => {
                    const sw = swatchOf(o.outfit)
                    const on = o.id === active.id
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setActiveId(o.id)}
                        aria-pressed={on}
                        className={`flex shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3.5 text-xs backdrop-blur-md transition-colors ${
                          on ? 'border-white bg-white text-ink' : 'border-white/25 bg-black/35 text-white'
                        }`}
                      >
                        <span
                          className="relative h-7 w-7 overflow-hidden rounded-full"
                          style={{ background: sw.tint ?? '#ddd' }}
                        >
                          {sw.src && (
                            <span
                              className="absolute inset-0 opacity-70 mix-blend-multiply"
                              style={{ backgroundImage: `url("${sw.src}")`, backgroundSize: '18px 18px' }}
                            />
                          )}
                        </span>
                        {o.label}
                      </button>
                    )
                  })}
                </div>

                <div className="grid grid-cols-3 items-center px-6">
                  <Link to="/studio" className={`${iconBtn} justify-self-start`} aria-label="กลับไปแก้ชุดในสตูดิโอ">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                      <path d="M8 4 4 7l2 3 2-1v11h8V9l2 1 2-3-4-3c-.5 1.5-2 2.5-4 2.5S8.5 5.5 8 4z" strokeLinejoin="round" />
                    </svg>
                  </Link>
                  <button
                    type="button"
                    onClick={handleShutter}
                    aria-label="ถ่ายรูป"
                    className="grid h-20 w-20 place-items-center justify-self-center rounded-full border-[3px] border-white transition-transform active:scale-90"
                  >
                    <span className="h-[62px] w-[62px] rounded-full bg-white" />
                  </button>
                  <Link to="/gallery" className={`${iconBtn} justify-self-end`} aria-label="ดูแกลเลอรี">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="M4 17.5 9 13l3 2.5 3.5-4L21 15" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                </div>
              </div>
            </>
          )}

          {/* ดูรูปที่เพิ่งถ่าย */}
          {shot && (
            <div className="absolute inset-0 z-50 flex flex-col bg-night/95 backdrop-blur-sm">
              <div className="flex min-h-0 flex-1 items-center justify-center p-5">
                <img
                  src={shot}
                  alt="รูปที่เพิ่งถ่าย"
                  className="max-h-full max-w-full rounded-lg object-contain shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)]"
                />
              </div>
              <p className="text-center text-xs text-white/60">{savedNote}</p>
              <div className="flex gap-3 p-5">
                <button type="button" onClick={() => setShot(null)} className="btn h-12 flex-1 border border-white/30 text-white">
                  ถ่ายใหม่
                </button>
                <button type="button" onClick={sharePhoto} className="btn h-12 flex-1 bg-white text-ink">
                  บันทึก / แชร์
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default TryOn
