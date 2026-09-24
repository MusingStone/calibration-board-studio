import { useEffect, useState } from 'react'
import { ArrowLeftRight, Eye, EyeOff, Ruler, Trash2 } from 'lucide-react'
import type { DimensionArrow, DimensionLeader, DimensionSpec, DocumentModel, LayoutEdge } from './core/model'
import { dimensionArrowStyles, dimensionDistance, dimensionDriven, dimensionLeaderStyles, dimensionLimits, dimensionStyle, edgeLabels, horizontalEdges, verticalEdges } from './core/layout'
import { translateTree } from './i18n'
import type { Language } from './i18n'

/** Number field that keeps a local draft and commits on blur or Enter. */
function CommitNumberField({ label, value, onCommit, min, max, step = 0.1 }: { label: string; value: number; onCommit: (value: number) => void; min?: number; max?: number; step?: number }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => { setDraft(String(value)) }, [value])
  function commit() {
    const parsed = Number(draft)
    if (Number.isFinite(parsed) && Math.abs(parsed - value) > 0.0001) onCommit(parsed)
    else setDraft(String(value))
  }
  return <label className="field"><span className="field-label">{label}</span><span className="input-wrap"><input type="number" step={step} min={min} max={max} value={draft} onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => {
    if (event.key === 'Enter') event.currentTarget.blur()
    else if (event.key === 'Escape') { setDraft(String(value)); event.currentTarget.blur() }
  }}/><span className="unit">mm</span></span></label>
}

function SectionTitle({ children }: { children: React.ReactNode }) { return <div className="section-title"><span>{children}</span></div> }

const clampStyle = (value: number, limit: { min: number; max: number }) => Math.min(Math.max(value, limit.min), limit.max)

/** Labels for the two style pickers; the interface language translates them. */
const arrowLabels: Record<DimensionArrow, string> = { solid: '实心箭头', open: '开口箭头', tick: '建筑斜线', dot: '圆点', none: '无箭头' }
const leaderLabels: Record<DimensionLeader, string> = { auto: '自适应（过长时断开）', dashed: '虚线', solid: '细实线', stub: '只画两端短线', none: '不画引线' }

export type DimensionConflict = { id: string; value: number; items: { id: string; label: string; before: number; after: number }[] }

