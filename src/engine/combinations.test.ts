import { describe, expect, it } from 'vitest';
import { cageCombinations } from './combinations';
import { combinationText } from './types';
import type { Cage, Grid, Op, Puzzle } from './types';

/**
 * A bare puzzle carrying one cage. `cageCombinations` reads only `size` and the
 * cage, never the solution, so the solution here is a placeholder.
 */
function puzzleWith(size: number, cage: Cage): Puzzle {
  return {
    size,
    difficulty: 'easy',
    cages: [cage],
    solution: new Array(size * size).fill(1),
    seed: 'test',
  };
}

function emptyGrid(size: number): Grid {
  return new Array(size * size).fill(null);
}

/** The possible combinations, as ascending digit tuples, for readable assertions. */
function possibleDigits(puzzle: Puzzle, values: Grid, cage: Cage): number[][] {
  const list = cageCombinations(puzzle, values, cage);
  return (list ?? []).filter((c) => c.possible).map((c) => c.digits);
}

function ruledOutDigits(puzzle: Puzzle, values: Grid, cage: Cage): number[][] {
  const list = cageCombinations(puzzle, values, cage);
  return (list ?? []).filter((c) => !c.possible).map((c) => c.digits);
}

describe('cageCombinations', () => {
  it('lists the single combination of a 3+ cage', () => {
    const cage: Cage = { id: 0, cells: [0, 1], op: '+', target: 3 };
    const puzzle = puzzleWith(3, cage);
    expect(possibleDigits(puzzle, emptyGrid(3), cage)).toEqual([[1, 2]]);
  });

  it('lists every pair of a 2÷ cage in an 8×8, all possible on an empty board', () => {
    const cage: Cage = { id: 0, cells: [0, 1], op: '/', target: 2 };
    const puzzle = puzzleWith(8, cage);
    expect(possibleDigits(puzzle, emptyGrid(8), cage)).toEqual([
      [1, 2],
      [2, 4],
      [3, 6],
      [4, 8],
    ]);
    expect(ruledOutDigits(puzzle, emptyGrid(8), cage)).toEqual([]);
  });

  it('collapses both orderings of a domino onto one multiset', () => {
    const cage: Cage = { id: 0, cells: [0, 1], op: '-', target: 1 };
    const puzzle = puzzleWith(4, cage);
    // {1,2}, {2,3}, {3,4} — one entry each, not two.
    expect(possibleDigits(puzzle, emptyGrid(4), cage)).toEqual([
      [1, 2],
      [2, 3],
      [3, 4],
    ]);
  });

  it('rules out every combination when the cage holds an impossible digit', () => {
    const cage: Cage = { id: 0, cells: [0, 1], op: '/', target: 2 };
    const puzzle = puzzleWith(8, cage);
    const values = emptyGrid(8);
    values[0] = 5; // no 2÷ pair contains a 5
    expect(possibleDigits(puzzle, values, cage)).toEqual([]);
    expect(ruledOutDigits(puzzle, values, cage)).toEqual([
      [1, 2],
      [2, 4],
      [3, 6],
      [4, 8],
    ]);
  });

  it('keeps only combinations consistent with an entered cage digit', () => {
    const cage: Cage = { id: 0, cells: [0, 1], op: '/', target: 2 };
    const puzzle = puzzleWith(8, cage);
    const values = emptyGrid(8);
    values[0] = 2; // pins cell 0 to 2: only pairs able to place a 2 at cell 0 survive
    expect(possibleDigits(puzzle, values, cage)).toEqual([
      [1, 2],
      [2, 4],
    ]);
    expect(ruledOutDigits(puzzle, values, cage)).toEqual([
      [3, 6],
      [4, 8],
    ]);
  });

  it('rules out a combination whose digit is taken by a filled peer', () => {
    // A 5+ pair in a 5×5 over two cells in the same row: {1,4} and {2,3}.
    const cage: Cage = { id: 0, cells: [0, 1], op: '+', target: 5 };
    const puzzle = puzzleWith(5, cage);
    const values = emptyGrid(5);
    // Take 1 and 4 out of both columns the cage sits in, so {1,4} has nowhere to
    // go. Kept in distinct rows so the fillers don't conflict with each other.
    values[5] = 1; // column 0, row 1
    values[10] = 4; // column 0, row 2
    values[16] = 1; // column 1, row 3
    values[21] = 4; // column 1, row 4
    expect(possibleDigits(puzzle, values, cage)).toEqual([[2, 3]]);
    expect(ruledOutDigits(puzzle, values, cage)).toEqual([[1, 4]]);
  });

  it('sinks ruled-out combinations below the possible ones', () => {
    const cage: Cage = { id: 0, cells: [0, 1], op: '/', target: 2 };
    const puzzle = puzzleWith(8, cage);
    const values = emptyGrid(8);
    values[0] = 2;
    const list = cageCombinations(puzzle, values, cage) ?? [];
    const firstRuledOut = list.findIndex((c) => !c.possible);
    const lastPossible = list.map((c) => c.possible).lastIndexOf(true);
    expect(lastPossible).toBeLessThan(firstRuledOut);
  });
});

describe('combinationText', () => {
  const cases: Array<[Op, number[], string]> = [
    ['+', [1, 2], '1 + 2'],
    ['*', [1, 2, 3], '1 × 2 × 3'],
    ['-', [1, 4], '4 − 1'],
    ['/', [1, 2], '2 ÷ 1'],
    ['=', [3], '3'],
  ];
  it.each(cases)('formats %s over %j as "%s"', (op, digits, expected) => {
    expect(combinationText(op, digits)).toBe(expected);
  });
});
