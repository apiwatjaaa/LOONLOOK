import { useEffect, useRef, useState } from 'react'
import type { ImageSegmenter, PoseLandmarker } from '@mediapipe/tasks-vision'
import { Link } from 'react-router-dom'
import BodyOutline from '../components/BodyOutline'
import { fitGarment } from '../ar/fitGarment'
import { getPoseLandmarker, type PoseLandmarkerResult } from '../ar/poseDetector'
import { renderGarment } from '../ar/renderGarment'
import { createSmoother, type Fit } from '../ar/smoothing'
import type { Garment, GarmentSlot } from '../data/garments'
import { garments, SLOT_DRAW_ORDER } from '../data/garments'
import { LOOKS } from '../data/looks'
import { findPattern } from '../data/patterns'
import { composeGarmentToImage } from '../design/composeGarment'
import { addGalleryPhoto } from '../lib/gallery'
import { getSegmentingLandmarker, maskToCanvas } from '../lib/poseSegmenter'
import { CLOTHES, clothesToCanvas, findWaistGap, getClothesSegmenter } from '../lib/clothesSegmenter'
import { buildFabric, type Fabric } from '../lib/fabric'
import { hipsVisible, makeBuffers, paintRecolor, type Landmark } from '../lib/recolor'
import { drawAccessory, drawBottom, drawTop, measureMask, type Body, type MaskInfo, type Pt } from '../lib/warpGarment'
import { readSavedOutfits, type SavedOutfit } from '../lib/savedOutfits'
import type { CustomPatterns, OutfitConfigs } from '../store/useOutfit'
import { useOutfitStore } from '../store/useOutfit'

type Phase = 'intro' | 'loading' | 'ready' | 'error'
type Facing = 'user' | 'environment'
// photo = ถ่ายรูปก่อนแล้ว AI แต่งชุดแบบละเอียด (ลื่นสุด สวยสุด) · real = ย้อมลายบนเสื้อจริงแบบสด · overlay = สวมชุดใหม่ทับตัว
type Mode = 'photo' | 'real' | 'overlay'

type EquippedItem = {
  garment: Garment
  image: HTMLImageElement
  smooth: ReturnType<typeof createSmoother>
  info: MaskInfo
}

// วิธีสวมแต่ละแบบ: band = ช่วงลำตัวในรูปเสื้อ (ไม่รวมแขน), sleeve = แขนเสื้อที่วาดตามแขนจริง
const TOPS: Record<string, { band: [number, number]; sleeve: 'none' | 'short' | 'long'; hem?: number }> = {
  'top-temp': { band: [0.19, 0.81], sleeve: 'short' },
  'top-crop': { band: [0.2, 0.8], sleeve: 'short', hem: 0.62 },
  'top-shirt': { band: [0.18, 0.82], sleeve: 'long', hem: 1.08 },
  'top-tank': { band: [0.19, 0.81], sleeve: 'none' },
  'top-jacket': { band: [0.17, 0.83], sleeve: 'long', hem: 1.1 },
}
const ACCESSORIES: Record<string, { width: number; raise: number }> = {
  'acc-scarf': { width: 0.62, raise: 0.2 }, // รอบคอ ห้อยลงหน้าอก
  'acc-belt': { width: 1.12, raise: 0.0 }, // คาดเอว กว้างเท่าตัว
}
const PANTS = new Set(['bottom-wide', 'bottom-shorts'])
// ทรงบาน: ไม่ตัดตามเงาร่าง (ผ้าต้องบานออกนอกตัวได้)
const LOOSE = new Set(['bottom-temp', 'bottom-midi'])

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

