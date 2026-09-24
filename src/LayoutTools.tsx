import { useEffect, useState } from 'react'
import { AlignCenter, AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical, Plus } from 'lucide-react'
import type { DimensionSpec, DocumentModel, Layer, LayoutEdge } from './core/model'
import { uid } from './core/model'
import { alignLayer, dimensionInkDefaults, edgeCoordinate, edgeLabels, horizontalEdges, verticalEdges } from './core/layout'
import { layerBounds } from './core/scene'
import { translateTree } from './i18n'
import type { Language } from './i18n'

const quickAlign: { edge: LayoutEdge; title: string; icon: typeof AlignStartVertical }[] = [
  { edge: 'left', title: '左对齐', icon: AlignStartVertical },
  { edge: 'hcenter', title: '水平居中', icon: AlignCenterVertical },
  { edge: 'right', title: '右对齐', icon: AlignEndVertical },
  { edge: 'top', title: '上对齐', icon: AlignStartHorizontal },
  { edge: 'vcenter', title: '垂直居中', icon: AlignCenterHorizontal },
  { edge: 'bottom', title: '下对齐', icon: AlignEndHorizontal },
]

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return <label className="field"><span className="field-label">{label}</span><span className="input-wrap"><input type="number" step="0.1" value={Number.isFinite(value) ? +value.toFixed(1) : 0} onChange={e => onChange(Number(e.target.value))}/><span className="unit">mm</span></span></label>
}

export default function LayoutTools({ language, doc, target, select, move, addDimension }: {
  language: Language
  doc: DocumentModel
  target: Layer | null
  select: (id: string) => void
  move: (id: string, position: Partial<Pick<Layer, 'x' | 'y'>>) => void
  addDimension: (dimension: DimensionSpec) => void
}) {
  const [referenceId, setReferenceId] = useState('page')
  const [alignRef, setAlignRef] = useState('page')
  const [axis, setAxis] = useState<'x' | 'y'>('x')
  const [targetEdge, setTargetEdge] = useState<LayoutEdge>('left')
  const [referenceEdge, setReferenceEdge] = useState<LayoutEdge>('left')
  const [distance, setDistance] = useState(0)
  const reference = doc.layers.find(l => l.id === referenceId) ?? null
  const alignReference = doc.layers.find(l => l.id === alignRef) ?? null
  const edges = axis === 'x' ? horizontalEdges : verticalEdges
  useEffect(() => { setTargetEdge(axis === 'x' ? 'left' : 'top'); setReferenceEdge(axis === 'x' ? 'left' : 'top') }, [axis])
  useEffect(() => { if (target) setDistance(+(edgeCoordinate(target, targetEdge, doc) - edgeCoordinate(reference, referenceEdge, doc)).toFixed(1)) }, [doc, target?.id, referenceId, targetEdge, referenceEdge])
  const bounds = target ? layerBounds(target) : null
  const setPosition = (position: Partial<Pick<Layer, 'x' | 'y'>>) => { if (target) move(target.id, position) }
  function applyAlign(edge: LayoutEdge) { if (target) move(target.id, alignLayer(doc, target, edge, alignReference, edge, 0)) }
  function centerOnPage() {
    if (!target) return
    move(target.id, { ...alignLayer(doc, target, 'hcenter', null, 'hcenter', 0), ...alignLayer(doc, target, 'vcenter', null, 'vcenter', 0) })
  }
  return translateTree(<div className="layout-tools">
    <p className="panel-hint">按毫米对齐图层边缘：先选择当前图层，再使用下面的对齐参照与距离工具。</p>
    <div className="layout-section"><label className="field"><span className="field-label">当前图层</span><select value={target?.id ?? ''} onChange={e => select(e.target.value)}><option value="">选择图层</option>{doc.layers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label></div>
    {target && bounds && <>
      <div className="layout-section"><strong className="layout-title">快速对齐</strong>
        <label className="field"><span className="field-label">对齐参照</span><select value={alignRef} onChange={e => setAlignRef(e.target.value)}><option value="page">纸张</option>{doc.layers.filter(l => l.id !== target.id).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <div className="align-grid">{quickAlign.map(item => <button key={item.edge} title={item.title} onClick={() => applyAlign(item.edge)}><item.icon size={16}/></button>)}</div>
        <div className="layout-actions"><button className="apply" onClick={centerOnPage}><AlignCenter size={15}/> 居中于纸张</button></div>
        <p className="hint-copy">在画布上拖动时会自动吸附到图层边缘、纸张中心与等距位置；这里用于一步精确落到参照边缘。</p>
      </div>
      <div className="layout-section"><strong className="layout-title">纸张对齐</strong>
        <div className="layout-actions"><button onClick={() => setPosition({ x: target.x + (doc.width / 2 - bounds.x - bounds.width / 2) })}><AlignCenter size={15}/> 水平居中</button><button onClick={() => setPosition({ y: target.y + (doc.height / 2 - bounds.y - bounds.height / 2) })}><AlignCenterVertical size={15}/> 垂直居中</button></div>
        <div className="two-fields"><NumberField label="距左纸边" value={bounds.x} onChange={x => setPosition({ x: target.x + x - bounds.x })}/><NumberField label="距右纸边" value={doc.width - bounds.x - bounds.width} onChange={n => setPosition({ x: target.x + doc.width - bounds.x - bounds.width - n })}/><NumberField label="距上纸边" value={bounds.y} onChange={y => setPosition({ y: target.y + y - bounds.y })}/><NumberField label="距下纸边" value={doc.height - bounds.y - bounds.height} onChange={n => setPosition({ y: target.y + doc.height - bounds.y - bounds.height - n })}/></div>
      </div>
      <div className="layout-section"><strong className="layout-title">边到边距离</strong>
        <label className="field"><span className="field-label">参照对象</span><select value={referenceId} onChange={e => setReferenceId(e.target.value)}><option value="page">纸张</option>{doc.layers.filter(l => l.id !== target.id).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <div className="axis-tabs"><button className={axis === 'x' ? 'active' : ''} onClick={() => setAxis('x')}>水平 X</button><button className={axis === 'y' ? 'active' : ''} onClick={() => setAxis('y')}>垂直 Y</button></div>
        <div className="two-fields"><label className="field"><span className="field-label">当前图层的边</span><select value={targetEdge} onChange={e => setTargetEdge(e.target.value as LayoutEdge)}>{edges.map(e => <option key={e} value={e}>{edgeLabels[e]}</option>)}</select></label><label className="field"><span className="field-label">参照对象的边</span><select value={referenceEdge} onChange={e => setReferenceEdge(e.target.value as LayoutEdge)}>{edges.map(e => <option key={e} value={e}>{edgeLabels[e]}</option>)}</select></label></div>
        <NumberField label="指定距离（允许负值）" value={distance} onChange={setDistance}/>
        <div className="layout-actions"><button className="apply" onClick={() => setPosition(alignLayer(doc, target, targetEdge, reference, referenceEdge, distance))}>按距离定位</button><button onClick={() => addDimension({ id: uid(), targetId: target.id, targetEdge, referenceId, referenceEdge, offset: 8, visible: true, ...dimensionInkDefaults })}><Plus size={14}/> 添加尺寸线</button></div>
      </div>
    </>}
  </div>, language)
}
