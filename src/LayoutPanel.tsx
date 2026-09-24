import { useState } from 'react'
import { Eye, EyeOff, Trash2 } from 'lucide-react'
import type { DimensionSpec, DocumentModel, Layer } from './core/model'
import { dimensionDistance, edgeLabels } from './core/layout'
import LayoutTools from './LayoutTools'
import { translateTree } from './i18n'
import type { Language } from './i18n'

export default function LayoutPanel({ language, doc, target, selectedDimensionId, dimensionTool, onOpenAlignment, select, selectDimension, move, addDimension, updateDimension, removeDimension }: {
  language: Language
  doc: DocumentModel
  target: Layer | null
  selectedDimensionId: string | null
  dimensionTool: boolean
  onOpenAlignment: () => void
  select: (id: string) => void
  selectDimension: (id: string | null) => void
  move: (id: string, position: Partial<Pick<Layer, 'x' | 'y'>>) => void
  addDimension: (dimension: DimensionSpec) => void
  updateDimension: (id: string, change: Partial<DimensionSpec>) => void
  removeDimension: (id: string) => void
}) {
  // Two sub-menus: the drawing dimensions come first, alignment sits behind the second.
  const [panel, setPanel] = useState<'dimensions' | 'tools'>('dimensions')
  const dimensions = doc.dimensions ?? []
  return translateTree(<div className="sidebar-scroll layout-panel">
    <div className="layout-sub-tabs">
      <button className={panel === 'dimensions' ? 'active' : ''} onClick={() => setPanel('dimensions')}>工程图尺寸线{dimensions.length > 0 && <span className="count-chip">{dimensions.length}</span>}</button>
      <button className={panel === 'tools' ? 'active' : ''} onClick={() => { setPanel('tools'); onOpenAlignment() }}>对齐工具</button>
    </div>
    {panel === 'dimensions' ? <>
      <p className="panel-hint">{dimensionTool ? '尺寸工具已开启：在画布上依次点击同一方向的两条边生成尺寸线；已有尺寸线仍可选中、双击或拖动。' : '尺寸工具已关闭。需要添加尺寸线时，请点击画布工具栏的标尺按钮；已有尺寸线仍可选中和编辑。'}</p>
      <div className="layout-section">
        {dimensions.length === 0 ? <p className="layout-empty">尚未添加尺寸线</p> : dimensions.map(d => <div key={d.id} className={`dimension-item${selectedDimensionId === d.id ? ' active' : ''}`}>
          <button className="dimension-pick" title="选中后在右侧属性栏编辑" onClick={() => selectDimension(selectedDimensionId === d.id ? null : d.id)}>{`${doc.layers.find(l => l.id === d.targetId)?.name ?? '图层'} · ${edgeLabels[d.targetEdge]} ↔ ${d.referenceId === 'page' ? '纸张' : doc.layers.find(l => l.id === d.referenceId)?.name ?? '图层'} · ${edgeLabels[d.referenceEdge]}`}</button>
          <strong className="dimension-value">{`${dimensionDistance(doc, d).toFixed(1)} mm`}</strong>
          <button title="显示或隐藏" onClick={() => updateDimension(d.id, { visible: !d.visible })}>{d.visible ? <Eye size={14}/> : <EyeOff size={14}/>}</button>
          <button title="删除尺寸线" onClick={() => { removeDimension(d.id); if (selectedDimensionId === d.id) selectDimension(null) }}><Trash2 size={14}/></button>
        </div>)}
      </div>
    </> : <LayoutTools language={language} doc={doc} target={target} select={select} move={move} addDimension={addDimension}/>}
  </div>, language)
}
