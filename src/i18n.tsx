import { cloneElement, isValidElement } from 'react'
import type { ReactElement, ReactNode } from 'react'

export type Language = 'zh' | 'en'

const english: Record<string, string> = {
  '标定板工坊 — 相机标定板生成器': 'Calibration Board Studio — Camera Calibration Target Generator',
  '工具面板': 'Tools', '关闭工具面板': 'Close tools', '关闭属性面板': 'Close properties',
  '项目名称': 'Project name', '页面标题': 'Page title', '自动保存到浏览器': 'Autosaves in this browser', '所有计算均在浏览器本地完成': 'All calculations run locally in your browser',
  '自动保存失败，请下载项目 JSON 备份。': 'Autosave failed. Download a project JSON backup.',
  '新建项目': 'New project', '导入项目': 'Import project', '保存项目 JSON': 'Save project JSON', '导出文件': 'Export',
  '在 GitHub 查看源码': 'View source on GitHub', '在 GitHub 查看源码（新标签页打开）': 'View source on GitHub (opens in a new tab)',
  '标定板': 'Boards', '图层': 'Layers', '排版': 'Layout', '选择标定图案': 'Choose a pattern',
  '选择图案替换当前标定板，或点击 ＋ 添加一个新图层。': 'Choose a pattern to replace the current board, or click + to add a board.',
  '图层结构': 'Layer stack', '标定板保持精确尺寸；装饰层可以自由移动与编辑。': 'Board geometry retains exact dimensions; other layers can be moved and edited.',
  '标定板保持精确尺寸；装饰层可以自由移动与编辑。拖动时会自动吸附对齐，双击名称即可重命名。': 'Board geometry retains exact dimensions; other layers stay editable. Dragging snaps to inference guides, and a double-click renames a layer.',
  '重命名图层': 'Rename layer', '重命名子图层': 'Rename child layer', '全部折叠': 'Collapse all', '全部展开': 'Expand all',
  '展开子图层': 'Expand child layers', '折叠子图层': 'Collapse child layers',
  '名称与可见性': 'Name and visibility', '图层名称': 'Layer name', '子图层名称': 'Child layer name', '在画布中显示': 'Visible on canvas',
  '名称重复时会自动追加序号；也可在图层列表中双击名称直接修改。': 'Duplicate names get a number automatically. Double-click a name in the layer list to edit it directly.',
  '名称留空可恢复默认；相对标定板角落定位，可在画布上拖动，尺寸变化时保持对齐。': 'Leave the name blank to restore the default. The child is anchored to a board corner and can be dragged on the canvas.',
  '方向键微调 0.1 mm，Shift + 方向键 1 mm；拖动时按住 Shift 锁定单方向。': 'Arrow keys nudge by 0.1 mm, Shift + arrows by 1 mm. Hold Shift while dragging to lock one axis.',
  '精确图层不可拉伸，尺寸只能通过参数修改；拖动时按 Alt 可临时关闭吸附，按住 Shift 锁定单方向。': 'Protected geometry can only be resized through its parameters. Hold Alt while dragging to suspend snapping, or Shift to lock one axis.',
  '智能吸附：对齐、等距与网格（按住 Alt 临时关闭）': 'Smart snapping: alignment, equal gaps, and grid. Hold Alt to suspend.',
  '网格吸附步长': 'Grid snap step', '网格关': 'Grid off', '超出纸张': 'Outside page',
  '快速对齐': 'Quick align', '对齐参照': 'Align to', '居中于纸张': 'Center on page',
  '左对齐': 'Align left', '右对齐': 'Align right', '上对齐': 'Align top', '下对齐': 'Align bottom',
  '在画布上拖动时会自动吸附到图层边缘、纸张中心与等距位置；这里用于一步精确落到参照边缘。': 'Dragging on the canvas snaps to layer edges, the page center, and equal gaps. These buttons apply one relation exactly.',
  '页面居中': 'Centered on page', '等距': 'Equal gaps',
  '尺寸工具': 'Dimension tool', '尺寸工具已开启': 'Dimension tool is on', '依次点击两条边即可生成尺寸线': 'click two edges to create a dimension line',
  'Esc 也可退出': 'Esc also exits', '退出工具': 'Turn off tool', 'Z 轴方向': 'Z axis', '指向标记外（Y 向上）': 'Out of the marker (Y up)', '指向标记内（Y 向下）': 'Into the marker (Y down)',
  '单码没有排列方向，原点固定在标记中心：Z 轴指向标记外时 X 向右、Y 向上；指向标记内时 X 向右、Y 向下。坐标轴按此约定画在对应角上。': 'A single marker has no arrangement: the origin is the marker center. With Z out of the marker the frame is X right and Y up; with Z into the marker it is X right and Y down. The axes are drawn at the matching corner.',
  '尺寸数值': 'Dimension value', '线条粗细': 'Line thickness', '数值字号': 'Value font size', '尺寸线颜色': 'Dimension color',
  '箭头样式': 'Arrow style', '引线样式': 'Leader lines',
  '实心箭头': 'Filled arrow', '开口箭头': 'Open arrow', '建筑斜线': 'Architectural tick', '圆点': 'Dot', '无箭头': 'No arrow',
  '自适应（过长时断开）': 'Automatic (breaks when long)', '虚线': 'Dashed', '细实线': 'Thin solid', '只画两端短线': 'Short stubs only', '不画引线': 'Hidden',
  '与其他尺寸冲突': 'Conflicts with other dimensions', '无法保持其他尺寸不变': 'Other dimensions cannot stay put', '仍然修改': 'Change anyway', '取消': 'Cancel',
  '修改被取消。': 'Change cancelled.', '可驱动': 'Driving', '仅测量': 'Measurement only',
  '测量值（输入后被测对象移动）': 'Measured value (the object moves to match)',
  '尺寸线位置（相对几何的偏移）': 'Line position (offset from the geometry)',
  '标注对象': 'Dimension objects', '被测对象（输入数值时移动）': 'Measured object (moves when you type a value)',
  '被测边': 'Measured edge', '参照对象（保持不动）': 'Reference (stays fixed)', '参照边': 'Reference edge',
  '输入数值后被标注对象会移动到该距离，并保持原来的方向；也可以在画布上双击尺寸线直接输入，或直接拖动尺寸线调整位置。': 'A typed value moves the measured object to that distance, keeping its current side. You can also double-click the dimension on the canvas or drag the line itself.',
  '正负号表示被测边在参照边的哪一侧：正值为右侧／下方，负值为左侧／上方，输入负值即可换到另一侧；也可以在画布上双击尺寸线输入，或直接拖动尺寸线调整位置。': 'The sign says which side the measured edge is on: positive is right or below, negative is left or above — type a negative value to move it across. You can also double-click the dimension on the canvas or drag the line itself.',
  '换到另一侧': 'Flip to the other side',
  '在画布上用尺寸工具点击两条边同样可以生成尺寸线；标注同一个图形自身的宽或高时，矩形、圆形、直线与图片会按数值改变尺寸。': 'The dimension tool on the canvas creates lines the same way. A dimension that spans one shape resizes rectangles, circles, lines, and images.',
  '尺寸线属于排版模式：切换到排版后可创建、编辑和拖动尺寸线。': 'Dimension lines belong to layout mode: switch to Layout to create, edit, and drag them.',
  '已添加尺寸线：在右侧属性栏输入数值，或双击 / 拖动画布上的尺寸线。': 'Dimension added: type a value in the inspector, or double-click or drag the line on the canvas.',
  '点击画布或左侧图层列表开始编辑；在排版模式选中尺寸线可编辑数值': 'Select a layer on the canvas or in the layer list; in layout mode you can select a dimension to edit its value.',
  '尺寸工具：依次点击两条边生成尺寸线；双击尺寸线输入数值，拖动尺寸线调整位置（Esc 退出）': 'Dimension tool: click two edges to create a dimension, double-click it to type a value, and drag it to reposition (Esc to exit)',
  '尺寸工具 · 点击图层边缘、中心线或纸张边缘作为第一条边（Esc 退出）': 'Dimension tool: click a layer edge, a center line, or a paper edge as the first edge (Esc to exit)',
  '尺寸工具：已选定第一条边，再点击第二条边生成尺寸线（Esc 取消）': 'Dimension tool: first edge selected, click a second edge to create the dimension (Esc to cancel)',
  '纸张边': 'paper edge',
  '纸张的两条边之间不能标注尺寸。': 'A dimension cannot run between two paper edges.',
  '请选择同一方向的两条边。': 'Choose two edges along the same axis.',
  '该尺寸值无法用于当前图形与所选边。': 'This value cannot be applied to the current shape and edges.',
  '该图层只能测量：标定板与文字尺寸由参数决定。': 'This layer is measurement only: board and text sizes come from their parameters.',
  '用画布工具栏的尺寸工具依次点击两条边即可生成尺寸线；双击尺寸线直接输入数值，拖动尺寸线可调整位置。尺寸值随图层移动自动更新，导出时可选择包含尺寸线的版本。': 'Use the dimension tool in the canvas toolbar and click two edges to create a dimension. Double-click a dimension to type a value, and drag it to reposition. Values follow the geometry, and the export dialog can include them.',
  '用画布工具栏的尺寸工具依次点击两条边即可生成尺寸线；选中尺寸线后可在右侧属性栏输入数值、修改标注对象与位置，也可以双击或直接拖动尺寸线。尺寸值随图层移动自动更新，导出时可选择包含尺寸线的版本。': 'Use the dimension tool in the canvas toolbar and click two edges to create a dimension. Select a dimension to type its value and to change its objects or position in the inspector; you can also double-click or drag the line on the canvas. Values follow the geometry, and the export dialog can include them.',
  '文字': 'Text', '矩形': 'Rectangle', '圆形': 'Circle', '直线': 'Line', '图片': 'Image', '校验线': 'Check line',
  '100 mm 打印校验线': '100 mm print check line',
  '长度固定为 100 mm：校验线用于核对打印比例，因此长度不可修改，只能调整位置、颜色与线宽。': 'The length is fixed at 100 mm: the check line verifies the print scale, so it can be moved, recoloured, and re-weighted but never resized.',
  '文字图层': 'Text layer', '图片图层': 'Image layer', '形状图层': 'Shape layer',
  '上移图层': 'Move layer up', '下移图层': 'Move layer down', '隐藏图层': 'Hide layer', '显示图层': 'Show layer',
  '隐藏子图层': 'Hide child layer', '显示子图层': 'Show child layer', '精确图层不可拉伸，尺寸只能通过参数修改。': 'Protected board geometry can only be resized through its parameters.',
  '编辑画布': 'Canvas', '编辑排版': 'Layout', '撤销': 'Undo', '重做': 'Redo', '属性': 'Properties', '实时预览': 'Live preview',
  '单位：毫米 (mm)': 'Units: millimeters (mm)', '输出尺寸以毫米定义，导出时保持物理比例': 'Output keeps the defined physical dimensions',
  '标定板已就绪': 'Board ready', '标定板需要检查': 'Board needs attention', '问题详情': 'Issue details', '关闭问题详情': 'Close issue details', '缩小': 'Zoom out', '放大': 'Zoom in', '重置缩放': 'Reset zoom', '适应窗口': 'Fit to window',
  '界面缩放': 'Interface scale', '主题色': 'Theme color', '恢复默认': 'Reset', '恢复默认设置': 'Restore default settings', '界面设置已恢复默认，当前项目未改变。': 'Interface settings restored; the current project is unchanged.', '自动': 'Auto',
  '调整左侧栏宽度': 'Resize the left panel', '调整右侧栏宽度': 'Resize the right panel',
  '尺寸线': 'Dimension', '导出标定板': 'Export board', '尺寸线只在排版模式中显示和编辑': 'Dimensions are shown and edited in Layout mode',
  '选中后在右侧属性栏编辑': 'Select to edit it in the inspector',
  '纸张超过 10000 mm，已超出常规打印范围；PDF 单边上限为 5080 mm。': 'Pages above 10000 mm are outside ordinary printing; PDF is limited to 5080 mm per side.',
  '纸张过大，无法生成 PDF（单边上限 5080 mm），请改用 SVG 或 PNG。': 'The page is too large for PDF (5080 mm per side); export SVG or PNG instead.',
  '输入文字': 'Type here',
  '属性设置': 'Inspector', '子图层': 'Child layer',
  'XY 坐标轴': 'XY axes', '参数标签': 'Parameter label', '等长坐标轴': 'Equal length axes', '板型与尺寸': 'Pattern and dimensions',
  'ID 标注': 'ID labels', '逐个标记的编号': 'Number of every marker',
  '显示每个标记或标签的编号，默认隐藏；可用偏移与大小微调位置，也随标定板一起旋转。': 'Shows the number of every marker or tag. It starts hidden; use the offset and size to nudge it, and it rotates with the board.',
  '相对于标定板角落定位；可在画布上拖动，尺寸变化时保持对齐。': 'Anchored to a board corner; drag on the canvas to adjust its position.',
  '相对位置': 'Relative position', '水平偏移': 'Horizontal offset', '垂直偏移': 'Vertical offset',
  '解锁编辑样式与方向': 'Unlock style and direction editing', '大小': 'Size', '标签内容（留空使用模板参数）': 'Label text (blank uses pattern parameters)',
  '允许旋转': 'Allow rotation', '旋转角度': 'Rotation angle', '恢复默认位置与大小': 'Reset position and size',
  '精确标定图层': 'Protected board layer', '自由编辑图层': 'Editable layer', '复制图层': 'Duplicate layer', '删除图层': 'Delete layer',
  '标定板参数': 'Board parameters', '精确': 'Exact', '图案类型': 'Pattern type', '标注子图层': 'Annotation child layers',
  '隐藏': 'Hide', '显示': 'Show', '坐标原点': 'Coordinate origin', '左上角': 'Top left', '右上角': 'Top right',
  '左下角': 'Bottom left', '右下角': 'Bottom right', '允许旋转整个标定板': 'Allow entire board to rotate',
  '物理尺寸': 'Physical size', '宽度': 'Width', '高度': 'Height', '由板型参数自动计算，禁止非等比缩放。': 'Calculated from board parameters; nonuniform scaling is disabled.',
  '文字内容': 'Text content', '文本': 'Text', '字号': 'Font size', '字重': 'Font weight', '颜色': 'Color',
  '常规': 'Regular', '中等': 'Medium', '加粗': 'Bold', '图层样式': 'Layer style', '半径': 'Radius', '直径': 'Diameter',
  '填充形状': 'Fill shape', '线宽': 'Stroke width', '线宽相对标称轮廓': 'Stroke alignment', '内侧': 'Inside', '居中': 'Center', '外侧': 'Outside',
  '位置': 'Position', 'X 坐标': 'X position', 'Y 坐标': 'Y position', '选择一个图层': 'Select a layer',
  '点击画布或左侧图层列表开始编辑': 'Select a layer on the canvas or in the layer list', '页面设置': 'Page settings',
  '纸张规格': 'Paper size', '自定义': 'Custom', '纸张方向': 'Paper orientation', '纵向': 'Portrait', '横向': 'Landscape', '需要检查': 'Check these issues',
  '标定几何与导出文件都在本地生成，数据不会上传。': 'Board geometry and files are generated locally; no data is uploaded.',
  '先选择纸张': 'Choose paper size first', '创建后仍可在页面设置中修改尺寸。': 'You can change the page size later.',
  '自定宽高': 'Custom dimensions', '纸张宽度': 'Paper width', '纸张高度': 'Paper height', '自动生成不重复的名称': 'Generate a unique name automatically',
  '图案将按纸张大小自动调整': 'The starter pattern will fit the paper', '创建项目': 'Create project',
  '选择适合打印或后续处理的文件格式。': 'Choose a format for printing or further processing.', '矢量精确打印': 'Precise vector printing',
  '可编辑矢量': 'Editable vector', '指定 DPI 位图': 'Bitmap at a chosen DPI', '项目与元数据': 'Project and metadata',
  '输出设置': 'Export settings', '输出分辨率': 'Output resolution',
  '打印比例补偿': 'Print scale compensation', '打印 100 mm 校验线后，输入实测长度': 'Enter the measured length of the printed 100 mm line',
  '保持实际物理尺寸': 'Keep physical dimensions', '生成中…': 'Generating…', '导出前请修正参数和页面范围。': 'Fix parameters and page boundaries before export.',
  '精确排版': 'Precise layout', '按毫米对齐图案边缘。标定板居中只计算图案本体。': 'Align pattern edges in millimeters. Board centering uses pattern geometry only.',
  '当前图层': 'Current layer', '选择图层': 'Select layer', '纸张对齐': 'Page alignment', '水平居中': 'Center horizontally', '垂直居中': 'Center vertically',
  '距左纸边': 'Left margin', '距右纸边': 'Right margin', '距上纸边': 'Top margin', '距下纸边': 'Bottom margin',
  '边到边距离': 'Edge to edge distance', '参照对象': 'Reference object', '纸张': 'Page', '水平 X': 'Horizontal X', '垂直 Y': 'Vertical Y',
  '当前图层的边': 'Target edge', '参照对象的边': 'Reference edge', '指定距离（允许负值）': 'Specified distance (negative allowed)',
  '按距离定位': 'Apply distance', '添加尺寸线': 'Add dimension', '工程图尺寸线': 'Drawing dimensions',
  '选中尺寸线后可在右侧属性栏输入数值、修改标注对象与位置，也可以双击或直接拖动尺寸线；导出时可选择包含尺寸线的版本。': 'Select a dimension to set its value, objects, and position in the inspector, or double-click and drag the line itself; the export dialog decides whether files include dimensions.',
  '尚未添加尺寸线': 'No dimensions yet', '显示或隐藏': 'Show or hide', '删除尺寸线': 'Delete dimension',
  '对齐工具': 'Alignment tools',
  '尺寸工具已开启：在画布上依次点击同一方向的两条边生成尺寸线；已有尺寸线仍可选中、双击或拖动。': 'Dimension tool on: click two edges along the same axis to create a dimension; existing lines can still be selected, double-clicked, or dragged.',
  '尺寸工具已关闭。需要添加尺寸线时，请点击画布工具栏的标尺按钮；已有尺寸线仍可选中和编辑。': 'The dimension tool is off. Click the ruler in the canvas toolbar to add dimensions; existing dimensions remain selectable and editable.',
  '按毫米对齐图层边缘：先选择当前图层，再使用下面的对齐参照与距离工具。': 'Align layer edges in millimeters: pick the current layer, then use the reference and distance tools below.',

  '左边': 'Left edge', '右边': 'Right edge', '上边': 'Top edge', '下边': 'Bottom edge', '水平中心': 'Horizontal center', '垂直中心': 'Vertical center',
  '基础图案': 'Basic patterns', '编码标记': 'Coded markers', '棋盘格': 'Chessboard', '经典角点标定': 'Classic corner calibration',
  '对称圆点阵列': 'Symmetric circle grid', '等距圆心网格': 'Evenly spaced circle centers', '非对称圆点': 'Asymmetric circle grid',
  '交错排列圆点阵列': 'Staggered circle grid', 'ArUco 单码': 'Single ArUco marker', '单个可识别方形码': 'Single coded square',
  '多码规则排列': 'Regular marker grid', '棋盘角点 + ArUco': 'Chessboard corners + ArUco',
  'AprilTag 单码': 'Single AprilTag', 'AprilTag 编码方块': 'Coded AprilTag square', '整齐排列的标签阵列': 'Regular tag grid',
  'Kalibr 对称角点布局': 'Kalibr symmetric corner layout', '自定义二值图案': 'Custom binary pattern', '输入 0/1 像素矩阵': 'Enter a 0/1 pixel matrix',
  '列数': 'Columns', '行数': 'Rows', '方格边长': 'Square size', '左上角方格': 'Top left square', '黑色棋盘格': 'Black chess square',
  'ArUco 标记': 'ArUco marker', '圆心间距': 'Center spacing', '圆点直径': 'Circle diameter', '基础间距': 'Base spacing',
  '编码字典': 'Code dictionary', '标记边长': 'Marker size', '标记间距': 'Marker gap', '起始 ID': 'Starting ID', '起始角': 'Starting corner',
  '方格列数': 'Square columns', '方格行数': 'Square rows', '标签边长': 'Tag size', '标签间距': 'Tag gap',
  '标签列数': 'Tag columns', '标签行数': 'Tag rows', '二值矩阵（每行一组）': 'Binary matrix (one group per row)',
  '1 为黑色，0 为白色；用空格或换行分隔行': '1 is black and 0 is white; separate rows with spaces or newlines',
  '单元格边长': 'Cell size', '对称角点': 'Symmetric corners',
  '纸张宽高须至少 1 mm。': 'Paper width and height must be at least 1 mm.',
  '已新建项目。': 'Project created.', '请上传 PNG 或 JPEG 图片。': 'Upload a PNG or JPEG image.',
  '项目已载入。': 'Project loaded.', '项目文件无效。': 'Invalid project file.',
  '请先修正标定板参数与页面尺寸。': 'Fix board parameters and page boundaries first.',
  '导出失败。': 'Export failed.', '图像尺寸过大，请降低 DPI 或页面尺寸。': 'Image too large; reduce DPI or page size.',
  '页面尺寸无效。': 'Invalid page size.', '未知标定板类型。': 'Unknown board type.',
  '标定板超出页面范围。': 'Board extends beyond the page.',
  'XY 坐标轴超出页面范围。': 'XY axes extend beyond the page.',
  '参数标签超出页面范围。': 'Parameter label extends beyond the page.',
  '编码字典不可用。': 'Code dictionary unavailable.',
  '圆点直径应小于圆心间距。': 'Circle diameter must be smaller than center spacing.',
  '圆点直径应小于基础间距。': 'Circle diameter must be smaller than base spacing.',
  '标记边长必须小于方格边长。': 'Marker size must be smaller than square size.',
  '标记数量超出字典容量。': 'Marker count exceeds dictionary capacity.',
  '矩阵只能包含 0、1 和空白字符。': 'The matrix may contain only 0, 1, and whitespace.',
  '左上角为 ArUco 标记对应 OpenCV 4.6 之前的旧版布局（等价于 setLegacyPattern(true)）；OpenCV 4.6 起默认左上角为黑色棋盘格，若识别端使用新版布局，请把左上角方格切换为黑色棋盘格。修改起始 ID 后，识别端也须使用相同的标记 ID 序列。': 'A marker in the top-left square matches the legacy OpenCV arrangement (before 4.6, the same as setLegacyPattern(true)). OpenCV 4.6 and newer default to a black first square, so switch the top-left square to a black chess square when your detector uses the newer layout. After changing the starting ID, configure the detector with the same marker ID sequence.',
  '此组合可生成 AprilGrid 版式；原版 Kalibr 检测器使用 36h11、左下角起点及从 0 开始的 ID，请确认识别端已适配。': 'This AprilGrid layout can be generated, but stock Kalibr uses 36h11, a bottom-left origin, and IDs starting at 0. Confirm that your detector supports the change.',
}

