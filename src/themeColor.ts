export const themeColorKey = 'calibration-board-studio-theme-color'
export const defaultThemeColor = '#e9654b'

const validColor = (value: string | null): value is string => !!value && /^#[0-9a-fA-F]{6}$/.test(value)
const channels = (value: string) => [1, 3, 5].map(index => Number.parseInt(value.slice(index, index + 2), 16))
const luminance = (value: string) => {
  const [r, g, b] = channels(value).map(channel => {
    const normalized = channel / 255
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrastOnWhite = (value: string) => 1.05 / (luminance(value) + 0.05)
const hex = (channels: number[]) => `#${channels.map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('')}`

export function storedThemeColor() {
  try {
    const value = localStorage.getItem(themeColorKey)
    return validColor(value) ? value : defaultThemeColor
  } catch {
    return defaultThemeColor
  }
}

/** Interface accent only; paper artwork keeps its own colors. */
export function applyThemeColor(value: string) {
  if (!validColor(value)) return
  const root = document.documentElement
  root.style.setProperty('--theme-accent', value)
  root.style.setProperty('--theme-accent-on', contrastOnWhite(value) >= 4.5 ? '#ffffff' : '#18222a')
  let textColor = value
  const source = channels(value)
  for (let step = 1; contrastOnWhite(textColor) < 4.5 && step <= 20; step++) {
    textColor = hex(source.map(channel => channel * (1 - step * 0.05)))
  }
  root.style.setProperty('--theme-accent-text', textColor)
}
