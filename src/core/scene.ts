import type { BoardChild, BoardChildKind, BoardLayer, DocumentModel, Layer, Primitive, ScaleLayer, Size, Transform } from './model'
import { SCALE_LINE_LENGTH } from './model'

const childKinds: BoardChildKind[] = ['axes', 'info', 'ids']
import { pluginMap } from './plugins'
import { dimensionPrimitives } from './layout'

export function layerSize(layer: Layer): Size {
  if (layer.type === 'board') return pluginMap[layer.pluginId]?.size(layer.params) ?? { width: 0, height: 0 }
  if (layer.type === 'text') return { width: Math.max(10, layer.value.length * layer.fontSize * 0.58), height: layer.fontSize }
  if (layer.type === 'scale') return { width: SCALE_LINE_LENGTH, height: CHECK_LINE_BOX }
  return { width: layer.width, height: layer.height }
}
export function layerBounds(layer: Layer): { x: number; y: number; width: number; height: number } {
  const size = layerSize(layer)
  if (layer.type === 'board' && layer.allowRotation && layer.rotation) {
    const angle = layer.rotation * Math.PI / 180, c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle))
    const width = size.width * c + size.height * s, height = size.width * s + size.height * c
    return { x: layer.x + (size.width - width) / 2, y: layer.y + (size.height - height) / 2, width, height }
  }
  if (layer.type === 'text') return { x: layer.x, y: layer.y - layer.fontSize, ...size }
  if (layer.type === 'scale') return { x: layer.x, y: layer.y - CHECK_LINE_LABEL, ...size }
  if (layer.type === 'circle') {
    const extra = layer.strokeAlignment === 'inside' ? 0 : layer.strokeAlignment === 'outside' ? layer.strokeWidth : layer.strokeWidth / 2
    const diameter = Math.min(layer.width, layer.height)
    return { x: layer.x + layer.width / 2 - diameter / 2 - extra, y: layer.y + layer.height / 2 - diameter / 2 - extra, width: diameter + extra * 2, height: diameter + extra * 2 }
  }
  if (layer.type === 'rect') {
    const extra = layer.strokeAlignment === 'inside' ? 0 : layer.strokeAlignment === 'outside' ? layer.strokeWidth : layer.strokeWidth / 2
    return { x: layer.x - extra, y: layer.y - extra, width: size.width + extra * 2, height: size.height + extra * 2 }
  }
  return { x: layer.x, y: layer.y, ...size }
}
export type BoardChildBoxes = Partial<Record<BoardChildKind, ReturnType<typeof boardChildBounds>>>

export function boardOverlayPrimitives(layer: BoardLayer, childBoxes?: BoardChildBoxes): Primitive[] {
  if (!layer.visible) return []
  const plugin = pluginMap[layer.pluginId]
  if (!plugin?.origin) return []
  const boardTransform = layer.allowRotation && layer.rotation ? [{ angle: layer.rotation, cx: layer.x + plugin.size(layer.params).width / 2, cy: layer.y + plugin.size(layer.params).height / 2 }] : []
  const shapes: Primitive[] = []
  for (const kind of childKinds) {
    const child = boardChild(layer, kind)
    if (!child.visible || (kind === 'ids' && !plugin.markers)) continue
    const box = childBoxes?.[kind] ?? boardChildBounds(layer, kind)
    const childTransform = child.allowRotation && child.rotation ? [{ angle: child.rotation, cx: box.x + box.width / 2, cy: box.y + box.height / 2 }] : []
    shapes.push(...boardChildPrimitives(layer, kind, box).map(shape => withTransforms(translate(shape, layer.x, layer.y), [...childTransform, ...boardTransform])))
  }
  return shapes
}

