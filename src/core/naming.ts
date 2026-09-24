import type { BoardChild, BoardChildKind, DocumentModel, Layer } from './model'

/** Default display name of a board child layer, before translation. */
export const defaultChildTitle = (kind: BoardChildKind) => kind === 'axes' ? 'XY 坐标轴' : kind === 'info' ? '参数标签' : 'ID 标注'
/** User-defined child name when present, otherwise the default template name. */
export const childTitle = (child: BoardChild, kind: BoardChildKind) => child.title?.trim() || defaultChildTitle(kind)

const numbered = /^(.*\S)\s+(\d+)$/

/**
 * Return `desired` when it is free, otherwise append an increasing counter.
 * Only a trailing " 12" suffix is treated as a counter so names such as "A4" stay intact.
 */
export function uniqueName(desired: string, taken: Iterable<string>, fallback = '图层'): string {
  const used = new Set<string>()
  for (const name of taken) used.add(name.trim())
  const clean = desired.trim() || fallback
  if (!used.has(clean)) return clean
  const match = numbered.exec(clean)
  const base = match ? match[1] : clean
  let index = match ? Number(match[2]) + 1 : 2
  while (used.has(`${base} ${index}`)) index += 1
  return `${base} ${index}`
}

/** Drop a generated " 2" counter so duplicates do not stack suffixes. */
export function baseName(name: string): string {
  const match = numbered.exec(name.trim())
  return match ? match[1] : name.trim()
}

/** Rename imported layers so a hand-edited project cannot contain two layers with one name. */
export function normalizeNames(doc: DocumentModel): DocumentModel {
  const used: string[] = []
  const layers = doc.layers.map(layer => {
    const name = uniqueName(layer.name, used)
    used.push(name)
    return name === layer.name ? layer : { ...layer, name } as Layer
  })
  return { ...doc, layers }
}

/** Names of every top-level layer except the one being renamed. */
export function otherLayerNames(doc: DocumentModel, id?: string): string[] {
  return doc.layers.filter(layer => layer.id !== id).map(layer => layer.name)
}