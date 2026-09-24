import type { DocumentModel } from './model'
import { documentVersion } from './model'
import { pluginMap } from './plugins'
import { PAGE_MAX, PAGE_MIN } from './paper'

const finite = (value: unknown, min = -10000, max = 10000) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const horizontalEdges = new Set(['left', 'hcenter', 'right'])
const verticalEdges = new Set(['top', 'vcenter', 'bottom'])

export function isDocumentModel(data: unknown): data is DocumentModel {
  if (!record(data) || data.version !== documentVersion || typeof data.name !== 'string' || data.name.length > 200 || !finite(data.width, PAGE_MIN, PAGE_MAX) || !finite(data.height, PAGE_MIN, PAGE_MAX) || !Array.isArray(data.layers) || data.layers.length > 200) return false
  const ids = new Set<string>()
  for (const layer of data.layers) {
    if (!record(layer) || typeof layer.id !== 'string' || !layer.id || layer.id === 'page' || ids.has(layer.id) || typeof layer.name !== 'string' || layer.name.length > 200 || typeof layer.visible !== 'boolean' || !finite(layer.x, -PAGE_MAX, PAGE_MAX) || !finite(layer.y, -PAGE_MAX, PAGE_MAX)) return false
    ids.add(layer.id)
    if (layer.type === 'board') {
      if (typeof layer.pluginId !== 'string' || !pluginMap[layer.pluginId] || !record(layer.params)) return false
      for (const field of pluginMap[layer.pluginId].fields) {
        const value = layer.params[field.key]
        if (field.type === 'number' && !finite(value, -1000, 1000)) return false
        if (field.type === 'text' && (typeof value !== 'string' || value.length > 10000)) return false
        if (field.type === 'select' && (typeof value !== 'string' || !field.options?.some(option => option.value === value))) return false
      }
      if (finite(layer.params.rows, 0, 1000) && finite(layer.params.columns, 0, 1000) && Number(layer.params.rows) * Number(layer.params.columns) > 5000) return false
      if (!record(layer.children)) return false
      for (const kind of ['axes', 'info', 'ids']) {
        const child = layer.children[kind]
        if (!record(child) || typeof child.visible !== 'boolean' || !finite(child.offsetX) || !finite(child.offsetY) || (child.scale !== undefined && !finite(child.scale, 0.1, 10)) || (child.rotation !== undefined && !finite(child.rotation, -3600, 3600)) || (child.label !== undefined && (typeof child.label !== 'string' || child.label.length > 1000)) || (child.title !== undefined && (typeof child.title !== 'string' || child.title.length > 200))) return false
      }
      if (layer.rotation !== undefined && !finite(layer.rotation, -3600, 3600)) return false
      if (layer.collapsed !== undefined && typeof layer.collapsed !== 'boolean') return false
    } else if (layer.type === 'text') {
      if (typeof layer.value !== 'string' || layer.value.length > 10000 || !finite(layer.fontSize, 0.1, 100) || typeof layer.color !== 'string' || !finite(layer.fontWeight, 100, 900)) return false
    } else if (layer.type === 'rect' || layer.type === 'circle' || layer.type === 'line') {
      if (!finite(layer.width, 0, PAGE_MAX) || !finite(layer.height, -PAGE_MAX, PAGE_MAX) || !finite(layer.strokeWidth, 0, 100) || typeof layer.color !== 'string' || typeof layer.fill !== 'boolean') return false
    } else if (layer.type === 'scale') {
      // The print check line is 100 mm by definition: the file carries no length.
      if (!finite(layer.strokeWidth, 0, 100) || typeof layer.color !== 'string') return false
    } else if (layer.type === 'image') {
      if (!finite(layer.width, 0, PAGE_MAX) || !finite(layer.height, 0, PAGE_MAX) || typeof layer.dataUrl !== 'string' || layer.dataUrl.length > 30_000_000 || !/^data:image\/(png|jpeg);base64,/.test(layer.dataUrl)) return false
    } else return false
  }
  if (data.dimensions !== undefined) {
    if (!Array.isArray(data.dimensions) || data.dimensions.length > 200) return false
    const dimensionIds = new Set<string>()
    for (const d of data.dimensions) {
      if (!record(d) || typeof d.id !== 'string' || !d.id || dimensionIds.has(d.id)) return false
      if (typeof d.targetId !== 'string' || !ids.has(d.targetId) || typeof d.referenceId !== 'string' || (d.referenceId !== 'page' && !ids.has(d.referenceId))) return false
      if (typeof d.targetEdge !== 'string' || typeof d.referenceEdge !== 'string') return false
      if (!((horizontalEdges.has(d.targetEdge) && horizontalEdges.has(d.referenceEdge)) || (verticalEdges.has(d.targetEdge) && verticalEdges.has(d.referenceEdge)))) return false
      if (!finite(d.offset) || typeof d.visible !== 'boolean') return false
      if (d.lineWidth !== undefined && !finite(d.lineWidth, 0.01, 5)) return false
      if (d.fontSize !== undefined && !finite(d.fontSize, 0.5, 30)) return false
      if (d.color !== undefined && (typeof d.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(d.color))) return false
      if (d.arrow !== undefined && !['solid', 'open', 'tick', 'dot', 'none'].includes(String(d.arrow))) return false
      if (d.leader !== undefined && !['auto', 'dashed', 'solid', 'stub', 'none'].includes(String(d.leader))) return false
      dimensionIds.add(d.id)
    }
  }
  return true
}
