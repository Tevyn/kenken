import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SAMPLE_PUZZLE } from '../fixtures/samplePuzzle'
import { useGame } from './useGame'

function pressKey(key: string, init: KeyboardEventInit = {}) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }))
  })
}

describe('useGame keyboard handling', () => {
  it('selects, types a digit, moves, erases', () => {
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE))

    act(() => result.current.select(0))
    pressKey('1')
    expect(result.current.state.values[0]).toBe(1)

    pressKey('ArrowRight')
    expect(result.current.state.selected).toBe(1)

    pressKey('2')
    expect(result.current.state.values[1]).toBe(2)

    pressKey('Backspace')
    expect(result.current.state.values[1]).toBeNull()
  })

  it('digits beyond the puzzle size are ignored', () => {
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE))
    act(() => result.current.select(0))
    pressKey('9')
    expect(result.current.state.values[0]).toBeNull()
  })

  it('space toggles mode', () => {
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE))
    expect(result.current.state.mode).toBe('value')
    pressKey(' ')
    expect(result.current.state.mode).toBe('mark')
    pressKey(' ')
    expect(result.current.state.mode).toBe('value')
  })

  it('Ctrl+Z undoes and Ctrl+Shift+Z redoes', () => {
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE))
    act(() => result.current.select(0))
    pressKey('1')
    expect(result.current.state.values[0]).toBe(1)

    pressKey('z', { ctrlKey: true })
    expect(result.current.state.values[0]).toBeNull()

    pressKey('z', { ctrlKey: true, shiftKey: true })
    expect(result.current.state.values[0]).toBe(1)
  })

  it('Ctrl+Y also redoes', () => {
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE))
    act(() => result.current.select(0))
    pressKey('1')
    pressKey('z', { ctrlKey: true })
    expect(result.current.state.values[0]).toBeNull()
    pressKey('y', { ctrlKey: true })
    expect(result.current.state.values[0]).toBe(1)
  })

  it('ignores keystrokes while a text input is focused', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE))
    act(() => result.current.select(0))
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }))
    })
    expect(result.current.state.values[0]).toBeNull()

    document.body.removeChild(input)
  })

  it('exposes canUndo/canRedo derived flags', () => {
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE))
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)

    act(() => result.current.select(0))
    act(() => result.current.enterDigit(1))
    expect(result.current.canUndo).toBe(true)

    act(() => result.current.undo())
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(true)
  })
})

describe('useGame auto-clear preference', () => {
  it('defaults to on and flips with setAutoClearMarks', () => {
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE))
    expect(result.current.state.autoClearMarks).toBe(true)

    act(() => result.current.setAutoClearMarks(false))
    expect(result.current.state.autoClearMarks).toBe(false)

    act(() => result.current.setAutoClearMarks(true))
    expect(result.current.state.autoClearMarks).toBe(true)
  })

  it('honours the initial value the caller supplies', () => {
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE, { autoClearMarks: false }))
    expect(result.current.state.autoClearMarks).toBe(false)

    // With it off, entering a 3 next door leaves the pencilled 3 in place.
    act(() => result.current.select(0))
    act(() => result.current.setMode('mark'))
    act(() => result.current.enterDigit(3))
    act(() => result.current.setMode('value'))
    act(() => result.current.select(1))
    act(() => result.current.enterDigit(3))
    expect(result.current.state.marks[0]).toEqual([3])
  })
})

describe('useGame hints', () => {
  it('H explains a step, and a second H applies it', () => {
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE))

    pressKey('h')
    expect(result.current.hintPending).toBe(true)
    expect(result.current.state.hint.kind).toBe('shown')
    expect(result.current.state.values[14]).toBeNull()
    expect(result.current.highlight?.focus).toEqual([14])

    pressKey('h')
    expect(result.current.state.values[14]).toBe(2)
    expect(result.current.hintPending).toBe(false)
    expect(result.current.state.recentHints).toEqual(['freebie-cage|14|2'])
    expect(result.current.highlight).toBeUndefined()
  })

  it('biases the hint toward the selected cell', () => {
    function focusAfterSelecting(cell: number): number[] {
      const { result } = renderHook(() => useGame(SAMPLE_PUZZLE))
      // Take the single rank-10 freebie out of the running first, so several
      // equally-ranked cage hints are left and proximity is what decides.
      pressKey('h')
      pressKey('h')
      act(() => result.current.select(cell))
      pressKey('h')
      const phase = result.current.state.hint
      return phase.kind === 'shown' ? phase.hint.highlight.focus : []
    }

    expect(focusAfterSelecting(0)).toContain(0)
    expect(focusAfterSelecting(15)).toContain(15)
  })

  it('Escape dismisses without applying', () => {
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE))
    pressKey('h')
    pressKey('Escape')
    expect(result.current.state.hint).toEqual({ kind: 'idle' })
    expect(result.current.state.values[14]).toBeNull()
  })

  it('Ctrl+H is left to the browser', () => {
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE))
    pressKey('h', { ctrlKey: true })
    expect(result.current.state.hint).toEqual({ kind: 'idle' })
  })

  it('ignores H while a text input is focused', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE))
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true }))
    })
    expect(result.current.state.hint).toEqual({ kind: 'idle' })

    document.body.removeChild(input)
  })

  it('revealCell turns the escape hatch into an ordinary two-press hint', () => {
    const { result } = renderHook(() => useGame(SAMPLE_PUZZLE))
    act(() => result.current.select(0))
    act(() => result.current.revealCell())

    const phase = result.current.state.hint
    expect(phase.kind).toBe('shown')
    if (phase.kind === 'shown') expect(phase.hint.technique).toBe('reveal')
    expect(result.current.state.values.some((v) => v !== null)).toBe(false)

    act(() => result.current.pressHint())
    expect(result.current.state.values.some((v) => v !== null)).toBe(true)
  })
})
