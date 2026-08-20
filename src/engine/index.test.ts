import { describe, expect, it } from 'vitest';
import { countSolutions, findConflicts, isSolved, solvePuzzle } from './index';
import { generatePuzzle } from './generator';
import { SAMPLE_PUZZLE } from '../fixtures/samplePuzzle';
import type { Grid, Puzzle } from './types';

/**
 * 4x4 with a known solution and one cage of every operator, so the conflict
 * rules can be exercised against each in turn.
 *
 *   1 2 3 4
 *   2 1 4 3
 *   3 4 1 2
 *   4 3 2 1
 */
const P: Puzzle = SAMPLE_PUZZLE;
const SOLVED: Grid = [...P.solution];
const EMPTY: Grid = new Array(16).fill(null);

describe('isSolved', () => {
  it('accepts the correct solution', () => {
    expect(isSolved(P, SOLVED)).toBe(true);
  });

  it('rejects an empty or partial grid', () => {
    expect(isSolved(P, EMPTY)).toBe(false);
    const partial = [...SOLVED];
    partial[7] = null;
    expect(isSolved(P, partial)).toBe(false);
  });

  it('rejects a grid of the wrong length', () => {
    expect(isSolved(P, [1, 2, 3])).toBe(false);
  });

  it('rejects out-of-range values', () => {
    const bad = [...SOLVED];
    bad[0] = 9;
    expect(isSolved(P, bad)).toBe(false);
    const zero = [...SOLVED];
    zero[0] = 0;
    expect(isSolved(P, zero)).toBe(false);
  });

  it('rejects a Latin-square violation', () => {
    // Swapping two cells in a row breaks both the column rule and a cage.
    const dup = [...SOLVED];
    dup[1] = dup[0];
    expect(isSolved(P, dup)).toBe(false);
  });

  it('rejects a valid Latin square whose cage arithmetic is wrong', () => {
    // A different order-4 Latin square: rows/columns fine, cages not.
    const otherSquare: Grid = [1, 2, 3, 4, 2, 1, 4, 3, 3, 4, 2, 1, 4, 3, 1, 2];
    expect(isSolved(P, otherSquare)).toBe(false);
  });

  it('accepts the solution of every generated puzzle', () => {
    for (const size of [3, 5, 7]) {
      const puzzle = generatePuzzle({ size, difficulty: 'medium', seed: `solved-${size}` });
      expect(isSolved(puzzle, puzzle.solution)).toBe(true);
    }
  }, 60_000);

  it('rejects a grid that leaves a cell outside every cage', () => {
    const uncovered: Puzzle = { ...P, cages: P.cages.slice(0, 2) };
    const grid: Grid = [...SOLVED];
    expect(isSolved(uncovered, grid)).toBe(false);
  });
});

describe('findConflicts', () => {
  it('reports nothing for an empty grid', () => {
    expect(findConflicts(P, EMPTY).size).toBe(0);
  });

  it('reports nothing for the correct solution', () => {
    expect(findConflicts(P, SOLVED).size).toBe(0);
  });

  it('never flags an empty cell', () => {
    const grid: Grid = new Array(16).fill(null);
    grid[0] = 3;
    grid[1] = 3; // duplicate in row 0
    const conflicts = findConflicts(P, grid);
    expect(conflicts).toEqual(new Set([0, 1]));
    for (let i = 2; i < 16; i++) expect(conflicts.has(i)).toBe(false);
  });

  it('flags both cells of a duplicated digit in a row', () => {
    const grid: Grid = new Array(16).fill(null);
    grid[4] = 2;
    grid[6] = 2;
    expect(findConflicts(P, grid)).toEqual(new Set([4, 6]));
  });

  it('flags every cell of a triple in a row', () => {
    const grid: Grid = new Array(16).fill(null);
    grid[8] = 1;
    grid[9] = 1;
    grid[10] = 1;
    expect(findConflicts(P, grid)).toEqual(new Set([8, 9, 10]));
  });

  it('flags both cells of a duplicated digit in a column', () => {
    const grid: Grid = new Array(16).fill(null);
    grid[2] = 4;
    grid[14] = 4;
    expect(findConflicts(P, grid)).toEqual(new Set([2, 14]));
  });

  it('flags a cell that duplicates in both its row and its column', () => {
    const grid: Grid = new Array(16).fill(null);
    grid[0] = 1;
    grid[1] = 1; // row clash with 0
    grid[4] = 1; // column clash with 0
    expect(findConflicts(P, grid)).toEqual(new Set([0, 1, 4]));
  });

  it('flags a full cage whose arithmetic is wrong', () => {
    // Cage 2 is cells [4, 8] with '1-'. 1 and 4 differ by 3, not 1.
    const grid: Grid = new Array(16).fill(null);
    grid[4] = 1;
    grid[8] = 4;
    expect(findConflicts(P, grid)).toEqual(new Set([4, 8]));
  });

  it('does not flag a partially-filled cage, however wrong it looks', () => {
    const grid: Grid = new Array(16).fill(null);
    grid[4] = 1; // cage [4, 8] is "1-" and still missing cell 8
    expect(findConflicts(P, grid).size).toBe(0);
  });

  it('flags a wrong division cage', () => {
    // Cage 5 is cells [11, 15] with '2/'.
    const grid: Grid = new Array(16).fill(null);
    grid[11] = 3;
    grid[15] = 4;
    expect(findConflicts(P, grid)).toEqual(new Set([11, 15]));
  });

  it('flags a wrong freebie cage', () => {
    // Cage 6 is cell [14] with '=2'.
    const grid: Grid = new Array(16).fill(null);
    grid[14] = 3;
    expect(findConflicts(P, grid)).toEqual(new Set([14]));
  });

  it('accepts a correct 3-cell product cage', () => {
    // Cage 1 is cells [2, 3, 7] with '36*'.
    const grid: Grid = new Array(16).fill(null);
    grid[2] = 3;
    grid[3] = 4;
    grid[7] = 3;
    expect(findConflicts(P, grid).size).toBe(0);
  });

  it('reports both kinds of conflict together', () => {
    const grid: Grid = new Array(16).fill(null);
    grid[14] = 1; // freebie cage wants 2
    grid[12] = 1;
    grid[13] = 1; // duplicate in row 3
    const conflicts = findConflicts(P, grid);
    expect(conflicts.has(14)).toBe(true);
    expect(conflicts.has(12)).toBe(true);
    expect(conflicts.has(13)).toBe(true);
  });

  it('returns an empty set for a grid of the wrong length', () => {
    expect(findConflicts(P, [1, 2]).size).toBe(0);
  });

  it('finds no conflicts in any generated puzzle solution', () => {
    for (const size of [4, 6, 9]) {
      const puzzle = generatePuzzle({ size, difficulty: 'hard', seed: `conflict-${size}` });
      expect(findConflicts(puzzle, puzzle.solution).size).toBe(0);
    }
  }, 60_000);
});

describe('solvePuzzle and countSolutions', () => {
  it('defaults to a single solution and a cap of two', () => {
    expect(solvePuzzle(P)).toHaveLength(1);
    expect(countSolutions(P)).toBe(1);
  });

  it('never returns more than the requested limit', () => {
    const puzzle = generatePuzzle({ size: 5, difficulty: 'easy', seed: 'limit' });
    expect(solvePuzzle(puzzle, 5)).toHaveLength(1);
    expect(countSolutions(puzzle, 1)).toBe(1);
  }, 60_000);
});
