/** localStorage key for the auto-clear-pencil-marks preference, namespaced to the app. */
const AUTO_CLEAR_MARKS_KEY = 'kenken:autoClearMarks'

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
