import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import {
  cageCombinations,
  cageLabel,
  checkCorrectness,
  combinationText,
  findHint,
  findNextNumber,
  revealHint,
} from '../engine';
import type { CellIndex, Puzzle } from '../engine/types';
import type { BoardSeed, Direction, GameAction, Mode } from './state';
import { createInitialState, gameReducer, hintHighlight } from './state';

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** True when a keyboard event should be left alone because a form control is focused. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return EDITABLE_TAGS.has(target.tagName);
}

export interface UseGameOptions {
  /** Initial value of the auto-clear-pencil-marks preference. Defaults to true. */
  autoClearMarks?: boolean;
  /**
   * Initial value of the auto-fill-single-cages preference. Defaults to false.
   * Read once, at mount, like `autoClearMarks`: when true the one-cell cages are
   * already filled in on the board the reducer opens with.
   */
  autoFillSingleCages?: boolean;
  /**
   * Hand the keyboard back to the rest of the page.
   *
   * While true the window handler returns before it inspects the key — no
   * dispatch and, just as importantly, no `preventDefault`, so a focused
   * `<button>` inside an open popover still activates on Space. The owner sets
   * this whenever something modal is on screen; unlike `autoClearMarks` it is
   * read on every render, not just at mount.
   */
  suspended?: boolean;
  /**
   * The `H` shortcut. Forwarded rather than handled, because the panel it opens
   * is owned above the game — opening one is what sets `suspended` — and the
   * game has no business reaching up to open it.
   */
  onRequestHint?: () => void;
  /**
   * A board to resume instead of an empty one — the values and marks a saved
   * game restores. Read once, at mount, like `autoClearMarks`: the reducer's
   * state is the only record of the board from then on.
   */
  seed?: BoardSeed;
}

/** One line of the Combinations panel: an arithmetic expression, still allowed or not. */
export interface CombinationLine {
  /** The combination written out, e.g. `"8 ÷ 4"`. */
  text: string;
  /** False when the board has ruled this combination out. */
  possible: boolean;
}

/** What the Combinations choice shows for the selected cell's cage. */
export interface CombinationsView {
  /** The cage's label, e.g. `"2÷"`, naming which cage the list is for. */
  cageLabel: string;
  /** Every combination, possible first; `null` when there are too many to list. */
  lines: CombinationLine[] | null;
}

