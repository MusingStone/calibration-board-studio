import type { DimensionArrow, DimensionLeader, DimensionSpec, DocumentModel, Layer, LayoutEdge, Primitive } from './model'
import { layerBounds } from './scene'

export const horizontalEdges: LayoutEdge[] = ['left', 'hcenter', 'right']
export const verticalEdges: LayoutEdge[] = ['top', 'vcenter', 'bottom']

export const edgeLabels: Record<LayoutEdge, string> = { left: '左边', hcenter: '水平中心', right: '右边', top: '上边', vcenter: '垂直中心', bottom: '下边' }

export type Point = { x: number; y: number }
export type Bounds = { x: number; y: number; width: number; height: number }
/** A picked edge: a layer edge, a layer center line, or the paper border (`page`). */
export type EdgePick = { layerId: string; edge: LayoutEdge }
export type EdgeSegment = EdgePick & { priority: number; x1: number; y1: number; x2: number; y2: number }
export type DimensionChange = { x?: number; y?: number; width?: number; height?: number }

export function edgeCoordinate(layer: Layer | null, edge: LayoutEdge, doc: DocumentModel): number {
  const bounds = layer ? layerBounds(layer) : { x: 0, y: 0, width: doc.width, height: doc.height }
  if (edge === 'left') return bounds.x
  if (edge === 'hcenter') return bounds.x + bounds.width / 2
  if (edge === 'right') return bounds.x + bounds.width
  if (edge === 'top') return bounds.y
  if (edge === 'vcenter') return bounds.y + bounds.height / 2
  return bounds.y + bounds.height
}

export function alignLayer(doc: DocumentModel, target: Layer, targetEdge: LayoutEdge, reference: Layer | null, referenceEdge: LayoutEdge, distance: number) {
  const referenceCoordinate = edgeCoordinate(reference, referenceEdge, doc)
  const targetCoordinate = edgeCoordinate(target, targetEdge, doc)
  const axis = horizontalEdges.includes(targetEdge) ? 'x' : 'y'
  return { [axis]: Math.round(((axis === 'x' ? target.x : target.y) + referenceCoordinate + distance - targetCoordinate) * 10) / 10 }
}

/** Dimensions measured along x are drawn as horizontal lines, and vice versa. */
export const dimensionAxis = (edge: LayoutEdge): 'x' | 'y' => horizontalEdges.includes(edge) ? 'x' : 'y'

export function dimensionTarget(doc: DocumentModel, dimension: DimensionSpec) { return doc.layers.find(layer => layer.id === dimension.targetId) ?? null }
export function dimensionReference(doc: DocumentModel, dimension: DimensionSpec) { return dimension.referenceId === 'page' ? null : doc.layers.find(layer => layer.id === dimension.referenceId) ?? null }
/** A dimension only renders while both of its objects exist and are visible. */
export function dimensionResolvable(doc: DocumentModel, dimension: DimensionSpec): boolean {
  const target = dimensionTarget(doc, dimension)
  const reference = dimensionReference(doc, dimension)
  if (!target || !target.visible) return false
  if (dimension.referenceId !== 'page' && (!reference || !reference.visible)) return false
  return true
}

/** True when typing a value can move or resize the measured object. */
export function dimensionDriven(doc: DocumentModel, dimension: DimensionSpec): boolean {
  const target = dimensionTarget(doc, dimension)
  if (!target) return false
  if (dimension.targetId !== dimension.referenceId) return true
  return dimension.targetEdge !== dimension.referenceEdge && (target.type === 'rect' || target.type === 'circle' || target.type === 'line' || target.type === 'image')
}

/** Signed distance the dimension currently measures, in millimeters. */
export function dimensionDistance(doc: DocumentModel, dimension: DimensionSpec): number {
  const target = dimensionTarget(doc, dimension)
  if (!target) return 0
  return edgeCoordinate(target, dimension.targetEdge, doc) - edgeCoordinate(dimensionReference(doc, dimension), dimension.referenceEdge, doc)
}

