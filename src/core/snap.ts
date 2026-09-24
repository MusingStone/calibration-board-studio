import type { Size } from './model'

export type Box = { x: number; y: number; width: number; height: number }
/** Inference relations, ordered by strength when several snaps are equally close. */
export type SnapKind = 'spacing' | 'layer' | 'page' | 'grid'
export type SnapGuide = {
  orientation: 'vertical' | 'horizontal'
  /** Coordinate on the perpendicular axis, in millimeters. */
  at: number
  /** Extent of the guide along its own direction, in millimeters. */
  start: number
  end: number
  kind: SnapKind
  label?: string
  /** Draw end ticks, used for measured gaps. */
  ticks?: boolean
}
export type SnapTarget = { id: string; name: string; box: Box }
export type SnapSettings = { threshold: number; grid?: number; page?: boolean; layers?: boolean; spacing?: boolean }
export type SnapResult = { dx: number; dy: number; hasX: boolean; hasY: boolean; guides: SnapGuide[]; relations: string[] }

type Axis = 'x' | 'y'
type Interval = { id: string; name: string; start: number; end: number; crossStart: number; crossEnd: number }
type Candidate = { delta: number; rank: number; guides: SnapGuide[]; relation?: string }

const EPS = 1e-6
const GUIDE_PAD = 2
const round1 = (n: number) => Math.round(n * 10) / 10

/** Screen-independent snap distance: roughly `pixels` on screen, clamped to a sane millimeter range. */
export const snapThreshold = (mmPerPixel: number, pixels = 9) => Math.min(3, Math.max(0.35, pixels * mmPerPixel))

function intervalOf(box: Box, axis: Axis, id = '', name = ''): Interval {
  return axis === 'x'
    ? { id, name, start: box.x, end: box.x + box.width, crossStart: box.y, crossEnd: box.y + box.height }
    : { id, name, start: box.y, end: box.y + box.height, crossStart: box.x, crossEnd: box.x + box.width }
}
function shifted(interval: Interval, delta: number): Interval { return { ...interval, start: interval.start + delta, end: interval.end + delta } }
function crossOverlap(a: Interval, b: Interval) { return Math.min(a.crossEnd, b.crossEnd) - Math.max(a.crossStart, b.crossStart) }
function crossMiddle(a: Interval, b: Interval) { return (Math.max(a.crossStart, b.crossStart) + Math.min(a.crossEnd, b.crossEnd)) / 2 }

function alignmentGuide(axis: Axis, at: number, moving: Interval, reference: Interval, kind: SnapKind, pad = GUIDE_PAD): SnapGuide {
  return {
    orientation: axis === 'x' ? 'vertical' : 'horizontal',
    at,
    start: Math.min(moving.crossStart, reference.crossStart) - pad,
    end: Math.max(moving.crossEnd, reference.crossEnd) + pad,
    kind,
  }
}
function gapGuide(axis: Axis, at: number, start: number, end: number, label: string): SnapGuide {
  return { orientation: axis === 'x' ? 'horizontal' : 'vertical', at, start, end, kind: 'spacing', label, ticks: true }
}
function roleLabel(axis: Axis, role: number) {
  if (role === 1) return axis === 'x' ? '水平中心' : '垂直中心'
  if (axis === 'x') return role === 0 ? '左边' : '右边'
  return role === 0 ? '上边' : '下边'
}