function directionForKey(key: string): Direction | null {
  switch (key) {
    case 'ArrowUp':
      return 'up';
    case 'ArrowDown':
      return 'down';
    case 'ArrowLeft':
      return 'left';
    case 'ArrowRight':
      return 'right';
    default:
      return null;
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
  const initialAutoClearMarks = options?.autoClearMarks ?? true;
  const initialAutoFillSingleCages = options?.autoFillSingleCages ?? false;
  const suspended = options?.suspended ?? false;
  const [state, dispatch] = useReducer(gameReducer, initialPuzzle, (puzzle: Puzzle) =>
    createInitialState(puzzle, initialAutoClearMarks, options?.seed, initialAutoFillSingleCages),
  );

  // The panel's three choices all have to read the live grid but must stay
  // identity-stable for the popover that hangs off them, so they read state
  // through a ref rather than closing over it.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Same trick for the H shortcut: the listener below is installed once, so it
  // must not close over a callback the owner is free to redefine every render.
  const requestHintRef = useRef(options?.onRequestHint);
  useEffect(() => {
    requestHintRef.current = options?.onRequestHint;
  }, [options?.onRequestHint]);

  const select = useCallback((index: CellIndex) => dispatch({ type: 'SELECT', index }), []);
  const move = useCallback((direction: Direction) => dispatch({ type: 'MOVE', direction }), []);
  const enterDigit = useCallback((value: number) => dispatch({ type: 'DIGIT', value }), []);
  const erase = useCallback(() => dispatch({ type: 'ERASE' }), []);
  const setMode = useCallback((mode: Mode) => dispatch({ type: 'SET_MODE', mode }), []);
  const toggleMode = useCallback(() => dispatch({ type: 'TOGGLE_MODE' }), []);
  const setAutoClearMarks = useCallback(
    (enabled: boolean) => dispatch({ type: 'SET_AUTO_CLEAR_MARKS', enabled }),
    [],
  );
  const setAutoFillSingleCages = useCallback(
    (enabled: boolean) => dispatch({ type: 'SET_AUTO_FILL_SINGLE_CAGES', enabled }),
    [],
  );
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);
  const newPuzzle = useCallback((puzzle: Puzzle) => dispatch({ type: 'NEW_PUZZLE', puzzle }), []);
  /** Drop whatever the hint panel was explaining, and the highlight it drew. */
  const dismissHint = useCallback(() => dispatch({ type: 'DISMISS_HINT' }), []);

  /** Options every ladder call shares: bias toward the cursor, skip what was just applied. */
  const hintOptions = useCallback(() => {
    const current = stateRef.current;
    return { near: current.selected, recent: current.recentHints };
  }, []);

  /**
   * The panel's Tip choice: explain the easiest step available, in words and in
   * highlight. `findHint` is pure but not free, so it is called here, on the
   * press, and never during render or in an effect.
   */
  const showHint = useCallback(() => {
    const current = stateRef.current;
    const result = findHint(current.puzzle, current.values, current.marks, hintOptions());
    dispatch({ type: 'REQUEST_HINT', result });
  }, [hintOptions]);

  /**
   * The panel's Correctness choice: judge every filled cell against the
   * solution.
   *
   * Reports how many came back wrong, because the panel has a sentence to write
   * either way and the count is part of it. Only the rejected cells reach the
   * board; the confirmed ones are the player's own work and go unremarked.
   */
  const checkBoard = useCallback((): number => {
    const current = stateRef.current;
    const report = checkCorrectness(current.puzzle, current.values);
    dispatch({ type: 'CHECK_CORRECTNESS', report });
    return report.incorrect.length;
  }, []);

  /**
   * The panel's Number choice: write a digit, always. First the next one the
   * ladder can reason out; when it is stuck — a mistake on the board, a dead
   * end, a search past its cap — a correct one straight from the solution
   * instead, because a player who asked for a number is owed a number, not the
   * explanation the ladder happens to have. Only a wholly filled grid has none
   * to give, and reports so with `false`.
   */
  const placeNumber = useCallback((): boolean => {
    const current = stateRef.current;
    const options = hintOptions();
    const next = findNextNumber(current.puzzle, current.values, current.marks, options);
    // `visible` is only ever read by the eliminate branch, and this is a placement.
    if (next) {
      dispatch({ type: 'APPLY_HINT', apply: { kind: 'place', cells: [next] }, visible: [] });
      return true;
    }
    if (!current.values.some((value) => value === null)) return false;
    const reveal = revealHint(current.puzzle, current.values, { near: current.selected });
    dispatch({ type: 'APPLY_HINT', apply: reveal.apply, visible: [] });
    return true;
  }, [hintOptions]);

  /**
   * The panel's Combinations choice: every digit set the selected cell's cage
   * could hold, with the ones the board rules out marked. Read from `stateRef`
   * on the press like the other choices, and null when nothing is selected — the
   * choice is disabled then, so the panel never actually calls it in that state.
   */
  const combinationsFor = useCallback((): CombinationsView | null => {
    const current = stateRef.current;
    const selected = current.selected;
    if (selected == null) return null;
    const { puzzle, values } = current;
    const cage = puzzle.cages.find((c) => c.cells.includes(selected));
    if (!cage) return null;
    const combos = cageCombinations(puzzle, values, cage);
    return {
      cageLabel: cageLabel(cage),
      lines:
        combos === null
          ? null
          : combos.map((c) => ({
              text: combinationText(cage.op, c.digits),
              possible: c.possible,
            })),
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Before anything else, and before any preventDefault: while suspended the
      // key belongs to whatever is on top of the board.
      if (suspended) return;
      if (isTypingTarget(event.target)) return;

      const isMeta = event.ctrlKey || event.metaKey;

      if (isMeta && (event.key === 'z' || event.key === 'Z')) {
        event.preventDefault();
        if (event.shiftKey) {
          dispatch({ type: 'REDO' });
        } else {
          dispatch({ type: 'UNDO' });
        }
        return;
      }
      if (isMeta && (event.key === 'y' || event.key === 'Y')) {
        event.preventDefault();
        dispatch({ type: 'REDO' });
        return;
      }

      const direction = directionForKey(event.key);
      if (direction) {
        event.preventDefault();
        dispatch({ type: 'MOVE', direction });
        return;
      }

      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        dispatch({ type: 'ERASE' });
        return;
      }

      if (event.key === ' ') {
        event.preventDefault();
        dispatch({ type: 'TOGGLE_MODE' });
        return;
      }

      // Bare H only: Ctrl/Cmd+H belongs to the browser.
      if (!isMeta && (event.key === 'h' || event.key === 'H')) {
        event.preventDefault();
        requestHintRef.current?.();
        return;
      }

      if (/^[1-9]$/.test(event.key)) {
        event.preventDefault();
        dispatch({ type: 'DIGIT', value: Number(event.key) });
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [suspended]);

  const expiring = state.placed.length > 0;

  /*
   * A hint-placed digit is marked for exactly one move: it is a statement about
   * the board as the player left it, and the moment they touch it again the
   * statement is about something else. The verdict's marks are not on this
   * clock — each belongs to its own cell and goes when that cell is edited.
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
    if (!expiring) return;
    function clear() {
      dispatch({ type: 'CLEAR_FEEDBACK' });
    }
    window.addEventListener('mousedown', clear);
    window.addEventListener('keydown', clear);
    return () => {
      window.removeEventListener('mousedown', clear);
      window.removeEventListener('keydown', clear);
    };
  }, [expiring]);

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;
  const highlight = useMemo(() => hintHighlight(state.hint), [state.hint]);

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
      setAutoFillSingleCages,
      undo,
      redo,
      reset,
      newPuzzle,
      dismissHint,
      showHint,
      checkBoard,
      placeNumber,
      combinationsFor,
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
      setAutoFillSingleCages,
      undo,
      redo,
      reset,
      newPuzzle,
      dismissHint,
      showHint,
      checkBoard,
      placeNumber,
      combinationsFor,
      canUndo,
      canRedo,
      highlight,
    ],
  );
}
