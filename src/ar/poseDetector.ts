import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision'

let landmarkerPromise: Promise<PoseLandmarker> | null = null

// โหลดโมเดลจาก public/mediapipe/ (ไม่พึ่ง CDN) เพื่อให้ใช้งานได้แม้เน็ตไม่ดีวันแข่ง
function createLandmarker() {
  return FilesetResolver.forVisionTasks('/mediapipe/wasm').then((fileset) =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: '/mediapipe/pose_landmarker_lite.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
    }),
  )
}

export function getPoseLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = createLandmarker()
  }
  return landmarkerPromise
}

export function detectPose(
  landmarker: PoseLandmarker,
  video: HTMLVideoElement,
  timestampMs: number,
): PoseLandmarkerResult {
  return landmarker.detectForVideo(video, timestampMs)
}

export type { PoseLandmarkerResult }