function solveAxis(axis: Axis, box: Box, page: Size, targets: SnapTarget[], settings: SnapSettings) {
  const moving = intervalOf(box, axis)
  const entries = targets.map(target => intervalOf(target.box, axis, target.id, target.name))
  const candidates: Candidate[] = []
  const limit = Math.max(0, settings.threshold)
  const consider = (delta: number, rank: number, guides: SnapGuide[], relation?: string) => {
    if (Math.abs(delta) <= limit + EPS) candidates.push({ delta, rank, guides, relation })
  }
  const size = moving.end - moving.start
  const movingValues = [moving.start, moving.start + size / 2, moving.end]

  if (settings.page !== false) {
    const pageInterval = intervalOf({ x: 0, y: 0, width: page.width, height: page.height }, axis)
    const pageValues = [pageInterval.start, (pageInterval.start + pageInterval.end) / 2, pageInterval.end]
    for (let m = 0; m < 3; m += 1) for (let r = 0; r < 3; r += 1) {
      const delta = pageValues[r] - movingValues[m]
      const snapped = shifted(moving, delta)
      consider(delta, m === 1 && r === 1 ? 3 : 4, [alignmentGuide(axis, pageValues[r], snapped, pageInterval, 'page', 0)], m === 1 && r === 1 ? '页面居中' : undefined)
    }
  }

  if (settings.layers !== false) for (const entry of entries) {
    const values = [entry.start, (entry.start + entry.end) / 2, entry.end]
    for (let m = 0; m < 3; m += 1) for (let r = 0; r < 3; r += 1) {
      const delta = values[r] - movingValues[m]
      const snapped = shifted(moving, delta)
      const aligned = m === r
      consider(delta, aligned ? 1 : 2, [alignmentGuide(axis, values[r], snapped, entry, 'layer')],
        aligned ? `与「${entry.name}」${roleLabel(axis, r)}对齐` : `与「${entry.name}」${roleLabel(axis, r)}贴边`)
    }
  }

  if (settings.spacing !== false) {
    const band = entries.filter(entry => crossOverlap(entry, moving) > 0.01)
    const before = band.filter(entry => entry.end <= moving.start + EPS)
    const after = band.filter(entry => entry.start >= moving.end - EPS)
    // Two neighbours: place the layer so both gaps match.
    for (const a of before) for (const b of after) {
      if (b.start - a.end < size - EPS) continue
      const start = (a.end + b.start) / 2 - size / 2
      const at = crossMiddle(a, moving)
      const label = `${round1(start - a.end)} mm`
      consider(start - moving.start, 0, [gapGuide(axis, at, a.end, start, label), gapGuide(axis, at, start + size, b.start, label)], '等距')
    }
    // Continue an existing rhythm: the same gap as an adjacent pair.
    const sorted = [...band].sort((p, q) => p.start - q.start)
    for (let i = 0; i + 1 < sorted.length; i += 1) {
      const a = sorted[i], b = sorted[i + 1]
      const gap = b.start - a.end
      if (gap <= 0.01 || crossOverlap(a, b) <= 0.01) continue
      const at = crossMiddle(a, b)
      const reference = gapGuide(axis, at, a.end, b.start, `${round1(gap)} mm`)
      if (moving.start >= b.end - EPS) {
        const start = b.end + gap
        consider(start - moving.start, 0, [reference, gapGuide(axis, at, b.end, start, reference.label ?? '')], '等距')
      } else if (moving.end <= a.start + EPS) {
        const start = a.start - gap - size
        consider(start - moving.start, 0, [reference, gapGuide(axis, at, start, a.start, reference.label ?? '')], '等距')
      }
    }
  }

  const grid = settings.grid && settings.grid > 0 ? settings.grid : 0
  if (grid) consider(Math.round(moving.start / grid) * grid - moving.start, 5, [], `网格 ${round1(grid)} mm`)

  if (!candidates.length) return { delta: 0, guides: [] as SnapGuide[], relation: undefined, snapped: false }
  // An inferred relation always wins over the background grid; within the same
  // class the closest candidate wins, and rank breaks ties.
  const tier = (candidate: Candidate) => candidate.rank === 5 ? 1 : 0
  candidates.sort((p, q) => tier(p) - tier(q) || Math.abs(p.delta) - Math.abs(q.delta) || p.rank - q.rank)
  const best = candidates[0]
  return { delta: best.delta, guides: best.guides, relation: best.relation, snapped: true }
}

/**
 * Sketch-style inference for a dragged box: alignment with the page and other
 * layers, equal spacing between neighbours, a continued spacing rhythm, and a
 * background grid. Returns the correction to apply plus the guides to draw.
 */
export function snapMove(box: Box, page: Size, targets: SnapTarget[], settings: SnapSettings): SnapResult {
  const horizontal = solveAxis('x', box, page, targets, settings)
  const vertical = solveAxis('y', box, page, targets, settings)
  const relations = [horizontal.relation, vertical.relation].filter((value): value is string => !!value)
  return { dx: horizontal.delta, dy: vertical.delta, hasX: horizontal.snapped, hasY: vertical.snapped, guides: [...horizontal.guides, ...vertical.guides], relations }
}