export function translateText(value: string, language: Language): string {
  if (language === 'zh') return value
  const trimmed = value.trim()
  const exact = english[trimmed]
  if (exact) return value.replace(trimmed, exact)
  if (trimmed.endsWith(' 标定板')) return `${translateText(trimmed.slice(0, -4), language)} board`
  if (trimmed.endsWith(' 副本')) return `${translateText(trimmed.slice(0, -3), language)} copy`
  if (trimmed.includes('：')) {
    const [name, detail] = trimmed.split('：', 2)
    if (detail) {
      const field = detail.match(/^(.+)超出允许范围。$/)
      return `${translateText(name, language)}: ${field ? `${translateText(field[1], language)} is out of range.` : translateText(detail, language)}`
    }
  }
  return value
    .replace(/(\d+) 个问题需要处理/g, '$1 issues to fix')
    .replace(/(\d+) 个标定板 · (\d+) 个图层/g, '$1 boards · $2 layers')
    .replace(/^(\d+) 个图层$/, '$1 layers')
    .replace(/^距纸边 左 ([\d.]+) · 右 ([\d.]+) · 上 ([\d.]+) · 下 ([\d.]+)$/, 'Margins L $1 · R $2 · T $3 · B $4')
    .replace(/^图层名称重复，已重命名为「(.+)」。$/, 'Duplicate layer name; renamed to "$1".')
    .replace(/^子图层名称重复，已重命名为「(.+)」。$/, 'Duplicate child layer name; renamed to "$1".')
    .replace(/^与「(.+)」(.+)对齐$/, (_, name: string, edge: string) => `Aligned to "${translateText(name, language)}" (${translateText(edge, language)})`)
    .replace(/^与「(.+)」(.+)贴边$/, (_, name: string, edge: string) => `Touching "${translateText(name, language)}" (${translateText(edge, language)})`)
    .replace(/^网格 ([\d.]+) mm$/, 'Grid $1 mm')
    .replace(/^已阻止修改 · 与 (\d+) 条已有尺寸冲突，请在属性栏确认。$/, 'Change blocked · it conflicts with $1 existing dimensions; confirm it in the inspector.')
    .replace(/^已同时调整 (\d+) 个图层，其他尺寸保持不变。$/, 'Moved $1 layers together; the other dimensions are unchanged.')
    .replace(/^没有能同时满足其他尺寸的解法，这次修改会让 (\d+) 条已有尺寸变化：$/, 'No arrangement keeps the other dimensions intact: this change would move $1 of them:')
    .replace(/^无法保持其他尺寸不变 · (\d+) 条尺寸会同时变化，请在属性栏确认。$/, 'Other dimensions cannot stay put · $1 would change; confirm in the inspector.')
    .replace(/^(.+)设置$/, (_, name: string) => `${translateText(name, language)} settings`)
    .replace(/^(\d+) 条尺寸线在排版模式中编辑$/, '$1 dimension lines — edit them in Layout mode')
    .replace(/^尺寸工具 · 已选参照「(.+) · (.+)」，再点击第二条边生成尺寸线（Esc 取消）$/, (_, name: string, edge: string) => `Dimension tool: reference "${translateText(name, language)}" (${translateText(edge, language)}), click a second edge to create the dimension (Esc to cancel)`)
    .replace(/^(.+?) (\d+)$/, (_, base: string, index: string) => `${translateText(base, language)} ${index}`)
    .replace(/导出工程图尺寸线（(\d+) 条）/g, 'Export drawing dimensions ($1)')
    .replace(/显示(XY 坐标轴|参数标签)/g, (_, name: string) => `Show ${translateText(name, language)}`)
    .replace(/添加 (.+) 图层/g, (_, name: string) => `Add ${translateText(name, language)} layer`)
    .replace(/· 子图层/g, '· child layer')
    .replace(/下载 (PDF|SVG|PNG|JSON)/g, 'Download $1')
    .replace(/(PDF|SVG|PNG|JSON) 已生成。/g, '$1 generated.')
    .replace(/此字典最多包含 (\d+) 个 ID，请减少行列数或调整起始 ID。/g, 'This dictionary has at most $1 IDs; reduce rows or columns, or change the starting ID.')
    .replace(/导出内容将按 ([\d.]+) 倍补偿，请确认不会超出纸张边界。/g, 'Output will be scaled by $1; check that it remains within the page.')
}

