import type { PDFDocument } from 'pdf-lib'
import type { DocumentModel, Primitive } from './model'
import { boardOriginCorner, scene } from './scene'
import { pluginMap } from './plugins'

const mmToPt = (n: number) => n * 72 / 25.4
const escaped = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const attr = (n: number) => Number(n.toFixed(6))
function svgPrimitive(p: Primitive): string {
  const transform = p.transform?.length ? ` transform="${p.transform.slice().reverse().map(t => `rotate(${attr(t.angle)} ${attr(t.cx)} ${attr(t.cy)})`).join(' ')}"` : ''
  if (p.kind === 'rect') return `<rect${transform} x="${attr(p.x)}" y="${attr(p.y)}" width="${attr(p.width)}" height="${attr(p.height)}" fill="${p.fill}"${p.stroke ? ` stroke="${p.stroke}" stroke-width="${attr(p.strokeWidth ?? 0.2)}"` : ''}/>`
  if (p.kind === 'circle') return `<circle${transform} cx="${attr(p.cx)}" cy="${attr(p.cy)}" r="${attr(p.r)}" fill="${p.fill}"${p.stroke ? ` stroke="${p.stroke}" stroke-width="${attr(p.strokeWidth ?? 0.2)}"` : ''}/>`
  if (p.kind === 'line') return `<line${transform} x1="${attr(p.x1)}" y1="${attr(p.y1)}" x2="${attr(p.x2)}" y2="${attr(p.y2)}" stroke="${p.stroke}" stroke-width="${attr(p.strokeWidth)}"${p.dash ? ` stroke-dasharray="${attr(p.dash)} ${attr(p.dash)}"` : ''}/>`
  if (p.kind === 'poly') return `<polygon${transform} points="${p.points.map(point => `${attr(point.x)},${attr(point.y)}`).join(' ')}" fill="${p.fill}"${p.stroke ? ` stroke="${p.stroke}" stroke-width="${attr(p.strokeWidth ?? 0.2)}"` : ''}/>`
  if (p.kind === 'text') return `<text${transform} x="${attr(p.x)}" y="${attr(p.y)}" font-size="${attr(p.fontSize)}" font-family="Arial, sans-serif" font-weight="${p.fontWeight ?? 400}" fill="${p.fill}"${p.stroke ? ` stroke="${p.stroke}" stroke-width="${attr(p.strokeWidth ?? 0)}" paint-order="stroke"` : ''}>${escaped(p.value)}</text>`
  return `<image${transform} x="${attr(p.x)}" y="${attr(p.y)}" width="${attr(p.width)}" height="${attr(p.height)}" href="${escaped(p.href)}"/>`
}
/**
 * SVG path for a filled polygon. pdf-lib draws SVG paths, so the PDF exporter
 * and any future renderer share one definition of an arrowhead's outline.
 */
