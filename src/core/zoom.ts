/**
 * Canvas zoom. The range is deliberately wide: a 40 mm marker board and a
 * 10 000 mm floor target both have to stay workable, so the limits span five
 * orders of magnitude and every step is multiplicative, which keeps the felt
 * change identical at 2 % and at 1500 %.
 */
export const ZOOM_MIN = 0.02
export const ZOOM_MAX = 16
/** Ratio applied by one zoom-in or zoom-out step. */
export const ZOOM_STEP = 1.25
/** Page pixels per millimetre at 100 %. */
export const CANVAS_SCALE = 2.3

const round = (value: number) => Number(value.toFixed(4))

export function clampZoom(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1
  return round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value)))
}

export const zoomIn = (value: number) => clampZoom(clampZoom(value) * ZOOM_STEP)
export const zoomOut = (value: number) => clampZoom(clampZoom(value) / ZOOM_STEP)

/** Percentage shown in the status bar; small zoom levels keep one decimal. */
export function zoomLabel(value: number): string {
  const percent = clampZoom(value) * 100
  return `${percent < 10 ? percent.toFixed(1) : Math.round(percent)}%`
}

/** Zoom that fits a page into a viewport, leaving room for the canvas padding. */
export function fitZoom(pageWidth: number, pageHeight: number, viewportWidth: number, viewportHeight: number, padding = 96): number {
  if (!(pageWidth > 0) || !(pageHeight > 0) || !(viewportWidth > 0) || !(viewportHeight > 0)) return 1
  const scaleX = (viewportWidth - padding) / (pageWidth * CANVAS_SCALE)
  const scaleY = (viewportHeight - padding) / (pageHeight * CANVAS_SCALE)
  return clampZoom(Math.min(scaleX, scaleY))
}