// หาเส้นแบ่งเสื้อ/กางเกงจากภาพเสื้อผ้า โดยดูช่วงเอวของคน
function waistGapFor(values: Float32Array, w: number, h: number, lm: Landmark[]) {
  const sy = (lm[11].y + lm[12].y) / 2
  const hy = (lm[23].y + lm[24].y) / 2
  const torso = hy - sy
  const xs = [lm[11].x, lm[12].x, lm[23].x, lm[24].x]
  return findWaistGap(values, w, h, Math.min(...xs), Math.max(...xs), sy + torso * 0.45, hy + torso * 0.25)
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
  const modeRef = useRef<Mode>('photo')
  // โหมดถ่ายแล้วแต่ง: รูปที่ถ่าย + ตำแหน่งเสื้อผ้า (เก็บไว้ เปลี่ยนลุคได้ทันทีไม่ต้องถ่ายใหม่)
  const captureRef = useRef<(() => Promise<void>) | null>(null)
  const photoRef = useRef<{ frame: HTMLCanvasElement; mask: HTMLCanvasElement; lm?: Landmark[]; gapY: number | null; found: boolean } | null>(null)
  const photoBuf = useRef(makeBuffers())
  const fabricsRef = useRef<{ top: Fabric | null; bottom: Fabric | null }>({ top: null, bottom: null })
  const models = useRef<{ overlay: PoseLandmarker | null; pose: PoseLandmarker | null; seg: ImageSegmenter | null }>({
    overlay: null,
    pose: null,
    seg: null,
  })

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
  const [mode, setMode] = useState<Mode>('photo')
  const [processing, setProcessing] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoNote, setPhotoNote] = useState('')

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
          next.push({ garment, image, smooth: createSmoother(0.4), info: measureMask(image) })
        } catch (err) {
          console.error(err)
        }
      }
      next.sort((a, b) => SLOT_DRAW_ORDER[a.garment.slot] - SLOT_DRAW_ORDER[b.garment.slot])
      if (!cancelled) equippedRef.current = next
      // ผืนผ้าสำหรับโหมด "ลายบนเสื้อจริง": ท่อนบน (หรือชุดเต็มตัว) + ท่อนล่าง
      const [top, bottom] = await Promise.all([
        buildFabric(active.outfit, active.outfit.top ? 'top' : 'full', active.custom).catch(() => null),
        buildFabric(active.outfit, 'bottom', active.custom).catch(() => null),
      ])
      if (!cancelled) {
        fabricsRef.current = { top, bottom }
        // ถ้ากำลังดูรูปที่ถ่ายไว้ → แต่งใหม่ด้วยลุคที่เพิ่งเลือก
        if (photoRef.current) recomposePhoto()
      }
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

  // แต่งชุดบนรูปที่ถ่ายไว้ (เร็ว: ใช้ตำแหน่งเสื้อผ้าเดิม แค่ปูลายใหม่)
  function recomposePhoto() {
    const p = photoRef.current
    if (!p) return
    const { frame, mask, lm, gapY, found } = p
    const out = document.createElement('canvas')
    out.width = frame.width
    out.height = frame.height
    const o = out.getContext('2d')
    if (!o) return
    o.drawImage(frame, 0, 0)
    const { top, bottom } = fabricsRef.current
    if (found && (top || bottom)) {
      const lit = paintRecolor({ src: frame, w: frame.width, h: frame.height, mask, top, bottom, lm, gapY, buf: photoBuf.current })
      o.drawImage(lit, 0, 0)
    }
    // ลายน้ำชื่อโครงงาน
    const size = Math.max(18, Math.round(out.width * 0.05))
    o.font = `italic ${size}px "Bodoni Moda", serif`
    o.fillStyle = 'rgba(255,255,255,0.85)'
    o.textAlign = 'right'
    o.textBaseline = 'bottom'
    const margin = Math.round(out.width * 0.045)
    o.fillText('Long Look', out.width - margin, out.height - margin)
    setPhotoUrl(out.toDataURL('image/jpeg', 0.9))
  }

  function closePhoto() {
    photoRef.current = null
    setPhotoUrl(null)
    setPhotoNote('')
  }

  async function savePhoto() {
    if (!photoUrl) return
    try {
      addGalleryPhoto(photoUrl)
    } catch {
      /* แกลเลอรีเต็ม: ยังบันทึกลงเครื่องได้ */
    }
    await shareUrl(photoUrl)
  }

  // โหลดโมเดล AI ที่โหมดนั้นใช้ (โหลดครั้งเดียว)
  async function ensureModels(m: Mode) {
    const cur = models.current
    if (m === 'real' || m === 'photo') {
      const [pose, seg] = await Promise.all([
        cur.pose ?? getPoseLandmarker(),
        cur.seg ?? getClothesSegmenter(),
      ])
      cur.pose = pose
      cur.seg = seg
    } else {
      cur.overlay = cur.overlay ?? (await getSegmentingLandmarker().catch(() => getPoseLandmarker()))
    }
  }

  function switchMode(next: Mode) {
    modeRef.current = next
    setMode(next)
    ensureModels(next).catch((err) => {
      console.error(err)
      updateHint('โหลด AI ไม่สำเร็จ ลองเช็กอินเทอร์เน็ต')
    })
  }

  async function startCamera(nextFacing: Facing = facingRef.current) {
    stopStream()
    setPhase('loading')
    cancelledRef.current = false
    facingRef.current = nextFacing
    setFacing(nextFacing)

    try {
      // โหลดโมเดลตามโหมด (อีกโหมดค่อยโหลดตอนกดสลับ)
      const mediaStream = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextFacing, width: { ideal: 960 }, height: { ideal: 960 } },
          audio: false,
        }),
        ensureModels(modeRef.current),
      ]).then(([stream]) => stream)
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

      // ผืนผ้าใบช่วยวาด (ใช้ซ้ำทุกเฟรม)
      const mk = () => document.createElement('canvas')
      const buf = { fitted: mk(), free: mk(), base: mk(), lit: mk(), shade: mk(), soft: mk(), mask: mk(), rim: mk(), tiny: mk(), segIn: mk(), cloth: mk() }

      const render = (result: PoseLandmarkerResult) => {
        const W = canvas.width
        const H = canvas.height
        // กล้องหน้า = กลับด้านแบบกระจก / กล้องหลัง = ภาพตรง
        const mirror = facingRef.current === 'user'

        ctx.save()
        if (mirror) {
          ctx.scale(-1, 1)
          ctx.translate(-W, 0)
        }
        ctx.drawImage(video, 0, 0, W, H)

        const landmarks = result.landmarks[0]
        if (!landmarks) {
          updateHint('ยืนให้กล้องเห็นตัวคุณ')
          ctx.restore()
          return
        }

        // เงาร่างคน (ถ้ามี) → ใช้ตัดชุดให้แนบตัวพอดี
        const segMask = result.segmentationMasks?.[0]
        let hasMask = false
        if (segMask) {
          try {
            // เงาร่างว่างเปล่า (อ่านค่าไม่ได้) → ไม่ตัด ใช้ขนาดปกติแทน
            hasMask = maskToCanvas(segMask.getAsFloat32Array(), segMask.width, segMask.height, buf.mask) > 0.01
          } catch {
            hasMask = false
          }
        }

        // ทำให้จุดข้อต่อนิ่งขึ้น (EMA) ก่อนเอาไปยืดชุด
        const P = (i: number): Pt => {
          const raw = { x: landmarks[i].x * W, y: landmarks[i].y * H }
          const prev = pointsRef.current[i]
          const next = prev ? { x: prev.x + 0.45 * (raw.x - prev.x), y: prev.y + 0.45 * (raw.y - prev.y) } : raw
          pointsRef.current[i] = next
          return next
        }
        const seen = (i: number) => (landmarks[i]?.visibility ?? 1) >= 0.5
        const pts: Record<number, Pt> = {}
        for (const i of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) pts[i] = P(i)
        const half = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
        const base: Body = {
          sR: pts[12], sL: pts[11], hR: pts[24], hL: pts[23],
          // เข่ามองไม่เห็น → ประมาณกึ่งกลางสะโพก-ข้อเท้า
          kR: seen(26) ? pts[26] : half(pts[24], pts[28]),
          kL: seen(25) ? pts[25] : half(pts[23], pts[27]),
          aR: pts[28], aL: pts[27],
          eR: seen(14) ? pts[14] : null, eL: seen(13) ? pts[13] : null,
          wR: seen(16) ? pts[16] : null, wL: seen(15) ? pts[15] : null,
        }
        // ชิ้นที่ตัดตามเงาร่าง วาดให้หลวมกว่าตัวก่อน แล้วค่อยตัดขอบตามตัวจริง
        const fittedBody: Body = { ...base, ease: hasMask ? 1.3 : 1 }

        // วาดที่ความละเอียดราว 720px ให้เร็วบนมือถือ
        const scale = Math.min(1, 720 / Math.max(W, H))
        const lw = Math.round(W * scale)
        const lh = Math.round(H * scale)
        const prep = (c: HTMLCanvasElement) => {
          if (c.width !== lw) c.width = lw
          if (c.height !== lh) c.height = lh
          const x = c.getContext('2d')
          if (!x) return null
          x.setTransform(1, 0, 0, 1, 0, 0)
          x.globalCompositeOperation = 'source-over'
          x.globalAlpha = 1
          x.clearRect(0, 0, lw, lh)
          x.setTransform(scale, 0, 0, scale, 0, 0)
          return x
        }
        const fctx = prep(buf.fitted)
        const rctx = prep(buf.free)
        if (!fctx || !rctx) {
          ctx.restore()
          return
        }

        let drawn = 0
        for (const item of equippedRef.current) {
          const g = item.garment
          // ใช้ fitGarment เช็กว่ากล้องเห็นจุดยึดของชิ้นนี้ครบไหม
          const fit = fitGarment(landmarks, g.anchors, g.widthScale, g.offsetY, W, H)
          if (!fit) continue
          drawn++
          const top = TOPS[g.id]
          const acc = ACCESSORIES[g.id]
          // กระโปรงบาน/กางเกงขากว้าง ไม่ตัดตามตัว (ทรงผ้าต้องบานออกนอกตัวได้)
          const free = LOOSE.has(g.id)
          const target = free ? rctx : fctx
          const body = free ? base : fittedBody
          if (g.slot === 'bottom') drawBottom(target, item.image, body, item.info, PANTS.has(g.id))
          else if (top) drawTop(target, item.image, body, top.band, top.sleeve, top.hem)
          else if (acc) drawAccessory(target, item.image, base, item.info, acc.width, acc.raise)
          // สายคาดเฉียง/อื่น ๆ: วางแบบเดิม (หมุนตามแนวเฉียง)
          else renderGarment(target, item.image, item.smooth(tuneForBody(uprightFit(fit), g)))
        }
        updateHint(drawn < equippedRef.current.length ? 'ถอยห่างอีกนิด ให้กล้องเห็นถึงเข่า' : '')
        if (!drawn) {
          ctx.restore()
          return
        }

        // 1) ตัดชุดชิ้นที่แนบตัว ให้อยู่ในเงาร่างคน → พอดีตัวทุกรูปร่าง
        if (hasMask) {
          fctx.setTransform(1, 0, 0, 1, 0, 0)
          fctx.globalCompositeOperation = 'destination-in'
          fctx.drawImage(buf.mask, 0, 0, lw, lh)
          fctx.globalCompositeOperation = 'source-over'
        }

        // 2) รวมชั้น: ชิ้นบาน (ล่าง) + ชิ้นแนบตัว (บน)
        const bctx = prep(buf.base)
        const lctx = prep(buf.lit)
        const sctx = prep(buf.shade)
        if (!bctx || !lctx || !sctx) {
          ctx.restore()
          return
        }
        bctx.setTransform(1, 0, 0, 1, 0, 0)
        bctx.drawImage(buf.free, 0, 0)
        bctx.drawImage(buf.fitted, 0, 0)

        // 3) แสงเงาจริงจากกล้อง: เอาภาพขาวดำ (รอยยับ/เงาบนตัว) มาทาบชุดแบบ soft-light
        //    แล้วหักแสงรวมที่เบลอ (ภาพกลับสี) ออก เหลือแต่รายละเอียดเงา ชุดสีไม่หม่นตามเสื้อเดิม
        sctx.setTransform(1, 0, 0, 1, 0, 0)
        sctx.drawImage(video, 0, 0, lw, lh)
        sctx.globalCompositeOperation = 'saturation'
        sctx.fillStyle = '#808080'
        sctx.fillRect(0, 0, lw, lh)
        sctx.globalCompositeOperation = 'source-over'
        const soft = buf.soft
        const sw = Math.max(8, Math.round(lw / 24))
        const sh = Math.max(8, Math.round(lh / 24))
        if (soft.width !== sw) soft.width = sw
        if (soft.height !== sh) soft.height = sh
        const tctx = soft.getContext('2d')
        if (tctx) {
          tctx.globalCompositeOperation = 'source-over'
          tctx.drawImage(buf.shade, 0, 0, sw, sh)
          tctx.globalCompositeOperation = 'difference'
          tctx.fillStyle = '#ffffff'
          tctx.fillRect(0, 0, sw, sh)
          tctx.globalCompositeOperation = 'source-over'
        }

        lctx.setTransform(1, 0, 0, 1, 0, 0)
        lctx.drawImage(buf.base, 0, 0)
        lctx.globalCompositeOperation = 'soft-light'
        lctx.globalAlpha = 0.5
        lctx.drawImage(buf.shade, 0, 0)
        lctx.imageSmoothingEnabled = true
        lctx.drawImage(soft, 0, 0, lw, lh)
        lctx.globalAlpha = 1

        // 3.5) ความโค้งของตัว: ขอบลำตัว/แขน/ขาเข้มลงนุ่ม ๆ ชุดเลยดูกลมมีปริมาตร ไม่แบนเป็นแผ่น
        if (hasMask) {
          const rctx2 = prep(buf.rim)
          const tiny = buf.tiny
          const tw = Math.max(8, Math.round(lw / 36))
          const th = Math.max(8, Math.round(lh / 36))
          if (tiny.width !== tw) tiny.width = tw
          if (tiny.height !== th) tiny.height = th
          const tx = tiny.getContext('2d')
          if (rctx2 && tx) {
            tx.clearRect(0, 0, tw, th)
            tx.drawImage(buf.mask, 0, 0, tw, th) // ย่อ = เบลอ
            rctx2.setTransform(1, 0, 0, 1, 0, 0)
            rctx2.fillStyle = '#4a4643'
            rctx2.fillRect(0, 0, lw, lh)
            rctx2.imageSmoothingEnabled = true
            rctx2.drawImage(tiny, 0, 0, lw, lh) // กลางตัวขาว ขอบเทา
            lctx.globalCompositeOperation = 'multiply'
            lctx.drawImage(buf.rim, 0, 0)
          }
        }

        lctx.globalCompositeOperation = 'destination-in'
        lctx.drawImage(buf.base, 0, 0)
        lctx.globalCompositeOperation = 'source-over'

        // 4) แปะชุดลงภาพ พร้อมเงานุ่ม ๆ
        const shoulderW = Math.hypot(pts[11].x - pts[12].x, pts[11].y - pts[12].y)
        ctx.shadowColor = 'rgba(0,0,0,0.3)'
        ctx.shadowBlur = shoulderW * 0.1
        ctx.shadowOffsetY = shoulderW * 0.03
        ctx.drawImage(buf.lit, 0, 0, W, H)
        ctx.shadowColor = 'transparent'
        ctx.restore()
      }

      // ====== โหมด "ลายบนเสื้อจริง" ======
      // AI หาพิกเซลที่เป็นเสื้อผ้า → ปูผืนผ้าที่ออกแบบ → ใส่แสงเงา/รอยยับจากภาพจริง → ตัดให้อยู่ในเสื้อพอดี
      // ลดการกระตุก: AI ทำงานราว 15 ครั้ง/วินาที ส่วนภาพกล้องวาดทุกเฟรม (ใช้ชุดที่คำนวณล่าสุดแปะ)
      let lastAI = 0
      let aiCount = 0
      let litReady = false
      let lastLm: PoseLandmarkerResult['landmarks'][number] | undefined
      const liveBuf = makeBuffers()
      const nextTs = () => (lastTs = Math.max(performance.now(), lastTs + 1))

      // ====== โหมด "ถ่ายแล้วแต่ง" ======
      // ถ่ายภาพนิ่ง → AI หาเสื้อผ้าแบบละเอียด 2 รอบ (ทั้งภาพ + ซูมเฉพาะตัวคน ขอบคมขึ้น)
      captureRef.current = async () => {
        setProcessing(true)
        try {
          await ensureModels('photo')
          const m = models.current
          if (!m.seg || !m.pose) throw new Error('AI ยังไม่พร้อม')
          await new Promise((r) => setTimeout(r, 30)) // ให้หน้าจอขึ้น "กำลังแต่งชุด" ก่อน

          // 1) ภาพนิ่ง (กลับด้านแบบกระจกถ้าเป็นกล้องหน้า ให้ตรงกับที่เห็น)
          const W = video.videoWidth
          const H = video.videoHeight
          const k = Math.min(1, 1440 / Math.max(W, H))
          const frame = document.createElement('canvas')
          frame.width = Math.round(W * k)
          frame.height = Math.round(H * k)
          const fx = frame.getContext('2d')
          if (!fx) throw new Error('canvas')
          if (facingRef.current === 'user') {
            fx.translate(frame.width, 0)
            fx.scale(-1, 1)
          }
          fx.drawImage(video, 0, 0, frame.width, frame.height)
          fx.setTransform(1, 0, 0, 1, 0, 0)

          // 2) ท่าทาง
          const lm = m.pose.detectForVideo(frame, nextTs()).landmarks[0] as Landmark[] | undefined

          // 3) หาเสื้อผ้าทั้งภาพ
          const small = (src: CanvasImageSource, sw: number, sh: number, max: number) => {
            const c = document.createElement('canvas')
            const s2 = Math.min(1, max / Math.max(sw, sh))
            c.width = Math.max(16, Math.round(sw * s2))
            c.height = Math.max(16, Math.round(sh * s2))
            c.getContext('2d')?.drawImage(src, 0, 0, c.width, c.height)
            return c
          }
          const mask = document.createElement('canvas')
          mask.width = frame.width
          mask.height = frame.height
          const mx = mask.getContext('2d')
          if (!mx) throw new Error('canvas')
          mx.imageSmoothingQuality = 'high'
          const fullMask = document.createElement('canvas')
          let coverage = 0
          let gapY: number | null = null
          m.seg.segmentForVideo(small(frame, frame.width, frame.height, 512), nextTs(), (res) => {
            const cm = res.confidenceMasks?.[CLOTHES]
            if (!cm) return
            const values = cm.getAsFloat32Array()
            coverage = clothesToCanvas(values, cm.width, cm.height, fullMask)
            if (lm && hipsVisible(lm)) gapY = waistGapFor(values, cm.width, cm.height, lm)
          })
          mx.drawImage(fullMask, 0, 0, mask.width, mask.height)

          // 4) ซูมเฉพาะตัวคน แล้วหาเสื้อผ้าอีกรอบ (ละเอียดกว่า) แปะทับช่วงตัวคน
          if (lm) {
            const pts = lm.filter((p) => (p.visibility ?? 1) > 0.3)
            if (pts.length > 4) {
              const xs = pts.map((p) => p.x)
              const ys = pts.map((p) => p.y)
              let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
              const bw = x1 - x0
              const bh = y1 - y0
              x0 = Math.max(0, x0 - bw * 0.35)
              x1 = Math.min(1, x1 + bw * 0.35)
              y0 = Math.max(0, y0 - bh * 0.12)
              y1 = Math.min(1, y1 + bh * 0.08)
              if ((x1 - x0) * (y1 - y0) < 0.8) {
                const rx = Math.round(x0 * frame.width)
                const ry = Math.round(y0 * frame.height)
                const rw = Math.max(16, Math.round((x1 - x0) * frame.width))
                const rh = Math.max(16, Math.round((y1 - y0) * frame.height))
                const crop = document.createElement('canvas')
                const cs = Math.min(1, 512 / Math.max(rw, rh))
                crop.width = Math.max(16, Math.round(rw * cs))
                crop.height = Math.max(16, Math.round(rh * cs))
                crop.getContext('2d')?.drawImage(frame, rx, ry, rw, rh, 0, 0, crop.width, crop.height)
                const cropMask = document.createElement('canvas')
                let ok = false
                m.seg.segmentForVideo(crop, nextTs(), (res) => {
                  const cm = res.confidenceMasks?.[CLOTHES]
                  if (!cm) return
                  ok = clothesToCanvas(cm.getAsFloat32Array(), cm.width, cm.height, cropMask) > 0.01
                })
                if (ok) {
                  mx.clearRect(rx, ry, rw, rh)
                  mx.drawImage(cropMask, rx, ry, rw, rh)
                }
              }
            }
          }

          const found = coverage > 0.004
          photoRef.current = { frame, mask, lm, gapY, found }
          setPhotoNote(found ? '' : 'ไม่เจอเสื้อผ้าในรูป ลองถ่ายให้เห็นตัวชัด ๆ ในที่สว่าง')
          recomposePhoto()
        } catch (err) {
          console.error(err)
          setPhotoNote('แต่งชุดไม่สำเร็จ ลองถ่ายใหม่อีกครั้ง')
        } finally {
          setProcessing(false)
        }
      }

      const renderReal = (seg: ImageSegmenter, pose: PoseLandmarker, ts: number, runAI: boolean) => {
        const W = canvas.width
        const H = canvas.height
        const mirror = facingRef.current === 'user'
        if (!runAI) {
          ctx.save()
          if (mirror) {
            ctx.scale(-1, 1)
            ctx.translate(-W, 0)
          }
          ctx.drawImage(video, 0, 0, W, H)
          if (litReady) ctx.drawImage(liveBuf.lit, 0, 0, W, H)
          ctx.restore()
          return
        }
        const scale = Math.min(1, 540 / Math.max(W, H))
        const lw = Math.round(W * scale)
        const lh = Math.round(H * scale)

        // 1) หาเสื้อผ้า (ย่อภาพก่อนให้เร็ว)
        const si = buf.segIn
        const sScale = 256 / Math.max(W, H)
        const sw = Math.max(16, Math.round(W * sScale))
        const sh = Math.max(16, Math.round(H * sScale))
        if (si.width !== sw) si.width = sw
        if (si.height !== sh) si.height = sh
        si.getContext('2d')?.drawImage(video, 0, 0, sw, sh)
        // 2) ท่าทาง (เปลี่ยนช้ากว่าเสื้อผ้า ตรวจทุก 2 รอบพอ)
        if (aiCount++ % 2 === 0 || !lastLm) lastLm = pose.detectForVideo(video, ts).landmarks[0]
        const lm = lastLm
        const hipsSeen = hipsVisible(lm)

        let coverage = 0
        let gapY: number | null = null
        seg.segmentForVideo(si, ts, (res) => {
          const m = res.confidenceMasks?.[CLOTHES]
          if (!m) return
          const values = m.getAsFloat32Array()
          coverage = clothesToCanvas(values, m.width, m.height, buf.cloth)
          if (lm && hipsSeen) gapY = waistGapFor(values, m.width, m.height, lm)
        })

        ctx.save()
        if (mirror) {
          ctx.scale(-1, 1)
          ctx.translate(-W, 0)
        }
        ctx.drawImage(video, 0, 0, W, H)

        const { top, bottom } = fabricsRef.current
        if (coverage < 0.004 || (!top && !bottom)) {
          litReady = false
          updateHint(coverage < 0.004 ? 'ยืนให้กล้องเห็นเสื้อผ้าที่ใส่อยู่' : '')
          ctx.restore()
          return
        }
        updateHint('')
        paintRecolor({ src: video, w: lw, h: lh, mask: buf.cloth, top, bottom, lm, gapY, buf: liveBuf })
        ctx.drawImage(liveBuf.lit, 0, 0, W, H)
        litReady = true
        ctx.restore()
      }

      const loop = () => {
        if (cancelledRef.current) return
        if (video.videoWidth && video.videoHeight) {
          if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth
          if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight
          // timestamp ต้องเพิ่มขึ้นเสมอ ไม่งั้น MediaPipe จะ error
          const ts = Math.max(performance.now(), lastTs + 1)
          lastTs = ts
          const m = models.current
          if (modeRef.current === 'photo') {
            // ถ่ายแล้วแต่ง: ระหว่างเล็งเป็นกล้องธรรมดา ไม่มี AI → ลื่นเต็มที่
            ctx.save()
            if (facingRef.current === 'user') {
              ctx.scale(-1, 1)
              ctx.translate(-canvas.width, 0)
            }
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            ctx.restore()
            updateHint('')
          } else if (modeRef.current === 'real' && m.seg && m.pose) {
            const runAI = ts - lastAI > 62
            if (runAI) lastAI = ts
            renderReal(m.seg, m.pose, ts, runAI)
          } else if (modeRef.current === 'overlay' && m.overlay) {
            // วาดทั้งหมดใน callback: เงาร่างคนใช้ได้เฉพาะช่วงนี้ (MediaPipe คืนหน่วยความจำหลังจากนั้น)
            m.overlay.detectForVideo(video, ts, render)
          } else {
            // โมเดลของโหมดนี้ยังโหลดไม่เสร็จ: โชว์กล้องไปก่อน
            ctx.save()
            if (facingRef.current === 'user') {
              ctx.scale(-1, 1)
              ctx.translate(-canvas.width, 0)
            }
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            ctx.restore()
            updateHint('กำลังโหลด AI...')
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
          ? 'เว็บยังไม่ได้รับอนุญาตให้ใช้กล้อง กดอนุญาตในหน้าต่างที่เด้งขึ้น หรือเปิดสิทธิ์กล้องในการตั้งค่าเบราว์เซอร์'
          : 'เปิดกล้องไม่ได้ ลองเปิดเว็บนี้ใน Safari หรือ Chrome แทนแอปอื่น (เช่น Instagram / LINE)',
      )
    }
  }

  function takePhoto() {
    if (modeRef.current === 'photo') {
      captureRef.current?.()
      return
    }
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
    if (shot) await shareUrl(shot)
  }

  async function shareUrl(url: string) {
    const blob = await (await fetch(url)).blob()
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
    link.href = url
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

              {/* สลับโหมด */}
              <div className="absolute inset-x-0 top-[4.5rem] z-20 flex justify-center">
                <div className="flex rounded-full border border-white/20 bg-black/40 p-1 text-xs text-white backdrop-blur-md">
                  {(
                    [
                      ['photo', 'ถ่ายแล้วแต่ง'],
                      ['real', 'สด'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={mode === id}
                      onClick={() => switchMode(id)}
                      className={`rounded-full px-3.5 py-1.5 transition-colors ${mode === id ? 'bg-white text-ink' : 'text-white/80'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
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

          {/* AI กำลังแต่งชุด */}
          {processing && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-night/80 text-white backdrop-blur-sm">
              <span aria-hidden className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/25 border-t-white" />
              <p className="font-wordmark text-2xl italic">Styling…</p>
              <p className="text-sm text-white/70">AI กำลังแต่งชุดให้</p>
            </div>
          )}

          {/* ผลลัพธ์ "ถ่ายแล้วแต่ง": เปลี่ยนลุคได้ทันทีบนรูปเดิม */}
          {photoUrl && !processing && (
            <div className="absolute inset-0 z-50 flex flex-col bg-night">
              <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
                <img
                  src={photoUrl}
                  alt="รูปที่แต่งชุดแล้ว"
                  className="max-h-full max-w-full rounded-xl object-contain shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)]"
                />
                {photoNote && (
                  <p className="absolute inset-x-6 top-6 rounded-xl bg-black/60 px-4 py-2.5 text-center text-xs text-white backdrop-blur-md">
                    {photoNote}
                  </p>
                )}
              </div>
              <p className="px-5 pb-2 text-[11px] tracking-[0.14em] text-white/50">ลองลุคอื่นบนรูปนี้</p>
              <div className="flex gap-2.5 overflow-x-auto px-5 pb-4 [scrollbar-width:none]">
                {options.map((o) => {
                  const sw = swatchOf(o.outfit)
                  const on = o.id === active.id
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setActiveId(o.id)}
                      aria-pressed={on}
                      className={`flex shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3.5 text-xs transition-colors ${
                        on ? 'border-white bg-white text-ink' : 'border-white/25 bg-white/5 text-white'
                      }`}
                    >
                      <span className="relative h-7 w-7 overflow-hidden rounded-full" style={{ background: sw.tint ?? '#ddd' }}>
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
              <div className="flex gap-3 px-5 pb-6">
                <button type="button" onClick={closePhoto} className="btn h-12 flex-1 border border-white/30 text-white">
                  ถ่ายใหม่
                </button>
                <button type="button" onClick={savePhoto} className="btn h-12 flex-1 bg-white text-ink">
                  บันทึก / แชร์
                </button>
              </div>
            </div>
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
