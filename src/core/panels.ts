/**
 * Widths of the two docking panels. The canvas keeps a minimum width so a
 * dragged panel can never squeeze the stage out of existence, and the limits
 * also depend on the viewport, which is what makes the layout usable on a
 * 1366 px laptop and on a 4K display without a fixed pixel guess.
 */
export type PanelSide = 'left' | 'right'

export const PANEL_MIN = { left: 240, right: 250 } as const
export const PANEL_MAX = { left: 460, right: 560 } as const
/** The stage never becomes narrower than this. */
export const STAGE_MIN = 320
/** Strip between the canvas and a panel that accepts the drag. */
export const PANEL_HANDLE = 7

/**
 * The interface scale, as a multiple of the root font size. Panel widths are
 * stored in pixels, so these thresholds have to grow with the text: otherwise a
 * 1.25× interface would squeeze the same 190 px of content into a panel built
 * for smaller labels.
 */
export type UiScale = number

/** Default share of the viewport, clamped to the absolute limits. */
export function defaultPanelWidth(side: PanelSide, viewportWidth: number, scale: UiScale = 1): number {
  const share = side === 'left' ? 0.19 : 0.21
  return clampPanelWidth(side, Math.round(viewportWidth * share), viewportWidth, 0, scale)
}

export function clampPanelWidth(side: PanelSide, width: number, viewportWidth: number, otherWidth = 0, scale: UiScale = 1): number {
  const configured = Math.round((side === 'left' ? PANEL_MIN.left : PANEL_MIN.right) * scale)
  const ceiling = Math.round((side === 'left' ? PANEL_MAX.left : PANEL_MAX.right) * scale)
  const room = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 1440
  const available = room - STAGE_MIN * scale - otherWidth - PANEL_HANDLE * 2
  const max = Math.max(configured, Math.min(ceiling, available))
  const wanted = Number.isFinite(width) && width > 0 ? width : configured
  return Math.round(Math.min(max, Math.max(configured, wanted)))
}

/** Both panel widths at once, so one clamp cannot push the stage below its minimum. */
export function clampPanels(left: number, right: number, viewportWidth: number, scale: UiScale = 1): { left: number; right: number } {
  const room = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 1440
  const budget = room - STAGE_MIN * scale - PANEL_HANDLE * 2
  let leftWidth = clampPanelWidth('left', left, room, 0, scale)
  let rightWidth = clampPanelWidth('right', right, room, 0, scale)
  const shrink = (side: PanelSide, overflow: number) => {
    if (side === 'left') leftWidth = Math.max(Math.round(PANEL_MIN.left * scale), leftWidth - overflow)
    else rightWidth = Math.max(Math.round(PANEL_MIN.right * scale), rightWidth - overflow)
  }
  // Try both sides: the wider panel may already be at its minimum.
  const first = leftWidth >= rightWidth ? 'left' : 'right'
  shrink(first, Math.max(0, leftWidth + rightWidth - budget))
  shrink(first === 'left' ? 'right' : 'left', Math.max(0, leftWidth + rightWidth - budget))
  return { left: leftWidth, right: rightWidth }
}
