import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { findHint, revealHint, visibleSets } from '../engine'
import type { CellIndex, Puzzle } from '../engine/types'
import type { Direction, GameAction, Mode } from './state'
import { createInitialState, gameReducer, hintHighlight } from './state'

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
 * - H: hint. The first press explains a step, the second applies it.
 * - Escape: dismiss the hint currently on screen.
 *
 * Ignored while a text input, textarea, select, or contenteditable element is focused.
 */
export function useGame(initialPuzzle: Puzzle) {
  const [state, dispatch] = useReducer(gameReducer, initialPuzzle, createInitialState)

  // `pressHint` has to read the live grid but must stay identity-stable for the
  // keyboard listener, so it reads state through a ref rather than closing over it.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

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
  const dismissHint = useCallback(() => dispatch({ type: 'DISMISS_HINT' }), [])

  /**
   * One press of the Hint button (docs/HINTS.md §7.1).
   *
   * From `shown` it applies the hint that is already on screen; from `idle` or
   * `message` it looks for a new one. `findHint` is pure but not free, so it is
   * called here, on the press, and never during render or in an effect.
   */
  const pressHint = useCallback(() => {
    const current = stateRef.current

    if (current.hint.kind === 'shown') {
      const { apply, signature } = current.hint.hint
      // Only an elimination consults `visible`, so only it pays for the fixpoint.
      const visible =
        apply.kind === 'eliminate'
          ? visibleSets(current.puzzle, current.values, current.marks)
          : []
      dispatch({ type: 'APPLY_HINT', apply, visible, signature })
      return
    }

    // `idle`, or a message being retried — the mistake it named may be fixed by now.
    const result = findHint(current.puzzle, current.values, current.marks, {
      near: current.selected,
      recent: current.recentHints,
    })
    dispatch({ type: 'REQUEST_HINT', result })
  }, [])

  /** The `stuck` escape hatch: turn a revealed cell into an ordinary shown hint. */
  const revealCell = useCallback(() => {
    const current = stateRef.current
    const hint = revealHint(current.puzzle, current.values, { near: current.selected })
    dispatch({ type: 'REQUEST_HINT', result: { kind: 'hint', hint } })
  }, [])

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

      // Bare H only: Ctrl/Cmd+H belongs to the browser.
      if (!isMeta && (event.key === 'h' || event.key === 'H')) {
        event.preventDefault()
        pressHint()
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        dispatch({ type: 'DISMISS_HINT' })
        return
      }

      if (/^[1-9]$/.test(event.key)) {
        event.preventDefault()
        dispatch({ type: 'DIGIT', value: Number(event.key) })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pressHint])

  const canUndo = state.past.length > 0
  const canRedo = state.future.length > 0
  /** True when a hint is explained and waiting for the second press. */
  const hintPending = state.hint.kind === 'shown'
  const highlight = useMemo(() => hintHighlight(state.hint), [state.hint])

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
      pressHint,
      dismissHint,
      revealCell,
      canUndo,
      canRedo,
      hintPending,
      highlight,
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
      pressHint,
      dismissHint,
      revealCell,
      canUndo,
      canRedo,
      hintPending,
      highlight,
    ],
  )
}
