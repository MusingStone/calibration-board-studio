import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Circle as CircleIcon, Eye, EyeOff, Grid2X2, ImagePlus, LockKeyhole, Minus, Pencil, Ruler, Square, Type } from 'lucide-react'
import type { BoardChildKind, BoardLayer, DocumentModel, Layer } from './core/model'
import { SCALE_LINE_LENGTH } from './core/model'
import { childTitle } from './core/naming'
import { pluginMap } from './core/plugins'
import { boardChild, boardChildId } from './core/scene'
import { translateTree } from './i18n'
import type { Language } from './i18n'

const childKinds: BoardChildKind[] = ['axes', 'info', 'ids']
/** The ID overlay only exists for targets that carry coded markers. */
const childExists = (layer: BoardLayer, kind: BoardChildKind) => kind !== 'ids' || !!pluginMap[layer.pluginId]?.markers
const childHint = (kind: BoardChildKind) => kind === 'axes' ? '等长坐标轴' : kind === 'info' ? '板型与尺寸' : '逐个标记的编号'

/** Layer types the add row offers, laid out three per row so the labels fit. */
const addActions = [
  { key: 'text', label: '文字', icon: Type },
  { key: 'rect', label: '矩形', icon: Square },
  { key: 'circle', label: '圆形', icon: CircleIcon },
  { key: 'line', label: '直线', icon: Minus },
  { key: 'scale', label: '校验线', icon: Ruler, title: '100 mm 打印校验线' },
  { key: 'image', label: '图片', icon: ImagePlus },
] as { key: 'text' | 'rect' | 'circle' | 'line' | 'scale' | 'image'; label: string; icon: typeof Type; title?: string }[]
function layerGlyph(layer: Layer) {
  if (layer.type === 'board') return <Grid2X2 size={16}/>
  if (layer.type === 'text') return <Type size={16}/>
  if (layer.type === 'image') return <ImagePlus size={16}/>
  if (layer.type === 'circle') return <CircleIcon size={16}/>
  if (layer.type === 'scale') return <Ruler size={16}/>
  return <Square size={16}/>
}
function layerKind(layer: Layer) {
  if (layer.type === 'board') return pluginMap[layer.pluginId]?.name ?? '标定板'
  if (layer.type === 'text') return '文字图层'
  if (layer.type === 'image') return '图片图层'
  if (layer.type === 'scale') return `${SCALE_LINE_LENGTH} mm 校验线`
  return '形状图层'
}