/**
 * Where the dimension line sits: `line` is the coordinate on the perpendicular
 * axis, `base` is the measured object's edge it was offset from.
 */
export function dimensionPlacement(doc: DocumentModel, dimension: DimensionSpec) {
  const axis = dimensionAxis(dimension.targetEdge)
  const target = dimensionTarget(doc, dimension)
  const reference = dimensionReference(doc, dimension)
  const targetBounds = target ? layerBounds(target) : { x: 0, y: 0, width: doc.width, height: doc.height }
  const referenceOuter = reference
    ? (axis === 'x' ? layerBounds(reference).y + layerBounds(reference).height : layerBounds(reference).x + layerBounds(reference).width)
    : 0
  const base = axis === 'x'
    ? Math.max(targetBounds.y + targetBounds.height, referenceOuter)
    : Math.max(targetBounds.x + targetBounds.width, referenceOuter)
  const limit = axis === 'x' ? doc.height : doc.width
  const margin = Math.min(6, limit / 2)
  return { axis, base, limit, line: Math.max(margin, Math.min(limit - margin, base + dimension.offset)) }
}

/** Offset that puts the dimension line at `pointer`, clamped so the line stays on the paper. */
export function dimensionOffset(doc: DocumentModel, dimension: DimensionSpec, pointer: number): number {
  const { base, limit } = dimensionPlacement(doc, dimension)
  const margin = Math.min(6, limit / 2)
  return Math.round((Math.max(margin, Math.min(limit - margin, pointer)) - base) * 10) / 10
}

/** Fit the displayed value on the paper when it is smaller than the chosen font. */
function dimensionDisplayFontSize(doc: DocumentModel, dimension: DimensionSpec): number {
  const wanted = dimensionStyle(dimension).fontSize
  const length = dimensionValue(doc, dimension).length
  return Math.min(wanted, Math.max(0.05, (doc.width - 0.4) / (length * 0.62)), Math.max(0.05, doc.height - 0.4))
}

/** Anchor of the dimension text, used for the inline value editor. */
export function dimensionLabelPoint(doc: DocumentModel, dimension: DimensionSpec): Point {
  const target = dimensionTarget(doc, dimension)
  const start = target ? edgeCoordinate(target, dimension.targetEdge, doc) : 0
  const end = edgeCoordinate(dimensionReference(doc, dimension), dimension.referenceEdge, doc)
  const { axis, line } = dimensionPlacement(doc, dimension)
  const fontSize = dimensionDisplayFontSize(doc, dimension)
  const width = dimensionValue(doc, dimension).length * fontSize * 0.62
  const clamp = (position: number, extent: number, limit: number) => Math.max(0.2, Math.min(limit - extent - 0.2, position))
  const baseline = (position: number) => Math.max(fontSize * 0.85, Math.min(doc.height - Math.max(0.2, fontSize * 0.25), position))
  if (axis === 'x') return { x: clamp((start + end - width) / 2, width, doc.width), y: baseline(line - fontSize * 0.4) }
  const right = line + fontSize * 0.4
  const x = right + width <= doc.width - 0.2 ? right : line - fontSize * 0.4 - width
  return { x: clamp(x, width, doc.width), y: baseline((start + end) / 2 + fontSize * 0.36) }
}

/**
 * Position (or size) change that makes the dimension measure `value`. Dimensions
 * inside one layer resize it when the layer supports width and height. Their
 * measurements use visible bounds, including any outward stroke.
 */