export function layerPrimitives(layer: Layer): Primitive[] {
  if (!layer.visible) return []
  if (layer.type === 'board') {
    const plugin = pluginMap[layer.pluginId]
    if (!plugin) return []
    const boardTransform = layer.allowRotation && layer.rotation ? [{ angle: layer.rotation, cx: layer.x + plugin.size(layer.params).width / 2, cy: layer.y + plugin.size(layer.params).height / 2 }] : []
    const pattern = plugin.generate(layer.params).map(shape => withTransforms(translate(shape, layer.x, layer.y), boardTransform))
    return [...pattern, ...boardOverlayPrimitives(layer)]
  }
  if (layer.type === 'text') return [{ kind: 'text', x: layer.x, y: layer.y, value: layer.value, fontSize: layer.fontSize, fill: layer.color, fontWeight: layer.fontWeight }]
  if (layer.type === 'image') return [{ kind: 'image', x: layer.x, y: layer.y, width: layer.width, height: layer.height, href: layer.dataUrl }]
  if (layer.type === 'rect') {
    const inset = layer.strokeAlignment === 'inside' ? layer.strokeWidth / 2 : layer.strokeAlignment === 'outside' ? -layer.strokeWidth / 2 : 0
    return [{ kind: 'rect', x: layer.x + inset, y: layer.y + inset, width: Math.max(0, layer.width - inset * 2), height: Math.max(0, layer.height - inset * 2), fill: layer.fill ? layer.color : 'none', stroke: layer.color, strokeWidth: layer.strokeWidth }]
  }
  if (layer.type === 'circle') {
    const inset = layer.strokeAlignment === 'inside' ? layer.strokeWidth / 2 : layer.strokeAlignment === 'outside' ? -layer.strokeWidth / 2 : 0
    return [{ kind: 'circle', cx: layer.x + layer.width / 2, cy: layer.y + layer.height / 2, r: Math.max(0, Math.min(layer.width, layer.height) / 2 - inset), fill: layer.fill ? layer.color : 'none', stroke: layer.color, strokeWidth: layer.strokeWidth }]
  }
  if (layer.type === 'scale') return checkLinePrimitives(layer)
  return [{ kind: 'line', x1: layer.x, y1: layer.y, x2: layer.x + layer.width, y2: layer.y + layer.height, stroke: layer.color, strokeWidth: layer.strokeWidth }]
}
/** Half-height of the check line handled by the canvas, ticks and label included. */
const CHECK_LINE_TICK = 2
const CHECK_LINE_LABEL = 5
/** Bounding box height of the check line, used for hit areas, snapping, and alignment. */
export const CHECK_LINE_BOX = CHECK_LINE_LABEL + CHECK_LINE_TICK

/**
 * The print check line: a fixed 100 mm rule with end ticks and a caption. It is
 * built from the same primitives every renderer already understands, and its
 * length comes from SCALE_LINE_LENGTH rather than from the layer, so no control
 * can change it.
 */
export function checkLinePrimitives(layer: ScaleLayer): Primitive[] {
  const { x, y, color, strokeWidth } = layer
  const end = x + SCALE_LINE_LENGTH
  return [
    { kind: 'line', x1: x, y1: y, x2: end, y2: y, stroke: color, strokeWidth },
    { kind: 'line', x1: x, y1: y - CHECK_LINE_TICK, x2: x, y2: y + CHECK_LINE_TICK, stroke: color, strokeWidth },
    { kind: 'line', x1: end, y1: y - CHECK_LINE_TICK, x2: end, y2: y + CHECK_LINE_TICK, stroke: color, strokeWidth },
    { kind: 'text', x: x + SCALE_LINE_LENGTH / 2 - 17, y: y - 2.5, value: `${SCALE_LINE_LENGTH} mm   ·   PRINT AT 100%`, fontSize: 2.5, fill: color },
  ]
}

export function boardChild(layer: BoardLayer, kind: BoardChildKind): BoardChild {
  return layer.children[kind]
}
export function boardChildId(layer: BoardLayer, kind: BoardChildKind) { return `${layer.id}:${kind}` }

export function boardOriginCorner(layer: BoardLayer) {
  const plugin = pluginMap[layer.pluginId]
  const fallback = plugin?.origin === 'bottom-left' ? 'bottom-left' : 'top-left'
  // A single marker has no arrangement to pick a corner from: the Z axis option
  // pins the frame. Z out of the marker puts Y up (axes glyph at the bottom-left
  // corner), Z into the marker puts Y down (glyph at the top-left corner).
  if (plugin?.single) {
    if (layer.params.zAxis === 'out') return 'bottom-left'
    if (layer.params.zAxis === 'in') return 'top-left'
    return fallback
  }
  return String(layer.params.startCorner ?? fallback)
}

