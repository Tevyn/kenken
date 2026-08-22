/** localStorage key for the auto-clear-pencil-marks preference, namespaced to the app. */
const AUTO_CLEAR_MARKS_KEY = 'kenken:autoClearMarks'

/** localStorage key for the colour-theme preference. */
const THEME_KEY = 'kenken:theme'

/** Which palette to paint: follow the operating system, or override it. */
export type Theme = 'light' | 'dark' | 'system'

/** The three choices, in the order the settings picker shows them. */
export const THEMES: readonly Theme[] = ['light', 'dark', 'system']

/**
 * Read the persisted theme, defaulting to `system`. Same storage caveats as
 * the auto-clear preference below: any failure falls back to the default.
 */
export function loadTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
    return 'system'
  } catch {
    return 'system'
  }
}

/** Persist the theme. A storage failure silently drops the write. */
export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Storage unavailable or full - the preference just won't persist this time.
  }
}

/**
 * Point the document at a palette.
 *
 * This is the whole implementation: every colour in the token layer resolves
 * through `light-dark()`, which reads `color-scheme`, and `src/index.css` maps
 * `[data-theme]` onto `color-scheme`. So one attribute re-themes the app, and
 * `system` is simply the attribute's absence — no token knows this exists.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

/**
 * Read the persisted auto-clear-marks preference, defaulting to `true` when
 * nothing is stored or the stored string isn't one this module wrote.
 *
 * Storage access can throw outright (Safari private mode, a sandboxed iframe
 * with storage disabled), and a crashed game over a preference would be
 * absurd, so any failure just falls back to the default.
 */
export function loadAutoClearMarks(): boolean {
  try {
    const stored = localStorage.getItem(AUTO_CLEAR_MARKS_KEY)
    if (stored === 'false') return false
    return true
  } catch {
    return true
  }
}

/**
 * Persist the auto-clear-marks preference. Same reasoning as `load`: a
 * storage failure should silently drop the write rather than surface anywhere.
 */
export function saveAutoClearMarks(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_CLEAR_MARKS_KEY, String(enabled))
  } catch {
    // Storage unavailable or full - the preference just won't persist this time.
  }
}
