import { useEffect, useRef, useState } from 'react';
import type { GridErrors } from '../engine/errors';
import type { CellIndex, Grid, Puzzle } from '../engine/types';
import { cageIdByCell, colOf, rowOf } from '../engine/types';
import type { Verdict } from '../game/state';

/*
 * The completion glow: a bloom that ripples through a cage, row, column, or the
 * whole grid the moment the player finishes it without any red-marked digit.
 *
 * These timings were dialled in by hand in the glow lab mockup and are the one
 * source of truth for the effect — the stylesheet reads the duration and
 * intensity off CSS variables the Board sets from the constants here, so there
 * is nothing to keep in sync by eye.
 *
 * Rows, columns, and the whole-puzzle sweep step one wavefront every
 * `LINE_STEP_MS`; a cage ripples a touch slower at `CAGE_STEP_MS`. All four use
 * the same bloom, so only the spacing differs.
 */
export const LINE_STEP_MS = 60;
export const CAGE_STEP_MS = 80;
export const GLOW_DURATION_MS = 600;
export const GLOW_INTENSITY = 0.7;

/** A little slack past the last cell's animation before the glow layer is torn down. */
const CLEANUP_SLACK_MS = 80;

/**
 * How long the whole-grid finish sweep takes, start to finish.
 *
 * The corner-to-corner sweep lights its last cell — the bottom-right one — at
 * `2 * (size - 1) * LINE_STEP_MS` (see `computeGlowDelays`' `'puzzle'` branch),
 * and that cell then blooms for `GLOW_DURATION_MS`. Reduced motion collapses the
 * stagger to zero (Cell.css zeroes every delay), leaving only the single bloom.
 *
 * The success overlay uses this to hold itself back until the board has finished
 * celebrating rather than landing on top of the ripple.
 */
export function puzzleFinishSweepMs(size: number, reducedMotion: boolean): number {
  const sweep = reducedMotion ? 0 : 2 * (size - 1) * LINE_STEP_MS;
  return sweep + GLOW_DURATION_MS;
}

/**
 * A unit the player can complete, as a stable string key: one per row, column,
 * and cage, plus the whole grid. Used to compare "what was finished" between two
 * board states without allocating objects.
 */
type UnitKey = string;

/** What the Board needs to draw one ripple: a per-cell start delay, plus a token. */
export interface CompletionGlow {
  /** Start delay in ms, keyed by flat cell index. Cells absent from the map do not glow. */
  readonly delays: ReadonlyMap<CellIndex, number>;
  /**
   * Bumped for every ripple. The Board keys each glow layer on it so a fresh
   * completion restarts the CSS animation even while an earlier one is mid-fade.
   */
  readonly token: number;
}

/**
 * Every unit that is completely filled and carries no red-marked digit.
 *
 * "Red-marked" is read from both channels the board paints red: a provable
 * conflict (`errors.cells`) and a cell the Correctness check rejected
 * (`verdict`). A unit with either on any of its cells is not celebrated.
 */
export function cleanCompleteUnits(
  puzzle: Puzzle,
  values: Grid,
  errors: GridErrors,
  verdict: Verdict,
): Set<UnitKey> {
  const { size } = puzzle;
  const verdictSet = verdict.length > 0 ? new Set(verdict) : null;
  const isRed = (cell: CellIndex) => errors.cells.has(cell) || (verdictSet?.has(cell) ?? false);

  const units = new Set<UnitKey>();

  for (let line = 0; line < size; line++) {
    let rowFull = true;
    let rowClean = true;
    let colFull = true;
    let colClean = true;
    for (let k = 0; k < size; k++) {
      const rowCell = line * size + k;
      const colCell = k * size + line;
      if (values[rowCell] == null) rowFull = false;
      else if (isRed(rowCell)) rowClean = false;
      if (values[colCell] == null) colFull = false;
      else if (isRed(colCell)) colClean = false;
    }
    if (rowFull && rowClean) units.add(`row:${line}`);
    if (colFull && colClean) units.add(`col:${line}`);
  }

  for (const cage of puzzle.cages) {
    let full = true;
    let clean = true;
    for (const cell of cage.cells) {
      if (values[cell] == null) {
        full = false;
        break;
      }
      if (isRed(cell)) clean = false;
    }
    if (full && clean) units.add(`cage:${cage.id}`);
  }

  // The whole grid. A solved grid is inherently clean, but gating on red as well
  // keeps a merely-full grid (every cell entered, some still wrong) from firing
  // the finale.
  let allFull = true;
  for (let i = 0; i < values.length; i++) {
    if (values[i] == null) {
      allFull = false;
      break;
    }
  }
  if (allFull && errors.cells.size === 0 && verdict.length === 0) units.add('puzzle');

  return units;
}

