/**
 * The `N(N+1)/2` family: innies and outies.
 *
 * Every row and every column of an N x N grid holds each digit `1..N` exactly
 * once, so it always totals `T = N(N+1)/2` (3x3 -> 6, 4x4 -> 10, ... 9x9 -> 45).
 * If you know what every cell of a unit contributes except one, you know that
 * one. That is the whole idea, and it is the deduction the existing solver
 * cannot make by propagation — see `docs/HINTS.md` §3.1.
 *
 * The KenKen-specific wrinkle, which the Killer-Sudoku literature glosses over
 * because there every cage is additive: **a cage's target is not its sum**
 * unless the operator is `+` or `=`. A `1-` cage in a 4x4 sums to 3, 5 or 7
 * depending on which pair it holds. So the contributions here come from
 * `cageSumSet`, derived from each cage's surviving combinations, and a cage
 * only contributes to a *placement* when that set is a singleton.
 *
 * Two shapes are detected:
 *
 *   innie — cages lying entirely inside the unit cover all but one of its
 *           cells. The leftover cell is `T - (sum of those cages)`.
 *
 *   outie — cages lying entirely inside the unit, plus exactly one cage that
 *           straddles the boundary with exactly one cell outside, cover the
 *           unit. The in-unit part of the straddling cage must supply
 *           `T - (sum of the inside cages)`, so its outside cell holds
 *           `(that cage's total) - (that remainder)`.
 *
 * The multi-valued case — where a contributing cage has a *range* of sums, so
 * the leftover cell is only bounded to an interval — is technique
 * `unit-sum-bound` (rank 90), deliberately out of scope for Tier 1.
 */

import type { CellIndex } from './types';
import { bit, singletonCageSum, unitLine, type CandidateState, type UnitKey } from './candidates';

/** `T` — what every row and every column of an N x N grid adds up to. */
export const unitTotal = (size: number): number => (size * (size + 1)) / 2;

export interface UnitSumInnie {
  unitKey: UnitKey;
  /** 0-based row or column number this unit is. */
  line: number;
  /** Cage indices lying entirely inside the unit, ascending. */
  insideCages: number[];
  /** What those cages contribute between them. */
  coveredSum: number;
  /** The one cell of the unit they do not cover. */
  cell: CellIndex;
  digit: number;
}

export interface UnitSumOutie {
  unitKey: UnitKey;
  line: number;
  insideCages: number[];
  coveredSum: number;
  /** The cage index that straddles the unit boundary. */
  straddlingCage: number;
  /** Its in-unit cells, ascending. */
  straddlingInside: CellIndex[];
  /** What its in-unit part has to add to: `T - coveredSum`. */
  remainder: number;
  /** What the whole straddling cage adds to. */
  cageSum: number;
  /** Its one cell outside the unit. */
  cell: CellIndex;
  digit: number;
}

interface UnitShape {
  key: UnitKey;
  members: CellIndex[];
  /** Cage indices with every cell in this unit, ascending. */
  inside: number[];
  /** Cages with some but not all cells here, ascending by cage index. */
  straddling: Array<{ cageIndex: number; inside: CellIndex[]; outside: CellIndex[] }>;
  /** Cells of the unit not covered by a fully-inside cage. */
  uncovered: CellIndex[];
}

/**
 * Split a unit into the cages that live entirely inside it and the ones that
 * poke out. Returns `null` for a malformed unit (an uncaged cell), which makes
 * both detectors below decline to reason about it rather than guess.
 */
