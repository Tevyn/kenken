import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { checkCorrectness, findHint, findNextNumber } from '../engine'
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

export interface UseGameOptions {
  /** Initial value of the auto-clear-pencil-marks preference. Defaults to true. */
  autoClearMarks?: boolean
  /**
   * Hand the keyboard back to the rest of the page.
   *
   * While true the window handler returns before it inspects the key — no
   * dispatch and, just as importantly, no `preventDefault`, so a focused
   * `<button>` inside an open popover still activates on Space. The owner sets
   * this whenever something modal is on screen; unlike `autoClearMarks` it is
   * read on every render, not just at mount.
   */
  suspended?: boolean
  /**
   * The `H` shortcut. Forwarded rather than handled, because the panel it opens
   * is owned above the game — opening one is what sets `suspended` — and the
   * game has no business reaching up to open it.
   */
  onRequestHint?: () => void
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
 * - H: open the hint panel, via `options.onRequestHint`.
 * - Escape: dismiss the hint left on the board after the panel closed.
 *
 * Ignored while a text input, textarea, select, or contenteditable element is
 * focused, and ignored entirely while `options.suspended` is set — that is how
 * an open popover takes the keyboard, since its panel is all `<button>`s and
 * tag-name sniffing would never notice it.
 *
 * `options.autoClearMarks` seeds the auto-clear preference and is read once, at
 * mount: the caller owns the persisted value and drives later changes through
 * `setAutoClearMarks`.
 */
export function useGame(initialPuzzle: Puzzle, options?: UseGameOptions) {
  const initialAutoClearMarks = options?.autoClearMarks ?? true
  const suspended = options?.suspended ?? false
  const [state, dispatch] = useReducer(gameReducer, initialPuzzle, (puzzle: Puzzle) =>
    createInitialState(puzzle, initialAutoClearMarks),
  )

  // The panel's three choices all have to read the live grid but must stay
  // identity-stable for the popover that hangs off them, so they read state
  // through a ref rather than closing over it.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Same trick for the H shortcut: the listener below is installed once, so it
  // must not close over a callback the owner is free to redefine every render.
  const requestHintRef = useRef(options?.onRequestHint)
  useEffect(() => {
    requestHintRef.current = options?.onRequestHint
  }, [options?.onRequestHint])

  const select = useCallback((index: CellIndex) => dispatch({ type: 'SELECT', index }), [])
  const move = useCallback((direction: Direction) => dispatch({ type: 'MOVE', direction }), [])
  const enterDigit = useCallback((value: number) => dispatch({ type: 'DIGIT', value }), [])
  const erase = useCallback(() => dispatch({ type: 'ERASE' }), [])
  const setMode = useCallback((mode: Mode) => dispatch({ type: 'SET_MODE', mode }), [])
  const toggleMode = useCallback(() => dispatch({ type: 'TOGGLE_MODE' }), [])
  const setAutoClearMarks = useCallback(
    (enabled: boolean) => dispatch({ type: 'SET_AUTO_CLEAR_MARKS', enabled }),
    [],
  )
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [])
  const redo = useCallback(() => dispatch({ type: 'REDO' }), [])
  const reset = useCallback(() => dispatch({ type: 'RESET' }), [])
  const newPuzzle = useCallback((puzzle: Puzzle) => dispatch({ type: 'NEW_PUZZLE', puzzle }), [])

  /** Options every ladder call shares: bias toward the cursor, skip what was just applied. */
  const hintOptions = useCallback(() => {
    const current = stateRef.current
    return { near: current.selected, recent: current.recentHints }
  }, [])

  /**
   * The panel's Tip choice: explain the easiest step available, in words and in
   * highlight. `findHint` is pure but not free, so it is called here, on the
   * press, and never during render or in an effect.
   */
  const showHint = useCallback(() => {
    const current = stateRef.current
    const result = findHint(current.puzzle, current.values, current.marks, hintOptions())
    dispatch({ type: 'REQUEST_HINT', result })
  }, [hintOptions])

  /** The panel's Correctness choice: judge every filled cell against the solution. */
  const checkBoard = useCallback(() => {
    const current = stateRef.current
    dispatch({ type: 'CHECK_CORRECTNESS', report: checkCorrectness(current.puzzle, current.values) })
  }, [])

  /**
   * The panel's Number choice: write the next digit the ladder would reach.
   *
   * Reports whether it wrote one, because the panel has to decide between
   * getting out of the way and staying open to explain itself. Nothing to place
   * means the ladder had something else to say — a mistake, a dead end, a
   * finished grid — so that is what goes on screen instead of silence.
   */
  const placeNumber = useCallback((): boolean => {
    const current = stateRef.current
    const options = hintOptions()
    const next = findNextNumber(current.puzzle, current.values, current.marks, options)
    if (!next) {
      dispatch({
        type: 'REQUEST_HINT',
        result: findHint(current.puzzle, current.values, current.marks, options),
      })
      return false
    }
    // `visible` is only ever read by the eliminate branch, and this is a placement.
    dispatch({ type: 'APPLY_HINT', apply: { kind: 'place', cells: [next] }, visible: [] })
    return true
  }, [hintOptions])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Before anything else, and before any preventDefault: while suspended the
      // key belongs to whatever is on top of the board.
      if (suspended) return
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
        requestHintRef.current?.()
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
  }, [suspended])

  const expiring = state.verdict.correct.length > 0 || state.placed.length > 0

  /*
   * The green treatments last exactly one move: a confirmed cell and a
   * placed digit are both statements about the board as the player left it, and
   * the moment they touch it again the statement is about something else.
   *
   * `mousedown` and `keydown` rather than `click` and `keyup`, and that is the
   * whole trick: both states are created by a `click` on a panel button, and a
   * click is the *end* of an interaction that began with a mousedown (or, for
   * Enter on a button, with a keydown whose default action dispatches the
   * click). So the press that asked for the treatment is already spent by the
   * time this listener exists, and the next one — anywhere on the page — is the
   * first it can possibly see. No timer, and no dependence on when effects run.
   */
  useEffect(() => {
    if (!expiring) return
    function clear() {
      dispatch({ type: 'CLEAR_FEEDBACK' })
    }
    window.addEventListener('mousedown', clear)
    window.addEventListener('keydown', clear)
    return () => {
      window.removeEventListener('mousedown', clear)
      window.removeEventListener('keydown', clear)
    }
  }, [expiring])

  const canUndo = state.past.length > 0
  const canRedo = state.future.length > 0
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
      setAutoClearMarks,
      undo,
      redo,
      reset,
      newPuzzle,
      showHint,
      checkBoard,
      placeNumber,
      canUndo,
      canRedo,
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
      setAutoClearMarks,
      undo,
      redo,
      reset,
      newPuzzle,
      showHint,
      checkBoard,
      placeNumber,
      canUndo,
      canRedo,
      highlight,
    ],
  )
}