export default function LayerPanel({ language, doc, selected, onSelect, onToggleCollapse, onToggleAll, onToggleVisible, onToggleChildVisible, onMove, onRename, onRenameChild, onAdd, onUpload }: {
  language: Language
  doc: DocumentModel
  selected: string | null
  onSelect: (id: string) => void
  onToggleCollapse: (id: string) => void
  onToggleAll: (collapsed: boolean) => void
  onToggleVisible: (id: string) => void
  onToggleChildVisible: (boardId: string, kind: BoardChildKind) => void
  onMove: (id: string, direction: -1 | 1) => void
  onRename: (id: string, name: string) => void
  onRenameChild: (boardId: string, kind: BoardChildKind, name: string) => void
  onAdd: (type: 'text' | 'rect' | 'circle' | 'line' | 'scale') => void
  onUpload: () => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!editing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editing])
  function startEdit(id: string, value: string) { setEditing(id); setDraft(value) }
  function commit() {
    if (!editing) return
    const [boardId, kind] = editing.split(':')
    if (kind === 'axes' || kind === 'info' || kind === 'ids') onRenameChild(boardId, kind, draft)
    else onRename(editing, draft)
    setEditing(null)
  }
  function editor() {
    return <input
      ref={inputRef}
      className="name-input"
      value={draft}
      onClick={event => event.stopPropagation()}
      onDoubleClick={event => event.stopPropagation()}
      onChange={event => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); commit() }
        else if (event.key === 'Escape') { event.preventDefault(); setEditing(null) }
      }}
    />
  }
  const boards = doc.layers.filter(layer => layer.type === 'board')
  const anyExpanded = boards.some(layer => !layer.collapsed)
  return translateTree(<div className="sidebar-scroll layer-panel">
    <div className="side-intro"><span className="eyebrow">LAYERS</span><h2>图层结构</h2><p>标定板保持精确尺寸；装饰层可以自由移动与编辑。拖动时会自动吸附对齐，双击名称即可重命名。</p></div>
    <div className="add-layer-row">
      {addActions.map(action => <button key={action.key} title={action.title ?? action.label} onClick={() => action.key === 'image' ? onUpload() : onAdd(action.key)}>
        <action.icon size={15}/><span>{action.label}</span>
      </button>)}
    </div>
    <div className="layer-list-head">
      <span>{`${doc.layers.length} 个图层`}</span>
      {boards.length > 0 && <button className="layer-fold-all" onClick={() => onToggleAll(anyExpanded)}>{anyExpanded ? <ChevronRight size={12}/> : <ChevronDown size={12}/>}{anyExpanded ? '全部折叠' : '全部展开'}</button>}
    </div>
    <div className="layer-list">
      {[...doc.layers].reverse().map(layer => <div className="layer-row" key={layer.id}>
        <div className={`layer-item ${selected === layer.id ? 'active' : ''}`} onClick={() => onSelect(layer.id)}>
          {layer.type === 'board'
            ? <button className="layer-caret" title={layer.collapsed ? '展开子图层' : '折叠子图层'} onClick={event => { event.stopPropagation(); onToggleCollapse(layer.id) }}>{layer.collapsed ? <ChevronRight size={14}/> : <ChevronDown size={14}/>}</button>
            : <span className="layer-caret empty"/>}
          <div className={`layer-glyph ${layer.type === 'board' ? 'board' : ''}`}>{layerGlyph(layer)}</div>
          <div className="layer-name" onDoubleClick={event => { event.stopPropagation(); startEdit(layer.id, layer.name) }}>
            {editing === layer.id ? editor() : <><strong title={layer.name}>{layer.name}</strong><small>{layerKind(layer)}</small></>}
          </div>
          {layer.type === 'board' && <LockKeyhole size={13} className="layer-lock"/>}
          <div className="layer-tray">
            <button className="layer-order" title="重命名图层" onClick={event => { event.stopPropagation(); startEdit(layer.id, layer.name) }}><Pencil size={12}/></button>
            <button className="layer-order" title="上移图层" onClick={event => { event.stopPropagation(); onMove(layer.id, 1) }}><ArrowUp size={13}/></button>
            <button className="layer-order" title="下移图层" onClick={event => { event.stopPropagation(); onMove(layer.id, -1) }}><ArrowDown size={13}/></button>
          </div>
          <button className="layer-eye" title={layer.visible ? '隐藏图层' : '显示图层'} onClick={event => { event.stopPropagation(); onToggleVisible(layer.id) }}>{layer.visible ? <Eye size={16}/> : <EyeOff size={16}/>}</button>
        </div>
        {layer.type === 'board' && !layer.collapsed && <div className="board-children">
          {childKinds.filter(kind => childExists(layer, kind)).map(kind => <div key={kind} className={`layer-item child-item ${selected === boardChildId(layer, kind) ? 'active' : ''}`} onClick={() => onSelect(boardChildId(layer, kind))}>
            <span className="child-branch"/>
            <span className="child-glyph">{kind === 'axes' ? 'XY' : kind === 'info' ? '≡' : '#'}</span>
            <div className="layer-name" onDoubleClick={event => { event.stopPropagation(); startEdit(boardChildId(layer, kind), childTitle(boardChild(layer, kind), kind)) }}>
              {editing === boardChildId(layer, kind) ? editor() : <><strong title={childTitle(boardChild(layer, kind), kind)}>{childTitle(boardChild(layer, kind), kind)}</strong><small>{childHint(kind)}</small></>}
            </div>
            <div className="layer-tray">
              <button className="layer-order" title="重命名子图层" onClick={event => { event.stopPropagation(); startEdit(boardChildId(layer, kind), childTitle(boardChild(layer, kind), kind)) }}><Pencil size={11}/></button>
            </div>
            <button className="layer-eye" title={boardChild(layer, kind).visible ? '隐藏子图层' : '显示子图层'} onClick={event => { event.stopPropagation(); onToggleChildVisible(layer.id, kind) }}>{boardChild(layer, kind).visible ? <Eye size={15}/> : <EyeOff size={15}/>}</button>
          </div>)}
        </div>}
      </div>)}
    </div>
    <div className="layer-tip"><LockKeyhole size={16}/> 精确图层不可拉伸，尺寸只能通过参数修改；拖动时按 Alt 可临时关闭吸附，按住 Shift 锁定单方向。</div>
  </div>, language)
}
