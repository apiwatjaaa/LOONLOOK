export type Fit = {
  x: number
  y: number
  width: number
  height: number
  angle: number
}

// Exponential Moving Average ลดการสั่นของตำแหน่ง/ขนาด/มุมเสื้อระหว่างเฟรม
export function createSmoother(alpha = 0.4) {
  let prev: Fit | null = null

  return function smooth(next: Fit): Fit {
    if (!prev) {
      prev = next
      return next
    }
    prev = {
      x: prev.x + alpha * (next.x - prev.x),
      y: prev.y + alpha * (next.y - prev.y),
      width: prev.width + alpha * (next.width - prev.width),
      height: prev.height + alpha * (next.height - prev.height),
      angle: prev.angle + alpha * (next.angle - prev.angle),
    }
    return prev
  }
}
