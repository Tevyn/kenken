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
