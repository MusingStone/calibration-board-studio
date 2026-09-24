import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, Copy, Download, Eye, EyeOff, FileJson, FilePlus2, FileText, Frame, Github, Grid2X2, Hash, ImagePlus, Languages, Layers3, LockKeyhole, Magnet, Maximize2, MousePointer2, Palette, Plus, RectangleHorizontal, RectangleVertical, Redo2, RotateCcw, Ruler, Save, Scaling, Settings2, Shapes, ShieldCheck, Trash2, Type, Undo2, Upload, X, ZoomIn, ZoomOut } from 'lucide-react'
import type { BoardChild, BoardChildKind, BoardLayer, DimensionSpec, DocumentModel, Layer, Primitive } from './core/model'
import { documentVersion, SCALE_LINE_LENGTH, uid } from './core/model'
import { categories, defaultChildren, dictionaryCapacity, pluginMap, plugins } from './core/plugins'
import { findPreset, flipSize, matchPaper, orientationSize, pageBeyondPdf, pageOversize, pageTooSmall, paperPresets, PAGE_MIN, PAGE_WARN, PDF_PAGE_MAX } from './core/paper'
import type { PaperOrientation } from './core/paper'
import { CANVAS_SCALE, fitZoom, zoomIn as stepZoomIn, zoomLabel, zoomOut as stepZoomOut } from './core/zoom'
import { clampPanels, defaultPanelWidth, PANEL_MIN } from './core/panels'
import type { PanelSide } from './core/panels'
import { boardChild, boardChildBounds, boardChildId, boardOriginCorner, boardOverlayPrimitives, CHECK_LINE_BOX, errors, fitPosition, layerBounds, layerPrimitives, layerSize, starterSquareSize, starterTitlePosition } from './core/scene'
import type { BoardChildBoxes } from './core/scene'
import { baseName, childTitle, defaultChildTitle, normalizeNames, otherLayerNames, uniqueName } from './core/naming'
import { snapMove, snapThreshold } from './core/snap'
import type { Box, SnapGuide, SnapTarget } from './core/snap'
import { exportJson, exportPdf, exportPng, exportSvg } from './core/export'
import DimensionInspector from './DimensionInspector'
import LayerPanel from './LayerPanel'
import LayoutPanel from './LayoutPanel'
import { translateText, translateTree } from './i18n'
import type { Language } from './i18n'
import { dimensionAxis, dimensionChange, dimensionDistance, dimensionDriven, dimensionEdgeSegment, dimensionInkDefaults, dimensionLabelPoint, dimensionOffset, dimensionPlacement, dimensionPrimitives, edgeCoordinate, edgeLabels, pickDimensionEdge, solveDimensionValue } from './core/layout'
import type { DimensionShift } from './core/layout'
import type { EdgePick } from './core/layout'
import { isDocumentModel } from './core/project'
import './styles.css'
import { applyUiScale, isUiScaleChoice, storedUiScale, uiScaleChoices, uiScaleKey, uiScaleLabel } from './uiScale'
import type { UiScaleChoice } from './uiScale'
import { applyThemeColor, defaultThemeColor, storedThemeColor, themeColorKey } from './themeColor'
import './responsive.css'

const childKinds: BoardChildKind[] = ['axes', 'info', 'ids']
function changedBoardChild(layer: BoardLayer, kind: BoardChildKind, change: Partial<BoardChild>): BoardLayer {
  return { ...layer, children: { ...layer.children, [kind]: { ...boardChild(layer, kind), ...change } } }
}
/** The ID overlay only exists for targets that carry coded markers. */
const childSupported = (layer: BoardLayer, kind: BoardChildKind) => kind !== 'ids' || !!pluginMap[layer.pluginId]?.markers
const gridSteps = [0, 0.5, 1, 2, 5]
/** Window width used to keep the docked panels inside the screen. */
const viewportWidth = () => (typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 1440)
const panelKey = (side: PanelSide) => `calibration-board-studio-panel-${side}`
/**
 * The interface scale the CSS is currently applying, read back from the root
 * font size: that way one knob drives the stylesheet, the panel thresholds, and
 * the user's override without duplicating the breakpoints in JavaScript.
 */
function rootUiScale(): number {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return 1
  const size = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
  return Number.isFinite(size) && size > 0 ? Math.min(2, Math.max(0.5, size / 16)) : 1
}
/** Remember preferred widths; the active layout clamps them without overwriting them. */
function loadPanels(): { left: number; right: number } {
  const room = viewportWidth(), scale = rootUiScale()
  const read = (side: PanelSide) => {
    const stored = Number(localStorage.getItem(panelKey(side)))
    return Number.isFinite(stored) && stored > 0 ? stored : defaultPanelWidth(side, room, scale)
  }
  return { left: read('left'), right: read('right') }
}

const starterPaper = { width: 210, height: 297 }
const documentStorageKey = 'calibration-board-studio-document'
const starterBoardSize = pluginMap.charuco.size(pluginMap.charuco.defaults)
const starterBoardAt = fitPosition(starterBoardSize, starterPaper)
const starter: DocumentModel = { version: documentVersion, name: 'calibration-board-01', ...starterPaper, layers: [
  { id: 'board-1', type: 'board', name: 'ChArUco 标定板', visible: true, ...starterBoardAt, pluginId: 'charuco', params: { ...pluginMap.charuco.defaults }, children: defaultChildren('charuco') },
  { id: 'text-1', type: 'text', name: '页面标题', visible: true, ...starterTitlePosition(starterPaper.width, starterPaper.height), value: 'CALIBRATION / 001', fontSize: 4.2, color: '#111820', fontWeight: 700 },
] }
function loadDoc(): DocumentModel {
  try {
    const raw = localStorage.getItem(documentStorageKey)
    if (raw) {
      const data = JSON.parse(raw)
      if (isDocumentModel(data)) return data
    }
  } catch { /* Use starter document. */ }
  return starter
}
const fmt = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(1)
/** Language the user picked before, if any. */
const storedLanguage = (): Language | null => {
  const stored = localStorage.getItem('calibration-board-studio-language')
  return stored === 'zh' || stored === 'en' ? stored : null
}
/**
 * First visit follows the browser: the first preferred language we support wins,
 * Chinese for any `zh*` tag and English for any `en*` tag. A browser with neither
 * falls back to English; a non-browser environment keeps Chinese.
 */
function detectLanguage(): Language {
  const stored = storedLanguage()
  if (stored) return stored
  if (typeof navigator === 'undefined') return 'zh'
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const tag of preferred) {
    const value = String(tag ?? '').toLowerCase()
    if (value.startsWith('zh')) return 'zh'
    if (value.startsWith('en')) return 'en'
  }
  return 'en'
}
const round = (n: number, digits = 1) => { const factor = 10 ** digits; return Math.round(n * factor) / factor }
function svgTransforms(transforms: Primitive['transform']) { return transforms?.length ? transforms.slice().reverse().map(t => `rotate(${t.angle} ${t.cx} ${t.cy})`).join(' ') : undefined }
function shapeNode(p: Primitive, index: number) {
  const transform = svgTransforms(p.transform)
  if (p.kind === 'rect') return <rect key={index} transform={transform} x={p.x} y={p.y} width={p.width} height={p.height} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} />
  if (p.kind === 'circle') return <circle key={index} transform={transform} cx={p.cx} cy={p.cy} r={p.r} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} />
  if (p.kind === 'line') return <line key={index} transform={transform} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeDasharray={p.dash ? `${p.dash} ${p.dash}` : undefined} />
  if (p.kind === 'poly') return <polygon key={index} transform={transform} points={p.points.map(point => `${point.x},${point.y}`).join(' ')} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} />
  if (p.kind === 'text') return <text key={index} transform={transform} x={p.x} y={p.y} fontSize={p.fontSize} fontFamily="Arial, sans-serif" fontWeight={p.fontWeight ?? 400} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} paintOrder={p.stroke ? 'stroke' : undefined}>{p.value}</text>
  if (p.kind === 'image') return <image key={index} transform={transform} x={p.x} y={p.y} width={p.width} height={p.height} href={p.href} />
  return null
}
/** Inference guides: alignment lines and equal-gap measurements drawn while dragging. */
function guideNodes(guides: SnapGuide[]) {
  return <g className="snap-layer" pointerEvents="none">{guides.flatMap((guide, index) => {
    const line = guide.orientation === 'vertical'
      ? <line key={`l${index}`} className={`snap-guide ${guide.kind}`} x1={guide.at} y1={guide.start} x2={guide.at} y2={guide.end}/>
      : <line key={`l${index}`} className={`snap-guide ${guide.kind}`} x1={guide.start} y1={guide.at} x2={guide.end} y2={guide.at}/>
    const nodes = [line]
    if (guide.ticks) {
      const tick = 0.8
      nodes.push(guide.orientation === 'vertical'
        ? <line key={`s${index}`} className="snap-guide spacing" x1={guide.at - tick} y1={guide.start} x2={guide.at + tick} y2={guide.start}/>
        : <line key={`s${index}`} className="snap-guide spacing" x1={guide.start} y1={guide.at - tick} x2={guide.start} y2={guide.at + tick}/>)
      nodes.push(guide.orientation === 'vertical'
        ? <line key={`e${index}`} className="snap-guide spacing" x1={guide.at - tick} y1={guide.end} x2={guide.at + tick} y2={guide.end}/>
        : <line key={`e${index}`} className="snap-guide spacing" x1={guide.end} y1={guide.at - tick} x2={guide.end} y2={guide.at + tick}/>)
    }
    if (guide.label) {
      const middle = (guide.start + guide.end) / 2
      const width = guide.label.length * 1.85 + 2.4
      nodes.push(<g key={`t${index}`}>
        {guide.orientation === 'vertical'
          ? <><rect className="snap-label-bg" x={guide.at - width / 2} y={middle - 3.1} width={width} height={4.2} rx="0.8"/><text className="snap-label" x={guide.at} y={middle} textAnchor="middle">{guide.label}</text></>
          : <><rect className="snap-label-bg" x={middle - width / 2} y={guide.at - 3.1} width={width} height={4.2} rx="0.8"/><text className="snap-label" x={middle} y={guide.at} textAnchor="middle">{guide.label}</text></>}
      </g>)
    }
    return nodes
  })}</g>
}
function NumericInput({ label, value, onChange, min, max, step = 0.1, suffix, disabled }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; suffix?: string; disabled?: boolean }) {
  return <label className="field"><span className="field-label">{label}</span><span className="input-wrap"><input type="number" value={value} min={min} max={max} step={step} disabled={disabled} onChange={event => onChange(Number(event.target.value))}/>{suffix && <span className="unit">{suffix}</span>}</span></label>
}
/**
 * Text field that keeps a local draft and commits on blur or Enter, used for
 * layer and child names. The caller passes the name as it should be displayed,
 * so an unchanged commit is a no-op and never rewrites the stored name.
 */
