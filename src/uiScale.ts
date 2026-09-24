/**
 * Interface scale choices. The menu, the stored preference, and the CSS rules
 * that turn the choice into `--ui` all read this one list: adding a step here is
 * the only edit needed for the menu and its stylesheet rules.
 */
export const uiScaleChoices = ['1', '1.1', '1.25', '1.5', '1.75', '2'] as const

export type UiScaleChoice = 'auto' | (typeof uiScaleChoices)[number]

export const uiScaleKey = 'calibration-board-studio-ui-scale'
/** The percentage a menu entry shows, e.g. `1.25` -> `125%`. */
export const uiScaleLabel = (value: UiScaleChoice) => value === 'auto' ? null : `${Math.round(Number(value) * 100)}%`

export function isUiScaleChoice(value: string | null | undefined): value is UiScaleChoice {
  return value === 'auto' || (uiScaleChoices as readonly string[]).includes(value ?? '')
}

/** The stored preference, falling back to the automatic steps. */
export function storedUiScale(): UiScaleChoice {
  try {
    const stored = localStorage.getItem(uiScaleKey)
    return isUiScaleChoice(stored) ? stored : 'auto'
  } catch {
    return 'auto'
  }
}

/**
 * Apply the override to the root element. Without it the CSS steps decide, so
 * "auto" simply removes the attribute.
 */
export function applyUiScale(value: UiScaleChoice) {
  if (value === 'auto') delete document.documentElement.dataset.ui
  else document.documentElement.dataset.ui = value
}