export function dimensionChange(doc: DocumentModel, dimension: DimensionSpec, value: number): DimensionChange {
  const target = dimensionTarget(doc, dimension)
  if (!target) return {}
  const rounded = Math.round(value * 100) / 100
  if (dimension.targetId === dimension.referenceId) {
    const axis = dimensionAxis(dimension.targetEdge)
    const role = (edge: LayoutEdge) => edge === 'left' || edge === 'top' ? 0 : edge === 'hcenter' || edge === 'vcenter' ? 0.5 : 1
    const span = role(dimension.targetEdge) - role(dimension.referenceEdge)
    if (!span || !Number.isFinite(rounded)) return {}
    const measuredExtent = rounded / span
    if (target.type === 'line') {
      // Vertical line segments may point upward; horizontal widths are stored
      // nonnegative by the project format.
      if (Math.abs(measuredExtent) < 0.1 || (axis === 'x' && measuredExtent < 0)) return {}
      return axis === 'x' ? { width: measuredExtent } : { height: measuredExtent }
    }
    if (target.type !== 'rect' && target.type !== 'circle' && target.type !== 'image') return {}
    const strokeExtra = target.type === 'image' || target.strokeAlignment === 'inside' ? 0
      : target.strokeAlignment === 'outside' ? target.strokeWidth : target.strokeWidth / 2
    const size = measuredExtent - strokeExtra * 2
    if (!Number.isFinite(size) || size < 0.1) return {}
    if (target.type === 'circle') return { width: size, height: size }
    return axis === 'x' ? { width: size } : { height: size }
  }
  // The sign picks the side: positive keeps the target to the right or below the
  // reference, negative puts it to the left or above.
  const distance = rounded
  return alignLayer(doc, target, dimension.targetEdge, dimensionReference(doc, dimension), dimension.referenceEdge, distance)
}

const pageEdges: { edge: LayoutEdge; from: [number, number]; to: [number, number] }[] = [
  { edge: 'left', from: [0, 0], to: [0, 1] }, { edge: 'right', from: [1, 0], to: [1, 1] },
  { edge: 'top', from: [0, 0], to: [1, 0] }, { edge: 'bottom', from: [0, 1], to: [1, 1] },
  { edge: 'hcenter', from: [0.5, 0], to: [0.5, 1] }, { edge: 'vcenter', from: [0, 0.5], to: [1, 0.5] },
]

/** Every pickable edge: layer borders, layer center lines, and the paper border. */
export function dimensionEdgeSegments(doc: DocumentModel): EdgeSegment[] {
  const segments: EdgeSegment[] = pageEdges.map(({ edge, from, to }) => ({
    layerId: 'page', edge, priority: edge === 'hcenter' || edge === 'vcenter' ? 3 : 2,
    x1: from[0] * doc.width, y1: from[1] * doc.height, x2: to[0] * doc.width, y2: to[1] * doc.height,
  }))
  for (const layer of doc.layers) {
    if (!layer.visible) continue
    const bounds = layerBounds(layer)
    const left = bounds.x, right = bounds.x + bounds.width, top = bounds.y, bottom = bounds.y + bounds.height
    segments.push(
      { layerId: layer.id, edge: 'left', priority: 0, x1: left, y1: top, x2: left, y2: bottom },
      { layerId: layer.id, edge: 'right', priority: 0, x1: right, y1: top, x2: right, y2: bottom },
      { layerId: layer.id, edge: 'top', priority: 0, x1: left, y1: top, x2: right, y2: top },
      { layerId: layer.id, edge: 'bottom', priority: 0, x1: left, y1: bottom, x2: right, y2: bottom },
      { layerId: layer.id, edge: 'hcenter', priority: 1, x1: (left + right) / 2, y1: top, x2: (left + right) / 2, y2: bottom },
      { layerId: layer.id, edge: 'vcenter', priority: 1, x1: left, y1: (top + bottom) / 2, x2: right, y2: (top + bottom) / 2 },
    )
  }
  return segments
}

export function dimensionEdgeSegment(doc: DocumentModel, pick: EdgePick): EdgeSegment | null {
  return dimensionEdgeSegments(doc).find(segment => segment.layerId === pick.layerId && segment.edge === pick.edge) ?? null
}

