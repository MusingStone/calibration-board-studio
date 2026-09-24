export type Transform = { angle: number; cx: number; cy: number }
export type Rect = { kind: 'rect'; x: number; y: number; width: number; height: number; fill: string; stroke?: string; strokeWidth?: number }
export type Circle = { kind: 'circle'; cx: number; cy: number; r: number; fill: string; stroke?: string; strokeWidth?: number }
export type Line = { kind: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; strokeWidth: number; dash?: number }
export type Poly = { kind: 'poly'; points: { x: number; y: number }[]; fill: string; stroke?: string; strokeWidth?: number }
export type Text = { kind: 'text'; x: number; y: number; value: string; fontSize: number; fill: string; stroke?: string; strokeWidth?: number; fontFamily?: string; fontWeight?: number }
export type Image = { kind: 'image'; x: number; y: number; width: number; height: number; href: string }
export type Primitive = (Rect | Circle | Line | Poly | Text | Image) & { transform?: Transform[] }
export type BoardChildKind = 'axes' | 'info' | 'ids'
export type BoardChild = { visible: boolean; offsetX: number; offsetY: number; scale?: number; rotation?: number; allowRotation?: boolean; label?: string; title?: string; editable?: boolean }
export type BoardLayer = { id: string; type: 'board'; name: string; visible: boolean; x: number; y: number; pluginId: string; params: Record<string, number | string>; children: Record<BoardChildKind, BoardChild>; rotation?: number; allowRotation?: boolean; collapsed?: boolean }
export type TextLayer = { id: string; type: 'text'; name: string; visible: boolean; x: number; y: number; value: string; fontSize: number; color: string; fontWeight: number }
export type ShapeLayer = { id: string; type: 'rect' | 'circle' | 'line'; name: string; visible: boolean; x: number; y: number; width: number; height: number; color: string; strokeWidth: number; fill: boolean; strokeAlignment?: 'inside' | 'center' | 'outside' }
export type ImageLayer = { id: string; type: 'image'; name: string; visible: boolean; x: number; y: number; width: number; height: number; dataUrl: string }
/** Print check line: its length is a constant, so no input can change it. */
export type ScaleLayer = { id: string; type: 'scale'; name: string; visible: boolean; x: number; y: number; color: string; strokeWidth: number }
export type Layer = BoardLayer | TextLayer | ShapeLayer | ImageLayer | ScaleLayer
export type LayoutEdge = 'left' | 'right' | 'hcenter' | 'top' | 'bottom' | 'vcenter'
/** How a dimension end is marked, and how the leader lines that anchor it are drawn. */
export type DimensionArrow = 'solid' | 'open' | 'tick' | 'dot' | 'none'
export type DimensionLeader = 'auto' | 'dashed' | 'solid' | 'stub' | 'none'
export type DimensionSpec = { id: string; targetId: string; targetEdge: LayoutEdge; referenceId: string; referenceEdge: LayoutEdge; offset: number; visible: boolean; lineWidth?: number; fontSize?: number; color?: string; arrow?: DimensionArrow; leader?: DimensionLeader }
export type DocumentModel = { version: number; name: string; width: number; height: number; layers: Layer[]; dimensions?: DimensionSpec[] }
export type Size = { width: number; height: number }
/** A coded marker or tag placed by a target, in board-local millimeters (top-left corner plus size). */
export type MarkerSpot = { id: number; x: number; y: number; size: number }
export type Field = { key: string; label: string; type: 'number' | 'select' | 'text'; min?: number; max?: number; step?: number; suffix?: string; options?: { label: string; value: string }[]; hint?: string }
export type BoardPlugin = { id: string; name: string; category: string; description: string; icon: string; fields: Field[]; defaults: Record<string, number | string>; size: (p: Record<string, number | string>) => Size; generate: (p: Record<string, number | string>) => Primitive[]; origin?: 'top-left' | 'bottom-left'; single?: boolean; markers?: (p: Record<string, number | string>) => MarkerSpot[]; annotation?: (p: Record<string, number | string>) => string; metadata?: (p: Record<string, number | string>) => Record<string, unknown>; validate?: (p: Record<string, number | string>) => string[] }
export const uid = () => Math.random().toString(36).slice(2, 10)
export const num = (p: Record<string, number | string>, key: string) => Number(p[key]) || 0
/**
 * Length of the print check line, in millimetres. It is a constant rather than
 * a layer field: the line exists to verify a print, so its length must never
 * be editable.
 */
export const SCALE_LINE_LENGTH = 100
/** Current project schema version. */
export const documentVersion = 1
