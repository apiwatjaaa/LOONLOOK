import type { Fit } from './smoothing'

export function renderGarment(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  fit: Fit,
) {
  if (!image.complete || image.naturalWidth === 0) return

  ctx.save()
  ctx.translate(fit.x, fit.y)
  ctx.rotate(fit.angle)
  ctx.drawImage(image, -fit.width / 2, -fit.height / 2, fit.width, fit.height)
  ctx.restore()
}
