import { describe, expect, it } from 'vitest';
import { buildCandidateState } from './candidates';
import { findInnies, findOuties, unitTotal } from './unitSums';
import { DOC_PUZZLE } from '../fixtures/docPuzzle';
import type { Grid, Op, Puzzle } from './types';

const empty = (size: number): Grid => new Array<number | null>(size * size).fill(null);

function tiled(size: number, cages: Array<[number[], Op, number]>): Puzzle {
  const puzzle: Puzzle = {
    size,
    difficulty: 'easy',
    seed: 'unit-sums-test',
    solution: [],
    cages: cages.map(([cells, op, target], id) => ({ id, cells, op, target })),
  };
  // A miscounted hand-built layout would silently change what these tests mean.
  const covered = new Set(cages.flatMap(([cells]) => cells));
  if (covered.size !== size * size) throw new Error(`layout covers ${covered.size} cells`);
  return puzzle;
}

const state = (puzzle: Puzzle, values: Grid = empty(puzzle.size)) =>
  buildCandidateState(puzzle, values);

/**
 * A 4x4 whose column 1 is covered, bar one cell, by a single 6+ cage.
 * `1-` fillers elsewhere: every pair of adjacent digits is legal for them, so
 * they constrain nothing and leave the innie as the only deduction in sight.
 */
const INNIE_ONE_CAGE = tiled(4, [
  [[4, 8, 12], '+', 6],
  [[0, 1], '-', 1],
  [[2, 3], '-', 1],
  [[5, 6], '-', 1],
  [[7, 11], '-', 1],
  [[9, 10], '-', 1],
  [[13, 14, 15], '+', 9],
]);

/**
 * A 5x5 whose column 1 is covered, bar one cell, by *two* additive cages.
 * Both have a pinned sum but two possible digit pairs, so no easier technique
 * shadows the innie.
 */
const INNIE_TWO_CAGES = tiled(5, [
  [[0, 5], '+', 7],
  [[10, 15], '+', 6],
  [[20, 21], '-', 1],
  [[1, 2], '-', 1],
  [[3, 4], '-', 1],
  [[6, 7], '-', 1],
  [[8, 9], '-', 1],
  [[11, 12], '-', 1],
  [[13, 14], '-', 1],
  [[16, 17], '-', 1],
  [[18, 19], '-', 1],
  [[22, 23, 24], '+', 9],
]);

/**
 * Same shape as `INNIE_ONE_CAGE`, but column 1's covering cages are a `2/` pair
 * and a freebie. `2/` can be {1,2} or {2,4}, so its sum is 3 or 6 — the innie
 * must decline rather than pick one.
 */
const INNIE_AMBIGUOUS = tiled(4, [
  [[4, 8], '/', 2],
  [[12], '=', 3],
  [[0, 1], '-', 1],
  [[2, 3], '-', 1],
  [[5, 6], '-', 1],
  [[7, 11], '-', 1],
  [[9, 10], '-', 1],
  [[13, 14, 15], '+', 9],
]);

describe('unitTotal', () => {
  it('is N(N+1)/2 for every supported grid size', () => {
    expect([3, 4, 5, 6, 7, 8, 9].map(unitTotal)).toEqual([6, 10, 15, 21, 28, 36, 45]);
  });
});

describe('findInnies', () => {
  it('places the one cell a single covering cage leaves over', () => {
    const found = findInnies(state(INNIE_ONE_CAGE));
    const innie = found.find((f) => f.cell === 0);
    expect(innie).toBeDefined();
    expect(innie).toMatchObject({
      unitKey: 4, // column 1, 0-based
      line: 0,
      insideCages: [0],
      coveredSum: 6,
      cell: 0,
      digit: 4,
    });
  });

  it('adds several covering cages together', () => {
    expect(findInnies(state(INNIE_TWO_CAGES))).toEqual([
      {
        unitKey: 5, // column 1 of a 5x5
        line: 0,
        insideCages: [0, 1],
        coveredSum: 13,
        cell: 20,
        digit: 2,
      },
    ]);
  });

  it('declines when a covering cage has more than one possible sum', () => {
    // The point of `cageSumSet`: 2/ is not "sum 2", and it is not one number.
    expect(findInnies(state(INNIE_AMBIGUOUS)).some((f) => f.cell === 0)).toBe(false);
  });

  it('says nothing about a cell the player has already filled', () => {
    const values = empty(4);
    values[0] = 4;
    expect(findInnies(state(INNIE_ONE_CAGE, values)).some((f) => f.cell === 0)).toBe(false);
  });

  it('is silent on a contradictory grid', () => {
    const values = empty(4);
    values[4] = 1;
    values[8] = 1; // duplicate in column 1
    expect(findInnies(state(INNIE_ONE_CAGE, values))).toEqual([]);
  });

  it('every digit it places is the true solution digit', () => {
    for (const found of findInnies(state(DOC_PUZZLE))) {
      expect(found.digit).toBe(DOC_PUZZLE.solution[found.cell]);
    }
  });
});

describe('findOuties', () => {
  it('reproduces the worked example from docs/HINTS.md §4', () => {
    // Column 2 of the docs/KENKEN.md fixture holds the 8x cage (sum 6) plus the
    // two column-2 cells of the 6x cage. 10 - 6 = 4 for that part, and the 6x
    // cage totals 6, so its cell outside the column is 6 - 4 = 2.
    const found = findOuties(state(DOC_PUZZLE));
    const outie = found.find((f) => f.cell === 14);
    expect(outie).toEqual({
      unitKey: 5, // column 2, 0-based
      line: 1,
      insideCages: [1],
      coveredSum: 6,
      straddlingCage: 6,
      straddlingInside: [9, 13],
      remainder: 4,
      cageSum: 6,
      cell: 14,
      digit: 2,
    });
    expect(outie?.digit).toBe(DOC_PUZZLE.solution[14]);
  });

  it('every digit it places is the true solution digit', () => {
    for (const found of findOuties(state(DOC_PUZZLE))) {
      expect(found.digit).toBe(DOC_PUZZLE.solution[found.cell]);
    }
  });

  it('declines when the straddling cage has more than one cell outside', () => {
    // Row 4 of INNIE_ONE_CAGE is covered by the 9+ cage plus one cell of the
    // 6+ cage, but that cage has two more cells elsewhere in column 1.
    expect(findOuties(state(INNIE_ONE_CAGE))).toEqual([]);
  });

  it('declines when the straddling cage total is not pinned', () => {
    // Column 1 of INNIE_ONE_CAGE: the 1- straddler could total 3, 5 or 7.
    expect(findOuties(state(INNIE_ONE_CAGE)).some((f) => f.unitKey === 4)).toBe(false);
  });

  it('is silent on a contradictory grid', () => {
    const values = empty(4);
    values[1] = 2;
    values[5] = 2; // duplicate in column 2
    expect(findOuties(state(DOC_PUZZLE, values))).toEqual([]);
  });
});
