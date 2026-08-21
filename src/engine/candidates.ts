/**
 * Candidate bookkeeping for the hint engine.
 *
 * This is a deliberately *slow and readable* re-implementation of the two cheap
 * propagation rules `solver.ts` runs in its hot loop:
 *
 *   (A) cage combination filtering + candidate intersection,
 *   (B) naked singles — a solved cell clears its digit from row/column peers.
 *
 * It is not a refactor of the solver, and the solver does not use it. The
 * solver is on the generator's critical path and runs thousands of times per
 * puzzle; this runs once per hint-button press on a single grid, so legibility
 * beats speed everywhere they conflict. The one piece genuinely worth sharing —
 * `enumerateCageCombos` — is imported rather than duplicated.
 *
 * Two things make this different from the solver's version, and both matter:
 *
 *  - It is seeded from a *player's* grid, not from an empty one.
 *  - It stops at rules (A) and (B). Hidden singles (solver rule C) and locked
 *    candidates (rules D1/D2) are deliberately left undone, because the hint
 *    engine wants to *report* those as techniques rather than silently fold
 *    them into the baseline. See `docs/HINTS.md` §2.
 *
 * Everything here is sound with respect to the player's entries alone: pencil
 * marks are never an input. A conclusion drawn from a player's (possibly wrong)
 * marks would be a false hint, which is the one unforgivable bug in a hint
 * system.
 */

import type { Cage, CellIndex, Grid, Puzzle } from './types';
import { enumerateCageCombos } from './solver';

/** Enumeration cap per cage. Far above anything a legal 9x9 cage produces. */
export const DEFAULT_HINT_COMBO_CAP = 20_000;

/**
 * Unit keys are dense integers so they can index `CandidateState.units`:
 * row `r` is key `r`, column `c` is key `size + c`.
 */
export type UnitKey = number;

export interface CageUnitOverlap {
  key: UnitKey;
  /** Positions within `cage.cells` (not cell indices) that fall in this unit. */
  positions: number[];
}

export interface CageInfo {
  index: number;
  cage: Cage;
  cells: CellIndex[];
  /** Every row/column this cage touches, with the positions it occupies there. */
  units: CageUnitOverlap[];
}

export interface CandidateState {
  size: number;
  cellCount: number;
  /** Bitmask with all `size` digit bits set. */
  full: number;
  values: Grid;
  cages: CageInfo[];
  /** Bitmask of still-possible digits per cell, after rules (A)+(B). */
  cands: Int32Array;
  /** Surviving combinations per cage, position-aligned with `cage.cells`. */
  combos: number[][][];
  /** cell index -> index into `puzzle.cages`, or -1 for an uncaged cell. */
  cageOfCell: Int32Array;
  /** unit key -> member cell indices, in ascending order. */
  units: number[][];
  /**
   * True when propagation proved the grid unsatisfiable — a cell with no
   * candidates left, or a cage with no surviving combination. The state is
   * still returned (partially propagated) so callers can report rather than
   * throw; every detector should refuse to run on a contradictory state.
   */
  contradiction: boolean;
}

/* ------------------------------------------------------------------ */
/* Bitmask helpers. Masks stay internal; the public hint API uses      */
/* plain digit arrays.                                                  */
/* ------------------------------------------------------------------ */

export const bit = (digit: number): number => 1 << (digit - 1);

export function popcount(mask: number): number {
  let m = mask - ((mask >> 1) & 0x55555555);
  m = (m & 0x33333333) + ((m >> 2) & 0x33333333);
  m = (m + (m >> 4)) & 0x0f0f0f0f;
  return (m * 0x01010101) >> 24;
}

/** Ascending digit list for a bitmask. */
export function maskToDigits(mask: number, size: number): number[] {
  const out: number[] = [];
  for (let v = 1; v <= size; v++) if ((mask & bit(v)) !== 0) out.push(v);
  return out;
}

export function digitsToMask(digits: Iterable<number>): number {
  let mask = 0;
  for (const d of digits) mask |= bit(d);
  return mask;
}

/** The single digit of a one-bit mask, or 0 if the mask is not a singleton. */
export function soleDigit(mask: number): number {
  if (mask === 0 || (mask & (mask - 1)) !== 0) return 0;
  let v = 1;
  let m = mask;
  while ((m & 1) === 0) {
    m >>= 1;
    v++;
  }
  return v;
}

/* ------------------------------------------------------------------ */
/* Unit keys                                                            */
/* ------------------------------------------------------------------ */

export const rowKey = (row: number): UnitKey => row;
export const colKey = (col: number, size: number): UnitKey => size + col;
export const isRowKey = (key: UnitKey, size: number): boolean => key < size;
/** 0-based row or column number for a unit key. */
export const unitLine = (key: UnitKey, size: number): number =>
  key < size ? key : key - size;