function NameField({ label, value, onCommit }: { label: string; value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => { setDraft(value) }, [value])
  return <label className="field"><span className="field-label">{label}</span><input value={draft} onChange={event => setDraft(event.target.value)} onBlur={() => { if (draft !== value) onCommit(draft) }} onKeyDown={event => {
    if (event.key === 'Enter') event.currentTarget.blur()
    else if (event.key === 'Escape') { setDraft(value); event.currentTarget.blur() }
  }}/></label>
}
function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) { return <div className="section-title"><span>{children}</span>{action}</div> }
function BrandMark() { return <svg width="23" height="23" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M6 12V6h6M20 6h6v6M26 20v6h-6M12 26H6v-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/><path d="M16 8v16M8 16h16" stroke="currentColor" strokeWidth="1.4" opacity="0.75"/><rect x="12.5" y="12.5" width="7" height="7" rx="1.1" fill="currentColor"/></svg> }
function App({ initialTab = 'boards', initialSelection = 'board-1' }: { initialTab?: 'boards' | 'layers' | 'layout'; initialSelection?: string | null } = {}) {
  const [doc, setDoc] = useState<DocumentModel>(loadDoc)
  const [language, setLanguage] = useState<Language>(detectLanguage)
  const [selected, setSelected] = useState<string | null>(initialSelection)
  const [tab, setTab] = useState<'boards' | 'layers' | 'layout'>(initialTab)
  const [zoom, setZoom] = useState(1)
  const [autoFit, setAutoFit] = useState(true)
  const [viewport, setViewport] = useState(() => ({ width: viewportWidth(), scale: rootUiScale() }))
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [panels, setPanels] = useState(loadPanels)
  const [uiScale, setUiScale] = useState<UiScaleChoice>(storedUiScale)
  const [themeColor, setThemeColor] = useState(storedThemeColor)
  const [issuesOpen, setIssuesOpen] = useState(false)
  const [resizing, setResizing] = useState<PanelSide | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [newPreset, setNewPreset] = useState('A4')
  const [newOrientation, setNewOrientation] = useState<PaperOrientation>('portrait')
  const [newWidth, setNewWidth] = useState(210)
  const [newHeight, setNewHeight] = useState(297)
  const [newName, setNewName] = useState('')
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [format, setFormat] = useState<'pdf' | 'svg' | 'png' | 'json'>('pdf')
  const [dpi, setDpi] = useState(300)
  const [exportDimensions, setExportDimensions] = useState(false)
  const [measured, setMeasured] = useState(100)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [saveError, setSaveError] = useState(false)
  const [past, setPast] = useState<DocumentModel[]>([])
  const [future, setFuture] = useState<DocumentModel[]>([])
  const [snapEnabled, setSnapEnabled] = useState(() => localStorage.getItem('calibration-board-studio-snap') !== 'off')
  const [gridStep, setGridStep] = useState(() => {
    const stored = localStorage.getItem('calibration-board-studio-grid')
    return stored !== null && gridSteps.includes(Number(stored)) ? Number(stored) : 1
  })
  const [guides, setGuides] = useState<SnapGuide[]>([])
  const [dimensionTool, setDimensionTool] = useState(initialTab === 'layout')
  const [toolNotice, setToolNotice] = useState(initialTab === 'layout')
  const [pendingEdge, setPendingEdge] = useState<EdgePick | null>(null)
  const [hoverEdge, setHoverEdge] = useState<EdgePick | null>(null)
  const [selectedDimensionId, setSelectedDimensionId] = useState<string | null>(null)
  const [editingDimension, setEditingDimension] = useState<string | null>(null)
  const [conflict, setConflict] = useState<{ id: string; value: number; items: { id: string; label: string; before: number; after: number }[] } | null>(null)
  const [readout, setReadout] = useState<{ x: number; y: number; left: number; right: number; top: number; bottom: number; relations: string[]; overflow: boolean } | null>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const projectRef = useRef<HTMLInputElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const resizer = useRef<{ side: PanelSide; startX: number; startWidth: number } | null>(null)
  const inspectorRef = useRef<HTMLDivElement>(null)
  const ignoreCanvasClick = useRef(false)
  const drag = useRef<{ id: string; kind?: BoardChildKind; x: number; y: number; originX: number; originY: number; box: Box; recorded?: boolean } | null>(null)
  const dimensionDrag = useRef<{ id: string; axis: 'x' | 'y'; startPointer: number; startLine: number; moved?: boolean; record: boolean } | null>(null)
  const canvasCache = useRef(new WeakMap<Layer, { nodes: React.ReactNode[]; boxes?: BoardChildBoxes; patternNodes?: React.ReactNode[] }>())
  const patternCache = useRef(new WeakMap<BoardLayer['params'], { pluginId: string; nodes: React.ReactNode[] }>())
  const latestDoc = useRef(doc)
  const savedDoc = useRef<DocumentModel | null>(null)
  const saveErrorNotified = useRef(false)
  const selectedLayer = doc.layers.find(layer => layer.id === selected) ?? null
  const selectedChild = doc.layers.flatMap(layer => layer.type === 'board' ? childKinds.map(kind => ({ board: layer, kind })) : []).find(item => boardChildId(item.board, item.kind) === selected) ?? null
  const selectedDimension = (doc.dimensions ?? []).find(dimension => dimension.id === selectedDimensionId) ?? null
  const issues = useMemo(() => errors(doc), [doc])
  useEffect(() => { if (!issues.length) setIssuesOpen(false) }, [issues.length])
  const compensation = measured > 0 ? 100 / measured : 1
  const paperMatch = matchPaper(doc.width, doc.height)
  function saveLatestDoc(notify = true) {
    if (savedDoc.current === latestDoc.current) return
    try {
      localStorage.setItem(documentStorageKey, JSON.stringify(latestDoc.current))
      savedDoc.current = latestDoc.current
      saveErrorNotified.current = false
      if (notify) setSaveError(false)
    } catch {
      if (notify) {
        setSaveError(true)
        if (!saveErrorNotified.current) setToast('自动保存失败，请下载项目 JSON 备份。')
        saveErrorNotified.current = true
      }
    }
  }
  useEffect(() => { latestDoc.current = doc; const timer = window.setTimeout(() => saveLatestDoc(), 400); return () => window.clearTimeout(timer) }, [doc])
  useEffect(() => {
    const flush = () => saveLatestDoc(false)
    const flushWhenHidden = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', flushWhenHidden)
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', flushWhenHidden) }
  }, [])
  useEffect(() => { localStorage.setItem('calibration-board-studio-snap', snapEnabled ? 'on' : 'off') }, [snapEnabled])
  useEffect(() => { localStorage.setItem('calibration-board-studio-grid', String(gridStep)) }, [gridStep])
  useEffect(() => { localStorage.setItem('calibration-board-studio-language', language); document.documentElement.lang = language; document.title = language === 'zh' ? '标定板工坊 — 相机标定板生成器' : 'Calibration Board Studio — Camera Calibration Target Generator' }, [language])
  useEffect(() => { applyThemeColor(themeColor); localStorage.setItem(themeColorKey, themeColor) }, [themeColor])
  useEffect(() => { localStorage.setItem(panelKey('left'), String(panels.left)); localStorage.setItem(panelKey('right'), String(panels.right)) }, [panels])
  // The override rides on a data attribute; without it the CSS steps decide.
  useEffect(() => {
    applyUiScale(uiScale)
    localStorage.setItem(uiScaleKey, uiScale)
    // The layout mode and the panel thresholds both read the live root size, so
    // the new scale has to be measured after it is applied.
    setViewport({ width: viewportWidth(), scale: rootUiScale() })
  }, [uiScale])
  // Keep preferred panel widths intact when a window temporarily becomes narrow.
  const layout = viewport.width >= 1180 * viewport.scale ? 'desktop' : viewport.width >= 760 * viewport.scale ? 'tablet' : 'mobile'
  const displayedPanels = layout === 'desktop'
    ? clampPanels(panels.left, panels.right, viewport.width, viewport.scale)
    : { left: Math.min(Math.max(panels.left, 240 * viewport.scale), viewport.width * 0.38), right: panels.right }
  useEffect(() => {
    const update = () => setViewport({ width: viewportWidth(), scale: rootUiScale() })
    update()
    window.addEventListener('resize', update)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(document.documentElement)
    return () => { window.removeEventListener('resize', update); observer?.disconnect() }
  }, [uiScale])
  useEffect(() => { setLibraryOpen(false); setInspectorOpen(false) }, [layout])
  useEffect(() => {
    if (!autoFit) return
    const node = canvasRef.current
    if (!node) return
    const update = () => {
      const wrap = node.querySelector<HTMLElement>('.canvas-wrap')
      if (!wrap || !node.clientWidth || !node.clientHeight) return
      const style = getComputedStyle(wrap)
      const extraHeight = [...wrap.children].filter(child => !child.classList.contains('paper-shadow')).reduce((sum, child) => {
        const css = getComputedStyle(child)
        return sum + child.getBoundingClientRect().height + parseFloat(css.marginTop) + parseFloat(css.marginBottom)
      }, 0)
      const width = node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 2
      const height = node.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - extraHeight - 2
      setZoom(fitZoom(doc.width, doc.height, Math.max(1, width), Math.max(1, height), 0))
    }
    const frame = requestAnimationFrame(update)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(node)
    return () => { cancelAnimationFrame(frame); observer?.disconnect() }
  }, [autoFit, doc.width, doc.height, language, uiScale])
  useEffect(() => {
    if (!libraryOpen && !inspectorOpen) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setLibraryOpen(false); setInspectorOpen(false) } }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [libraryOpen, inspectorOpen])
  useEffect(() => { if (inspectorOpen) setLibraryOpen(false) }, [inspectorOpen])
  useEffect(() => {
    const panelId = layout !== 'desktop' && inspectorOpen ? 'property-panel' : layout === 'mobile' && libraryOpen ? 'tool-panel' : null
    if (!panelId) return
    const panel = document.getElementById(panelId)
    if (!panel) return
    const previous = document.activeElement as HTMLElement | null
    const focusable = () => [...panel.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(node => node.getClientRects().length > 0)
    focusable()[0]?.focus()
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const nodes = focusable(), first = nodes[0], last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    panel.addEventListener('keydown', trap)
    return () => { panel.removeEventListener('keydown', trap); if (previous?.isConnected) previous.focus() }
  }, [layout, inspectorOpen, libraryOpen])
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer) } }, [toast])
  // The mode banner is a hint, not a permanent fixture: it fades out on its own too.
  useEffect(() => { if (!toolNotice) return; const timer = setTimeout(() => setToolNotice(false), 10_000); return () => clearTimeout(timer) }, [toolNotice])
  // Selecting something new must not inherit the previous scroll offset: picking a
  // child from deep inside the board inspector used to land on the page settings.
  useEffect(() => { const node = inspectorRef.current; if (node) node.scrollTop = 0 }, [selected, selectedDimensionId])
  function setDimensionMode(active: boolean) {
    setDimensionTool(active)
    setToolNotice(active)
    setPendingEdge(null)
    setHoverEdge(null)
  }
  // Dimension lines belong to the layout tab: switching in arms the dimension tool,
  // switching out puts it away (and only then drops the dimension selection).
  function changeTab(next: 'boards' | 'layers' | 'layout') {
    setTab(next)
    setDimensionMode(next === 'layout')
    if (next !== 'layout') setSelectedDimensionId(null)
  }
  function commit(update: (current: DocumentModel) => DocumentModel) { setPast(p => [...p.slice(-39), doc]); setFuture([]); setDoc(update(doc)) }
  function updateLayer(id: string, change: Partial<Layer>) { commit(current => ({ ...current, layers: current.layers.map(layer => layer.id === id ? { ...layer, ...change } as Layer : layer) })) }
  function updateChild(id: string, kind: BoardChildKind, change: Partial<BoardChild>) { commit(current => ({ ...current, layers: current.layers.map(layer => layer.id === id && layer.type === 'board' ? changedBoardChild(layer, kind, change) : layer) })) }
  function undo() { if (!past.length) return; setFuture(f => [...f, doc]); setDoc(past[past.length - 1]); setPast(past.slice(0, -1)) }
  function redo() { if (!future.length) return; setPast(p => [...p, doc]); setDoc(future[future.length - 1]); setFuture(future.slice(0, -1)) }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return }
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return
      if (event.key === 'Escape') {
        if (dimensionTool) { setDimensionMode(false); return }
        if (selectedDimensionId) setSelectedDimensionId(null)
        return
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedDimensionId) {
        event.preventDefault(); removeDimension(selectedDimensionId); setSelectedDimensionId(null); return
      }
      const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
      const step = arrows[event.key]
      if (!step || (event.metaKey || event.ctrlKey || event.altKey)) return
      const distance = event.shiftKey ? 1 : 0.1
      if (selectedChild) {
        event.preventDefault()
        const child = boardChild(selectedChild.board, selectedChild.kind)
        updateChild(selectedChild.board.id, selectedChild.kind, { offsetX: round(child.offsetX + step[0] * distance, 3), offsetY: round(child.offsetY + step[1] * distance, 3) })
      } else if (selectedLayer) {
        event.preventDefault()
        updateLayer(selectedLayer.id, { x: round(selectedLayer.x + step[0] * distance, 3), y: round(selectedLayer.y + step[1] * distance, 3) })
      }
    }
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key)
  })
  function choosePlugin(id: string, add = false) {
    setLibraryOpen(false)
    const plugin = pluginMap[id]
    const size = plugin.size(plugin.defaults)
    const position = fitPosition(size, doc)
    const targetBoard = selectedLayer?.type === 'board' ? selectedLayer : selectedChild?.board
    if (!add && targetBoard) {
      updateLayer(targetBoard.id, { pluginId: id, params: { ...plugin.defaults }, name: uniqueName(`${plugin.name} 标定板`, otherLayerNames(doc, targetBoard.id)), ...position, children: defaultChildren(id) })
    } else {
      const layer: BoardLayer = { id: uid(), type: 'board', name: uniqueName(`${plugin.name} 标定板`, otherLayerNames(doc)), visible: true, ...position, pluginId: id, params: { ...plugin.defaults }, children: defaultChildren(id) }
      commit(current => ({ ...current, layers: [...current.layers.filter(l => l.type === 'board'), layer, ...current.layers.filter(l => l.type !== 'board')] }))
      setSelected(layer.id)
    }
    changeTab('boards')
  }
  function addLayer(type: 'text' | 'rect' | 'circle' | 'line' | 'scale') {
    const basic = { id: uid(), visible: true, x: 25, y: 25 }
    const defaultName = type === 'text' ? '文字' : type === 'rect' ? '矩形' : type === 'circle' ? '圆形' : type === 'scale' ? '校验线' : '直线'
    const name = uniqueName(translateText(defaultName, language), otherLayerNames(doc))
    const layer: Layer = type === 'scale' ? { ...basic, type, name, color: '#111820', strokeWidth: 0.25, y: 25 + CHECK_LINE_BOX } : type === 'text' ? { ...basic, type, name, value: translateText('输入文字', language), fontSize: 5, color: '#111820', fontWeight: 500 } : { ...basic, type, name, width: 35, height: type === 'line' ? 0 : type === 'circle' ? 35 : 22, color: '#ef5b3f', strokeWidth: 0.5, fill: false }
    commit(current => ({ ...current, layers: [...current.layers, layer] })); setSelected(layer.id); changeTab('layers')
  }
  function removeLayer(id: string) { commit(current => ({ ...current, layers: current.layers.filter(l => l.id !== id), dimensions: (current.dimensions ?? []).filter(d => d.targetId !== id && d.referenceId !== id) })); setSelected(doc.layers.find(l => l.type === 'board' && l.id !== id)?.id ?? null) }
  function moveLayer(id: string, direction: -1 | 1) {
    commit(current => {
      const layers = [...current.layers]
      const index = layers.findIndex(layer => layer.id === id)
      if (index < 0) return current
      const target = index + direction
      if (target < 0 || target >= layers.length) return current
      ;[layers[index], layers[target]] = [layers[target], layers[index]]
      return { ...current, layers }
    })
  }
  function duplicateLayer(layer: Layer) {
    const copy = { ...layer, id: uid(), name: uniqueName(baseName(layer.name), otherLayerNames(doc)), x: layer.x + 5, y: layer.y + 5 } as Layer
    commit(current => ({ ...current, layers: [...current.layers, copy] })); setSelected(copy.id)
  }
  function renameLayer(id: string, name: string) {
    const layer = doc.layers.find(item => item.id === id)
    if (!layer) return
    const clean = name.trim()
    if (!clean) return
    const next = uniqueName(clean, otherLayerNames(doc, id))
    if (next !== clean) setToast(`图层名称重复，已重命名为「${next}」。`)
    if (next === layer.name) return
    updateLayer(id, { name: next })
  }
  function renameChild(boardId: string, kind: BoardChildKind, name: string) {
    const board = doc.layers.find(layer => layer.id === boardId)
    if (!board || board.type !== 'board') return
    const clean = name.trim()
    // Clearing the field, or typing the default name back, restores the template name.
    const otherNames = childKinds.filter(other => other !== kind && childSupported(board, other)).map(other => childTitle(boardChild(board, other), other))
    const next = clean && clean !== defaultChildTitle(kind) ? uniqueName(clean, otherNames) : undefined
    if (next && next !== clean) setToast(`子图层名称重复，已重命名为「${next}」。`)
    if (next === boardChild(board, kind).title) return
    updateChild(boardId, kind, { title: next })
  }
  // Folding the layer tree is view state, not geometry: it stays out of the undo history.
  function toggleCollapse(id: string) { setDoc(current => ({ ...current, layers: current.layers.map(layer => layer.id === id && layer.type === 'board' ? { ...layer, collapsed: !layer.collapsed } : layer) })) }
  function toggleAll(collapsed: boolean) { setDoc(current => ({ ...current, layers: current.layers.map(layer => layer.type === 'board' ? { ...layer, collapsed } : layer) })) }
  function toggleVisible(id: string) { const layer = doc.layers.find(item => item.id === id); if (layer) updateLayer(id, { visible: !layer.visible }) }
  function toggleChildVisible(id: string, kind: BoardChildKind) { const board = doc.layers.find(layer => layer.id === id); if (board?.type === 'board') updateChild(id, kind, { visible: !boardChild(board, kind).visible }) }
  function setPageSize(width: number, height: number) { commit(current => ({ ...current, width, height })) }
  /** Panel widths: drag, keyboard nudge, and double-click reset, all clamped to the screen. */
  function beginResize(side: PanelSide, event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    resizer.current = { side, startX: event.clientX, startWidth: displayedPanels[side] }
    setResizing(side)
  }
  function moveResize(event: React.PointerEvent<HTMLDivElement>) {
    const state = resizer.current
    if (!state) return
    const delta = state.side === 'left' ? event.clientX - state.startX : state.startX - event.clientX
    const wanted = state.startWidth + delta
    setPanels(current => clampPanels(state.side === 'left' ? wanted : current.left, state.side === 'right' ? wanted : current.right, viewportWidth(), rootUiScale()))
  }
  function endResize() { if (!resizer.current) return; resizer.current = null; setResizing(null) }
  function nudgePanel(side: PanelSide, delta: number) {
    const scale = rootUiScale()
    setPanels(current => clampPanels(side === 'left' ? current.left + delta : current.left, side === 'right' ? current.right + delta : current.right, viewportWidth(), scale))
  }
  function resetPanel(side: PanelSide) {
    const room = viewportWidth(), scale = rootUiScale()
    setPanels(current => clampPanels(side === 'left' ? defaultPanelWidth('left', room, scale) : current.left, side === 'right' ? defaultPanelWidth('right', room, scale) : current.right, room, scale))
  }
  function resetSettings() {
    for (const key of [themeColorKey, uiScaleKey, panelKey('left'), panelKey('right'), 'calibration-board-studio-snap', 'calibration-board-studio-grid', 'calibration-board-studio-language']) localStorage.removeItem(key)
    applyUiScale('auto')
    const room = viewportWidth(), scale = rootUiScale()
    setThemeColor(defaultThemeColor)
    setUiScale('auto')
    setViewport({ width: room, scale })
    setPanels({ left: defaultPanelWidth('left', room, scale), right: defaultPanelWidth('right', room, scale) })
    setLanguage(detectLanguage())
    setSnapEnabled(true)
    setGridStep(1)
    setAutoFit(true)
    setToast('界面设置已恢复默认，当前项目未改变。')
  }
  /** Fit the current page into the canvas viewport, which is what makes huge pages usable. */
  function fitToWindow() { setAutoFit(true) }
  function manualZoom(update: number | ((value: number) => number)) { setAutoFit(false); setZoom(update) }
  function addDimension(dimension: DimensionSpec) { commit(current => ({ ...current, dimensions: [...(current.dimensions ?? []), dimension] })) }
  function updateDimension(id: string, change: Partial<DimensionSpec>) { commit(current => ({ ...current, dimensions: (current.dimensions ?? []).map(d => d.id === id ? { ...d, ...change } : d) })) }
  function removeDimension(id: string) { commit(current => ({ ...current, dimensions: (current.dimensions ?? []).filter(d => d.id !== id) })) }
  function createProject() {
    const preset = findPreset(newPreset)
    const size = preset ? orientationSize(preset, newOrientation) : { width: newWidth, height: newHeight }
    const width = size.width, height = size.height
    if (pageTooSmall(width, height)) { setToast(`纸张宽高须至少 ${PAGE_MIN} mm。`); return }
    const count = Number(localStorage.getItem('calibration-board-studio-project-sequence') || '1') + 1
    localStorage.setItem('calibration-board-studio-project-sequence', String(count))
    const name = newName.trim() || `calibration-board-${String(count).padStart(2, '0')}`
    const squareSize = starterSquareSize(width, height)
    const boardSize = { width: squareSize * 7, height: squareSize * 10 }
    const position = fitPosition(boardSize, { width, height })
    const next: DocumentModel = { ...structuredClone(starter), name, width, height, layers: [
      { ...structuredClone(starter.layers[0]), ...position, params: { ...pluginMap.charuco.defaults, squareSize, markerSize: Math.max(0.1, Math.round(squareSize * 0.7 * 10) / 10) } } as BoardLayer,
      { ...structuredClone(starter.layers[1]), ...starterTitlePosition(width, height) },
    ] }
    commit(() => next); setSelected('board-1'); setNewOpen(false); setNewName(''); changeTab('boards'); setToast('已新建项目。')
    // A page that does not fit at 100 % opens fitted, so the new board is visible whole.
    setAutoFit(true)
  }
  function imageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg'].includes(file.type)) { setToast('请上传 PNG 或 JPEG 图片。'); return }
    const reader = new FileReader()
    reader.onload = () => { const layer: Layer = { id: uid(), type: 'image', name: uniqueName(file.name, otherLayerNames(doc)), visible: true, x: 20, y: 20, width: 35, height: 35, dataUrl: String(reader.result) }; commit(current => ({ ...current, layers: [...current.layers, layer] })); setSelected(layer.id); changeTab('layers') }
    reader.readAsDataURL(file); event.target.value = ''
  }
  function importProject(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    file.text().then(text => { try { const data = JSON.parse(text); if (!isDocumentModel(data)) throw new Error(); commit(() => normalizeNames(data)); setSelected(data.layers[0]?.id ?? null); setToast('项目已载入。') } catch { setToast('项目文件无效。') } }); event.target.value = ''
  }
  async function handleExport() {
    if (issues.length) { setToast('请先修正标定板参数与页面尺寸。'); return }
    // PDF pages cannot exceed 200 in (5080 mm) a side; the other formats have no such limit.
    if (format === 'pdf' && pageBeyondPdf(doc.width, doc.height)) { setToast(`纸张过大，无法生成 PDF（单边上限 ${PDF_PAGE_MAX} mm），请改用 SVG 或 PNG。`); return }
    setBusy(true)
    try {
      if (format === 'pdf') await exportPdf(doc, compensation, exportDimensions)
      else if (format === 'svg') exportSvg(doc, compensation, exportDimensions)
      else if (format === 'png') await exportPng(doc, dpi, compensation, exportDimensions)
      else exportJson(doc)
      setToast(`${format.toUpperCase()} 已生成。`); setExportOpen(false)
    } catch (error) { setToast(error instanceof Error ? error.message : '导出失败。') }
    finally { setBusy(false) }
  }
  function point(event: React.PointerEvent<SVGElement>) {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return { x: (event.clientX - rect.left) / rect.width * doc.width, y: (event.clientY - rect.top) / rect.height * doc.height }
  }
  /** Snap distance in millimeters, derived from the on-screen scale so it feels constant while zooming. */
  function tolerance() {
    const width = svgRef.current?.getBoundingClientRect().width ?? 0
    return width > 0 ? snapThreshold(doc.width / width) : 1
  }
  function snapTargets(excludeId: string): SnapTarget[] {
    return doc.layers.filter(layer => layer.visible && layer.id !== excludeId).map(layer => ({ id: layer.id, name: layer.name, box: layerBounds(layer) }))
  }
  const sameEdge = (a: EdgePick | null, b: EdgePick | null) => a === b || (!!a && !!b && a.layerId === b.layerId && a.edge === b.edge)
  function dimensionEdgeAt(event: React.PointerEvent<SVGElement>): EdgePick | null {
    return pickDimensionEdge(doc, point(event), Math.max(1.2, tolerance() * 1.6))
  }
  /** Move the dimension line with the pointer, measuring the offset from the geometry again. */
  function dragDimensionOffset(event: React.PointerEvent<SVGSVGElement>): boolean {
    const state = dimensionDrag.current
    if (!state) return false
    const pos = point(event)
    const pointer = state.axis === 'x' ? pos.y : pos.x
    if (state.record && !state.moved) { state.moved = true; setPast(p => [...p.slice(-39), doc]); setFuture([]) }
    const line = state.startLine + pointer - state.startPointer
    setDoc(current => ({ ...current, dimensions: (current.dimensions ?? []).map(dimension => dimension.id === state.id ? { ...dimension, offset: dimensionOffset(current, dimension, line) } : dimension) }))
    return true
  }
  /** Dimension tool: the first click picks the reference edge, the second one creates the line. */
  function onCanvasPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    setToolNotice(false)
    if (!dimensionTool) return
    const pick = dimensionEdgeAt(event)
    if (!pick) { setPendingEdge(null); setSelected(null); setSelectedDimensionId(null); return }
    if (!pendingEdge) { setPendingEdge(pick); return }
    if (sameEdge(pendingEdge, pick)) return
    if (pendingEdge.layerId === 'page' && pick.layerId === 'page') { setToast('纸张的两条边之间不能标注尺寸。'); return }
    if (dimensionAxis(pendingEdge.edge) !== dimensionAxis(pick.edge)) { setToast('请选择同一方向的两条边。'); return }
    // The paper is always the reference; the layer is the object a typed value moves.
    const target = pick.layerId === 'page' ? pendingEdge : pick
    const reference = pick.layerId === 'page' ? pick : pendingEdge
    const dimension: DimensionSpec = { id: uid(), targetId: target.layerId, targetEdge: target.edge, referenceId: reference.layerId, referenceEdge: reference.edge, offset: 8, visible: true, ...dimensionInkDefaults }
    commit(current => ({ ...current, dimensions: [...(current.dimensions ?? []), dimension] }))
    setPendingEdge(null)
    setSelectedDimensionId(dimension.id)
    setInspectorOpen(true)
    setToast('已添加尺寸线：在右侧属性栏输入数值，或双击 / 拖动画布上的尺寸线。')
    const pos = point(event)
    dimensionDrag.current = {
      id: dimension.id, axis: dimensionAxis(dimension.targetEdge),
      startPointer: dimensionAxis(dimension.targetEdge) === 'x' ? pos.y : pos.x,
      startLine: dimensionPlacement(doc, dimension).line, record: false,
    }
    svgRef.current?.setPointerCapture(event.pointerId)
  }
  function startDimensionDrag(event: React.PointerEvent<SVGLineElement>, dimension: DimensionSpec, line: number) {
    event.stopPropagation()
    setToolNotice(false)
    ignoreCanvasClick.current = true
    setSelectedDimensionId(dimension.id)
    setInspectorOpen(true)
    const axis = dimensionAxis(dimension.targetEdge)
    const pos = point(event)
    dimensionDrag.current = { id: dimension.id, axis, startPointer: axis === 'x' ? pos.y : pos.x, startLine: line, record: true }
    svgRef.current?.setPointerCapture(event.pointerId)
  }
  /** Apply a set of layer changes from one dimension edit as a single history step. */
  function applyShifts(shifts: DimensionShift[]) {
    if (!shifts.length) return
    commit(current => ({ ...current, layers: current.layers.map(layer => {
      const shift = shifts.find(item => item.id === layer.id)
      return shift ? { ...layer, ...shift } as Layer : layer
    }) }))
  }
  /** Drive the geometry one dimension at a time; used once a conflict is accepted. */
  function applyDimensionValue(id: string, value: number) {
    const dimension = (doc.dimensions ?? []).find(item => item.id === id)
    if (!dimension) return
    const change = dimensionChange(doc, dimension, value)
    if (Object.keys(change).length) updateLayer(dimension.targetId, change)
  }
  function commitDimensionValue(id: string, value: number) {
    const dimension = (doc.dimensions ?? []).find(item => item.id === id)
    setEditingDimension(null)
    setConflict(null)
    if (!dimension || !Number.isFinite(value)) return
    if (Math.abs(dimensionDistance(doc, dimension) - value) < 0.005) return
    if (!Object.keys(dimensionChange(doc, dimension, value)).length) { setToast(dimensionDriven(doc, dimension) ? '该尺寸值无法用于当前图形与所选边。' : '该图层只能测量：标定板与文字尺寸由参数决定。'); return }
    // Try to satisfy the edit together with every existing dimension first: layers an
    // existing dimension ties together travel as a group. Only a real dead end asks.
    const plan = solveDimensionValue(doc, dimension, value)
    if (!plan.conflicts.length) {
      applyShifts(plan.changes)
      if (plan.changes.length > 1) setToast(`已同时调整 ${plan.changes.length} 个图层，其他尺寸保持不变。`)
      return
    }
    setConflict({ id, value, items: plan.conflicts })
    setInspectorOpen(true)
    setToast(`无法保持其他尺寸不变 · ${plan.conflicts.length} 条尺寸会同时变化，请在属性栏确认。`)
  }
  function resolveConflict(apply: boolean) {
    const pending = conflict
    setConflict(null)
    if (!pending) return
    if (!apply) { setToast('修改被取消。'); return }
    applyDimensionValue(pending.id, pending.value)
  }
  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (dragDimensionOffset(event)) return
    const d = drag.current
    if (!d) {
      if (dimensionTool) { const pick = dimensionEdgeAt(event); setHoverEdge(current => sameEdge(current, pick) ? current : pick) }
      return
    }
    const pos = point(event)
    if (Math.hypot(pos.x - d.x, pos.y - d.y) < 0.05) return
    if (!d.recorded) { d.recorded = true; setPast(p => [...p.slice(-39), doc]); setFuture([]) }
    let dx = pos.x - d.x, dy = pos.y - d.y
    if (event.shiftKey) { if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0 }
    let active: SnapGuide[] = []
    let relations: string[] = []
    let hasX = false, hasY = false
    if (snapEnabled && !event.altKey) {
      const result = snapMove({ ...d.box, x: d.box.x + dx, y: d.box.y + dy }, { width: doc.width, height: doc.height }, snapTargets(d.kind ? '' : d.id), { threshold: tolerance(), grid: gridStep, page: true, layers: true, spacing: true })
      dx += result.dx; dy += result.dy; hasX = result.hasX; hasY = result.hasY
      active = result.guides; relations = result.relations
    }
    const x = hasX ? round(d.originX + dx, 3) : round(d.originX + dx)
    const y = hasY ? round(d.originY + dy, 3) : round(d.originY + dy)
    const box = { ...d.box, x: d.box.x + dx, y: d.box.y + dy }
    setGuides(active)
    setReadout({
      x, y,
      left: round(box.x), right: round(doc.width - box.x - box.width),
      top: round(box.y), bottom: round(doc.height - box.y - box.height),
      relations,
      overflow: box.x < -0.001 || box.y < -0.001 || box.x + box.width > doc.width + 0.001 || box.y + box.height > doc.height + 0.001,
    })
    setDoc(current => ({ ...current, layers: current.layers.map(layer => {
      if (layer.id !== d.id) return layer
      if (d.kind && layer.type === 'board') return changedBoardChild(layer, d.kind, { offsetX: x, offsetY: y })
      return { ...layer, x, y }
    }) }))
  }
  function endDrag() {
    drag.current = null
    dimensionDrag.current = null
    setGuides([])
    setReadout(null)
    requestAnimationFrame(() => { ignoreCanvasClick.current = false })
  }
  function startDrag(event: React.PointerEvent<SVGGElement>, layer: Layer) {
    if (dimensionTool) return
    event.stopPropagation(); setSelected(layer.id); setSelectedDimensionId(null); ignoreCanvasClick.current = true
    const pos = point(event)
    drag.current = { id: layer.id, x: pos.x, y: pos.y, originX: layer.x, originY: layer.y, box: layerBounds(layer) }
    svgRef.current?.setPointerCapture(event.pointerId)
  }
  function startChildDrag(event: React.PointerEvent<SVGRectElement>, board: BoardLayer, kind: BoardChildKind) {
    if (dimensionTool) return
    event.stopPropagation(); setSelected(boardChildId(board, kind)); ignoreCanvasClick.current = true
    const pos = point(event), child = boardChild(board, kind)
    drag.current = { id: board.id, kind, x: pos.x, y: pos.y, originX: child.offsetX, originY: child.offsetY, box: boardChildBounds(board, kind) }
    svgRef.current?.setPointerCapture(event.pointerId)
  }
  /** Rotation transform shared by a child layer's hit area and its selection outline. */
  function childTurn(layer: BoardLayer, kind: BoardChildKind, box: { x: number; y: number; width: number; height: number }, boardTurn?: string) {
    const child = boardChild(layer, kind)
    const childTurnTransform = child.allowRotation && child.rotation ? `rotate(${child.rotation} ${box.x + box.width / 2} ${box.y + box.height / 2})` : ''
    return [boardTurn, childTurnTransform].filter(Boolean).join(' ')
  }
  // Layer objects are replaced on edits, so untouched layers can reuse their
  // geometry and SVG nodes while selection, guides, or another layer changes.
  const visibleLayers = useMemo(() => doc.layers.filter(layer => layer.visible).map(layer => {
    let drawing = canvasCache.current.get(layer)
    if (!drawing) {
      let boxes: BoardChildBoxes | undefined
      let patternNodes: React.ReactNode[] | undefined
      if (layer.type === 'board') {
        boxes = {}
        for (const kind of childKinds) if (boardChild(layer, kind).visible && childSupported(layer, kind)) boxes[kind] = boardChildBounds(layer, kind)
        const cached = patternCache.current.get(layer.params)
        patternNodes = cached?.pluginId === layer.pluginId ? cached.nodes : pluginMap[layer.pluginId]?.generate(layer.params).map(shapeNode)
        if (patternNodes && patternNodes !== cached?.nodes) patternCache.current.set(layer.params, { pluginId: layer.pluginId, nodes: patternNodes })
      }
      const primitives = layer.type === 'board' ? boardOverlayPrimitives(layer, boxes) : layerPrimitives(layer)
      drawing = { nodes: primitives.map(shapeNode), boxes, patternNodes }
      canvasCache.current.set(layer, drawing)
    }
    return { layer, ...drawing }
  }), [doc.layers])
  const nothingSelected = !selectedLayer && !selectedChild && !selectedDimension
  const pluginForSelected = selectedLayer?.type === 'board' ? pluginMap[selectedLayer.pluginId] : null
  return translateTree(<div className="app-shell" data-layout={layout}>
    <header className="topbar">
      <div className="brand"><div className="brand-icon"><BrandMark/></div><div className="brand-words"><strong>{language === 'zh' ? '标定板工坊' : 'Board Studio'}</strong><small>{language === 'zh' ? 'CALIBRATION BOARD STUDIO' : 'CALIBRATION PATTERN TOOLS'}</small></div></div>
      <div className="top-divider"/>
      <div className="document-name"><span className="doc-avatar"><Grid2X2 size={15}/></span><input aria-label="项目名称" value={doc.name} onChange={e => setDoc({ ...doc, name: e.target.value })}/><span className={`saved-dot${saveError ? ' error' : ''}`} title={saveError ? '自动保存失败，请下载项目 JSON 备份。' : '自动保存到浏览器'}/></div>
      <div className="top-spacer"/>
      <div className="local-badge"><span/> 所有计算均在浏览器本地完成</div><div className="header-settings"><div className="language-switch" role="group" aria-label="界面语言 / Interface language" title="界面语言 / Interface language"><Languages size={15}/><button className={language === 'zh' ? 'active' : ''} aria-pressed={language === 'zh'} onClick={() => setLanguage('zh')}>中文</button><button className={language === 'en' ? 'active' : ''} aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button></div>
      <label className="ui-scale" title="界面缩放"><Scaling size={15}/><select aria-label="界面缩放" value={uiScale} onChange={event => { const next = event.target.value; if (isUiScaleChoice(next)) setUiScale(next) }}><option value="auto">自动</option>{uiScaleChoices.map(value => <option key={value} value={value}>{uiScaleLabel(value)}</option>)}</select></label>
      <label className="theme-picker" title="主题色"><Palette size={15}/><input type="color" aria-label="主题色" value={themeColor} onChange={event => setThemeColor(event.target.value)}/></label>
      <button className="settings-reset" type="button" title="恢复默认设置" aria-label="恢复默认设置" onClick={resetSettings}><RotateCcw size={15}/><span>恢复默认</span></button>
      <a className="github-link" href="https://github.com/MusingStone/calibration-board-studio" target="_blank" rel="noopener noreferrer" aria-label="在 GitHub 查看源码（新标签页打开）" title="在 GitHub 查看源码"><Github size={16} aria-hidden="true"/><span>GitHub</span></a>
      </div><div className="file-actions"><button className="icon-btn top-action" title="新建项目" onClick={() => setNewOpen(true)}><FilePlus2 size={18}/></button>
      <button className="icon-btn top-action" title="导入项目" onClick={() => projectRef.current?.click()}><Upload size={18}/></button>
      <button className="icon-btn top-action" title="保存项目 JSON" onClick={() => exportJson(doc)}><Save size={18}/></button>
      <div className="top-divider small"/>
      <button className="primary-button" aria-label="导出文件" title="导出文件" onClick={() => setExportOpen(true)}><Download size={17}/><span className="export-label">导出文件</span><ChevronDown size={14}/></button></div>
      <input ref={projectRef} type="file" accept="application/json,.json" hidden onChange={importProject}/>
    </header>
    <div className={`workspace${resizing ? ' resizing' : ''}`} style={{ '--panel-left': `${displayedPanels.left}px`, '--panel-right': `${displayedPanels.right}px` } as React.CSSProperties}>
      {libraryOpen && layout === 'mobile' && <div className="library-backdrop" onClick={() => setLibraryOpen(false)}/>}
      <aside id="tool-panel" role={layout === 'mobile' ? 'dialog' : undefined} aria-modal={layout === 'mobile' && libraryOpen ? true : undefined} aria-label="工具面板" className={`sidebar left-sidebar${libraryOpen ? ' open' : ''}`} inert={layout === 'mobile' && !libraryOpen}>
        <div className="library-head"><strong>工具面板</strong><button className="icon-btn" aria-label="关闭工具面板" onClick={() => setLibraryOpen(false)}><X size={18}/></button></div>
        <div className="side-tabs"><button className={tab === 'boards' ? 'active' : ''} onClick={() => changeTab('boards')}><Grid2X2 size={16}/><span className="tab-label">标定板</span></button><button className={tab === 'layers' ? 'active' : ''} onClick={() => changeTab('layers')}><Layers3 size={16}/><span className="tab-label">图层</span></button><button className={tab === 'layout' ? 'active' : ''} onClick={() => changeTab('layout')}><Ruler size={16}/><span className="tab-label">排版</span></button></div>
        {tab === 'boards' ? <div className="sidebar-scroll">
          <div className="side-intro"><span className="eyebrow">PATTERN LIBRARY</span><h2>选择标定图案</h2><p>选择图案替换当前标定板，或点击 ＋ 添加一个新图层。</p></div>
          {categories.map(category => { const entries = plugins.filter(plugin => plugin.category === category); return <div className="catalog-section" key={category}><div className="catalog-heading">{category}<span>{entries.length.toString().padStart(2, '0')}</span></div><div className="pattern-list">{entries.map(plugin => <div className={`pattern-card ${selectedLayer?.type === 'board' && selectedLayer.pluginId === plugin.id ? 'selected' : ''}`} key={plugin.id}><button className="pattern-main" onClick={() => choosePlugin(plugin.id)}><span className="pattern-icon">{plugin.icon}</span><span className="pattern-copy"><strong>{plugin.name}</strong><small>{plugin.description}</small></span></button><button className="pattern-add" title={`添加 ${plugin.name} 图层`} onClick={() => choosePlugin(plugin.id, true)}><Plus size={15}/></button></div>)}</div></div> })}
        </div> : tab === 'layout' ? <LayoutPanel language={language} doc={doc} target={selectedLayer ?? selectedChild?.board ?? null} selectedDimensionId={selectedDimensionId} dimensionTool={dimensionTool} onOpenAlignment={() => setDimensionMode(false)} select={setSelected} selectDimension={id => { setSelectedDimensionId(id); if (id) setInspectorOpen(true) }} move={(id, position) => updateLayer(id, position)} addDimension={dimension => { addDimension(dimension); setSelectedDimensionId(dimension.id) }} updateDimension={updateDimension} removeDimension={removeDimension}/> : <LayerPanel
          language={language}
          doc={doc}
          selected={selected}
          onSelect={id => setSelected(id)}
          onToggleCollapse={toggleCollapse}
          onToggleAll={toggleAll}
          onToggleVisible={toggleVisible}
          onToggleChildVisible={toggleChildVisible}
          onMove={moveLayer}
          onRename={renameLayer}
          onRenameChild={renameChild}
          onAdd={addLayer}
          onUpload={() => uploadRef.current?.click()}
        />}
        <input ref={uploadRef} type="file" accept="image/png,image/jpeg" hidden onChange={imageUpload}/>
        <div className="panel-resizer left" role="separator" aria-orientation="vertical" aria-label="调整左侧栏宽度" aria-valuenow={displayedPanels.left} aria-valuemin={PANEL_MIN.left} tabIndex={0}
          onPointerDown={event => beginResize('left', event)} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize}
          onDoubleClick={() => resetPanel('left')} onKeyDown={event => { if (event.key === 'ArrowLeft') { event.preventDefault(); nudgePanel('left', -16) } else if (event.key === 'ArrowRight') { event.preventDefault(); nudgePanel('left', 16) } }}/>
      </aside>
      <main className="stage">
        <div className="stage-toolbar">
          <button className="library-toggle inspector-toggle" aria-controls="tool-panel" aria-expanded={libraryOpen} onClick={() => { setLibraryOpen(true); setInspectorOpen(false) }}><Layers3 size={16}/> 工具面板</button>
          <div className="toolbar-group"><span className={`tool-indicator${dimensionTool ? ' active' : ''}`}>{dimensionTool ? <Ruler size={16}/> : <MousePointer2 size={16}/>}</span><span className="toolbar-label">{dimensionTool ? '尺寸工具' : tab === 'layout' ? '编辑排版' : '编辑画布'}</span></div>
          <span className="toolbar-divider"/>
          <div className="toolbar-group subtle"><button title="撤销" disabled={!past.length} onClick={undo}><Undo2 size={16}/></button><button title="重做" disabled={!future.length} onClick={redo}><Redo2 size={16}/></button></div>
          <span className="toolbar-divider"/>
          <div className="toolbar-group subtle snap-group">{tab === 'layout' && <button className={dimensionTool ? 'active' : ''} title="尺寸工具：依次点击同一方向的两条边生成尺寸线；已有尺寸线可选中、双击或拖动（Esc 退出）" onClick={() => setDimensionMode(!dimensionTool)}><Ruler size={16}/></button>}<button className={snapEnabled ? 'active' : ''} title="智能吸附：对齐、等距与网格（按住 Alt 临时关闭）" onClick={() => setSnapEnabled(value => !value)}><Magnet size={16}/></button><select className="snap-grid" title="网格吸附步长" value={gridStep} disabled={!snapEnabled} onChange={event => setGridStep(Number(event.target.value))}>{gridSteps.map(step => <option key={step} value={step}>{step === 0 ? '网格关' : `${step} mm`}</option>)}</select></div>
          <div className="stage-toolbar-spacer"/>
          {tab !== 'layout' && (doc.dimensions ?? []).length > 0 && <button className="layout-only-hint" title="尺寸线只在排版模式中显示和编辑" onClick={() => changeTab('layout')}>{`${(doc.dimensions ?? []).length} 条尺寸线在排版模式中编辑`}</button>}
          <button className="inspector-toggle" aria-controls="property-panel" aria-expanded={layout === 'desktop' || inspectorOpen} onClick={() => { setInspectorOpen(true); setLibraryOpen(false) }}><Settings2 size={16}/> 属性</button><div className="page-chip"><FileText size={15}/>{paperMatch.preset?.name ?? '自定义'} <span>{fmt(doc.width)} × {fmt(doc.height)} mm</span></div>
        </div>
        {dimensionTool && toolNotice && <div className="tool-banner" role="status">
          <span className="tool-banner-icon"><Ruler size={16}/></span>
          <span className="tool-banner-text"><strong>尺寸工具已开启</strong><span>依次点击两条边即可生成尺寸线</span></span>
          <span className="tool-banner-esc">Esc 也可退出</span>
          <button onClick={() => setDimensionMode(false)}><X size={14}/> 退出工具</button>
        </div>}
        <div className="canvas-scroll" ref={canvasRef}><div className="canvas-wrap">
          <div className="canvas-caption"><span><span className="canvas-live-dot"/> 实时预览</span><span>单位：毫米 (mm)</span></div>
          <div className="paper-shadow" style={{ width: doc.width * CANVAS_SCALE * zoom, height: doc.height * CANVAS_SCALE * zoom }}>
            <svg ref={svgRef} className={dimensionTool ? 'dimension-mode' : undefined} viewBox={`0 0 ${doc.width} ${doc.height}`} width="100%" height="100%" onPointerDown={onCanvasPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag} onClick={event => { if (ignoreCanvasClick.current) { ignoreCanvasClick.current = false; return } if (dimensionTool) return; if (event.target === event.currentTarget || (event.target as Element).classList.contains('paper-bg')) { setSelected(null); setSelectedDimensionId(null) } }}>
              <rect className="paper-bg" x="0" y="0" width={doc.width} height={doc.height} fill="white"/>
              {visibleLayers.map(({ layer, nodes, boxes, patternNodes }) => {
                const size = layerSize(layer)
                const boardTurn = layer.type === 'board' && layer.allowRotation && layer.rotation ? `rotate(${layer.rotation} ${layer.x + size.width / 2} ${layer.y + size.height / 2})` : undefined
                return <g key={layer.id} onPointerDown={event => startDrag(event, layer)} className="canvas-layer">
                  {layer.type === 'board' && patternNodes && <g className="board-pattern" transform={`translate(${layer.x} ${layer.y})${boardTurn ? ` rotate(${layer.rotation} ${size.width / 2} ${size.height / 2})` : ''}`}>{patternNodes}</g>}
                  {nodes}
                  {/* Child hit areas come first so that the pattern itself keeps the clicks near a corner it shares with the XY mark. */}
                  {layer.type === 'board' && childKinds.map(kind => {
                    const child = boardChild(layer, kind)
                    if (!child.visible || !childSupported(layer, kind)) return null
                    const box = boxes?.[kind]
                    if (!box) return null
                    if (box.width <= 0 || box.height <= 0) return null
                    const turn = childTurn(layer, kind, box, boardTurn)
                    return <g key={`hit-${kind}`} transform={turn}><rect x={box.x} y={box.y} width={box.width} height={box.height} fill="transparent" className="child-hit-area" onPointerDown={event => startChildDrag(event, layer, kind)}/></g>
                  })}
                  <rect transform={boardTurn} x={layer.x} y={layer.type === 'text' ? layer.y - layer.fontSize : layer.y} width={Math.max(size.width, 5)} height={Math.max(size.height, 5)} fill="transparent" className="hit-area"/>
                  {selected === layer.id && <rect className="selection-outline" transform={boardTurn} x={layer.x - 1} y={(layer.type === 'text' ? layer.y - layer.fontSize : layer.y) - 1} width={Math.max(size.width, 5) + 2} height={Math.max(size.height, 5) + 2} fill="none" stroke="var(--theme-accent)" strokeWidth="0.55" strokeDasharray="2 1.2" pointerEvents="none"/>}
                  {layer.type === 'board' && childKinds.map(kind => {
                    const child = boardChild(layer, kind)
                    if (!child.visible || !childSupported(layer, kind) || selected !== boardChildId(layer, kind)) return null
                    const box = boxes?.[kind]
                    if (!box) return null
                    return <g key={`outline-${kind}`} transform={childTurn(layer, kind, box, boardTurn)}><rect x={box.x - 0.6} y={box.y - 0.6} width={box.width + 1.2} height={box.height + 1.2} fill="none" stroke="var(--theme-accent)" strokeWidth="0.4" strokeDasharray="1.6 1" pointerEvents="none"/></g>
                  })}
                </g>
              })}
              {guides.length > 0 && guideNodes(guides)}
              {tab === 'layout' && <g className="dimension-layer">
                {dimensionPrimitives(doc).map(shapeNode)}
                {(doc.dimensions ?? []).map(dimension => {
                  if (!dimension.visible) return null
                  const target = doc.layers.find(layer => layer.id === dimension.targetId)
                  const reference = dimension.referenceId === 'page' ? null : doc.layers.find(layer => layer.id === dimension.referenceId) ?? null
                  if (!target || !target.visible || (dimension.referenceId !== 'page' && (!reference || !reference.visible))) return null
                  const placement = dimensionPlacement(doc, dimension)
                  const from = edgeCoordinate(target, dimension.targetEdge, doc), to = edgeCoordinate(reference, dimension.referenceEdge, doc)
                  const start = Math.min(from, to) - 1.5, end = Math.max(from, to) + 1.5
                  const className = `dimension-hit ${placement.axis === 'x' ? 'axis-x' : 'axis-y'}${selectedDimensionId === dimension.id ? ' selected' : ''}`
                  const open = (event: React.MouseEvent<SVGLineElement>) => { event.stopPropagation(); setSelectedDimensionId(dimension.id); setEditingDimension(dimension.id) }
                  return placement.axis === 'x'
                    ? <line key={dimension.id} className={className} x1={start} y1={placement.line} x2={end} y2={placement.line} onPointerDown={event => startDimensionDrag(event, dimension, placement.line)} onDoubleClick={open}/>
                    : <line key={dimension.id} className={className} x1={placement.line} y1={start} x2={placement.line} y2={end} onPointerDown={event => startDimensionDrag(event, dimension, placement.line)} onDoubleClick={open}/>
                })}
              </g>}
              {dimensionTool && tab === 'layout' && <>
                <rect className="pick-page" x={0} y={0} width={doc.width} height={doc.height} fill="none" pointerEvents="none"/>
                {visibleLayers.map(({ layer }) => {
                  const bounds = layerBounds(layer)
                  return <rect key={`pick-${layer.id}`} className="pick-outline" x={bounds.x} y={bounds.y} width={Math.max(bounds.width, 0.5)} height={Math.max(bounds.height, 0.5)} pointerEvents="none"/>
                })}
                {[hoverEdge, pendingEdge].map((pick, index) => {
                  if (!pick) return null
                  const segment = dimensionEdgeSegment(doc, pick)
                  if (!segment) return null
                  return <line key={`${index}-${pick.layerId}-${pick.edge}`} className={`pick-edge ${index ? 'pending' : 'hover'}`} x1={segment.x1} y1={segment.y1} x2={segment.x2} y2={segment.y2} pointerEvents="none"/>
                })}
              </>}
            </svg>
            {tab === 'layout' && editingDimension && (() => {
              const dimension = (doc.dimensions ?? []).find(item => item.id === editingDimension)
              if (!dimension) return null
              const anchor = dimensionLabelPoint(doc, dimension)
              return <input
                key={dimension.id}
                className="dimension-input"
                autoFocus
                defaultValue={dimensionDistance(doc, dimension).toFixed(1)}
                style={{ left: anchor.x * CANVAS_SCALE * zoom, top: anchor.y * CANVAS_SCALE * zoom }}
                onPointerDown={event => event.stopPropagation()}
                onDoubleClick={event => event.stopPropagation()}
                onBlur={event => { if (event.currentTarget.dataset.done) return; commitDimensionValue(dimension.id, Number(event.currentTarget.value)) }}
                onKeyDown={event => {
                  if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.dataset.done = '1'; commitDimensionValue(dimension.id, Number(event.currentTarget.value)) }
                  else if (event.key === 'Escape') { event.preventDefault(); setEditingDimension(null) }
                }}/>
            })()}
          </div>
          <div className="page-footnote"><Ruler size={14}/> 输出尺寸以毫米定义，导出时保持物理比例</div>
        </div></div>
        <div className="stage-bottom">
          <div className="status-left">
            <span className={`status-dot ${readout?.overflow || (!readout && issues.length) ? 'warn' : ''}`}/>
            {dimensionTool
              ? <span className="dimension-hint">{pendingEdge ? `尺寸工具 · 已选参照「${pendingEdge.layerId === 'page' ? '纸张' : doc.layers.find(layer => layer.id === pendingEdge.layerId)?.name ?? '图层'} · ${edgeLabels[pendingEdge.edge]}」，再点击第二条边生成尺寸线（Esc 取消）` : '尺寸工具 · 点击图层边缘、中心线或纸张边缘作为第一条边（Esc 退出）'}</span>
              : readout
              ? <span className="drag-readout">
                  <strong>X {fmt(readout.x)} · Y {fmt(readout.y)} mm</strong>
                  <span className="status-divider"/>
                  {`距纸边 左 ${fmt(readout.left)} · 右 ${fmt(readout.right)} · 上 ${fmt(readout.top)} · 下 ${fmt(readout.bottom)}`}
                  {readout.relations.length > 0 && <span className="snap-tag"><Magnet size={11}/>{readout.relations.join(' · ')}</span>}
                  {readout.overflow && <span className="snap-tag warn">超出纸张</span>}
                </span>
              : <>{issues.length ? '标定板需要检查' : '标定板已就绪'}<span className="status-divider"/>{doc.layers.filter(l => l.type === 'board').length} {language === 'zh' ? '个标定板' : 'boards'} · {doc.layers.length} {language === 'zh' ? '个图层' : 'layers'}</>}
          </div>
          <div className="issue-status">
            {issues.length > 0 && <button className="issue-trigger" type="button" aria-expanded={issuesOpen} aria-controls="issue-details" onClick={() => setIssuesOpen(open => !open)}><AlertTriangle size={14}/>{`${issues.length} 个问题需要处理`}<ChevronDown size={13} className={issuesOpen ? 'up' : ''}/></button>}
            {issuesOpen && issues.length > 0 && <div id="issue-details" className="issue-popover" role="region" aria-label="问题详情"><div className="issue-popover-head"><strong>问题详情</strong><button type="button" title="关闭问题详情" aria-label="关闭问题详情" onClick={() => setIssuesOpen(false)}><X size={15}/></button></div><ol>{issues.map((issue, index) => <li key={`${index}-${issue}`}>{issue}</li>)}</ol></div>}
          </div>
          <div className="zoom-control"><button title="缩小" onClick={() => manualZoom(stepZoomOut)}><ZoomOut size={16}/></button><span>{zoomLabel(zoom)}</span><button title="放大" onClick={() => manualZoom(stepZoomIn)}><ZoomIn size={16}/></button><button title="适应窗口" aria-pressed={autoFit} className={autoFit ? 'active' : ''} onClick={fitToWindow}><Frame size={15}/></button><button title="重置缩放" onClick={() => manualZoom(1)}><Maximize2 size={15}/></button></div>
        </div>
      </main>
      {inspectorOpen && layout !== 'desktop' && <div className="inspector-backdrop" onClick={() => setInspectorOpen(false)}/>}
      <aside id="property-panel" role={layout !== 'desktop' ? 'dialog' : undefined} aria-modal={layout !== 'desktop' && inspectorOpen ? true : undefined} aria-label="属性设置" className={`sidebar right-sidebar ${inspectorOpen ? 'open' : ''}`} inert={layout !== 'desktop' && !inspectorOpen}>
        <div className="inspector-head"><div><span className="eyebrow">INSPECTOR</span><h2>属性设置</h2></div><button className="inspector-close" aria-label="关闭属性面板" onClick={() => setInspectorOpen(false)}><X size={18}/></button></div>
        <div className="inspector-scroll" ref={inspectorRef}>
          {selectedDimension ? <DimensionInspector
            language={language}
            doc={doc}
            dimension={selectedDimension}
            onChange={change => updateDimension(selectedDimension.id, change)}
            onValue={value => commitDimensionValue(selectedDimension.id, value)}
            onOffset={offset => updateDimension(selectedDimension.id, { offset: dimensionOffset(doc, selectedDimension, dimensionPlacement(doc, selectedDimension).base + offset) })}
            onDelete={() => { removeDimension(selectedDimension.id); setSelectedDimensionId(null) }}
            conflict={conflict && conflict.id === selectedDimension.id ? conflict : null}
            onResolveConflict={resolveConflict}
          /> : selectedChild ? <>
            <div className="selected-layer-summary"><span className="summary-icon">{selectedChild.kind === 'axes' ? <Ruler size={20}/> : selectedChild.kind === 'info' ? <FileText size={20}/> : <Hash size={20}/>}</span><div><strong>{childTitle(boardChild(selectedChild.board, selectedChild.kind), selectedChild.kind)}</strong><small>{selectedChild.board.name} · 子图层</small></div></div>
            <div className="inspector-section"><SectionTitle>{`${childTitle(boardChild(selectedChild.board, selectedChild.kind), selectedChild.kind)}设置`}</SectionTitle>
              <div className="field-stack">
                <NameField label="子图层名称" value={translateText(childTitle(boardChild(selectedChild.board, selectedChild.kind), selectedChild.kind), language)} onCommit={name => renameChild(selectedChild.board.id, selectedChild.kind, name)}/>
                <label className="checkbox-row"><input type="checkbox" checked={boardChild(selectedChild.board, selectedChild.kind).visible} onChange={e => updateChild(selectedChild.board.id, selectedChild.kind, { visible: e.target.checked })}/> {language === 'zh' ? '显示' : 'Show '}{childTitle(boardChild(selectedChild.board, selectedChild.kind), selectedChild.kind)}</label>
              </div>
              <p className="hint-copy">{selectedChild.kind === 'ids' ? '显示每个标记或标签的编号，默认隐藏；可用偏移与大小微调位置，也随标定板一起旋转。' : '名称留空可恢复默认；相对标定板角落定位，可在画布上拖动，尺寸变化时保持对齐。'}</p>
            </div>
            <div className="inspector-section"><SectionTitle>相对位置</SectionTitle>
              <div className="two-fields">
                <NumericInput label="水平偏移" value={boardChild(selectedChild.board, selectedChild.kind).offsetX} suffix="mm" onChange={n => updateChild(selectedChild.board.id, selectedChild.kind, { offsetX: n })}/>
                <NumericInput label="垂直偏移" value={boardChild(selectedChild.board, selectedChild.kind).offsetY} suffix="mm" onChange={n => updateChild(selectedChild.board.id, selectedChild.kind, { offsetY: n })}/>
              </div>
              <div className="child-extra">
                <label className="checkbox-row"><input type="checkbox" checked={boardChild(selectedChild.board, selectedChild.kind).editable ?? selectedChild.board.pluginId === 'custom-binary'} onChange={e => updateChild(selectedChild.board.id, selectedChild.kind, { editable: e.target.checked })}/> 解锁编辑样式与方向</label>
                {(boardChild(selectedChild.board, selectedChild.kind).editable ?? selectedChild.board.pluginId === 'custom-binary') && <>
                  <NumericInput label="大小" value={boardChild(selectedChild.board, selectedChild.kind).scale ?? 1} min={0.25} max={4} step={0.05} suffix="×" onChange={n => updateChild(selectedChild.board.id, selectedChild.kind, { scale: n })}/>
                  {selectedChild.kind === 'info' && <label className="field text-field"><span className="field-label">标签内容（留空使用模板参数）</span><textarea value={boardChild(selectedChild.board, 'info').label ?? ''} onChange={e => updateChild(selectedChild.board.id, 'info', { label: e.target.value })}/></label>}
                  <label className="checkbox-row"><input type="checkbox" checked={boardChild(selectedChild.board, selectedChild.kind).allowRotation ?? false} onChange={e => updateChild(selectedChild.board.id, selectedChild.kind, { allowRotation: e.target.checked, rotation: e.target.checked ? boardChild(selectedChild.board, selectedChild.kind).rotation ?? 0 : 0 })}/> 允许旋转</label>
                  {boardChild(selectedChild.board, selectedChild.kind).allowRotation && <NumericInput label="旋转角度" value={boardChild(selectedChild.board, selectedChild.kind).rotation ?? 0} step={1} suffix="°" onChange={n => updateChild(selectedChild.board.id, selectedChild.kind, { rotation: n })}/>}
                </>}
              </div>
              <button className="reset-child" onClick={() => updateChild(selectedChild.board.id, selectedChild.kind, { offsetX: 0, offsetY: 0, scale: 1, rotation: 0 })}>恢复默认位置与大小</button>
            </div>
          </> : selectedLayer ? <>
            <div className="selected-layer-summary"><span className="summary-icon">{selectedLayer.type === 'board' ? <Grid2X2 size={20}/> : selectedLayer.type === 'text' ? <Type size={20}/> : selectedLayer.type === 'image' ? <ImagePlus size={20}/> : selectedLayer.type === 'scale' ? <Ruler size={20}/> : <Shapes size={20}/>}</span><div><strong>{selectedLayer.name}</strong><small>{selectedLayer.type === 'board' ? '精确标定图层' : selectedLayer.type === 'scale' ? `${SCALE_LINE_LENGTH} mm 校验线` : '自由编辑图层'}</small></div><div className="summary-actions"><button title="下移图层" onClick={() => moveLayer(selectedLayer.id, -1)}><ArrowDown size={15}/></button><button title="上移图层" onClick={() => moveLayer(selectedLayer.id, 1)}><ArrowUp size={15}/></button><button title="复制图层" onClick={() => duplicateLayer(selectedLayer)}><Copy size={15}/></button><button title="删除图层" onClick={() => removeLayer(selectedLayer.id)}><Trash2 size={15}/></button></div></div>
            <div className="inspector-section"><SectionTitle>名称与可见性</SectionTitle>
              <div className="field-stack">
                <NameField label="图层名称" value={translateText(selectedLayer.name, language)} onCommit={name => renameLayer(selectedLayer.id, name)}/>
                <label className="checkbox-row"><input type="checkbox" checked={selectedLayer.visible} onChange={e => updateLayer(selectedLayer.id, { visible: e.target.checked })}/> 在画布中显示</label>
              </div>
              <p className="hint-copy">名称重复时会自动追加序号；也可在图层列表中双击名称直接修改。</p>
            </div>
            {pluginForSelected && selectedLayer.type === 'board' && <>
              <div className="inspector-section"><SectionTitle>标定板参数 <span className="precision-tag"><LockKeyhole size={11}/> 精确</span></SectionTitle>
                <div className="field-stack">
                  <label className="field"><span className="field-label">图案类型</span><select value={selectedLayer.pluginId} onChange={e => choosePlugin(e.target.value)}>{plugins.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                  {pluginForSelected.fields.filter(field => field.key !== 'startCorner').map(field => field.type === 'number'
                    ? <NumericInput key={field.key} label={field.label} value={Number(selectedLayer.params[field.key])} min={field.min} max={field.max} step={field.step} suffix={field.suffix} onChange={n => updateLayer(selectedLayer.id, { params: { ...selectedLayer.params, [field.key]: n } })}/>
                    : field.type === 'select'
                      ? <label className="field" key={field.key}><span className="field-label">{field.label}</span><select value={selectedLayer.params[field.key]} onChange={e => { const params = { ...selectedLayer.params, [field.key]: e.target.value }; if (selectedLayer.pluginId === 'aprilgrid' && field.key === 'dictionary') { const available = dictionaryCapacity(e.target.value) - Number(params.startId); if (Number(params.columns) * Number(params.rows) > available) params.rows = Math.max(2, Math.floor(available / Number(params.columns))) } updateLayer(selectedLayer.id, { params }) }}>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                      : <label className="field text-field" key={field.key}><span className="field-label">{field.label}</span><textarea rows={4} value={selectedLayer.params[field.key]} onChange={e => updateLayer(selectedLayer.id, { params: { ...selectedLayer.params, [field.key]: e.target.value } })}/><small>{field.hint}</small></label>)}
                </div>
                <div className="board-child-controls"><SectionTitle>标注子图层</SectionTitle>
                  {childKinds.filter(kind => childSupported(selectedLayer, kind)).map(kind => <div className="child-control" key={kind}>
                    <button onClick={() => { setSelected(boardChildId(selectedLayer, kind)); changeTab('layers') }}>{childTitle(boardChild(selectedLayer, kind), kind)}</button>
                    <button className="layer-eye" title={boardChild(selectedLayer, kind).visible ? '隐藏' : '显示'} onClick={() => updateChild(selectedLayer.id, kind, { visible: !boardChild(selectedLayer, kind).visible })}>{boardChild(selectedLayer, kind).visible ? <Eye size={16}/> : <EyeOff size={16}/>}</button>
                  </div>)}
                </div>
                {selectedLayer.pluginId === 'charuco' && <p className="hint-copy">左上角为 ArUco 标记对应 OpenCV 4.6 之前的旧版布局（等价于 setLegacyPattern(true)）；OpenCV 4.6 起默认左上角为黑色棋盘格，若识别端使用新版布局，请把左上角方格切换为黑色棋盘格。修改起始 ID 后，识别端也须使用相同的标记 ID 序列。</p>}
                {selectedLayer.pluginId === 'aprilgrid' && (selectedLayer.params.dictionary !== 'APRILTAG_36H11' || boardOriginCorner(selectedLayer) !== 'bottom-left' || Number(selectedLayer.params.startId) !== 0) && <p className="compat-note">此组合可生成 AprilGrid 版式；原版 Kalibr 检测器使用 36h11、左下角起点及从 0 开始的 ID，请确认识别端已适配。</p>}
                <div className="board-orientation">
                  {pluginForSelected.single
                    ? <p className="hint-copy">单码没有排列方向，原点固定在标记中心：Z 轴指向标记外时 X 向右、Y 向上；指向标记内时 X 向右、Y 向下。坐标轴按此约定画在对应角上。</p>
                    : <label className="field"><span className="field-label">坐标原点</span><select value={boardOriginCorner(selectedLayer)} onChange={e => updateLayer(selectedLayer.id, { params: { ...selectedLayer.params, startCorner: e.target.value } })}><option value="top-left">左上角</option><option value="top-right">右上角</option><option value="bottom-left">左下角</option><option value="bottom-right">右下角</option></select></label>}
                  <label className="checkbox-row"><input type="checkbox" checked={selectedLayer.allowRotation ?? false} onChange={e => updateLayer(selectedLayer.id, { allowRotation: e.target.checked, rotation: e.target.checked ? selectedLayer.rotation ?? 0 : 0 })}/> 允许旋转整个标定板</label>
                  {selectedLayer.allowRotation && <NumericInput label="旋转角度" value={selectedLayer.rotation ?? 0} step={1} suffix="°" onChange={n => updateLayer(selectedLayer.id, { rotation: n })}/>}
                </div>
              </div>
              <div className="inspector-section"><SectionTitle>物理尺寸</SectionTitle>
                <div className="dimension-card"><div><span>宽度</span><strong>{fmt(pluginForSelected.size(selectedLayer.params).width)} <small>mm</small></strong></div><span className="dimension-cross">×</span><div><span>高度</span><strong>{fmt(pluginForSelected.size(selectedLayer.params).height)} <small>mm</small></strong></div></div>
                <p className="hint-copy">由板型参数自动计算，禁止非等比缩放。</p>
              </div>
            </>}
            {selectedLayer.type === 'text' && <div className="inspector-section"><SectionTitle>文字内容</SectionTitle><div className="field-stack"><label className="field text-field"><span className="field-label">文本</span><textarea value={selectedLayer.value} rows={3} onChange={e => updateLayer(selectedLayer.id, { value: e.target.value })}/></label><NumericInput label="字号" value={selectedLayer.fontSize} suffix="mm" min={1} max={50} onChange={n => updateLayer(selectedLayer.id, { fontSize: n })}/><label className="field"><span className="field-label">字重</span><select value={selectedLayer.fontWeight} onChange={e => updateLayer(selectedLayer.id, { fontWeight: Number(e.target.value) })}><option value="400">常规</option><option value="500">中等</option><option value="700">加粗</option></select></label><label className="field"><span className="field-label">颜色</span><input type="color" value={selectedLayer.color} onChange={e => updateLayer(selectedLayer.id, { color: e.target.value })}/></label></div></div>}
            {selectedLayer.type === 'scale' && <div className="inspector-section"><SectionTitle>校验线</SectionTitle><div className="field-stack"><label className="field"><span className="field-label">颜色</span><input type="color" value={selectedLayer.color} onChange={e => updateLayer(selectedLayer.id, { color: e.target.value })}/></label><NumericInput label="线宽" value={selectedLayer.strokeWidth} suffix="mm" min={0.1} onChange={n => updateLayer(selectedLayer.id, { strokeWidth: n })}/></div><p className="hint-copy">{`长度固定为 ${SCALE_LINE_LENGTH} mm：校验线用于核对打印比例，因此长度不可修改，只能调整位置、颜色与线宽。`}</p></div>}
            {(selectedLayer.type === 'rect' || selectedLayer.type === 'circle' || selectedLayer.type === 'line' || selectedLayer.type === 'image') && <div className="inspector-section"><SectionTitle>图层样式</SectionTitle><div className="field-stack">{selectedLayer.type === 'circle' ? <><NumericInput label="半径" value={Math.min(selectedLayer.width, selectedLayer.height) / 2} suffix="mm" min={0.1} onChange={n => updateLayer(selectedLayer.id, { width: n * 2, height: n * 2 })}/><NumericInput label="直径" value={Math.min(selectedLayer.width, selectedLayer.height)} suffix="mm" min={0.2} onChange={n => updateLayer(selectedLayer.id, { width: n, height: n })}/></> : <><NumericInput label="宽度" value={selectedLayer.width} suffix="mm" onChange={n => updateLayer(selectedLayer.id, { width: n })}/><NumericInput label="高度" value={selectedLayer.height} suffix="mm" onChange={n => updateLayer(selectedLayer.id, { height: n })}/></>}{selectedLayer.type !== 'image' && <><label className="field"><span className="field-label">颜色</span><input type="color" value={selectedLayer.color} onChange={e => updateLayer(selectedLayer.id, { color: e.target.value })}/></label><label className="checkbox-row"><input type="checkbox" checked={selectedLayer.fill} onChange={e => updateLayer(selectedLayer.id, { fill: e.target.checked })}/> 填充形状</label><NumericInput label="线宽" value={selectedLayer.strokeWidth} suffix="mm" min={0.1} onChange={n => updateLayer(selectedLayer.id, { strokeWidth: n })}/>{selectedLayer.type !== 'line' && <label className="field"><span className="field-label">线宽相对标称轮廓</span><select value={selectedLayer.strokeAlignment ?? 'center'} onChange={e => updateLayer(selectedLayer.id, { strokeAlignment: e.target.value as 'inside' | 'center' | 'outside' })}><option value="inside">内侧</option><option value="center">居中</option><option value="outside">外侧</option></select></label>}</>}</div></div>}
            <div className="inspector-section"><SectionTitle>位置</SectionTitle><div className="two-fields"><NumericInput label="X 坐标" value={selectedLayer.x} suffix="mm" onChange={n => updateLayer(selectedLayer.id, { x: n })}/><NumericInput label="Y 坐标" value={selectedLayer.y} suffix="mm" onChange={n => updateLayer(selectedLayer.id, { y: n })}/></div><p className="hint-copy">方向键微调 0.1 mm，Shift + 方向键 1 mm；拖动时按住 Shift 锁定单方向。</p></div>
          </> : <div className="empty-selection"><MousePointer2 size={25}/><strong>选择一个图层</strong><span>点击画布或左侧图层列表开始编辑；在排版模式选中尺寸线可编辑数值</span></div>}
          {/* Page settings belong to the document itself: they only appear when the
              selection is empty, which is what clicking the paper background does. */}
          {nothingSelected && <div className="inspector-section page-section"><SectionTitle>页面设置</SectionTitle><div className="field-stack"><label className="field"><span className="field-label">项目名称</span><input value={doc.name} onChange={e => setDoc({ ...doc, name: e.target.value })}/></label><label className="field"><span className="field-label">纸张规格</span><select value={paperMatch.preset?.name ?? '自定义'} onChange={e => { const preset = findPreset(e.target.value); if (preset) { const size = orientationSize(preset, paperMatch.orientation); setPageSize(size.width, size.height) } }}><option value="自定义">自定义</option>{paperPresets.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}</select></label><label className="field"><span className="field-label">纸张方向</span><select value={paperMatch.orientation} onChange={e => { const next = flipSize(doc.width, doc.height); if (e.target.value === 'landscape' || e.target.value === 'portrait') setPageSize(next.width, next.height) }}><option value="portrait">纵向</option><option value="landscape">横向</option></select></label><div className="two-fields"><NumericInput label="宽度" value={doc.width} suffix="mm" min={PAGE_MIN} onChange={n => setPageSize(n, doc.height)}/><NumericInput label="高度" value={doc.height} suffix="mm" min={PAGE_MIN} onChange={n => setPageSize(doc.width, n)}/></div>{pageOversize(doc.width, doc.height) && <p className="warn-note">{`纸张超过 ${PAGE_WARN} mm，已超出常规打印范围；PDF 单边上限为 ${PDF_PAGE_MAX} mm。`}</p>}</div></div>}
          {issues.length > 0 && <div className="issues"><strong>需要检查</strong>{issues.map((issue, i) => <p key={i}>{issue}</p>)}</div>}
          <div className="inspector-help"><ShieldCheck size={17}/><span>标定几何与导出文件都在本地生成，数据不会上传。</span></div>
        </div>
        <div className="panel-resizer right" role="separator" aria-orientation="vertical" aria-label="调整右侧栏宽度" aria-valuenow={displayedPanels.right} aria-valuemin={PANEL_MIN.right} tabIndex={0}
          onPointerDown={event => beginResize('right', event)} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize}
          onDoubleClick={() => resetPanel('right')} onKeyDown={event => { if (event.key === 'ArrowLeft') { event.preventDefault(); nudgePanel('right', 16) } else if (event.key === 'ArrowRight') { event.preventDefault(); nudgePanel('right', -16) } }}/>
      </aside>
    </div>
    {toast && <div className="toast">{toast}</div>}
    {newOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setNewOpen(false) }}><div className="new-modal"><div className="modal-head"><div><span className="eyebrow">NEW PROJECT</span><h2>先选择纸张</h2><p>创建后仍可在页面设置中修改尺寸。</p></div><button onClick={() => setNewOpen(false)}><X size={20}/></button></div><div className="new-modal-body"><div className="paper-options">{paperPresets.map(p => { const size = orientationSize(p, newOrientation); return <button key={p.name} className={newPreset === p.name ? 'active' : ''} onClick={() => { setNewPreset(p.name); setNewWidth(size.width); setNewHeight(size.height) }}><strong>{p.name}</strong><span>{`${fmt(size.width)} × ${fmt(size.height)} mm`}</span></button> })}<button className={newPreset === '自定义' ? 'active' : ''} onClick={() => setNewPreset('自定义')}><strong>自定义</strong><span>自定宽高</span></button></div><div className="orientation-picker"><span className="field-label">纸张方向</span><div className="axis-tabs"><button className={newOrientation === 'portrait' ? 'active' : ''} onClick={() => { if (newPreset === '自定义') { const flipped = flipSize(newWidth, newHeight); setNewWidth(flipped.width); setNewHeight(flipped.height) } else setNewOrientation('portrait') }}><RectangleVertical size={13}/> 纵向</button><button className={newOrientation === 'landscape' ? 'active' : ''} onClick={() => { if (newPreset === '自定义') { const flipped = flipSize(newWidth, newHeight); setNewWidth(flipped.width); setNewHeight(flipped.height) } else setNewOrientation('landscape') }}><RectangleHorizontal size={13}/> 横向</button></div></div>{newPreset === '自定义' && <div className="two-fields"><NumericInput label="纸张宽度" value={newWidth} min={PAGE_MIN} suffix="mm" onChange={setNewWidth}/><NumericInput label="纸张高度" value={newHeight} min={PAGE_MIN} suffix="mm" onChange={setNewHeight}/></div>}{pageOversize(newWidth, newHeight) && <p className="warn-note">{`纸张超过 ${PAGE_WARN} mm，已超出常规打印范围；PDF 单边上限为 ${PDF_PAGE_MAX} mm。`}</p>}<label className="field"><span className="field-label">项目名称</span><input value={newName} placeholder="自动生成不重复的名称" onChange={e => setNewName(e.target.value)}/></label></div><div className="modal-footer"><span>图案将按纸张大小自动调整</span><button className="primary-button" onClick={createProject}>创建项目</button></div></div></div>}
    {exportOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setExportOpen(false) }}><div className="export-modal"><div className="modal-head"><div><span className="eyebrow">EXPORT BOARD</span><h2>导出标定板</h2><p>选择适合打印或后续处理的文件格式。</p></div><button onClick={() => setExportOpen(false)}><X size={20}/></button></div><div className="format-grid">{([{ id: 'pdf', label: 'PDF', note: '矢量精确打印', icon: FileText }, { id: 'svg', label: 'SVG', note: '可编辑矢量', icon: Shapes }, { id: 'png', label: 'PNG', note: '指定 DPI 位图', icon: ImagePlus }, { id: 'json', label: 'JSON', note: '项目与元数据', icon: FileJson }] as const).map(item => <button key={item.id} className={format === item.id ? 'active' : ''} onClick={() => setFormat(item.id)}><item.icon size={21}/><strong>{item.label}</strong><small>{item.note}</small></button>)}</div><div className="export-settings"><SectionTitle>输出设置</SectionTitle>{format === 'png' && <label className="field"><span className="field-label">输出分辨率</span><select value={dpi} onChange={e => setDpi(Number(e.target.value))}><option value="150">150 DPI</option><option value="300">300 DPI</option><option value="600">600 DPI</option></select></label>}<label className="checkbox-row export-dimensions"><input type="checkbox" checked={exportDimensions} onChange={e => setExportDimensions(e.target.checked)}/> {`导出工程图尺寸线（${(doc.dimensions ?? []).length} 条）`}</label><div className="compensation"><div><strong>打印比例补偿</strong><small>打印 100 mm 校验线后，输入实测长度</small></div><div className="measure-input"><input type="number" min="1" max="200" step="0.01" value={measured} onChange={e => setMeasured(Number(e.target.value))}/><span>mm</span></div></div>{measured !== 100 && measured > 0 && <p className="comp-note">{`导出内容将按 ${compensation.toFixed(6)} 倍补偿，请确认不会超出纸张边界。`}</p>}</div><div className="modal-footer"><div><strong>{fmt(doc.width)} × {fmt(doc.height)} mm</strong><span>{format === 'png' ? `${Math.round(doc.width / 25.4 * dpi)} × ${Math.round(doc.height / 25.4 * dpi)} px` : '保持实际物理尺寸'}</span></div><button className="primary-button" disabled={busy || issues.length > 0 || measured <= 0 || (format === 'pdf' && pageBeyondPdf(doc.width, doc.height))} onClick={handleExport}><Download size={17}/>{busy ? '生成中…' : `下载 ${format.toUpperCase()}`}</button></div>{format === 'pdf' && pageBeyondPdf(doc.width, doc.height) && <div className="modal-warning">{`纸张过大，无法生成 PDF（单边上限 ${PDF_PAGE_MAX} mm），请改用 SVG 或 PNG。`}</div>}{issues.length > 0 && <div className="modal-warning">导出前请修正参数和页面范围。</div>}</div></div>}
  </div>, language)
}
export default App