function describeUnit(state: CandidateState, key: UnitKey): UnitShape | null {
  const members = state.units[key];
  const touching = new Set<number>();
  for (const cell of members) {
    const cageIndex = state.cageOfCell[cell];
    if (cageIndex < 0) return null;
    touching.add(cageIndex);
  }

  const memberSet = new Set(members);
  const inside: number[] = [];
  const straddling: UnitShape['straddling'] = [];
  for (const cageIndex of [...touching].sort((a, b) => a - b)) {
    const cells = state.cages[cageIndex].cells;
    const within = cells.filter((c) => memberSet.has(c));
    const without = cells.filter((c) => !memberSet.has(c));
    if (without.length === 0) inside.push(cageIndex);
    else straddling.push({ cageIndex, inside: within, outside: without });
  }

  const covered = new Set<CellIndex>();
  for (const cageIndex of inside) for (const c of state.cages[cageIndex].cells) covered.add(c);
  const uncovered = members.filter((c) => !covered.has(c));

  return { key, members, inside, straddling, uncovered };
}

/** Sum of every fully-inside cage, or `null` if any of them has an ambiguous sum. */
function sumOfInsideCages(state: CandidateState, inside: readonly number[]): number | null {
  let total = 0;
  for (const cageIndex of inside) {
    const sum = singletonCageSum(state, cageIndex);
    if (sum === null) return null;
    total += sum;
  }
  return total;
}

/** Is `digit` a legal, still-possible value for `cell`? */
function placeable(state: CandidateState, cell: CellIndex, digit: number): boolean {
  if (!Number.isInteger(digit) || digit < 1 || digit > state.size) return false;
  return (state.cands[cell] & bit(digit)) !== 0;
}

/**
 * Units where the fully-inside cages cover all but one cell and each has a
 * single possible sum. Only cells the player has not filled are reported.
 */
export function findInnies(state: CandidateState): UnitSumInnie[] {
  if (state.contradiction) return [];
  const T = unitTotal(state.size);
  const out: UnitSumInnie[] = [];

  for (let key = 0; key < state.units.length; key++) {
    const shape = describeUnit(state, key);
    if (!shape) continue;
    if (shape.uncovered.length !== 1) continue;
    // With one cell uncovered there is always at least one inside cage for
    // N >= 2, but guard it anyway: with no inside cages there is nothing to sum.
    if (shape.inside.length === 0) continue;

    const coveredSum = sumOfInsideCages(state, shape.inside);
    if (coveredSum === null) continue;

    const cell = shape.uncovered[0];
    if (state.values[cell] !== null && state.values[cell] !== undefined) continue;
    const digit = T - coveredSum;
    if (!placeable(state, cell, digit)) continue;

    out.push({
      unitKey: key,
      line: unitLine(key, state.size),
      insideCages: shape.inside,
      coveredSum,
      cell,
      digit,
    });
  }
  return out;
}

/**
 * Units covered by their fully-inside cages plus exactly one cage that
 * straddles the boundary with exactly one cell outside, where every
 * contributing sum is pinned.
 */
export function findOuties(state: CandidateState): UnitSumOutie[] {
  if (state.contradiction) return [];
  const T = unitTotal(state.size);
  const out: UnitSumOutie[] = [];

  for (let key = 0; key < state.units.length; key++) {
    const shape = describeUnit(state, key);
    if (!shape) continue;
    if (shape.straddling.length !== 1) continue;
    const straddler = shape.straddling[0];
    if (straddler.outside.length !== 1) continue;
    // Without an inside cage the deduction degenerates to "this cage covers
    // the whole unit", whose sentence reads badly and whose conclusion the
    // combination rules already reach.
    if (shape.inside.length === 0) continue;

    const coveredSum = sumOfInsideCages(state, shape.inside);
    if (coveredSum === null) continue;
    const cageSum = singletonCageSum(state, straddler.cageIndex);
    if (cageSum === null) continue;

    const cell = straddler.outside[0];
    if (state.values[cell] !== null && state.values[cell] !== undefined) continue;
    const remainder = T - coveredSum;
    const digit = cageSum - remainder;
    if (!placeable(state, cell, digit)) continue;

    out.push({
      unitKey: key,
      line: unitLine(key, state.size),
      insideCages: shape.inside,
      coveredSum,
      straddlingCage: straddler.cageIndex,
      straddlingInside: straddler.inside,
      remainder,
      cageSum,
      cell,
      digit,
    });
  }
  return out;
}