function infoLines(layer: BoardLayer): string[] {
  const plugin = pluginMap[layer.pluginId]
  const parts = (boardChild(layer, 'info').label || plugin?.annotation?.(layer.params) || plugin?.name || '').split(' · ')
  return [parts.slice(0, 2).join(' · '), parts.slice(2).join(' · ')].filter(Boolean)
}

export function boardChildBounds(layer: BoardLayer, kind: BoardChildKind): { x: number; y: number; width: number; height: number } {
  const plugin = pluginMap[layer.pluginId]
  if (!plugin) return { x: layer.x, y: layer.y, width: 0, height: 0 }
  const child = boardChild(layer, kind)
  const size = plugin.size(layer.params)
  const corner = boardOriginCorner(layer)
  const bottom = corner.startsWith('bottom'), right = corner.endsWith('right')
  const scale = child.scale || 1
  if (kind === 'axes') {
    // Anchor the axes to the origin corner: the glyph sits just outside the pattern
    // on the extension of its diagonal, so the arrows point into the pattern from
    // that corner instead of floating beside the edge. At 10 mm the arrows and
    // labels stay outside the pattern; only the invisible hit box tucks into the
    // corner, and the canvas lets the pattern keep those clicks.
    const alongX = right ? size.width : -size.width
    const alongY = bottom ? size.height : -size.height
    const length = Math.hypot(alongX, alongY) || 1
    const distance = 10 * scale
    return {
      x: layer.x + (right ? size.width : 0) + alongX / length * distance - (right ? 13.5 : 1.5) * scale + child.offsetX,
      y: layer.y + (bottom ? size.height : 0) + alongY / length * distance - (bottom ? 12.5 : 1.5) * scale + child.offsetY,
      width: 15 * scale, height: 15 * scale,
    }
  }
  if (kind === 'ids') {
    const spots = plugin.markers?.(layer.params) ?? []
    if (!spots.length) return { x: layer.x, y: layer.y, width: 0, height: 0 }
    const left = Math.min(...spots.map(spot => spot.x)), top = Math.min(...spots.map(spot => spot.y))
    const right = Math.max(...spots.map(spot => spot.x + spot.size)), bottom = Math.max(...spots.map(spot => spot.y + spot.size))
    return { x: layer.x + left + child.offsetX, y: layer.y + top + child.offsetY, width: (right - left) * scale, height: (bottom - top) * scale }
  }
  const lines = infoLines(layer)
  const width = Math.max(...lines.map(line => line.length * 1.65), 10)
  return {
    x: layer.x + (right ? 0 : Math.max(20, size.width - width * scale)) + child.offsetX,
    y: layer.y + (bottom ? size.height + 7 : -13 * scale) + child.offsetY,
    width: width * scale, height: lines.length * 4.1 * scale,
  }
}

