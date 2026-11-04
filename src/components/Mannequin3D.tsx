import { useEffect, useRef } from 'react'
import { createMannequinScene, type Piece, type SceneApi } from '../three/mannequinScene'

type Props = {
  pieces: Piece[]
  className?: string
  compact?: boolean // การ์ดแคบ (เทียบสี): หมุนเองช้า ๆ พร้อมกัน, ไม่มีปุ่ม
  interactive?: boolean // false = โชว์อย่างเดียว (ไม่รับเมาส์/นิ้ว ให้เลื่อนหน้าได้)
  onReady?: (api: SceneApi) => void
  onUnsupported?: () => void
}

// หุ่น 3 มิติในสตูดิโอ (ลากเพื่อหมุน ล้อเมาส์เพื่อซูม)
function Mannequin3D({ pieces, className, compact = false, interactive = true, onReady, onUnsupported }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const apiRef = useRef<SceneApi | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const api = createMannequinScene(canvas)
    if (!api) {
      onUnsupported?.()
      return
    }
    apiRef.current = api
    if (compact) api.setFrame(true)
    onReady?.(api)
    return () => {
      api.dispose()
      apiRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const key = JSON.stringify(pieces)
  useEffect(() => {
    apiRef.current?.setPieces(pieces)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return (
    <canvas
      ref={canvasRef}
      aria-label="หุ่น 3 มิติ ลากเพื่อหมุนดูรอบตัว"
      role="img"
      className={`${interactive ? 'cursor-grab touch-none active:cursor-grabbing' : 'pointer-events-none'} ${className ?? ''}`}
    />
  )
}

export default Mannequin3D