export default function DimensionInspector({ language, doc, dimension, onChange, onValue, onOffset, onDelete, conflict, onResolveConflict }: {
  language: Language
  doc: DocumentModel
  dimension: DimensionSpec
  onChange: (change: Partial<DimensionSpec>) => void
  onValue: (value: number) => void
  onOffset: (offset: number) => void
  onDelete: () => void
  conflict?: DimensionConflict | null
  onResolveConflict: (apply: boolean) => void
}) {
  const nameOf = (id: string) => id === 'page' ? '纸张' : doc.layers.find(layer => layer.id === id)?.name ?? '图层'
  const driven = dimensionDriven(doc, dimension)
  const style = dimensionStyle(dimension)
  const edgesFor = (edge: LayoutEdge) => horizontalEdges.includes(edge) ? horizontalEdges : verticalEdges
  return translateTree(<div className="dimension-inspector">
    <div className="selected-layer-summary">
      <span className="summary-icon"><Ruler size={20}/></span>
      <div><strong>尺寸线</strong><small>{`${nameOf(dimension.targetId)} · ${edgeLabels[dimension.targetEdge]} ↔ ${nameOf(dimension.referenceId)} · ${edgeLabels[dimension.referenceEdge]}`}</small></div>
      <div className="summary-actions">
        <button title="显示或隐藏" onClick={() => onChange({ visible: !dimension.visible })}>{dimension.visible ? <Eye size={15}/> : <EyeOff size={15}/>}</button>
        <button title="删除尺寸线" onClick={onDelete}><Trash2 size={15}/></button>
      </div>
    </div>
    <div className="inspector-section">
      <div className="section-title"><span>尺寸数值</span><span className="precision-tag">{driven ? '可驱动' : '仅测量'}</span></div>
      <div className="field-stack">
        <CommitNumberField label="测量值（输入后被测对象移动）" value={Math.round(dimensionDistance(doc, dimension) * 10) / 10} onCommit={onValue}/>
        {dimension.targetId !== dimension.referenceId && <button className="flip-dimension" onClick={() => onValue(-Math.round(dimensionDistance(doc, dimension) * 10) / 10)}><ArrowLeftRight size={13}/> 换到另一侧</button>}
        <CommitNumberField label="尺寸线位置（相对几何的偏移）" value={dimension.offset} onCommit={onOffset}/>
        <CommitNumberField label="线条粗细" value={style.lineWidth} min={dimensionLimits.lineWidth.min} max={dimensionLimits.lineWidth.max} step={dimensionLimits.lineWidth.step} onCommit={value => onChange({ lineWidth: clampStyle(value, dimensionLimits.lineWidth) })}/>
        <CommitNumberField label="数值字号" value={style.fontSize} min={dimensionLimits.fontSize.min} max={dimensionLimits.fontSize.max} step={dimensionLimits.fontSize.step} onCommit={value => onChange({ fontSize: clampStyle(value, dimensionLimits.fontSize) })}/>
        <label className="field"><span className="field-label">尺寸线颜色</span><input type="color" value={style.color} onChange={event => onChange({ color: event.target.value })}/></label>
        <label className="field"><span className="field-label">箭头样式</span><select value={dimension.arrow ?? 'solid'} onChange={event => onChange({ arrow: event.target.value as DimensionArrow })}>{dimensionArrowStyles.map(option => <option key={option} value={option}>{arrowLabels[option]}</option>)}</select></label>
        <label className="field"><span className="field-label">引线样式</span><select value={dimension.leader ?? 'auto'} onChange={event => onChange({ leader: event.target.value as DimensionLeader })}>{dimensionLeaderStyles.map(option => <option key={option} value={option}>{leaderLabels[option]}</option>)}</select></label>
        <label className="checkbox-row"><input type="checkbox" checked={dimension.visible} onChange={event => onChange({ visible: event.target.checked })}/> 在画布中显示</label>
      </div>
      {conflict && <div className="conflict-block">
        <strong>与其他尺寸冲突</strong>
        <p>{`没有能同时满足其他尺寸的解法，这次修改会让 ${conflict.items.length} 条已有尺寸变化：`}</p>
        <ul>{conflict.items.map(item => <li key={item.id}>{`${item.label}：${item.before} → ${item.after} mm`}</li>)}</ul>
        <div className="conflict-actions"><button className="apply" onClick={() => onResolveConflict(true)}>仍然修改</button><button onClick={() => onResolveConflict(false)}>取消</button></div>
      </div>}
      <p className="hint-copy">正负号表示被测边在参照边的哪一侧：正值为右侧／下方，负值为左侧／上方，输入负值即可换到另一侧；也可以在画布上双击尺寸线输入，或直接拖动尺寸线调整位置。</p>
    </div>
    <div className="inspector-section">
      <SectionTitle>标注对象</SectionTitle>
      <div className="field-stack">
        <label className="field"><span className="field-label">被测对象（输入数值时移动）</span><select value={dimension.targetId} onChange={event => onChange({ targetId: event.target.value })}>{doc.layers.map(layer => <option key={layer.id} value={layer.id}>{layer.name}</option>)}</select></label>
        <label className="field"><span className="field-label">被测边</span><select value={dimension.targetEdge} onChange={event => onChange({ targetEdge: event.target.value as LayoutEdge })}>{edgesFor(dimension.targetEdge).map(edge => <option key={edge} value={edge}>{edgeLabels[edge]}</option>)}</select></label>
        <label className="field"><span className="field-label">参照对象（保持不动）</span><select value={dimension.referenceId} onChange={event => onChange({ referenceId: event.target.value })}><option value="page">纸张</option>{doc.layers.map(layer => <option key={layer.id} value={layer.id}>{layer.name}</option>)}</select></label>
        <label className="field"><span className="field-label">参照边</span><select value={dimension.referenceEdge} onChange={event => onChange({ referenceEdge: event.target.value as LayoutEdge })}>{edgesFor(dimension.referenceEdge).map(edge => <option key={edge} value={edge}>{edgeLabels[edge]}</option>)}</select></label>
      </div>
      <p className="hint-copy">在画布上用尺寸工具点击两条边同样可以生成尺寸线；标注同一个图形自身的宽或高时，矩形、圆形、直线与图片会按数值改变尺寸。</p>
    </div>
  </div>, language)
}