export function boardChildPrimitives(layer: BoardLayer, kind: BoardChildKind, bounds?: ReturnType<typeof boardChildBounds>): Primitive[] {
  const plugin = pluginMap[layer.pluginId]
  if (!plugin?.origin || !boardChild(layer, kind).visible) return []
  const box = bounds ?? boardChildBounds(layer, kind)
  // Child primitives use board-local coordinates; layerPrimitives translates once.
  const x = box.x - layer.x, y = box.y - layer.y
  const scale = boardChild(layer, kind).scale || 1
  if (kind === 'info') return infoLines(layer).map((value, i) => ({ kind: 'text' as const, x, y: y + (3 + i * 4.1) * scale, value, fontSize: 2.8 * scale, fill: '#34434c', fontWeight: 600 }))
  if (kind === 'ids') {
    const child = boardChild(layer, kind)
    const spots = plugin.markers?.(layer.params) ?? []
    return spots.map(spot => {
      const value = String(spot.id)
      const fontSize = Math.min(Math.max(spot.size * 0.42, 1.6), 9) * scale
      const textWidth = value.length * fontSize * 0.62
      const centerX = spot.x + spot.size / 2 + child.offsetX
      const centerY = spot.y + spot.size / 2 + child.offsetY
      // Outlined digits read on black and white cells alike without hiding the code.
      return { kind: 'text' as const, x: centerX - textWidth / 2, y: centerY + fontSize * 0.34, value, fontSize, fill: '#e9654b', stroke: '#ffffff', strokeWidth: fontSize * 0.18, fontWeight: 700 }
    })
  }
  const corner = boardOriginCorner(layer)
  const bottom = corner.startsWith('bottom'), right = corner.endsWith('right')
  const ox = x + (right ? 13.5 : 1.5) * scale, oy = y + (bottom ? 12.5 : 1.5) * scale
  const arrowY = bottom ? 1 : -1
  const dirX = right ? -1 : 1
  const xTip = ox + 10 * scale * dirX
  const tipY = oy + (bottom ? -10 : 10) * scale
  // Both labels sit just beyond their arrow tip, centred on the arrow line.
  const fontSize = 3.1 * scale
  const glyphWidth = fontSize * 0.667
  const capHeight = fontSize * 0.72
  const gap = 0.8 * scale
  return [
    { kind: 'line', x1: ox, y1: oy, x2: xTip, y2: oy, stroke: '#d34b3e', strokeWidth: 0.46 * scale },
    { kind: 'line', x1: xTip, y1: oy, x2: xTip - 1.7 * scale * dirX, y2: oy - 0.85 * scale, stroke: '#d34b3e', strokeWidth: 0.46 * scale },
    { kind: 'line', x1: xTip, y1: oy, x2: xTip - 1.7 * scale * dirX, y2: oy + 0.85 * scale, stroke: '#d34b3e', strokeWidth: 0.46 * scale },
    { kind: 'line', x1: ox, y1: oy, x2: ox, y2: tipY, stroke: '#278354', strokeWidth: 0.46 * scale },
    { kind: 'line', x1: ox, y1: tipY, x2: ox - 0.85 * scale, y2: tipY + arrowY * 1.7 * scale, stroke: '#278354', strokeWidth: 0.46 * scale },
    { kind: 'line', x1: ox, y1: tipY, x2: ox + 0.85 * scale, y2: tipY + arrowY * 1.7 * scale, stroke: '#278354', strokeWidth: 0.46 * scale },
    { kind: 'text', x: dirX > 0 ? xTip + gap : xTip - gap - glyphWidth, y: oy + capHeight / 2, value: 'X', fontSize, fill: '#d34b3e', fontWeight: 700 },
    { kind: 'text', x: ox - glyphWidth / 2, y: bottom ? tipY - gap : tipY + gap + capHeight, value: 'Y', fontSize, fill: '#278354', fontWeight: 700 },
  ]
}
function withTransforms(p: Primitive, transforms: Transform[]): Primitive { return transforms.length ? { ...p, transform: transforms } : p }
function transformedBounds(box: { x: number; y: number; width: number; height: number }, transforms: Transform[]) {
  const corners = [{ x: box.x, y: box.y }, { x: box.x + box.width, y: box.y }, { x: box.x, y: box.y + box.height }, { x: box.x + box.width, y: box.y + box.height }]
  for (const transform of transforms) for (const corner of corners) {
    const angle = transform.angle * Math.PI / 180, dx = corner.x - transform.cx, dy = corner.y - transform.cy
    corner.x = transform.cx + dx * Math.cos(angle) - dy * Math.sin(angle)
    corner.y = transform.cy + dx * Math.sin(angle) + dy * Math.cos(angle)
  }
  const xs = corners.map(corner => corner.x), ys = corners.map(corner => corner.y)
  const x = Math.min(...xs), y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}