/** Rebinding children into a new array drops the "static children" flag, so rebuild it with stable keys. */
function withStableKey(node: ReactNode, index: number): ReactNode {
  if (isValidElement(node) && node.key == null) return cloneElement(node as ReactElement<Record<string, unknown>>, { key: `t${index}` })
  return node
}

export function translateTree(node: ReactNode, language: Language): ReactNode {
  if (language === 'zh') return node
  if (typeof node === 'string') return translateText(node, language)
  if (Array.isArray(node)) {
    const translated = node.map(child => translateTree(child, language))
    return translated.every((child, index) => child === node[index]) ? node : translated.map(withStableKey)
  }
  if (!isValidElement(node)) return node
  const props = node.props as Record<string, unknown>
  if (node.type === 'svg') return node
  const next: Record<string, unknown> = {}
  for (const key of ['title', 'placeholder', 'aria-label', 'label', 'hint']) if (typeof props[key] === 'string') {
    const translated = translateText(props[key], language)
    if (translated !== props[key]) next[key] = translated
  }
  if ('children' in props) {
    const translated = translateTree(props.children as ReactNode, language)
    if (translated !== props.children) next.children = translated
  }
  return Object.keys(next).length ? cloneElement(node as ReactElement<Record<string, unknown>>, next) : node
}