function pointSegmentDistance(point: Point, segment: EdgeSegment): number {
  const dx = segment.x2 - segment.x1, dy = segment.y2 - segment.y1
  const length = dx * dx + dy * dy
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - segment.x1) * dx + (point.y - segment.y1) * dy) / length))
  return Math.hypot(point.x - (segment.x1 + t * dx), point.y - (segment.y1 + t * dy))
}

/** Closest pickable edge within `tolerance` millimeters; layer edges win ties. */
export function pickDimensionEdge(doc: DocumentModel, point: Point, tolerance: number): EdgePick | null {
  let best: { pick: EdgePick; distance: number; priority: number } | null = null
  for (const segment of dimensionEdgeSegments(doc)) {
    const distance = pointSegmentDistance(point, segment)
    if (distance > tolerance) continue
    if (!best || distance < best.distance - 1e-9 || (Math.abs(distance - best.distance) <= 1e-9 && segment.priority < best.priority)) {
      best = { pick: { layerId: segment.layerId, edge: segment.edge }, distance, priority: segment.priority }
    }
  }
  return best?.pick ?? null
}

/** Human readable description of what a dimension measures, used in lists and notices. */
export function dimensionLabel(doc: DocumentModel, dimension: DimensionSpec): string {
  const nameOf = (id: string) => id === 'page' ? '纸张' : doc.layers.find(layer => layer.id === id)?.name ?? '图层'
  return `${nameOf(dimension.targetId)} · ${edgeLabels[dimension.targetEdge]} ↔ ${nameOf(dimension.referenceId)} · ${edgeLabels[dimension.referenceEdge]}`
}

/**
 * Other dimensions whose measured value would change when `dimension` is driven to
 * `value`. Dimensions are measured from the geometry, so moving the object of one
 * dimension moves what the others read: the caller can use this to raise a conflict
 * instead of changing them silently.
 */
export function dimensionConflicts(doc: DocumentModel, dimension: DimensionSpec, value: number): { id: string; label: string; before: number; after: number }[] {
  const change = dimensionChange(doc, dimension, value)
  if (!Object.keys(change).length) return []
  const next: DocumentModel = { ...doc, layers: doc.layers.map(layer => layer.id === dimension.targetId ? { ...layer, ...change } as Layer : layer) }
  const conflicts: { id: string; label: string; before: number; after: number }[] = []
  for (const other of doc.dimensions ?? []) {
    if (other.id === dimension.id || !other.visible || !dimensionResolvable(doc, other)) continue
    const before = dimensionDistance(doc, other)
    const after = dimensionDistance(next, other)
    if (Math.abs(after - before) > 0.05) conflicts.push({ id: other.id, label: dimensionLabel(doc, other), before: Math.round(before * 10) / 10, after: Math.round(after * 10) / 10 })
  }
  return conflicts
}

export type DimensionShift = { id: string; x?: number; y?: number; width?: number; height?: number }
export type DimensionPlan = { changes: DimensionShift[]; conflicts: { id: string; label: string; before: number; after: number }[] }

const round2 = (n: number) => Math.round(n * 100) / 100

/** Dimensions whose measured value drifts when `next` replaces `doc`. */
function driftOf(doc: DocumentModel, next: DocumentModel, editedId: string, value: number) {
  const drifted: { id: string; label: string; before: number; after: number }[] = []
  for (const dimension of doc.dimensions ?? []) {
    if (!dimension.visible || !dimensionResolvable(doc, dimension)) continue
    const before = dimensionDistance(doc, dimension)
    const after = dimensionDistance(next, dimension)
    const expected = dimension.id === editedId ? value : before
    if (Math.abs(after - expected) > 0.05) drifted.push({ id: dimension.id, label: dimensionLabel(doc, dimension), before: Math.round(before * 10) / 10, after: Math.round(after * 10) / 10 })
  }
  return drifted
}