function translate(p: Primitive, x: number, y: number): Primitive {
  if (p.kind === 'rect' || p.kind === 'image' || p.kind === 'text') return { ...p, x: p.x + x, y: p.y + y }
  if (p.kind === 'circle') return { ...p, cx: p.cx + x, cy: p.cy + y }
  if (p.kind === 'poly') return { ...p, points: p.points.map(point => ({ x: point.x + x, y: point.y + y })) }
  return { ...p, x1: p.x1 + x, x2: p.x2 + x, y1: p.y1 + y, y2: p.y2 + y }
}
export function scene(doc: DocumentModel, dimensions = false): Primitive[] {
  const output = doc.layers.flatMap(layerPrimitives)
  if (dimensions) output.push(...dimensionPrimitives(doc))
  return output
}
export function errors(doc: DocumentModel): string[] {
  const messages: string[] = []
  if (!Number.isFinite(doc.width) || !Number.isFinite(doc.height) || doc.width <= 0 || doc.height <= 0) messages.push('页面尺寸无效。')
  for (const layer of doc.layers) {
    if (layer.type !== 'board') continue
    const plugin = pluginMap[layer.pluginId]
    if (!plugin) { messages.push(`${layer.name}：未知标定板类型。`); continue }
    for (const field of plugin.fields) {
      if (field.type === 'number') {
        const value = Number(layer.params[field.key])
        if (!Number.isFinite(value) || (field.min !== undefined && value < field.min) || (field.max !== undefined && value > field.max) || (field.step === 1 && !Number.isInteger(value))) messages.push(`${layer.name}：${field.label}超出允许范围。`)
      }
    }
    messages.push(...(plugin.validate?.(layer.params) ?? []).map(message => `${layer.name}：${message}`))
    const bounds = layerBounds(layer)
    if (bounds.x < 0 || bounds.y < 0 || bounds.x + bounds.width > doc.width + 0.001 || bounds.y + bounds.height > doc.height + 0.001) messages.push(`${layer.name}：标定板超出页面范围。`)
    if (layer.visible && plugin.origin) for (const kind of childKinds) {
      const child = boardChild(layer, kind)
      if (!child.visible || (kind === 'ids' && !plugin.markers)) continue
      const childBox = boardChildBounds(layer, kind)
      const transforms: Transform[] = []
      if (child.allowRotation && child.rotation) transforms.push({ angle: child.rotation, cx: childBox.x + childBox.width / 2, cy: childBox.y + childBox.height / 2 })
      if (layer.allowRotation && layer.rotation) transforms.push({ angle: layer.rotation, cx: layer.x + plugin.size(layer.params).width / 2, cy: layer.y + plugin.size(layer.params).height / 2 })
      const box = transformedBounds(childBox, transforms)
      if (box.x < 0 || box.y < 0 || box.x + box.width > doc.width + 0.001 || box.y + box.height > doc.height + 0.001) messages.push(`${layer.name}：${kind === 'axes' ? 'XY 坐标轴' : '参数标签'}超出页面范围。`)
    }
  }
  return messages
}
export function fitPosition(size: Size, page: Size): { x: number; y: number } {
  return { x: Math.max(0, Math.round((page.width - size.width) / 2 * 10) / 10), y: Math.max(0, Math.round((page.height - size.height) / 2 * 10) / 10) }
}
/**
 * Square size for the board a new project starts with: seven squares span about
 * half of the short side, which reproduces the shipped 15 mm on an A4 sheet,
 * keeps a tiny page usable (the axes and the parameter label need room too), and
 * lets a multi-metre floor page start with a board worth printing.
 */
/** Top-left spot a new project puts its title in, with a margin that suits the page. */
export function starterTitlePosition(pageWidth: number, pageHeight: number): { x: number; y: number } {
  const margin = Math.min(20, Math.max(2, Math.min(pageWidth, pageHeight) * 0.05))
  return { x: Math.round(margin * 10) / 10, y: Math.round((margin + 2) * 10) / 10 }
}
export function starterSquareSize(pageWidth: number, pageHeight: number): number {
  const byWidth = Math.floor((pageWidth - 20) / 7)
  const byHeight = Math.floor((pageHeight - 45) / 10)
  const cap = Math.min(100, Math.max(15, Math.floor(Math.min(pageWidth, pageHeight) / 14)))
  return Math.max(0.5, Math.min(cap, byWidth, byHeight))
}
