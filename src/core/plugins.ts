import markerData from '../data/markers.json'
import type { BoardChild, BoardChildKind, BoardPlugin, MarkerSpot, Primitive, Size } from './model'
import { num } from './model'

type Params = Record<string, number | string>
type Dictionary = keyof typeof markerData
const black = '#111820'
const white = '#ffffff'
const integer = (key: string, label: string, min = 2, max = 60) => ({ key, label, type: 'number' as const, min, max, step: 1 })
const length = (key: string, label: string, min = 0.1, max = 250) => ({ key, label, type: 'number' as const, min, max, step: 0.1, suffix: 'mm' })
const dictionaryOptions = [
  { label: 'ArUco · 4×4 / 50', value: 'DICT_4X4_50' },
  { label: 'ArUco · 5×5 / 100', value: 'DICT_5X5_100' },
  { label: 'ArUco · 6×6 / 250', value: 'DICT_6X6_250' },
  { label: 'ArUco · 7×7 / 50', value: 'DICT_7X7_50' },
  { label: 'ArUco · 7×7 / 100', value: 'DICT_7X7_100' },
  { label: 'ArUco · 7×7 / 250', value: 'DICT_7X7_250' },
]
const aprilOptions = [
  { label: 'AprilTag · 16h5', value: 'APRILTAG_16H5' },
  { label: 'AprilTag · 25h9', value: 'APRILTAG_25H9' },
  { label: 'AprilTag · 36h10', value: 'APRILTAG_36H10' },
  { label: 'AprilTag · 36h11', value: 'APRILTAG_36H11' },
]
// A single marker has no arrangement corner, so its frame is pinned by the Z axis:
// Z out of the marker gives X right / Y up, Z into the marker gives X right / Y down.
const zAxisField = { key: 'zAxis', label: 'Z 轴方向', type: 'select' as const, options: [{ label: '指向标记外（Y 向上）', value: 'out' }, { label: '指向标记内（Y 向下）', value: 'in' }] }
const startCornerField = { key: 'startCorner', label: '起始角', type: 'select' as const, options: [{ label: '左上角', value: 'top-left' }, { label: '右上角', value: 'top-right' }, { label: '左下角', value: 'bottom-left' }, { label: '右下角', value: 'bottom-right' }] }
const dictField = (april = false) => ({ key: 'dictionary', label: '编码字典', type: 'select' as const, options: april ? aprilOptions : dictionaryOptions })
function marker(dictionary: Dictionary, id: number, x: number, y: number, size: number, borderBits = 1, officialAprilOrientation = false): Primitive[] {
  const data = markerData[dictionary]
  if (!data || id < 0 || id >= data.codes.length) return []
  const cells = data.size + borderBits * 2
  const unit = size / cells
  const out: Primitive[] = [{ kind: 'rect', x, y, width: size, height: size, fill: white }]
  for (let row = 0; row < cells; row++) for (let col = 0; col < cells; col++) {
    const border = row < borderBits || col < borderBits || row >= cells - borderBits || col >= cells - borderBits
    const dataIndex = (row - borderBits) * data.size + (col - borderBits)
    // OpenCV's AprilTag bitmap is rotated 180° relative to the AprilRobotics
    // published image and Kalibr's PDF. ArUco dictionaries use OpenCV orientation.
    const bit = border || data.codes[id][officialAprilOrientation ? data.size * data.size - 1 - dataIndex : dataIndex] === '1'
    if (bit) out.push({ kind: 'rect', x: x + col * unit, y: y + row * unit, width: unit, height: unit, fill: black })
  }
  return out
}
function chessboard(p: Params): Primitive[] {
  const rows = num(p, 'rows'), columns = num(p, 'columns'), s = num(p, 'squareSize')
  const invert = p.startColor === 'white'
  const out: Primitive[] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
    if (((r + c) % 2 === 0) !== invert) out.push({ kind: 'rect', x: c * s, y: r * s, width: s, height: s, fill: black })
  }
  return out
}
function circles(p: Params, asymmetric: boolean): Primitive[] {
  const rows = num(p, 'rows'), columns = num(p, 'columns'), spacing = num(p, 'spacing'), radius = num(p, 'diameter') / 2
  const out: Primitive[] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
    out.push({ kind: 'circle', cx: radius + (asymmetric ? 2 * c + (r % 2) : c) * spacing, cy: radius + r * spacing, r: radius, fill: black })
  }
  return out
}
function circleSize(p: Params, asymmetric: boolean): Size {
  const rows = num(p, 'rows'), columns = num(p, 'columns'), spacing = num(p, 'spacing'), diameter = num(p, 'diameter')
  return { width: diameter + (asymmetric ? 2 * (columns - 1) + 1 : columns - 1) * spacing, height: diameter + (rows - 1) * spacing }
}
function gridSpots(p: Params): MarkerSpot[] {
  const rows = num(p, 'rows'), columns = num(p, 'columns'), size = num(p, 'markerSize'), gap = num(p, 'gap')
  const corner = String(p.startCorner || 'top-left')
  const out: MarkerSpot[] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
    const idRow = corner.startsWith('bottom') ? rows - 1 - r : r
    const idCol = corner.endsWith('right') ? columns - 1 - c : c
    out.push({ id: idRow * columns + idCol + num(p, 'startId'), x: c * (size + gap), y: r * (size + gap), size })
  }
  return out
}
function grid(p: Params, april = false): Primitive[] {
  const dict = String(p.dictionary) as Dictionary
  return gridSpots(p).flatMap(spot => marker(dict, spot.id, spot.x, spot.y, spot.size, 1, april))
}
const gridSize = (p: Params): Size => {
  const size = num(p, 'markerSize'), gap = num(p, 'gap')
  return { width: num(p, 'columns') * size + (num(p, 'columns') - 1) * gap, height: num(p, 'rows') * size + (num(p, 'rows') - 1) * gap }
}
function aprilGridSize(p: Params): Size {
  const size = num(p, 'markerSize'), gap = size * num(p, 'spacingRatio')
  return { width: num(p, 'columns') * (size + gap) + gap, height: num(p, 'rows') * (size + gap) + gap }
}
function aprilSpots(p: Params): MarkerSpot[] {
  const rows = num(p, 'rows'), columns = num(p, 'columns'), size = num(p, 'markerSize')
  const gap = size * num(p, 'spacingRatio'), pitch = size + gap
  const corner = String(p.startCorner || 'bottom-left')
  const out: MarkerSpot[] = []
  // The bottom-left tag uses startId by default; IDs increase across, then upwards.
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const idRow = corner.startsWith('bottom') ? rows - 1 - row : row
    const idCol = corner.endsWith('right') ? columns - 1 - col : col
    out.push({ id: num(p, 'startId') + idRow * columns + idCol, x: gap + col * pitch, y: gap + row * pitch, size })
  }
  return out
}
function aprilGrid(p: Params): Primitive[] {
  const rows = num(p, 'rows'), columns = num(p, 'columns'), size = num(p, 'markerSize')
  const gap = size * num(p, 'spacingRatio'), pitch = size + gap
  const dictionary = String(p.dictionary) as Dictionary
  const output: Primitive[] = []
  // Kalibr's symmetric corner squares occupy each intersection of the tag gaps.
  for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
    output.push({ kind: 'rect', x: col * pitch, y: row * pitch, width: gap, height: gap, fill: black })
  }
  for (const spot of aprilSpots(p)) output.push(...marker(dictionary, spot.id, spot.x, spot.y, spot.size, 2, true))
  return output
}
function charucoIds(p: Params): { row: number; col: number; id: number }[] {
  const rows = num(p, 'rows'), columns = num(p, 'columns')
  const markerFirst = p.firstSquare === 'marker'
  const markerCells: { row: number; col: number }[] = []
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) if (((row + col) % 2 === 0) === markerFirst) markerCells.push({ row, col })
  const corner = String(p.startCorner || 'top-left')
  markerCells.sort((a, b) => {
    const rowOrder = corner.startsWith('bottom') ? b.row - a.row : a.row - b.row
    return rowOrder || (corner.endsWith('right') ? b.col - a.col : a.col - b.col)
  })
  return markerCells.map((cell, index) => ({ ...cell, id: num(p, 'startId') + index }))
}
function charucoSpots(p: Params): MarkerSpot[] {
  const square = num(p, 'squareSize'), markerSize = num(p, 'markerSize'), offset = (square - markerSize) / 2
  return charucoIds(p).map(cell => ({ id: cell.id, x: cell.col * square + offset, y: cell.row * square + offset, size: markerSize }))
}
function charuco(p: Params): Primitive[] {
  const rows = num(p, 'rows'), columns = num(p, 'columns'), square = num(p, 'squareSize'), markerSize = num(p, 'markerSize')
  const dictionary = String(p.dictionary) as Dictionary
  const markerFirst = p.firstSquare === 'marker'
  const ids = new Map(charucoIds(p).map(cell => [`${cell.row},${cell.col}`, cell.id]))
  const out: Primitive[] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
    if (((r + c) % 2 === 0) !== markerFirst) out.push({ kind: 'rect', x: c * square, y: r * square, width: square, height: square, fill: black })
    else {
      const offset = (square - markerSize) / 2
      out.push(...marker(dictionary, ids.get(`${r},${c}`) ?? 0, c * square + offset, r * square + offset, markerSize))
    }
  }
  return out
}
function custom(p: Params): Primitive[] {
  const rows = String(p.bits).trim().split(/\s+/).filter(Boolean)
  const cells = Math.max(1, ...rows.map(row => row.length))
  const size = num(p, 'cellSize')
  const out: Primitive[] = []
  rows.forEach((row, r) => [...row].forEach((bit, c) => { if (bit === '1') out.push({ kind: 'rect', x: c * size, y: r * size, width: size, height: size, fill: black }) }))
  // Preserve dimensions even when the last cell is white.
  out.unshift({ kind: 'rect', x: 0, y: 0, width: cells * size, height: rows.length * size, fill: white })
  return out
}
const boardMetadata = (p: Params) => ({ ...p })
const markerCheck = (p: Params, markerCount?: number): string[] => {
  const dict = markerData[String(p.dictionary) as Dictionary]
  if (!dict) return ['编码字典不可用。']
  const count = markerCount ?? ('rows' in p ? num(p, 'rows') * num(p, 'columns') : 1)
  if (num(p, 'startId') + count > dict.codes.length) return [`此字典最多包含 ${dict.codes.length} 个 ID，请减少行列数或调整起始 ID。`]
  return []
}
export const plugins: BoardPlugin[] = [
  { id: 'chessboard', name: '棋盘格', category: '基础图案', description: '经典角点标定', icon: '▦', fields: [integer('columns', '列数'), integer('rows', '行数'), length('squareSize', '方格边长'), { key: 'startColor', label: '左上角', type: 'select', options: [{ label: '黑色', value: 'black' }, { label: '白色', value: 'white' }] }], defaults: { columns: 7, rows: 10, squareSize: 15, startColor: 'black' }, size: p => ({ width: num(p, 'columns') * num(p, 'squareSize'), height: num(p, 'rows') * num(p, 'squareSize') }), generate: chessboard, origin: 'top-left', annotation: p => `Chessboard · ${p.columns}×${p.rows} · square ${p.squareSize} mm`, metadata: p => ({ ...p, innerCorners: [num(p, 'columns') - 1, num(p, 'rows') - 1] }) },
  { id: 'circles', name: '对称圆点阵列', category: '基础图案', description: '等距圆心网格', icon: '⠿', fields: [integer('columns', '列数'), integer('rows', '行数'), length('spacing', '圆心间距'), length('diameter', '圆点直径')], defaults: { columns: 7, rows: 10, spacing: 15, diameter: 7 }, size: p => circleSize(p, false), generate: p => circles(p, false), origin: 'top-left', annotation: p => `Circle grid · ${p.columns}×${p.rows} · pitch ${p.spacing} mm`, validate: p => num(p, 'diameter') >= num(p, 'spacing') ? ['圆点直径应小于圆心间距。'] : [] },
  { id: 'asymmetric-circles', name: '非对称圆点', category: '基础图案', description: '交错排列圆点阵列', icon: '⠷', fields: [integer('columns', '列数'), integer('rows', '行数'), length('spacing', '基础间距'), length('diameter', '圆点直径')], defaults: { columns: 4, rows: 11, spacing: 12, diameter: 6 }, size: p => circleSize(p, true), generate: p => circles(p, true), origin: 'top-left', annotation: p => `Asymmetric circles · ${p.columns}×${p.rows} · pitch ${p.spacing} mm`, validate: p => num(p, 'diameter') >= num(p, 'spacing') ? ['圆点直径应小于基础间距。'] : [] },
  { id: 'aruco-single', name: 'ArUco 单码', category: '编码标记', description: '单个可识别方形码', icon: '▣', fields: [dictField(), integer('startId', 'Marker ID', 0, 586), length('markerSize', '标记边长'), zAxisField], defaults: { dictionary: 'DICT_5X5_100', startId: 0, markerSize: 80, zAxis: 'out' }, size: p => ({ width: num(p, 'markerSize'), height: num(p, 'markerSize') }), generate: p => marker(String(p.dictionary) as Dictionary, num(p, 'startId'), 0, 0, num(p, 'markerSize')), markers: p => [{ id: num(p, 'startId'), x: 0, y: 0, size: num(p, 'markerSize') }], origin: 'bottom-left', single: true, annotation: p => `${p.dictionary} · ID ${p.startId} · ${p.markerSize} mm`, validate: markerCheck, metadata: boardMetadata },
  { id: 'aruco-grid', name: 'ArUco GridBoard', category: '编码标记', description: '多码规则排列', icon: '▦', fields: [dictField(), integer('columns', '列数'), integer('rows', '行数'), length('markerSize', '标记边长'), length('gap', '标记间距', 0, 100), integer('startId', '起始 ID', 0, 249), startCornerField], defaults: { dictionary: 'DICT_5X5_100', columns: 4, rows: 6, markerSize: 20, gap: 4, startId: 0, startCorner: 'top-left' }, size: p => gridSize(p), generate: p => grid(p), markers: gridSpots, origin: 'top-left', annotation: p => `${p.dictionary} · ${p.columns}×${p.rows} · marker ${p.markerSize} mm · ID ${p.startId}+`, validate: markerCheck, metadata: boardMetadata },
  {
    id: 'charuco', name: 'ChArUco', category: '编码标记', description: '棋盘角点 + ArUco', icon: '▤',
    fields: [dictField(), integer('columns', '方格列数'), integer('rows', '方格行数'), length('squareSize', '方格边长'), length('markerSize', '标记边长'), integer('startId', '起始 ID', 0, 249),
      { key: 'firstSquare', label: '左上角方格', type: 'select', options: [{ label: 'ArUco 标记', value: 'marker' }, { label: '黑色棋盘格', value: 'black' }] }],
    defaults: { dictionary: 'DICT_5X5_100', columns: 7, rows: 10, squareSize: 15, markerSize: 11, startId: 0, firstSquare: 'marker', startCorner: 'top-left' },
    size: p => ({ width: num(p, 'columns') * num(p, 'squareSize'), height: num(p, 'rows') * num(p, 'squareSize') }),
    generate: charuco, markers: charucoSpots, origin: 'top-left',
    annotation: p => `ChArUco · ${p.columns}×${p.rows} · square ${p.squareSize} mm · marker ${p.markerSize} mm · ID ${p.startId}+`,
    validate: p => [
      ...(num(p, 'markerSize') >= num(p, 'squareSize') ? ['标记边长必须小于方格边长。'] : []),
      ...markerCheck(p, charucoIds(p).length),
    ],
    metadata: p => ({ ...p, innerCorners: [num(p, 'columns') - 1, num(p, 'rows') - 1] }),
  },
  { id: 'apriltag-single', name: 'AprilTag 单码', category: 'AprilTag', description: 'AprilTag 编码方块', icon: '▣', fields: [dictField(true), integer('startId', 'Tag ID', 0, 586), length('markerSize', '标记边长'), zAxisField], defaults: { dictionary: 'APRILTAG_36H11', startId: 0, markerSize: 80, zAxis: 'in' }, size: p => ({ width: num(p, 'markerSize'), height: num(p, 'markerSize') }), generate: p => marker(String(p.dictionary) as Dictionary, num(p, 'startId'), 0, 0, num(p, 'markerSize'), 1, true), markers: p => [{ id: num(p, 'startId'), x: 0, y: 0, size: num(p, 'markerSize') }], origin: 'top-left', single: true, annotation: p => `${p.dictionary} · ID ${p.startId} · ${p.markerSize} mm`, validate: markerCheck, metadata: boardMetadata },
  { id: 'apriltag-grid', name: 'AprilTag Grid', category: 'AprilTag', description: '整齐排列的标签阵列', icon: '▦', fields: [dictField(true), integer('columns', '列数'), integer('rows', '行数'), length('markerSize', '标签边长'), length('gap', '标签间距', 0, 100), integer('startId', '起始 ID', 0, 586), startCornerField], defaults: { dictionary: 'APRILTAG_36H11', columns: 4, rows: 5, markerSize: 20, gap: 5, startId: 0, startCorner: 'top-left' }, size: p => gridSize(p), generate: p => grid(p, true), markers: gridSpots, origin: 'top-left', annotation: p => `${p.dictionary} · ${p.columns}×${p.rows} · tag ${p.markerSize} mm · gap ${p.gap} mm · ID ${p.startId}+`, validate: markerCheck, metadata: boardMetadata },
  {
    id: 'aprilgrid', name: 'AprilGrid / Kalibr', category: 'AprilTag',
    description: 'Kalibr 对称角点布局', icon: '▥',
    fields: [{ key: 'dictionary', label: 'AprilTag family', type: 'select', options: aprilOptions },
      integer('columns', '标签列数'), integer('rows', '标签行数'),
      length('markerSize', 'tagSize'),
      { key: 'spacingRatio', label: 'tagSpacing', type: 'number', min: 0.01, max: 1, step: 0.01, suffix: '×' }, integer('startId', '起始 ID', 0, 586), startCornerField],
    defaults: { dictionary: 'APRILTAG_36H11', columns: 6, rows: 6, markerSize: 14, spacingRatio: 0.3, startId: 0, startCorner: 'bottom-left' },
    size: aprilGridSize, generate: aprilGrid, markers: aprilSpots, origin: 'bottom-left',
    annotation: p => `${String(p.dictionary).replace('APRILTAG_', 'tag').toLowerCase()} · ${p.columns}×${p.rows} tags · tag ${p.markerSize} mm · spacing ${p.spacingRatio}× · ID ${p.startId}+`,
    validate: markerCheck,
    metadata: p => {
      const size = aprilGridSize(p), gap = num(p, 'markerSize') * num(p, 'spacingRatio')
      return { ...p, target_type: 'aprilgrid', tagCols: num(p, 'columns'), tagRows: num(p, 'rows'),
        tagSizeMeters: num(p, 'markerSize') / 1000, tagSpacing: num(p, 'spacingRatio'),
        origin: `${p.startCorner || 'bottom-left'} corner of tag ${num(p, 'startId')}`, originLocalMm: { x: String(p.startCorner || 'bottom-left').endsWith('right') ? size.width - gap : gap, y: String(p.startCorner || 'bottom-left').startsWith('bottom') ? size.height - gap : gap },
        xPositive: String(p.startCorner || 'bottom-left').endsWith('right') ? 'left' : 'right', yPositive: String(p.startCorner || 'bottom-left').startsWith('bottom') ? 'up' : 'down', kalibrDetectorCompatible: p.dictionary === 'APRILTAG_36H11' && (p.startCorner || 'bottom-left') === 'bottom-left' && num(p, 'startId') === 0, borderBits: 2, symmetricCorners: true }
    },
  },
  { id: 'custom-binary', name: '自定义二值图案', category: '自定义', description: '输入 0/1 像素矩阵', icon: '▧', fields: [{ key: 'bits', label: '二值矩阵（每行一组）', type: 'text', hint: '1 为黑色，0 为白色；用空格或换行分隔行' }, length('cellSize', '单元格边长')], defaults: { bits: '11111111 10011001 10100101 10111101 10100101 10011001 11111111', cellSize: 10 }, size: p => { const rows = String(p.bits).trim().split(/\s+/); return { width: Math.max(1, ...rows.map(r => r.length)) * num(p, 'cellSize'), height: rows.length * num(p, 'cellSize') } }, generate: custom, origin: 'top-left', annotation: p => `Binary · ${Math.max(1, ...String(p.bits).trim().split(/\s+/).map(row => row.length))}×${String(p.bits).trim().split(/\s+/).length} · cell ${p.cellSize} mm`, validate: p => /^[01\s]+$/.test(String(p.bits)) ? [] : ['矩阵只能包含 0、1 和空白字符。'], metadata: boardMetadata },
]
/** Child layers every board starts with: annotations visible, the ID overlay hidden. */
export const defaultChildren = (pluginId: string): Record<BoardChildKind, BoardChild> => ({
  axes: { visible: true, offsetX: 0, offsetY: 0, editable: pluginId === 'custom-binary' },
  info: { visible: true, offsetX: 0, offsetY: 0, editable: pluginId === 'custom-binary' },
  ids: { visible: false, offsetX: 0, offsetY: 0 },
})
export const pluginMap = Object.fromEntries(plugins.map(plugin => [plugin.id, plugin])) as Record<string, BoardPlugin>
export const categories = [...new Set(plugins.map(plugin => plugin.category))]
export const dictionaryCapacity = (id: string) => markerData[id as Dictionary]?.codes.length ?? 0