const withLayers = (doc: DocumentModel, changes: DimensionShift[]): DocumentModel => ({
  ...doc,
  layers: doc.layers.map(layer => {
    const change = changes.find(item => item.id === layer.id)
    return change ? { ...layer, ...change } as Layer : layer
  }),
})

/**
 * Resolve a value edit across the whole drawing instead of moving one object.
 *
 * Dimensions read the geometry, so moving the object of one dimension usually moves
 * what the others measure. Two layers that an existing dimension ties together have
 * to keep the same relative offset, so they form a group that can move together; the
 * edited dimension then decides how far the group travels. A dimension inside one
 * layer resizes it, and the layer is translated to keep the edges other dimensions
 * read in place. Only when no such arrangement exists does the edit become a conflict.
 * `value` is a magnitude: the side the dimension currently sits on is preserved.
 */
export function solveDimensionValue(doc: DocumentModel, dimension: DimensionSpec, value: number): DimensionPlan {
  const target = dimensionTarget(doc, dimension)
  if (!target) return { changes: [], conflicts: [] }
  const axis = dimensionAxis(dimension.targetEdge)
  const axisKey = axis === 'x' ? 'x' : 'y'
  const current = dimensionDistance(doc, dimension)
  const wanted = value
  const others = (doc.dimensions ?? []).filter(other =>
    other.id !== dimension.id && other.visible && dimensionResolvable(doc, other) && dimensionAxis(other.targetEdge) === axis)

  // Inside one layer: resize it, then shift it so the edges the other dimensions use stay put.
  if (dimension.targetId === dimension.referenceId) {
    const resize = dimensionChange(doc, dimension, value)
    if (!Object.keys(resize).length) return { changes: [], conflicts: dimensionConflicts(doc, dimension, value) }
    const sizeKey = axis === 'x' ? 'width' : 'height'
    const sizeDelta = Number((resize as Record<string, number>)[sizeKey] ?? 0) - Number((target as unknown as Record<string, number>)[sizeKey] ?? 0)
    const shifts = new Set<number>()
    for (const other of others) {
      const edge = other.targetId === target.id ? other.targetEdge : other.referenceEdge
      const role = edge === 'left' || edge === 'top' ? 0 : edge === 'hcenter' || edge === 'vcenter' ? 0.5 : 1
      shifts.add(round2(-role * sizeDelta))
    }
    if (shifts.size > 1) return { changes: [], conflicts: driftOf(doc, withLayers(doc, [{ id: target.id, ...resize }]), dimension.id, value) }
    const shift = shifts.size ? [...shifts][0] : 0
    const changes: DimensionShift[] = [{ id: target.id, ...resize, [axisKey]: round2((axis === 'x' ? target.x : target.y) + shift) }]
    const conflicts = driftOf(doc, withLayers(doc, changes), dimension.id, value)
    return conflicts.length ? { changes: [], conflicts } : { changes, conflicts: [] }
  }

  const delta = round2(wanted - current)
  if (Math.abs(delta) < 1e-9) return { changes: [], conflicts: [] }

  // Layers tied by an existing dimension (or to the fixed page) must travel together.
  const parent = new Map<string, string>()
  const find = (id: string): string => {
    const up = parent.get(id)
    if (!up || up === id) { parent.set(id, id); return id }
    const root = find(up)
    parent.set(id, root)
    return root
  }
  const union = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb) }
  for (const other of others) if (other.targetId !== other.referenceId) union(other.targetId, other.referenceId)

  const pageRoot = find('page')
  const targetRoot = find(target.id)
  const referenceRoot = dimension.referenceId === 'page' ? pageRoot : find(dimension.referenceId)
  if (targetRoot === referenceRoot) return { changes: [], conflicts: dimensionConflicts(doc, dimension, value) }

  // p[target] - p[reference] = delta, with the page pinned at zero: the target's group
  // travels when it is free to, otherwise the reference's group takes the other way.
  const targetPinned = targetRoot === pageRoot
  const moveRoot = targetPinned ? referenceRoot : targetRoot
  const shift = targetPinned ? -delta : delta
  const changes: DimensionShift[] = doc.layers
    .filter(layer => find(layer.id) === moveRoot)
    .map(layer => axis === 'x' ? { id: layer.id, x: round2(layer.x + shift) } : { id: layer.id, y: round2(layer.y + shift) })
  const conflicts = driftOf(doc, withLayers(doc, changes), dimension.id, value)
  return conflicts.length ? { changes: [], conflicts } : { changes, conflicts: [] }
}

