import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadAutoClearMarks, saveAutoClearMarks } from './preferences'

describe('preferences', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to true when nothing is stored', () => {
    expect(loadAutoClearMarks()).toBe(true)
  })

  it('round-trips true and false through save/load', () => {
    saveAutoClearMarks(false)
    expect(loadAutoClearMarks()).toBe(false)

    saveAutoClearMarks(true)
    expect(loadAutoClearMarks()).toBe(true)
  })

  it('falls back to the default when the stored value is unrecognised', () => {
    localStorage.setItem('kenken:autoClearMarks', 'nonsense')
    expect(loadAutoClearMarks()).toBe(true)
  })

  describe('with a throwing storage', () => {
    const originalLocalStorage = globalThis.localStorage

    beforeEach(() => {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
          getItem() {
            throw new Error('storage disabled')
          },
          setItem() {
            throw new Error('storage disabled')
          },
        },
      })
    })

    afterEach(() => {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: originalLocalStorage,
      })
    })

    it('load falls back to the default instead of throwing', () => {
      expect(() => loadAutoClearMarks()).not.toThrow()
      expect(loadAutoClearMarks()).toBe(true)
    })

    it('save silently does nothing instead of throwing', () => {
      expect(() => saveAutoClearMarks(false)).not.toThrow()
    })
  })
})
