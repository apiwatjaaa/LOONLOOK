import { useEffect, useRef, useState } from 'react'
import BodyOutline from '../components/BodyOutline'
import { fitGarment } from '../ar/fitGarment'
import { detectPose, getPoseLandmarker } from '../ar/poseDetector'
import { renderGarment } from '../ar/renderGarment'
import { createSmoother } from '../ar/smoothing'
import type { Garment, GarmentSlot } from '../data/garments'
import { garments, SLOT_DRAW_ORDER } from '../data/garments'
import { findPattern, patterns } from '../data/patterns'
import { composeGarmentToImage } from '../design/composeGarment'
import { addGalleryPhoto } from '../lib/gallery'
import { readSavedOutfits, type SavedOutfit } from '../lib/savedOutfits'
import type { CustomPatterns, OutfitConfigs } from '../store/useOutfit'
import { useOutfitStore } from '../store/useOutfit'

type Phase = 'intro' | 'loading' | 'ready' | 'error'

type EquippedItem = {
  garment: Garment
  image: HTMLImageElement
  smooth: ReturnType<typeof createSmoother>
}

// ชุดตัวอย่างชั่วคราว ใช้เมื่อเข้าหน้านี้ตรงโดยไม่ได้ผ่านสตูดิโอมาก่อน
const DEFAULT_IDS = ['bottom-temp', 'top-temp', 'sash-temp']

function buildDefaultConfigs(): OutfitConfigs {
  const configs: OutfitConfigs = {}
  for (const id of DEFAULT_IDS) {
    const garment = garments.find((g) => g.id === id)
    if (!garment) continue
    configs[garment.slot] = {
      garmentId: garment.id,
      patternId: patterns[0].id,
      hue: 0,
      saturation: 100,
      scale: 1,
    }
  }
  return configs
}

const DEFAULT_CONFIGS = buildDefaultConfigs()
const SLOT_PRIORITY: GarmentSlot[] = ['full', 'top', 'bottom', 'accessory']

function representativePattern(configs: OutfitConfigs) {
  for (const slot of SLOT_PRIORITY) {
    const config = configs[slot]
    if (!config) continue
    const pattern = patterns.find((p) => p.id === config.patternId) ?? patterns[0]
    return { pattern, hue: config.hue, saturation: config.saturation }
  }
  return null
}

