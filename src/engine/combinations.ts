/**
 * Cage combination listing for the "Combinations" panel.
 *
 * Given one cage, this enumerates every digit set it could mathematically hold
 * and marks each one as still possible or ruled out by the board. It looks no
 * further than the cage and the filled cells in its rows and columns — it is not
 * the hint engine (`candidates.ts`), which propagates across the whole grid. A
 * set is ruled out only when:
 *
 *  - a digit it needs is already used by a filled cell in one of the cage's rows
 *    or columns, or
 *  - it disagrees with a digit the player has already written into the cage,
 *    even a wrong one — an entered digit pins that cell, so only fillings that
 *    keep it survive.
 *
 * Pencil marks are never consulted: a mark can be wrong, stale, or absent, and
 * deriving from one would be unsound (the same rule the rest of the engine
 * keeps). Only entered `values` count.
 */

import type { Cage, CellIndex, Grid, Puzzle } from './types';
import { enumerateCageCombos } from './solver';
import { peersOf } from './candidates';

export interface CageCombination {
  /**
   * The combination's digits, ascending. Bent cages may legally repeat a digit,
   * so this is a multiset, not a set. Display order (larger-first for `−`/`÷`)
   * is applied by `combinationText`.
   */
  digits: number[];
  /** False when a filled cell in the cage's rows or columns rules this out. */
  possible: boolean;
}

/**
 * Every distinct digit set `cage` can hold, possible ones first and ruled-out
 * ones after, each group ascending — so `2÷1` sorts before `4÷2` and a struck
 * combination sinks to the bottom. `null` when the cage has too many
 * combinations to enumerate (far beyond anything a generated puzzle produces).
 */
export function cageCombinations(
  puzzle: Puzzle,
  values: Grid,
  cage: Cage,
): CageCombination[] | null {
  const size = puzzle.size;
  const combos = enumerateCageCombos(cage, size);
  if (combos === null) return null;

  const full = (1 << size) - 1;
  // What each cage cell may still hold, from filled cells alone.
  const allowed = cage.cells.map((cell) => allowedMask(values, cell, size, full));

  // `enumerateCageCombos` returns every position-aligned arrangement, including
  // both orderings of a domino. Fold them onto their digit multiset: the set is
  // possible when any one arrangement of it survives the board.
  const groups = new Map<string, CageCombination>();
  for (const combo of combos) {
    const survives = combo.every((digit, k) => (allowed[k] & (1 << (digit - 1))) !== 0);
    const digits = [...combo].sort((a, b) => a - b);
    const key = digits.join(',');
    const existing = groups.get(key);
    if (existing) {
      if (survives) existing.possible = true;
    } else {
      groups.set(key, { digits, possible: survives });
    }
  }

  return [...groups.values()].sort(compareCombinations);
}

/**
 * The digits a cell may hold given only the filled cells in its row and column.
 * A filled cell is pinned to its own value (right or wrong); an empty one keeps
 * every digit not already used by a filled peer.
 */
function allowedMask(values: Grid, cell: CellIndex, size: number, full: number): number {
  const own = values[cell];
  if (isDigit(own, size)) return 1 << (own - 1);
  let mask = full;
  for (const peer of peersOf(cell, size)) {
    const value = values[peer];
    if (isDigit(value, size)) mask &= ~(1 << (value - 1));
  }
  return mask;
}

function isDigit(value: number | null | undefined, size: number): value is number {
  return value != null && Number.isInteger(value) && value >= 1 && value <= size;
}

/** Possible sets first, then by digits ascending. A total order, for stable output. */
function compareCombinations(a: CageCombination, b: CageCombination): number {
  if (a.possible !== b.possible) return a.possible ? -1 : 1;
  const len = Math.min(a.digits.length, b.digits.length);
  for (let i = 0; i < len; i++) {
    if (a.digits[i] !== b.digits[i]) return a.digits[i] - b.digits[i];
  }
  return a.digits.length - b.digits.length;
}