export function polygonPath(points: { x: number; y: number }[]): string {
  return `M ${points.map(point => `${attr(point.x)} ${attr(point.y)}`).join(' L ')} Z`
}
function transformedPoint(p: Primitive, x: number, y: number) {
  for (const t of p.transform ?? []) {
    const a = t.angle * Math.PI / 180, dx = x - t.cx, dy = y - t.cy
    x = t.cx + dx * Math.cos(a) - dy * Math.sin(a)
    y = t.cy + dx * Math.sin(a) + dy * Math.cos(a)
  }
  return { x, y }
}
function totalAngle(p: Primitive) { return (p.transform ?? []).reduce((sum, t) => sum + t.angle, 0) }
export function svgString(doc: DocumentModel, compensation = 1, dimensions = false): string {
  const shapes = scene(doc, dimensions).map(svgPrimitive).join('')
  const transform = compensation === 1 ? shapes : `<g transform="translate(${attr(doc.width * (1 - compensation) / 2)} ${attr(doc.height * (1 - compensation) / 2)}) scale(${attr(compensation)})">${shapes}</g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${attr(doc.width)}mm" height="${attr(doc.height)}mm" viewBox="0 0 ${attr(doc.width)} ${attr(doc.height)}"><rect width="100%" height="100%" fill="#ffffff"/>${transform}</svg>`
}
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
export function exportSvg(doc: DocumentModel, compensation: number, dimensions = false) { download(new Blob([svgString(doc, compensation, dimensions)], { type: 'image/svg+xml;charset=utf-8' }), `${doc.name || 'calibration-board'}${dimensions ? '-drawing' : ''}.svg`) }
export async function exportPng(doc: DocumentModel, dpi: number, compensation: number, dimensions = false) {
  const width = Math.round(doc.width / 25.4 * dpi), height = Math.round(doc.height / 25.4 * dpi)
  if (width * height > 120_000_000) throw new Error('图像尺寸过大，请降低 DPI 或页面尺寸。')
  const svg = svgString(doc, compensation, dimensions)
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('无法创建图像画布。')
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, width, height)
    ctx.drawImage(image, 0, 0, width, height)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('PNG 编码失败。')), 'image/png'))
  download(blob, `${doc.name || 'calibration-board'}${dimensions ? '-drawing' : ''}-${dpi}dpi.png`)
  } finally { URL.revokeObjectURL(url) }
}
function color(hex: string, rgb: (r: number, g: number, b: number) => import('pdf-lib').RGB) {
  const match = /^#([\da-f]{6})$/i.exec(hex)
  if (!match) return rgb(0, 0, 0)
  const number = parseInt(match[1], 16)
  return rgb(((number >> 16) & 255) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255)
}
async function embedTextImage(pdf: PDFDocument, value: string, size: number, fill: string, weight: number) {
  const canvas = document.createElement('canvas')
  const px = Math.max(24, Math.ceil(size / 25.4 * 72 * 4))
  const context = canvas.getContext('2d')!
  context.font = `${weight} ${px}px Arial, sans-serif`
  canvas.width = Math.ceil(context.measureText(value).width + 8)
  canvas.height = Math.ceil(px * 1.4)
  context.font = `${weight} ${px}px Arial, sans-serif`
  context.fillStyle = fill
  context.textBaseline = 'alphabetic'
  context.fillText(value, 3, px)
  const data = canvas.toDataURL('image/png')
  return { image: await pdf.embedPng(data), width: canvas.width / 4, height: canvas.height / 4, baseline: px / 4 }
}
export async function exportPdf(doc: DocumentModel, compensation: number, dimensions = false) {
  const { PDFDocument, StandardFonts, rgb, degrees } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  pdf.setTitle(doc.name || 'Calibration Board')
  const width = mmToPt(doc.width), height = mmToPt(doc.height)
  const page = pdf.addPage([width, height])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const transformX = (x: number) => mmToPt(doc.width * (1 - compensation) / 2 + x * compensation)
  const transformY = (y: number) => height - mmToPt(doc.height * (1 - compensation) / 2 + y * compensation)
  const len = (x: number) => mmToPt(x * compensation)
  for (const p of scene(doc, dimensions)) {
    if (p.kind === 'rect') { const pt = transformedPoint(p, p.x, p.y + p.height); page.drawRectangle({ x: transformX(pt.x), y: transformY(pt.y), width: len(p.width), height: len(p.height), rotate: degrees(-totalAngle(p)), color: p.fill === 'none' ? undefined : color(p.fill, rgb), borderColor: p.stroke ? color(p.stroke, rgb) : undefined, borderWidth: p.stroke ? len(p.strokeWidth ?? 0.2) : undefined }) }
    else if (p.kind === 'circle') { const pt = transformedPoint(p, p.cx, p.cy); page.drawCircle({ x: transformX(pt.x), y: transformY(pt.y), size: len(p.r), color: p.fill === 'none' ? undefined : color(p.fill, rgb), borderColor: p.stroke ? color(p.stroke, rgb) : undefined, borderWidth: p.stroke ? len(p.strokeWidth ?? 0.2) : undefined }) }
    else if (p.kind === 'line') { const a = transformedPoint(p, p.x1, p.y1), b = transformedPoint(p, p.x2, p.y2); page.drawLine({ start: { x: transformX(a.x), y: transformY(a.y) }, end: { x: transformX(b.x), y: transformY(b.y) }, thickness: len(p.strokeWidth), color: color(p.stroke, rgb), dashArray: p.dash ? [len(p.dash), len(p.dash)] : undefined }) }
    // Filled shapes go through an SVG path so arrowheads stay solid in the PDF too.
    else if (p.kind === 'poly') { const path = polygonPath(p.points.map(point => transformedPoint(p, point.x, point.y))); page.drawSvgPath(path, { x: transformX(0), y: transformY(0), scale: len(1), color: color(p.fill, rgb) }) }
    else if (p.kind === 'text') {
      const size = len(p.fontSize)
      const pt = transformedPoint(p, p.x, p.y)
      if (/^[\x20-\x7e]*$/.test(p.value)) {
        const textFont = p.fontWeight && p.fontWeight >= 600 ? bold : font
        const options = { size, rotate: degrees(-totalAngle(p)), font: textFont }
        const halo = len(p.strokeWidth ?? 0) / 2
        if (p.stroke && halo > 0) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-0.7, -0.7], [-0.7, 0.7], [0.7, -0.7], [0.7, 0.7]]) page.drawText(p.value, { ...options, x: transformX(pt.x) + dx * halo, y: transformY(pt.y) + dy * halo, color: color(p.stroke, rgb) })
        page.drawText(p.value, { ...options, x: transformX(pt.x), y: transformY(pt.y), color: color(p.fill, rgb) })
      }
      else {
        const result = await embedTextImage(pdf, p.value, p.fontSize, p.fill, p.fontWeight ?? 400)
        page.drawImage(result.image, { x: transformX(pt.x), y: transformY(pt.y) - (result.height - result.baseline) * compensation, width: result.width * compensation, height: result.height * compensation, rotate: degrees(-totalAngle(p)) })
      }
    } else {
      try {
        const image = p.href.startsWith('data:image/jpeg') ? await pdf.embedJpg(p.href) : await pdf.embedPng(p.href)
        const pt = transformedPoint(p, p.x, p.y + p.height)
        page.drawImage(image, { x: transformX(pt.x), y: transformY(pt.y), width: len(p.width), height: len(p.height), rotate: degrees(-totalAngle(p)) })
      } catch { /* Unsupported image formats are rejected at upload. */ }
    }
  }
  download(new Blob([new Uint8Array(await pdf.save())], { type: 'application/pdf' }), `${doc.name || 'calibration-board'}${dimensions ? '-drawing' : ''}.pdf`)
}
export function exportJson(doc: DocumentModel) {
  const boards = doc.layers.flatMap(layer => {
    if (layer.type !== 'board') return []
    const origin = boardOriginCorner(layer)
    return [{ id: layer.id, plugin: layer.pluginId, positionMm: { x: layer.x, y: layer.y }, sizeMm: pluginMap[layer.pluginId]?.size(layer.params), parameters: layer.params, rotationDegrees: layer.allowRotation ? layer.rotation ?? 0 : 0, coordinateSystem: { origin, xPositive: origin.endsWith('right') ? 'left' : 'right', yPositive: origin.startsWith('bottom') ? 'up' : 'down' }, metadata: pluginMap[layer.pluginId]?.metadata?.(layer.params) ?? {} }]
  })
  const payload = { ...doc, boards }
  download(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `${doc.name || 'calibration-board'}.json`)
}
