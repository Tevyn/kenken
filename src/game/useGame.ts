import { useCallback, useEffect, useMemo, useReducer } from 'react'
import type { CellIndex, Puzzle } from '../engine/types'
import type { Direction, GameAction, Mode } from './state'
import { createInitialState, gameReducer } from './state'

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/** True when a keyboard event should be left alone because a form control is focused. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return EDITABLE_TAGS.has(target.tagName)
}

function directionForKey(key: string): Direction | null {
  switch (key) {
    case 'ArrowUp':
      return 'up'
    case 'ArrowDown':
      return 'down'
    case 'ArrowLeft':
      return 'left'
    case 'ArrowRight':
      return 'right'
    default:
      return null
  }
}

/**
 * Reducer-backed game state plus a global keyboard handler.
 *
 * Shortcuts:
 * - Digits 1..size: enter a value or toggle a pencil mark, depending on mode.
 * - Arrow keys: move the selection, clamped at the grid edges.
 * - Backspace / Delete: erase the selected cell.
 * - Space: toggle value/mark input mode.
 * - Ctrl/Cmd+Z: undo. Ctrl/Cmd+Shift+Z or Ctrl+Y: redo.
 *
 * Ignored while a text input, textarea, select, or contenteditable element is focused.
 */
export function useGame(initialPuzzle: Puzzle) {
  const [state, dispatch] = useReducer(gameReducer, initialPuzzle, createInitialState)

  const select = useCallback((index: CellIndex) => dispatch({ type: 'SELECT', index }), [])
  const move = useCallback((direction: Direction) => dispatch({ type: 'MOVE', direction }), [])
  const enterDigit = useCallback((value: number) => dispatch({ type: 'DIGIT', value }), [])
  const erase = useCallback(() => dispatch({ type: 'ERASE' }), [])
  const setMode = useCallback((mode: Mode) => dispatch({ type: 'SET_MODE', mode }), [])
  const toggleMode = useCallback(() => dispatch({ type: 'TOGGLE_MODE' }), [])
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [])
  const redo = useCallback(() => dispatch({ type: 'REDO' }), [])
  const reset = useCallback(() => dispatch({ type: 'RESET' }), [])
  const newPuzzle = useCallback((puzzle: Puzzle) => dispatch({ type: 'NEW_PUZZLE', puzzle }), [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return

      const isMeta = event.ctrlKey || event.metaKey

      if (isMeta && (event.key === 'z' || event.key === 'Z')) {
        event.preventDefault()
        if (event.shiftKey) {
          dispatch({ type: 'REDO' })
        } else {
          dispatch({ type: 'UNDO' })
        }
        return
      }
      if (isMeta && (event.key === 'y' || event.key === 'Y')) {
        event.preventDefault()
        dispatch({ type: 'REDO' })
        return
      }

      const direction = directionForKey(event.key)
      if (direction) {
        event.preventDefault()
        dispatch({ type: 'MOVE', direction })
        return
      }

      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault()
        dispatch({ type: 'ERASE' })
        return
      }

      if (event.key === ' ') {
        event.preventDefault()
        dispatch({ type: 'TOGGLE_MODE' })
        return
      }

      if (/^[1-9]$/.test(event.key)) {
        event.preventDefault()
        dispatch({ type: 'DIGIT', value: Number(event.key) })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const canUndo = state.past.length > 0
  const canRedo = state.future.length > 0

  return useMemo(
    () => ({
      state,
      dispatch: dispatch as (action: GameAction) => void,
      select,
      move,
      enterDigit,
      erase,
      setMode,
      toggleMode,
      undo,
      redo,
      reset,
      newPuzzle,
      canUndo,
      canRedo,
    }),
    [
      state,
      select,
      move,
      enterDigit,
      erase,
      setMode,
      toggleMode,
      undo,
      redo,
      reset,
      newPuzzle,
      canUndo,
      canRedo,
    ],
  )
}