function TryOn() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const equippedRef = useRef<EquippedItem[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef(0)
  const cancelledRef = useRef(false)

  const [phase, setPhase] = useState<Phase>('intro')
  const [errorMsg, setErrorMsg] = useState('')
  const [captureMessage, setCaptureMessage] = useState('')
  const [flash, setFlash] = useState(false)
  const [savedLooks, setSavedLooks] = useState<SavedOutfit[]>([])
  const [activeLookId, setActiveLookId] = useState<string | null>(null)

  const storeConfigs = useOutfitStore((s) => s.configs)
  const storeCustomPatterns = useOutfitStore((s) => s.customPatterns)

  useEffect(() => {
    setSavedLooks(readSavedOutfits())
  }, [])

  const activeLook = activeLookId ? savedLooks.find((look) => look.id === activeLookId) ?? null : null
  const hasStoreOutfit = Object.keys(storeConfigs).length > 0
  const activeConfigs: OutfitConfigs = activeLook?.outfit ?? (hasStoreOutfit ? storeConfigs : DEFAULT_CONFIGS)
  const activeCustomPatterns: CustomPatterns = activeLook ? {} : storeCustomPatterns

  // คอมโพสชุดที่กำลังใช้อยู่ให้เป็นรูปสำหรับวาดบน canvas AR ใหม่ทุกครั้งที่สลับลุค
  useEffect(() => {
    let cancelled = false

    async function build() {
      const next: EquippedItem[] = []
      for (const slot of Object.keys(activeConfigs) as GarmentSlot[]) {
        const config = activeConfigs[slot]
        if (!config || config.enabled === false) continue
        const garment = garments.find((g) => g.id === config.garmentId)
        if (!garment) continue
        const customPattern = activeCustomPatterns[slot]
        const pattern =
          customPattern && customPattern.id === config.patternId
            ? customPattern
            : findPattern(config.patternId)
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
  }, [activeLookId, storeConfigs, storeCustomPatterns, activeConfigs, activeCustomPatterns])

  useEffect(
    () => () => {
      cancelledRef.current = true
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((track) => track.stop())
    },
    [],
  )

  async function startCamera() {
    setPhase('loading')
    cancelledRef.current = false

    try {
      const [landmarker, mediaStream] = await Promise.all([
        getPoseLandmarker(),
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }),
      ])
      if (cancelledRef.current) {
        mediaStream.getTracks().forEach((track) => track.stop())
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

      const loop = () => {
        if (cancelledRef.current || !video || !canvas) return
        if (video.videoWidth && video.videoHeight) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight

          const result = detectPose(landmarker, video, performance.now())

          // กลับด้านภาพแบบกระจก (ผู้ใช้เห็นตัวเองเหมือนมองกระจก)
          ctx.save()
          ctx.scale(-1, 1)
          ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height)
          ctx.restore()

          const landmarks = result.landmarks[0]
          if (landmarks) {
            ctx.save()
            ctx.scale(-1, 1)
            ctx.translate(-canvas.width, 0)

            for (const item of equippedRef.current) {
              const fit = fitGarment(
                landmarks,
                item.garment.anchors,
                item.garment.widthScale,
                item.garment.offsetY,
                canvas.width,
                canvas.height,
              )
              if (fit) {
                renderGarment(ctx, item.image, item.smooth(fit))
              }
            }

            ctx.restore()
          }
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
          ? 'กรุณาอนุญาตให้เว็บไซต์เข้าถึงกล้อง'
          : 'ไม่สามารถเปิดกล้องหรือโหลดโมเดลตรวจจับร่างกายได้',
      )
    }
  }

  function handleCapture() {
    const canvas = canvasRef.current
    if (!canvas || phase !== 'ready') return

    // รวม canvas ปัจจุบัน + ลายน้ำชื่อโครงงาน (ข้อ 6.8) แล้วเก็บ/ดาวน์โหลด
    const snap = document.createElement('canvas')
    snap.width = canvas.width
    snap.height = canvas.height
    const ctx = snap.getContext('2d')
    if (!ctx) return
    ctx.drawImage(canvas, 0, 0)

    ctx.font = `300 ${Math.max(16, Math.round(canvas.width * 0.028))}px "IBM Plex Sans Thai", sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    const margin = Math.round(canvas.width * 0.03)
    ctx.fillText('Long Look', canvas.width - margin, canvas.height - margin)

    const dataUrl = snap.toDataURL('image/png')
    addGalleryPhoto(dataUrl)

    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `longlook-${Date.now()}.png`
    link.click()

    // จอกระพริบขาวเบา ๆ ยืนยันว่าถ่ายแล้ว (DESIGN.md ข้อ 9)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setFlash(true)
    window.setTimeout(() => setFlash(false), reduced ? 0 : 120)

    setCaptureMessage('บันทึกรูปแล้ว ดูได้ในแกลเลอรี')
    window.setTimeout(() => setCaptureMessage(''), 2500)
  }

  return (
    <div className="relative flex flex-1 flex-col">
      {phase === 'intro' && (
        <div className="relative flex flex-1 flex-col items-center justify-center gap-7 overflow-hidden bg-night px-6 py-16 text-center">
          <BodyOutline className="h-48 w-auto text-white/25" />

          <h1 className="font-heading text-3xl text-white">ลองสวม</h1>

          <ul className="flex flex-col gap-3 text-sm text-white/70">
            <li>ยืนห่างจากกล้องประมาณ 1.5–2 เมตร</li>
            <li>อยู่ในที่ที่มีแสงสว่างเพียงพอ</li>
            <li>ให้กล้องเห็นตั้งแต่หัวถึงเข่า</li>
          </ul>

          <button type="button" onClick={startCamera} className="btn btn-primary bg-white text-ink hover:opacity-85">
            เปิดกล้อง
          </button>

          <p className="max-w-xs text-xs text-white/85">
            ภาพจากกล้องประมวลผลในเครื่องคุณเท่านั้น ไม่ถูกส่งออกไปไหน
          </p>
        </div>
      )}

      {phase !== 'intro' && (
        <div className="relative flex-1 bg-night">
          <video ref={videoRef} className="hidden" playsInline muted />
          <canvas ref={canvasRef} className="h-full w-full object-cover" />

          {flash && <div className="pointer-events-none absolute inset-0 bg-white/70" />}

          {phase === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-night/90 text-white">
              <span
                aria-hidden
                className="h-9 w-9 animate-spin rounded-full border-[3px] border-white/25 border-t-white"
              />
              <p className="text-sm">กำลังเปิดกล้องและโหลดโมเดล...</p>
            </div>
          )}

          {phase === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center bg-night/90 px-6 text-center text-white">
              <p className="text-sm">{errorMsg}</p>
            </div>
          )}

          {phase === 'ready' && (
            <>
              <button
                type="button"
                onClick={handleCapture}
                aria-label="ถ่ายรูป"
                className="absolute bottom-28 left-1/2 flex h-20 w-20 -translate-x-1/2 items-center justify-center rounded-full border border-white/40"
              >
                <span className="h-[72px] w-[72px] rounded-full border-2 border-white" />
              </button>

              {captureMessage && (
                <p className="absolute bottom-[152px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-night/60 px-4 py-1.5 text-xs text-white">
                  {captureMessage}
                </p>
              )}

              {savedLooks.length > 0 && (
                <div className="absolute inset-x-0 bottom-0 flex gap-3 overflow-x-auto bg-black/40 px-4 pb-4 pt-6 backdrop-blur-[16px]">
                  <button
                    type="button"
                    onClick={() => setActiveLookId(null)}
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[4px] border text-[10px] text-white"
                    style={{
                      borderColor: activeLookId === null ? '#ffffff' : 'rgba(255,255,255,0.3)',
                    }}
                  >
                    ล่าสุด
                  </button>

                  {savedLooks.map((look) => {
                    const thumb = representativePattern(look.outfit)
                    return (
                      <button
                        key={look.id}
                        type="button"
                        onClick={() => setActiveLookId(look.id)}
                        aria-label="ลุคที่บันทึกไว้"
                        className="h-14 w-14 shrink-0 rounded-[4px]"
                        style={{
                          border: `1px solid ${
                            activeLookId === look.id ? '#ffffff' : 'rgba(255,255,255,0.3)'
                          }`,
                          backgroundImage: thumb ? `url("${thumb.pattern.src}")` : undefined,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          filter: thumb
                            ? `hue-rotate(${thumb.hue}deg) saturate(${thumb.saturation}%)`
                            : undefined,
                        }}
                      />
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default TryOn
