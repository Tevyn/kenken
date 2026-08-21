/**
 * Live error detection for a player's grid.
 *
 * Everything reported here is *provable* from the player's own entries plus the
 * cage constraints alone — `puzzle.solution` is never consulted. A digit that
 * merely differs from the intended solution is not an error until it makes some
 * constraint unsatisfiable, so a player exploring a wrong-but-not-yet-doomed
 * line is left alone.
 *
 * Three classes are detected:
 *   1. a digit repeated within a row or a column,
 *   2. a fully-filled cage whose arithmetic does not work out,
 *   3. a partially-filled cage that can no longer be completed at all.
 *
 * Class 3 reuses `enumerateCageCombos` from the solver rather than
 * reimplementing per-operator bounds arithmetic: a partial cage is feasible
 * exactly when at least one enumerated combination agrees with the digits the
 * player has already placed, at the positions they placed them.
 */

import type { CellIndex, Grid, Puzzle } from './types';
import { cageSatisfied } from './cages';
import { enumerateCageCombos } from './solver';

export interface GridErrors {
  /** Every cell participating in any detected error. Empty cells are never included. */
  cells: Set<CellIndex>;
  /** The subset of `cells` that repeat a digit within their row or column. */
  duplicates: Set<CellIndex>;
  /** Ids of cages that are either arithmetically wrong or no longer completable. */
  badCages: number[];
}

export interface ErrorCheckOptions {
  /**
   * Detect class 3 (partially-filled cages that can no longer be completed).
   * Default `true`. Turning it off skips combination enumeration entirely.
   */
  partialCages?: boolean;
  /**
   * Per-cage enumeration cap. A cage with more combinations than this is
   * excluded from the class-3 check rather than guessed at.
   */
  maxCombosPerCage?: number;
}

/** A grid checker bound to one puzzle. Safe to call on every keystroke. */
export type ErrorChecker = (grid: Grid) => GridErrors;

/**
 * Enumeration cap for the partial-cage check.
 *
 * Comfortably above what any legal cage on a 9x9 board produces (a 6-cell cage
 * tops out in the low thousands), so in practice no cage is ever skipped; the
 * cap exists purely so a pathological puzzle cannot hang the UI thread.
 */
export const DEFAULT_ERROR_COMBO_CAP = 20_000;

/**
 * Bind an error checker to a puzzle, enumerating each cage's legal digit
 * combinations once up front. Memoize the result per puzzle (`useMemo`) and
 * call the returned closure on every grid change — the per-call work is then
 * linear in the number of filled cells plus a scan of the (already computed)
 * combination lists of the cages the player has touched.
 */
export function createErrorChecker(puzzle: Puzzle, options: ErrorCheckOptions = {}): ErrorChecker {
  const size = puzzle.size;
  const cellCount = size * size;
  const checkPartial = options.partialCages ?? true;
  const cap = options.maxCombosPerCage ?? DEFAULT_ERROR_COMBO_CAP;

  // `null` means "enumeration overflowed the cap" — that cage's class-3 check
  // is skipped rather than guessed at. Missing an error is acceptable here;
  // accusing the player of one that is not provable never is.
  const combosByCage: (number[][] | null)[] = puzzle.cages.map((cage) =>
    checkPartial ? enumerateCageCombos(cage, size, cap) : null,
  );

  const lines = buildLines(size);

  return function check(grid: Grid): GridErrors {
    const cells = new Set<CellIndex>();
    const duplicates = new Set<CellIndex>();
    const badCages: number[] = [];
    if (grid.length !== cellCount) return { cells, duplicates, badCages };

    // (1) duplicate digits within a row or a column.
    for (const line of lines) markDuplicates(line, grid, duplicates);
    for (const cell of duplicates) cells.add(cell);

    for (let ci = 0; ci < puzzle.cages.length; ci++) {
      const cage = puzzle.cages[ci];
      const cageCells = cage.cells;
      const n = cageCells.length;

      // Position-aligned with `cageCells` (and therefore with every combo
      // `enumerateCageCombos` returns). 0 stands for "still empty".
      const placed = new Array<number>(n).fill(0);
      let filled = 0;
      for (let k = 0; k < n; k++) {
        const value = grid[cageCells[k]];
        if (value === null || value === undefined) continue;
        placed[k] = value;
        filled++;
      }
      if (filled === 0) continue;

      let bad: boolean;
      if (filled === n) {
        // (2) the cage is complete: just do the arithmetic.
        bad = !cageSatisfied(cage, placed);
      } else {
        // (3) the cage is partial: feasible iff some legal combination agrees
        //     with what the player has already placed.
        const combos = combosByCage[ci];
        // An empty list means *no* grid could ever satisfy this cage — that is
        // malformed puzzle data, not a player mistake, so say nothing.
        bad = combos !== null && combos.length > 0 && !anyComboAgrees(combos, placed);
      }
      if (!bad) continue;

      badCages.push(cage.id);
      // Highlight the cells the player *filled*, never the empty ones. The
      // filled digits are what is provably wrong — one of them has to change —
      // whereas an empty cell is blameless and highlighting it would suggest
      // the player had done something there. For a complete cage this is every
      // cell of the cage, matching the long-standing `findConflicts` behavior.
      for (let k = 0; k < n; k++) {
        if (placed[k] !== 0) cells.add(cageCells[k]);
      }
    }

    return { cells, duplicates, badCages };
  };
}

/**
 * One-shot form of `createErrorChecker`. Convenient for tests and for callers
 * that check a grid once; UI code should build a checker per puzzle instead so
 * the cage enumeration is not repeated on every keystroke.
 */
export function findGridErrors(
  puzzle: Puzzle,
  grid: Grid,
  options: ErrorCheckOptions = {},
): GridErrors {
  return createErrorChecker(puzzle, options)(grid);
}

/** Every row and every column, as lists of flat cell indices. */
function buildLines(size: number): number[][] {
  const lines: number[][] = [];
  for (let line = 0; line < size; line++) {
    const row: number[] = [];
    const col: number[] = [];
    for (let k = 0; k < size; k++) {
      row.push(line * size + k);
      col.push(k * size + line);
    }
    lines.push(row, col);
  }
  return lines;
}

/** Add every cell of `cells` that shares its digit with another to `out`. */
export function markDuplicates(cells: readonly number[], grid: Grid, out: Set<CellIndex>): void {
  const byValue = new Map<number, number[]>();
  for (const cell of cells) {
    const value = grid[cell];
    if (value === null || value === undefined) continue;
    const list = byValue.get(value);
    if (list) list.push(cell);
    else byValue.set(value, [cell]);
  }
  for (const list of byValue.values()) {
    if (list.length > 1) for (const cell of list) out.add(cell);
  }
}

/** Does some combination match every digit already placed in the cage? */
function anyComboAgrees(combos: readonly number[][], placed: readonly number[]): boolean {
  for (let i = 0; i < combos.length; i++) {
    const combo = combos[i];
    let ok = true;
    for (let k = 0; k < placed.length; k++) {
      if (placed[k] !== 0 && combo[k] !== placed[k]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}