/** Every row then every column, as lists of flat cell indices. */
export function buildUnits(size: number): number[][] {
  const units: number[][] = [];
  for (let r = 0; r < size; r++) {
    const row: number[] = [];
    for (let c = 0; c < size; c++) row.push(r * size + c);
    units.push(row);
  }
  for (let c = 0; c < size; c++) {
    const col: number[] = [];
    for (let r = 0; r < size; r++) col.push(r * size + c);
    units.push(col);
  }
  return units;
}

function buildCageInfos(puzzle: Puzzle): CageInfo[] {
  const size = puzzle.size;
  return puzzle.cages.map((cage, index) => {
    const cells = cage.cells.slice();
    const byUnit = new Map<UnitKey, number[]>();
    for (let k = 0; k < cells.length; k++) {
      const keys = [rowKey((cells[k] / size) | 0), colKey(cells[k] % size, size)];
      for (const key of keys) {
        const list = byUnit.get(key);
        if (list) list.push(k);
        else byUnit.set(key, [k]);
      }
    }
    const units: CageUnitOverlap[] = [];
    // Sorted so the state — and therefore every hint derived from it — is a
    // pure function of the puzzle, independent of Map iteration order.
    for (const key of [...byUnit.keys()].sort((a, b) => a - b)) {
      units.push({ key, positions: byUnit.get(key) as number[] });
    }
    return { index, cage, cells, units };
  });
}

/* ------------------------------------------------------------------ */
/* Propagation                                                          */
/* ------------------------------------------------------------------ */

/**
 * Seed candidates from `values` and run rules (A)+(B) to a fixpoint.
 *
 * A filled cell starts as its single digit; an empty cell starts as every
 * digit. `values` entries outside `1..size` are treated as empty, so a
 * malformed grid degrades to "less is known" rather than to a crash.
 */
export function buildCandidateState(
  puzzle: Puzzle,
  values: Grid,
  comboCap: number = DEFAULT_HINT_COMBO_CAP,
): CandidateState {
  const size = puzzle.size;
  const cellCount = size * size;
  const full = (1 << size) - 1;
  const cages = buildCageInfos(puzzle);

  const cageOfCell = new Int32Array(cellCount).fill(-1);
  for (const info of cages) {
    for (const cell of info.cells) {
      if (cell >= 0 && cell < cellCount) cageOfCell[cell] = info.index;
    }
  }

  const cands = new Int32Array(cellCount).fill(full);
  for (let i = 0; i < cellCount; i++) {
    const value = values[i];
    if (value === null || value === undefined) continue;
    if (!Number.isInteger(value) || value < 1 || value > size) continue;
    cands[i] = bit(value);
  }

  const combos: number[][][] = [];
  let contradiction = false;
  for (const info of cages) {
    // A cage too big to enumerate contributes no constraint rather than a
    // wrong one: an empty combination list would read as a contradiction, so
    // overflow is represented as "every combination survives" — which for
    // rule (A) purposes means the cage simply never narrows anything.
    const list = enumerateCageCombos(info.cage, size, comboCap);
    if (list === null) {
      combos.push([]);
      continue;
    }
    if (list.length === 0) contradiction = true;
    combos.push(list);
  }

  const state: CandidateState = {
    size,
    cellCount,
    full,
    values,
    cages,
    cands,
    combos,
    cageOfCell,
    units: buildUnits(size),
    contradiction,
  };

  if (!propagate(state)) state.contradiction = true;
  return state;
}

/**
 * Rules (A) and (B) to a fixpoint. Returns false on contradiction.
 *
 * No stale-cage tracking, no early exits: every round rescans every cage. That
 * is O(cages x combos) per round where the solver is closer to O(dirty cages),
 * and it is the right trade here — one call per button press against a solver
 * that makes thousands per generated puzzle.
 */
function propagate(state: CandidateState): boolean {
  for (;;) {
    let changed = false;

    // (A) A combination dies when it needs a digit one of its cells can no
    //     longer hold. A cell then keeps only what its cage still offers it.
    for (const info of state.cages) {
      const list = state.combos[info.index];
      if (list.length === 0) continue; // unconstrained (overflowed) or already dead
      const survivors = list.filter((combo) =>
        info.cells.every((cell, k) => (state.cands[cell] & bit(combo[k])) !== 0),
      );
      if (survivors.length === 0) return false;
      if (survivors.length !== list.length) {
        state.combos[info.index] = survivors;
        changed = true;
      }

      for (let k = 0; k < info.cells.length; k++) {
        let union = 0;
        for (const combo of survivors) union |= bit(combo[k]);
        const cell = info.cells[k];
        const next = state.cands[cell] & union;
        if (next === 0) return false;
        if (next !== state.cands[cell]) {
          state.cands[cell] = next;
          changed = true;
        }
      }
    }

    // (B) A cell down to one digit removes it from its row and column peers.
    for (let cell = 0; cell < state.cellCount; cell++) {
      const mask = state.cands[cell];
      if (mask === 0) return false;
      if ((mask & (mask - 1)) !== 0) continue;
      for (const peer of peersOf(cell, state.size)) {
        const next = state.cands[peer] & ~mask;
        if (next === state.cands[peer]) continue;
        if (next === 0) return false;
        state.cands[peer] = next;
        changed = true;
      }
    }

    if (!changed) return true;
  }
}

