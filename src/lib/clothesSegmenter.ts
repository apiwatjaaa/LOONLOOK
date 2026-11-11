import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision'

// AI แยกส่วนในภาพคน: 0 พื้นหลัง · 1 ผม · 2 ผิว · 3 หน้า · 4 เสื้อผ้า · 5 อื่น ๆ
// ใช้หา "ตรงไหนคือเสื้อผ้าที่ใส่อยู่" แล้วย้อมเป็นลายที่ออกแบบ
export const CLOTHES = 4

// ถ้าวางไฟล์โมเดลไว้ใน public/mediapipe/ จะใช้ไฟล์ในเครื่อง (ใช้ได้แม้ไม่มีเน็ต) ไม่งั้นโหลดจาก Google
const LOCAL_MODEL = '/mediapipe/selfie_multiclass_256x256.tflite'
const REMOTE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite'

let promise: Promise<ImageSegmenter> | null = null

export function getClothesSegmenter(): Promise<ImageSegmenter> {
  if (!promise) {
    const make = (path: string) =>
      FilesetResolver.forVisionTasks('/mediapipe/wasm').then((fileset) =>
        ImageSegmenter.createFromOptions(fileset, {
          // CPU: อ่านผลออกมาเป็นตัวเลขได้แน่นอนทุกเครื่อง
          baseOptions: { modelAssetPath: path, delegate: 'CPU' },
          runningMode: 'VIDEO',
          outputConfidenceMasks: true,
          outputCategoryMask: false,
        }),
      )
    const p = make(LOCAL_MODEL).catch(() => make(REMOTE_MODEL))
    p.catch(() => {
      promise = null
    })
    promise = p
    return p
  }
  return promise
}

/**
 * ค่าความน่าจะเป็น "เสื้อผ้า" (0–1) → รูปขาว-โปร่งใส
 * gain > 1 = ขอบแน่นขึ้น, cut = ตัดค่าต่ำทิ้ง (กันลามออกนอกเสื้อ)
 */
export function clothesToCanvas(values: Float32Array, width: number, height: number, out: HTMLCanvasElement): number {
  if (out.width !== width) out.width = width
  if (out.height !== height) out.height = height
  const ctx = out.getContext('2d')
  if (!ctx) return 0
  const img = ctx.createImageData(width, height)
  const d = img.data
  let covered = 0
  for (let i = 0; i < values.length; i++) {
    // ขยายช่วง 0.35–0.75 ให้เป็น 0–1 ขอบจะคมแต่ยังนุ่ม
    let a = (values[i] - 0.35) / 0.4
    a = a <= 0 ? 0 : a >= 1 ? 1 : a
    const j = i * 4
    d[j] = d[j + 1] = d[j + 2] = 255
    d[j + 3] = a * 255
    if (a > 0.5) covered++
  }
  ctx.putImageData(img, 0, 0)
  return covered / values.length
}
