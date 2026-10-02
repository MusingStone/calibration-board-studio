/** Preferences remain usable in memory when browser storage is unavailable. */
export function readStored(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

export function writeStored(key: string, value: string): boolean {
  try { localStorage.setItem(key, value); return true } catch { return false }
}

export function removeStored(key: string): boolean {
  try { localStorage.removeItem(key); return true } catch { return false }
}
