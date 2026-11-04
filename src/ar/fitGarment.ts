import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { Fit } from './smoothing'

export type Anchors = {
  from: number[]
  to: number[]
}

type Point = { x: number; y: number }

const VISIBILITY_THRESHOLD = 0.5

function isVisible(point: NormalizedLandmark | undefined): point is NormalizedLandmark {
  return !!point && (point.visibility ?? 1) >= VISIBILITY_THRESHOLD
}

function toPixel(p: NormalizedLandmark, w: number, h: number): Point {
  return { x: p.x * w, y: p.y * h }
}

function average(points: Point[]): Point {
  const x = points.reduce((sum, p) => sum + p.x, 0) / points.length
  const y = points.reduce((sum, p) => sum + p.y, 0) / points.length
  return { x, y }
}

function distance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export function fitGarment(
  landmarks: NormalizedLandmark[],
  anchors: Anchors,
  widthScale: number,
  offsetY: number,
  canvasWidth: number,
  canvasHeight: number,
): Fit | null {
  if (![...anchors.from, ...anchors.to].every((i) => isVisible(landmarks[i]))) {
    return null
  }

  const fromPts = anchors.from.map((i) => toPixel(landmarks[i], canvasWidth, canvasHeight))
  const toPts = anchors.to.map((i) => toPixel(landmarks[i], canvasWidth, canvasHeight))

  const centerFrom = average(fromPts)
  const centerTo = average(toPts)
  const height = distance(centerFrom, centerTo)

  // เส้นอ้างอิงความกว้าง+มุมหมุน: ใช้คู่ซ้าย-ขวาถ้ามี (ไหล่ หรือ สะโพก)
  const spreadPts = anchors.from.length >= 2 ? fromPts : anchors.to.length >= 2 ? toPts : null

  let width: number
  let angle: number

  if (spreadPts) {
    const p1 = spreadPts[0]
    const p2 = spreadPts[spreadPts.length - 1]
    width = distance(p1, p2) * widthScale
    angle = Math.atan2(p2.y - p1.y, p2.x - p1.x)
  } else {
    // ชิ้นพาดเฉียง (เช่น สไบ) ไม่มีคู่ซ้าย-ขวา ใช้ไหล่ (11,12) เป็นสเกลอ้างอิงความกว้าง
    const shoulderL = landmarks[11]
    const shoulderR = landmarks[12]
    if (!isVisible(shoulderL) || !isVisible(shoulderR)) return null

    const sL = toPixel(shoulderL, canvasWidth, canvasHeight)
    const sR = toPixel(shoulderR, canvasWidth, canvasHeight)
    width = distance(sL, sR) * widthScale
    angle = Math.atan2(centerTo.y - centerFrom.y, centerTo.x - centerFrom.x) - Math.PI / 2
  }

  return {
    x: (centerFrom.x + centerTo.x) / 2,
    y: (centerFrom.y + centerTo.y) / 2 + offsetY * height,
    width,
    height,
    angle,
  }
}