/**
 * The one cell a move filled in, or `null` when the change was anything else —
 * an erase, an undo/redo, a reset, a new puzzle, or any multi-cell edit. This is
 * what limits the glow to genuine forward placements and, for free, hands back
 * the cell to ripple outward from.
 */
export function singleForwardEdit(prev: Grid, next: Grid): CellIndex | null {
  if (prev.length !== next.length) return null;
  let changed: CellIndex | null = null;
  for (let i = 0; i < next.length; i++) {
    if (prev[i] === next[i]) continue;
    if (changed != null) return null; // more than one cell moved
    if (next[i] == null) return null; // a cell was cleared, not filled
    changed = i;
  }
  return changed;
}

/**
 * The per-cell delay map for one ripple. Rows and columns sweep out from the
 * placed cell along their line; a cage radiates from it by Manhattan distance;
 * the whole-puzzle sweep runs corner-to-corner from the top-left and, being the
 * finale, supersedes any smaller unit finished on the same move. When two units
 * light the same cell, the earlier wavefront wins.
 */
export function computeGlowDelays(
  puzzle: Puzzle,
  origin: CellIndex,
  units: Iterable<UnitKey>,
): Map<CellIndex, number> {
  const { size } = puzzle;
  const originRow = rowOf(origin, size);
  const originCol = colOf(origin, size);
  const delays = new Map<CellIndex, number>();
  const light = (cell: CellIndex, delay: number) => {
    const existing = delays.get(cell);
    if (existing === undefined || delay < existing) delays.set(cell, delay);
  };

  const unitSet = units instanceof Set ? units : new Set(units);

  if (unitSet.has('puzzle')) {
    for (let i = 0; i < size * size; i++) {
      light(i, (rowOf(i, size) + colOf(i, size)) * LINE_STEP_MS);
    }
    return delays;
  }

  let cageIds: number[] | null = null;
  for (const key of unitSet) {
    if (key.startsWith('row:')) {
      const row = Number(key.slice(4));
      for (let c = 0; c < size; c++) light(row * size + c, Math.abs(c - originCol) * LINE_STEP_MS);
    } else if (key.startsWith('col:')) {
      const col = Number(key.slice(4));
      for (let r = 0; r < size; r++) light(r * size + col, Math.abs(r - originRow) * LINE_STEP_MS);
    } else if (key.startsWith('cage:')) {
      const id = Number(key.slice(5));
      cageIds ??= cageIdByCell(puzzle);
      for (let i = 0; i < size * size; i++) {
        if (cageIds[i] !== id) continue;
        const dist = Math.abs(rowOf(i, size) - originRow) + Math.abs(colOf(i, size) - originCol);
        light(i, dist * CAGE_STEP_MS);
      }
    }
  }
  return delays;
}

/**
 * Fire a completion glow whenever a forward placement finishes a fresh
 * cage/row/column/puzzle with no red digit in it.
 *
 * Derived, never stored in the reducer: it watches `values` (against the board
 * as it stood before the edit) together with the same `errors` and `verdict`
 * the board already paints, works out which units are newly clean-complete, and
 * returns the ripple for the Board to draw. The layer tears itself down once the
 * last cell has finished blooming.
 */
export function useCompletionGlow(
  puzzle: Puzzle,
  values: Grid,
  errors: GridErrors,
  verdict: Verdict,
): CompletionGlow | null {
  const [glow, setGlow] = useState<CompletionGlow | null>(null);
  const prev = useRef<{ puzzle: Puzzle; values: Grid; clean: Set<UnitKey> } | null>(null);
  const tokenRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const clean = cleanCompleteUnits(puzzle, values, errors, verdict);
    const prior = prev.current;
    prev.current = { puzzle, values, clean };

    // First observation, or a wholesale swap (new puzzle, resume, reset): take a
    // baseline without celebrating whatever is already on the grid.
    if (!prior || prior.puzzle !== puzzle) return;

    const origin = singleForwardEdit(prior.values, values);
    if (origin == null) return;

    const newlyComplete: UnitKey[] = [];
    for (const key of clean) if (!prior.clean.has(key)) newlyComplete.push(key);
    if (newlyComplete.length === 0) return;

    const delays = computeGlowDelays(puzzle, origin, newlyComplete);
    if (delays.size === 0) return;

    tokenRef.current += 1;
    setGlow({ delays, token: tokenRef.current });

    let last = 0;
    for (const d of delays.values()) if (d > last) last = d;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setGlow(null), last + GLOW_DURATION_MS + CLEANUP_SLACK_MS);
  }, [puzzle, values, errors, verdict]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return glow;
}
