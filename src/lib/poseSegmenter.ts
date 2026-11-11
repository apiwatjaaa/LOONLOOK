import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'

// โมเดลจับท่าทาง "แบบมีเงาร่างคน" (segmentation mask) — ใช้ตัดชุดให้พอดีตัวจริงของแต่ละคน
// แยกจาก src/ar/poseDetector.ts เพื่อไม่แตะโค้ด AR เดิม (ใช้ไฟล์โมเดลชุดเดียวกันใน public/)
let promise: Promise<PoseLandmarker> | null = null

export function getSegmentingLandmarker(): Promise<PoseLandmarker> {
  if (!promise) {
    const p = FilesetResolver.forVisionTasks('/mediapipe/wasm').then((fileset) =>
      PoseLandmarker.createFromOptions(fileset, {
        // ใช้ CPU: อ่านเงาร่างคนออกมาได้แน่นอนทุกเครื่อง (GPU บางรุ่นอ่านค่าทศนิยมออกมาไม่ได้)
        baseOptions: { modelAssetPath: '/mediapipe/pose_landmarker_lite.task', delegate: 'CPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
        outputSegmentationMasks: true,
      }),
    )
    p.catch(() => {
      promise = null
    })
    promise = p
    return p
  }
  return promise
}

/**
 * แปลงเงาร่างคน (ค่า 0–1 ต่อพิกเซล) เป็นรูปขาว-โปร่งใส ขนาดเล็ก
 * ลดความละเอียดลง (step) ให้เร็วบนมือถือ — ตอนขยายกลับจะได้ขอบนุ่มเองโดยธรรมชาติ
 * boost > 1 = ขยายเงาร่างออกเล็กน้อย (ชุดใหญ่กว่าผิวนิดหน่อยเหมือนผ้าจริง)
 * คืนค่า = สัดส่วนพื้นที่ที่เป็นตัวคน
 */
export function maskToCanvas(
  values: Float32Array,
  width: number,
  height: number,
  out: HTMLCanvasElement,
  step = 3,
  boost = 1.5,
): number {
  const w = Math.max(1, Math.floor(width / step))
  const h = Math.max(1, Math.floor(height / step))
  if (out.width !== w) out.width = w
  if (out.height !== h) out.height = h
  const ctx = out.getContext('2d')
  if (!ctx) return 0
  const img = ctx.createImageData(w, h)
  const d = img.data
  let covered = 0
  for (let y = 0; y < h; y++) {
    const row = y * step * width
    for (let x = 0; x < w; x++) {
      const v = values[row + x * step] * boost
      const i = (y * w + x) * 4
      d[i] = d[i + 1] = d[i + 2] = 255
      d[i + 3] = v >= 1 ? 255 : v * 255
      if (v > 0.5) covered++
    }
  }
  ctx.putImageData(img, 0, 0)
  // สัดส่วนพื้นที่ที่เป็นตัวคน (ใช้เช็กว่าเงาร่างใช้ได้จริง)
  return covered / (w * h)
}
