/** Paper sizes are stored in portrait orientation; landscape swaps width and height. */
export type PaperOrientation = 'portrait' | 'landscape'
export type PaperPreset = { name: string; width: number; height: number }

export const paperPresets: PaperPreset[] = [
  { name: 'A0', width: 841, height: 1189 },
  { name: 'A1', width: 594, height: 841 },
  { name: 'A2', width: 420, height: 594 },
  { name: 'A3', width: 297, height: 420 },
  { name: 'A4', width: 210, height: 297 },
  { name: 'A5', width: 148, height: 210 },
  { name: 'A6', width: 105, height: 148 },
  { name: 'Letter', width: 215.9, height: 279.4 },
  { name: 'Legal', width: 215.9, height: 355.6 },
  { name: 'Tabloid', width: 279.4, height: 431.8 },
]

export const findPreset = (name: string) => paperPresets.find(preset => preset.name === name) ?? null

/** Size of a preset in the requested orientation. */
export function orientationSize(preset: PaperPreset, orientation: PaperOrientation) {
  return orientation === 'landscape' ? { width: preset.height, height: preset.width } : { width: preset.width, height: preset.height }
}

/** Flip a size between portrait and landscape. */
export const flipSize = (width: number, height: number) => ({ width: height, height: width })

/**
 * Which preset a page size corresponds to, in either orientation. A size that
 * matches no preset keeps its own shape as the orientation.
 */
export function matchPaper(width: number, height: number): { preset: PaperPreset | null; orientation: PaperOrientation } {
  const portrait = paperPresets.find(preset => preset.width === width && preset.height === height)
  if (portrait) return { preset: portrait, orientation: 'portrait' }
  const landscape = paperPresets.find(preset => preset.width === height && preset.height === width)
  if (landscape) return { preset: landscape, orientation: 'landscape' }
  return { preset: null, orientation: width > height ? 'landscape' : 'portrait' }
}

/**
 * The canvas is unbounded: any page size that can be drawn is accepted, and the
 * zoom range covers micro targets as well as large floor boards. Two numbers
 * are still worth knowing.
 */
export const PAGE_MIN = 1
/** Sanity ceiling for imported files: a page may be huge, but not unbounded data. */
export const PAGE_MAX = 1_000_000
/** Above this the page leaves the range of ordinary printing, so the UI warns. */
export const PAGE_WARN = 10000
/** PDF pages cannot exceed 14 400 pt (200 in ≈ 5080 mm) per side. */
export const PDF_PAGE_MAX = 5080

export const pageTooSmall = (width: number, height: number) => !(width >= PAGE_MIN) || !(height >= PAGE_MIN)
export const pageOversize = (width: number, height: number) => width > PAGE_WARN || height > PAGE_WARN
export const pageBeyondPdf = (width: number, height: number) => width > PDF_PAGE_MAX || height > PDF_PAGE_MAX

