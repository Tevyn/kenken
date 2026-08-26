import { MAX_SIZE, MIN_SIZE } from '../engine/types';
import type { Grid, Puzzle } from '../engine/types';
import type { Marks } from './state';

/** localStorage key for the in-progress game, namespaced to the app. */
const SESSION_KEY = 'kenken:session';

/**
 * A saved game, board only.
 *
 * The undo/redo history is deliberately not here: the player chose to resume a
 * position, not a whole editing session, so a reload lands them on the board as
 * they left it with a clean undo stack. Selection and mode are transient too and
 * left out for the same reason — where the cursor sat is not worth persisting.
 */
export interface SavedSession {
  puzzle: Puzzle;
  values: Grid;
  marks: Marks;
}

/**
 * True when `value` is shaped like a puzzle we could actually play. Not a full
 * validation — the engine trusts its own `Puzzle`s — just enough to reject
 * corrupt or stale JSON before it reaches `createInitialState`, where a bad
 * shape would crash the board rather than fall back to the cover.
 */
function isPuzzle(value: unknown): value is Puzzle {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  if (typeof p.size !== 'number' || p.size < MIN_SIZE || p.size > MAX_SIZE) return false;
  if (!Array.isArray(p.cages) || !Array.isArray(p.solution)) return false;
  return p.solution.length === p.size * p.size;
}

/**
 * Read the saved game, or `null` when there is none or it does not parse.
 *
 * Same storage caveats as the preferences module: access can throw outright,
 * and a crashed game over a bad save would be absurd, so any failure — missing,
 * malformed, or wrong-shaped — falls back to "no saved game", which the cover
 * reads as a disabled Continue.
 */
export function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedSession>;
    const { puzzle, values, marks } = parsed;
    if (!isPuzzle(puzzle)) return null;
    const cells = puzzle.size * puzzle.size;
    if (!Array.isArray(values) || values.length !== cells) return null;
    if (!Array.isArray(marks) || marks.length !== cells) return null;
    return { puzzle, values, marks };
  } catch {
    return null;
  }
}

/** Persist the in-progress game. A storage failure silently drops the write. */
export function saveSession(session: SavedSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Storage unavailable or full - the game just won't survive this reload.
  }
}