/** Editable limits of a dimension's ink, shared by the renderer and the inspector. */
export const dimensionLimits = {
  lineWidth: { min: 0.05, max: 2, step: 0.01, fallback: 0.5 },
  fontSize: { min: 1, max: 12, step: 0.1, fallback: 5 },
} as const

/** Ink a freshly created dimension starts with. */
export const dimensionInk = '#4d86a5'
export const dimensionInkDefaults = { lineWidth: dimensionLimits.lineWidth.fallback, fontSize: dimensionLimits.fontSize.fallback, color: dimensionInk }

const clamp = (value: number | undefined, limit: { min: number; max: number; fallback: number }) =>
  Math.min(Math.max(Number.isFinite(value) ? (value as number) : limit.fallback, limit.min), limit.max)

/** Line thickness, value font size, and ink of one dimension. */
export function dimensionStyle(dimension: DimensionSpec) {
  return { lineWidth: clamp(dimension.lineWidth, dimensionLimits.lineWidth), fontSize: clamp(dimension.fontSize, dimensionLimits.fontSize), color: /^#[0-9a-fA-F]{6}$/.test(dimension.color ?? '') ? dimension.color as string : dimensionInk }
}

export const dimensionValue = (doc: DocumentModel, dimension: DimensionSpec) => `${Math.abs(dimensionDistance(doc, dimension)).toFixed(1)} mm`

/** Dash length of the extension lines that show where a dimension is anchored. */
export const dimensionLeaderDash = 1.2
/** Arrowheads and leaders are chosen per dimension; these are the choices the inspector offers. */
export const dimensionArrowStyles: DimensionArrow[] = ['solid', 'open', 'tick', 'dot', 'none']
export const dimensionLeaderStyles: DimensionLeader[] = ['auto', 'dashed', 'solid', 'stub', 'none']
/** A leader longer than this is broken into two stubs by the automatic style. */
export const dimensionLeaderMax = 30
/** Length of each stub when a leader is broken or hidden beyond its ends. */
export const dimensionLeaderStub = 5

/** Arrow size scales with the line thickness so a heavy dimension keeps its weight. */
const arrowLength = (lineWidth: number) => Math.max(3, lineWidth * 6)
const arrowHalf = (lineWidth: number) => Math.max(0.9, lineWidth * 1.8)

/**
 * Mark the end of a dimension line at `tip` pointing along `direction` (-1 or 1
 * on the axis). When the measured span is too short for two arrows inside it,
 * the caller asks for an outside arrow: the tip stays on the edge and the head
 * sits beyond it.
 */
function arrowHead(tip: number, cross: number, direction: 1 | -1, lineWidth: number, along: 'x' | 'y', style: DimensionArrow, ink: string, alongLimit: number, crossLimit: number): Primitive[] {
  if (style === 'none') return []
  const clearance = lineWidth / 2
  const alongRoom = direction === 1 ? alongLimit - tip : tip
  const crossRoom = Math.min(cross, crossLimit - cross)
  const length = Math.min(arrowLength(lineWidth), alongRoom - clearance) * direction
  const half = Math.min(arrowHalf(lineWidth), crossRoom - clearance)
  if (alongRoom <= clearance || crossRoom <= clearance) return []
  const base = tip + length
  if (style === 'dot') {
    const r = Math.min(Math.max(0.7, lineWidth * 1.4), tip - clearance, alongLimit - tip - clearance, crossRoom - clearance)
    if (r <= 0) return []
    return along === 'x' ? [{ kind: 'circle', cx: tip, cy: cross, r, fill: ink }] : [{ kind: 'circle', cx: cross, cy: tip, r, fill: ink }]
  }
  if (style === 'tick') {
    // Architectural slash through the dimension line, sized with the arrow.
    const reach = Math.min(Math.max(1.2, arrowHalf(lineWidth) * 1.6), tip - clearance, alongLimit - tip - clearance, crossRoom - clearance)
    if (reach <= 0) return []
    return along === 'x'
      ? [{ kind: 'line', x1: tip - reach, y1: cross + reach, x2: tip + reach, y2: cross - reach, stroke: ink, strokeWidth: lineWidth }]
      : [{ kind: 'line', x1: cross + reach, y1: tip - reach, x2: cross - reach, y2: tip + reach, stroke: ink, strokeWidth: lineWidth }]
  }
  const points = along === 'x'
    ? [{ x: tip, y: cross }, { x: base, y: cross - half }, { x: base, y: cross + half }]
    : [{ x: cross, y: tip }, { x: cross - half, y: base }, { x: cross + half, y: base }]
  if (style === 'open') {
    // Open arrow: the same outline drawn as two strokes, no fill.
    return along === 'x'
      ? [{ kind: 'line', x1: tip, y1: cross, x2: base, y2: cross - half, stroke: ink, strokeWidth: lineWidth }, { kind: 'line', x1: tip, y1: cross, x2: base, y2: cross + half, stroke: ink, strokeWidth: lineWidth }]
      : [{ kind: 'line', x1: cross, y1: tip, x2: cross - half, y2: base, stroke: ink, strokeWidth: lineWidth }, { kind: 'line', x1: cross, y1: tip, x2: cross + half, y2: base, stroke: ink, strokeWidth: lineWidth }]
  }
  return [{ kind: 'poly', points, fill: ink }]
}

/**
 * Leader line from an object edge to the dimension line. The anchor is the side
 * that faces the line, so a dimension pulled above an object does not draw a
 * leader through it, and a leader that would run far across the page is broken
 * into a stub at each end instead of one long dashed line.
 */
function leaderLine(from: number, to: number, cross: number, along: 'x' | 'y', style: DimensionLeader, ink: string, lineWidth: number, limit: number): Primitive[] {
  if (style === 'none') return []
  const gap = 1, overshoot = 2
  const span = to - from
  const start = from + Math.sign(span) * gap
  const end = to + Math.sign(span) * overshoot
  const withinPage = (value: number) => Math.max(lineWidth / 2, Math.min(limit - lineWidth / 2, value))
  const line = (a: number, b: number, dash: number | undefined): Primitive => along === 'x'
    ? { kind: 'line', x1: cross, y1: withinPage(a), x2: cross, y2: withinPage(b), stroke: ink, strokeWidth: lineWidth, dash }
    : { kind: 'line', x1: withinPage(a), y1: cross, x2: withinPage(b), y2: cross, stroke: ink, strokeWidth: lineWidth, dash }
  const dash = style === 'solid' ? undefined : dimensionLeaderDash
  const stub = Math.min(dimensionLeaderStub, Math.abs(end - start) / 2)
  const broken = style === 'stub' || (style === 'auto' && Math.abs(end - start) > dimensionLeaderMax)
  if (!broken) return [line(start, end, dash)]
  // A stub at the object and another at the dimension line keep both ends readable.
  return [line(start, start + Math.sign(span) * stub, dash), line(end, end - Math.sign(span) * stub, dash)]
}

export function dimensionPrimitives(doc: DocumentModel): Primitive[] {
  const result: Primitive[] = []
  for (const d of doc.dimensions ?? []) {
    if (!d.visible || !dimensionResolvable(doc, d)) continue
    const target = dimensionTarget(doc, d) as Layer
    const a = edgeCoordinate(target, d.targetEdge, doc), b = edgeCoordinate(dimensionReference(doc, d), d.referenceEdge, doc)
    const horizontal = dimensionAxis(d.targetEdge) === 'x'
    const { line } = dimensionPlacement(doc, d)
    const { lineWidth, color: ink } = dimensionStyle(d)
    const fine = Math.min(lineWidth, doc.width / 2, doc.height / 2)
    const fontSize = dimensionDisplayFontSize(doc, d)
    const arrow = d.arrow ?? 'solid'
    const leader = d.leader ?? 'auto'
    const label = dimensionLabelPoint(doc, d)
    // Normally each tip sits on its edge with the tail inside the span, so the
    // direction depends on which edge comes first along the axis. A span too
    // short for two arrows flips them outside.
    const outward = Math.abs(b - a) < arrowLength(fine) * 2 + 1
    const inward: 1 | -1 = b >= a ? 1 : -1
    const startDirection: 1 | -1 = outward ? (inward === 1 ? -1 : 1) : inward
    const endDirection: 1 | -1 = outward ? inward : (inward === 1 ? -1 : 1)
    const alongLimit = horizontal ? doc.width : doc.height
    const onPaper = (value: number) => Math.max(fine / 2, Math.min(alongLimit - fine / 2, value))
    const tipA = onPaper(a), tipB = onPaper(b)
    const targetBox = layerBounds(target)
    const referenceBox = d.referenceId === 'page' ? null : layerBounds(dimensionReference(doc, d) as Layer)
    // The leader starts on the side of the object that faces the dimension line.
    const before = horizontal ? targetBox.y : targetBox.x
    const after = horizontal ? targetBox.y + targetBox.height : targetBox.x + targetBox.width
    const referenceAnchor = horizontal
      ? (referenceBox ? (line >= referenceBox.y + referenceBox.height ? referenceBox.y + referenceBox.height : line >= referenceBox.y ? line : referenceBox.y) : (line >= after ? after : before))
      : (referenceBox ? (line >= referenceBox.x + referenceBox.width ? referenceBox.x + referenceBox.width : line >= referenceBox.x ? line : referenceBox.x) : (line >= after ? after : before))
    const targetAnchor = line >= after ? after : line <= before ? before : line
    if (horizontal) {
      result.push(
        ...leaderLine(targetAnchor, line, tipA, 'x', leader, ink, fine, doc.height),
        ...leaderLine(referenceAnchor, line, tipB, 'x', leader, ink, fine, doc.height),
        { kind: 'line', x1: tipA, y1: line, x2: tipB, y2: line, stroke: ink, strokeWidth: fine },
        ...arrowHead(tipA, line, startDirection, fine, 'x', arrow, ink, doc.width, doc.height),
        ...arrowHead(tipB, line, endDirection, fine, 'x', arrow, ink, doc.width, doc.height),
        { kind: 'text', x: label.x, y: label.y, value: dimensionValue(doc, d), fontSize, fill: ink },
      )
    } else {
      result.push(
        ...leaderLine(targetAnchor, line, tipA, 'y', leader, ink, fine, doc.width),
        ...leaderLine(referenceAnchor, line, tipB, 'y', leader, ink, fine, doc.width),
        { kind: 'line', x1: line, y1: tipA, x2: line, y2: tipB, stroke: ink, strokeWidth: fine },
        ...arrowHead(tipA, line, startDirection, fine, 'y', arrow, ink, doc.height, doc.width),
        ...arrowHead(tipB, line, endDirection, fine, 'y', arrow, ink, doc.height, doc.width),
        { kind: 'text', x: label.x, y: label.y, value: dimensionValue(doc, d), fontSize, fill: ink },
      )
    }
  }
  return result
}