/** Every other cell in `cell`'s row and column, ascending, without duplicates. */
export function peersOf(cell: CellIndex, size: number): CellIndex[] {
  const row = (cell / size) | 0;
  const col = cell % size;
  const out: CellIndex[] = [];
  for (let c = 0; c < size; c++) {
    const peer = row * size + c;
    if (peer !== cell) out.push(peer);
  }
  for (let r = 0; r < size; r++) {
    const peer = r * size + col;
    if (peer !== cell) out.push(peer);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

/* ------------------------------------------------------------------ */
/* Derived views                                                        */
/* ------------------------------------------------------------------ */

/**
 * The set of sums a cage can produce over `positions` (default: all of them),
 * taken across its surviving combinations.
 *
 * This exists because **in KenKen a cage's target is not its sum** unless the
 * operator is `+` or `=` — a `1-` cage in a 4x4 can sum to 3, 5 or 7. Innies
 * and outies (`unitSums.ts`) need the sum, so they need this. A singleton
 * result places a digit; a multi-valued one only bounds it.
 *
 * Derived from the surviving combinations in every case, including `+` and
 * `=`. The doc suggests short-circuiting those to `target`; the enumerated
 * answer is identical there and one code path is easier to trust.
 */
export function cageSumSet(
  state: CandidateState,
  cageIndex: number,
  positions?: readonly number[],
): Set<number> {
  const sums = new Set<number>();
  const list = state.combos[cageIndex];
  const info = state.cages[cageIndex];
  const picks = positions ?? info.cells.map((_, k) => k);
  for (const combo of list) {
    let sum = 0;
    for (const p of picks) sum += combo[p];
    sums.add(sum);
  }
  return sums;
}

/** `cageSumSet` when it has exactly one element, else `null`. */
export function singletonCageSum(
  state: CandidateState,
  cageIndex: number,
  positions?: readonly number[],
): number | null {
  const sums = cageSumSet(state, cageIndex, positions);
  if (sums.size !== 1) return null;
  return [...sums][0];
}

/**
 * Candidate digits per cell after rules (A)+(B), seeded from `values`.
 * The public, bitmask-free form of `CandidateState.cands`.
 */
export function candidateSets(puzzle: Puzzle, values: Grid): number[][] {
  const state = buildCandidateState(puzzle, values);
  const out: number[][] = [];
  for (let i = 0; i < state.cellCount; i++) out.push(maskToDigits(state.cands[i], state.size));
  return out;
}

/**
 * What the player can plausibly see, per `docs/HINTS.md` §2: their own pencil
 * marks where they have written any, otherwise the digits not yet filled in
 * the cell's row or column. A filled cell shows its own digit.
 *
 * Used *only* to decide whether a conclusion is novel enough to be worth
 * showing. Never to derive one.
 */
export function visibleMasks(puzzle: Puzzle, values: Grid, marks: MarkSets): Int32Array {
  const size = puzzle.size;
  const cellCount = size * size;
  const full = (1 << size) - 1;
  const out = new Int32Array(cellCount);

  for (let cell = 0; cell < cellCount; cell++) {
    const value = values[cell];
    if (value !== null && value !== undefined) {
      out[cell] = bit(value) & full;
      continue;
    }
    const cellMarks = marks[cell];
    if (cellMarks && cellMarks.length > 0) {
      out[cell] = digitsToMask(cellMarks) & full;
      continue;
    }
    let mask = full;
    for (const peer of peersOf(cell, size)) {
      const peerValue = values[peer];
      if (peerValue !== null && peerValue !== undefined) mask &= ~bit(peerValue);
    }
    out[cell] = mask;
  }
  return out;
}

/** Pencil marks per cell, same shape as `game/state.ts`'s `Marks`. */
export type MarkSets = readonly (readonly number[])[];

/** Digit-array form of `visibleMasks`. */
export function visibleSets(puzzle: Puzzle, values: Grid, marks: MarkSets): number[][] {
  const masks = visibleMasks(puzzle, values, marks);
  const out: number[][] = [];
  for (let i = 0; i < masks.length; i++) out.push(maskToDigits(masks[i], puzzle.size));
  return out;
}
