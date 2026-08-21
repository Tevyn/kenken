import { describe, expect, it } from 'vitest';
import { createErrorChecker, findGridErrors } from './errors';
import { generatePuzzle } from './generator';
import { SAMPLE_PUZZLE } from '../fixtures/samplePuzzle';
import type { Grid, Op, Puzzle } from './types';

/**
 * The 4x4 fixture. Its solution is
 *
 *   1 2 3 4
 *   2 1 4 3
 *   3 4 1 2
 *   4 3 2 1
 *
 * and it is tightly constrained, so several of its cages admit exactly one
 * combination — handy for exercising the partial-cage rule.
 */
const P: Puzzle = SAMPLE_PUZZLE;
const SOLVED: Grid = [...P.solution];
const EMPTY: Grid = new Array(16).fill(null);

function empty(size: number): Grid {
  return new Array<number | null>(size * size).fill(null);
}

/**
 * A throwaway puzzle carrying nothing but the cages under test.
 *
 * `solution` is deliberately left empty: if error detection ever started
 * consulting it, every test built on this helper would break loudly.
 */
function cagePuzzle(size: number, cells: number[], op: Op, target: number): Puzzle {
  return {
    size,
    difficulty: 'easy',
    seed: 'errors-test',
    solution: [],
    cages: [{ id: 0, cells, op, target }],
  };
}

describe('findGridErrors: row and column duplicates', () => {
  it('reports nothing for an empty grid', () => {
    const errors = findGridErrors(P, EMPTY);
    expect(errors.cells.size).toBe(0);
    expect(errors.duplicates.size).toBe(0);
    expect(errors.badCages).toEqual([]);
  });

  it('reports nothing for the completed solution', () => {
    expect(findGridErrors(P, SOLVED).cells.size).toBe(0);
  });

  it('flags both cells of a duplicated digit in a row', () => {
    const grid = empty(4);
    grid[8] = 1;
    grid[9] = 1;
    const errors = findGridErrors(P, grid);
    expect(errors.duplicates).toEqual(new Set([8, 9]));
    expect(errors.cells).toEqual(new Set([8, 9]));
  });

  it('flags both cells of a duplicated digit in a column', () => {
    const grid = empty(4);
    grid[2] = 3;
    grid[6] = 3;
    expect(findGridErrors(P, grid).duplicates).toEqual(new Set([2, 6]));
  });

  it('returns an empty result for a grid of the wrong length', () => {
    const errors = findGridErrors(P, [1, 2]);
    expect(errors.cells.size).toBe(0);
    expect(errors.badCages).toEqual([]);
  });
});

describe('findGridErrors: completed cage arithmetic', () => {
  it('flags every cell of a full cage whose arithmetic is wrong', () => {
    // Cage 2 is cells [4, 8] with "1−". 1 and 4 differ by 3.
    const grid = empty(4);
    grid[4] = 1;
    grid[8] = 4;
    const errors = findGridErrors(P, grid);
    expect(errors.cells).toEqual(new Set([4, 8]));
    expect(errors.badCages).toEqual([2]);
    expect(errors.duplicates.size).toBe(0);
  });

  it('accepts a full cage whose arithmetic works out', () => {
    // Cage 1 is cells [2, 3, 7] with "36×"; 3 * 4 * 3 = 36.
    const grid = empty(4);
    grid[2] = 3;
    grid[3] = 4;
    grid[7] = 3;
    expect(findGridErrors(P, grid).cells.size).toBe(0);
  });
});

describe('findGridErrors: partial cage infeasibility', () => {
  it('flags a 3-cell 7+ cage that has already overshot its target', () => {
    // Cells 0,1,2 all sit in row 0, so 5 and 4 leave 7 - 9 for the third cell.
    const puzzle = cagePuzzle(5, [0, 1, 2], '+', 7);
    const grid = empty(5);
    grid[0] = 5;
    grid[1] = 4;
    const errors = findGridErrors(puzzle, grid);
    expect(errors.cells).toEqual(new Set([0, 1]));
    expect(errors.badCages).toEqual([0]);
  });

  it('leaves the same cage alone while it is still completable', () => {
    const puzzle = cagePuzzle(5, [0, 1, 2], '+', 7);
    const grid = empty(5);
    grid[0] = 1;
    grid[1] = 2; // 1 + 2 + 4 = 7
    expect(findGridErrors(puzzle, grid).cells.size).toBe(0);
  });

  it('flags a 12× cage holding a digit that does not divide the target', () => {
    const puzzle = cagePuzzle(5, [0, 1], '*', 12);
    const grid = empty(5);
    grid[0] = 5;
    const errors = findGridErrors(puzzle, grid);
    expect(errors.cells).toEqual(new Set([0]));
    expect(errors.badCages).toEqual([0]);
  });

  it('leaves a 12× cage alone when the digit does divide the target', () => {
    const puzzle = cagePuzzle(5, [0, 1], '*', 12);
    const grid = empty(5);
    grid[0] = 3; // 3 * 4 = 12
    expect(findGridErrors(puzzle, grid).cells.size).toBe(0);
  });

  it('flags a 3− cage in a 4x4 holding a digit with no possible partner', () => {
    // |a - b| = 3 over 1..4 forces {1, 4}; a 3 needs a 6 or a 0.
    const puzzle = cagePuzzle(4, [0, 1], '-', 3);
    const grid = empty(4);
    grid[1] = 3;
    expect(findGridErrors(puzzle, grid).cells).toEqual(new Set([1]));
  });

  it('leaves the same 3− cage alone for a digit that does have a partner', () => {
    const puzzle = cagePuzzle(4, [0, 1], '-', 3);
    const grid = empty(4);
    grid[1] = 4;
    expect(findGridErrors(puzzle, grid).cells.size).toBe(0);
  });

  it('flags a division cage holding a digit no ratio can use', () => {
    // Fixture cage 5 is cells [11, 15] with "2÷"; the legal pairs are 1/2 and 2/4.
    const grid = empty(4);
    grid[11] = 3;
    const errors = findGridErrors(P, grid);
    expect(errors.cells).toEqual(new Set([11]));
    expect(errors.badCages).toEqual([5]);
  });

  it('respects within-cage row and column uniqueness when judging feasibility', () => {
    // Fixture cage 1 is cells [2, 3, 7] with "36×". Cells 2 and 3 share a row and
    // cells 3 and 7 share a column, so [3, 4, 3] is the only legal combination.
    const grid = empty(4);
    grid[2] = 1;
    expect(findGridErrors(P, grid).cells).toEqual(new Set([2]));

    const ok = empty(4);
    ok[2] = 3;
    expect(findGridErrors(P, ok).cells.size).toBe(0);
  });

  it('highlights only the filled cells of an infeasible cage', () => {
    // Fixture cage 4 is cells [9, 12, 13] with "11+", whose only combination is
    // [4, 4, 3]. Cell 13 stays empty and must not be blamed.
    const grid = empty(4);
    grid[9] = 1;
    grid[12] = 4;
    const errors = findGridErrors(P, grid);
    expect(errors.cells).toEqual(new Set([9, 12]));
    expect(errors.cells.has(13)).toBe(false);
    for (const cell of errors.cells) expect(grid[cell]).not.toBeNull();
  });

  it('never flags an empty cell', () => {
    const grid = empty(4);
    grid[0] = 2; // fixture cage 0 admits only [1, 2, 1]
    const errors = findGridErrors(P, grid);
    expect(errors.cells.size).toBeGreaterThan(0);
    for (const cell of errors.cells) expect(grid[cell]).not.toBeNull();
  });
});

describe('findGridErrors: what must never be flagged', () => {
  it('says nothing about a correct partial grid at any prefix', () => {
    const grid = empty(4);
    for (let i = 0; i < 16; i++) {
      grid[i] = P.solution[i];
      expect(findGridErrors(P, grid).cells.size, `after filling cell ${i}`).toBe(0);
    }
  });

  it('says nothing about an entry that differs from the solution but is still completable', () => {
    // Fixture cage 3 is cells [6, 10] with "5+". The solution puts 4 in cell 6,
    // but 1 is perfectly consistent with the cage on its own (1 + 4 = 5), and
    // rows and columns are otherwise empty — so there is nothing to prove yet.
    const grid = empty(4);
    grid[6] = 1;
    expect(grid[6]).not.toBe(P.solution[6]);
    expect(findGridErrors(P, grid).cells.size).toBe(0);
  });

  it('says nothing about a wholly empty cage', () => {
    const puzzle = cagePuzzle(5, [0, 1, 2], '+', 7);
    expect(findGridErrors(puzzle, empty(5)).cells.size).toBe(0);
  });

  it('stays silent about a cage no grid could satisfy rather than blaming the player', () => {
    // A 3-cell subtraction cage is malformed data, not a mistake the player made.
    const puzzle = cagePuzzle(5, [0, 1, 2], '-', 1);
    const grid = empty(5);
    grid[0] = 2;
    expect(findGridErrors(puzzle, grid).cells.size).toBe(0);
  });
});

describe('findGridErrors: enumeration overflow', () => {
  it('skips the partial check for a cage whose combinations exceed the cap', () => {
    // Cell 2 alone is infeasible for fixture cage 1, but with enumeration capped
    // there is no evidence, so nothing may be reported.
    const grid = empty(4);
    grid[2] = 1;
    expect(findGridErrors(P, grid, { maxCombosPerCage: 0 }).cells.size).toBe(0);
    expect(findGridErrors(P, grid).cells).toEqual(new Set([2]));
  });

  it('still reports duplicates and completed cages when enumeration is capped', () => {
    const grid = empty(4);
    grid[0] = 3;
    grid[1] = 3;
    grid[14] = 3; // freebie cage wants 2
    const errors = findGridErrors(P, grid, { maxCombosPerCage: 0 });
    expect(errors.duplicates).toEqual(new Set([0, 1]));
    expect(errors.badCages).toEqual([6]);
  });
});

describe('findGridErrors: partialCages option', () => {
  it('drops the partial-cage class when disabled', () => {
    const grid = empty(4);
    grid[11] = 3; // infeasible for the "2÷" cage
    expect(findGridErrors(P, grid).cells.size).toBe(1);
    expect(findGridErrors(P, grid, { partialCages: false }).cells.size).toBe(0);
  });
});

describe('createErrorChecker', () => {
  it('returns a reusable closure that matches the one-shot form', () => {
    const check = createErrorChecker(P);
    const grid = empty(4);
    expect(check(grid).cells.size).toBe(0);

    grid[11] = 3;
    expect(check(grid)).toEqual(findGridErrors(P, grid));

    grid[11] = null;
    grid[0] = 1;
    grid[1] = 1;
    expect(check(grid).cells).toEqual(new Set([0, 1]));
  });

  it('never reports an error while a generated solution is entered cell by cell', () => {
    for (const size of [4, 5, 6]) {
      const puzzle = generatePuzzle({ size, difficulty: 'medium', seed: `errors-${size}` });
      const check = createErrorChecker(puzzle);
      const grid = empty(size);
      for (let i = 0; i < grid.length; i++) {
        grid[i] = puzzle.solution[i];
        const errors = check(grid);
        expect(errors.cells.size, `${size}x${size} after cell ${i}`).toBe(0);
        expect(errors.badCages, `${size}x${size} after cell ${i}`).toEqual([]);
      }
    }
  }, 60_000);

  it('never reports an error while a solution is entered in a shuffled order', () => {
    const puzzle = generatePuzzle({ size: 6, difficulty: 'hard', seed: 'errors-shuffled' });
    const check = createErrorChecker(puzzle);
    const grid = empty(6);
    // A fixed, arbitrary-looking traversal: any order of correct entries is
    // still correct, so no prefix may produce an error.
    const order = grid.map((_, i) => i).sort((a, b) => ((a * 17) % 36) - ((b * 17) % 36));
    for (const i of order) {
      grid[i] = puzzle.solution[i];
      expect(check(grid).cells.size, `after cell ${i}`).toBe(0);
    }
  }, 60_000);

  it('stays responsive on a 9x9 expert puzzle', () => {
    const puzzle = generatePuzzle({ size: 9, difficulty: 'expert', seed: 'errors-9' });
    const check = createErrorChecker(puzzle);
    const grid = empty(9);
    for (let i = 0; i < 40; i++) grid[i] = puzzle.solution[i];

    const start = performance.now();
    for (let i = 0; i < 200; i++) check(grid);
    const perCall = (performance.now() - start) / 200;
    // Generous: this only needs to catch an accidental re-enumeration per call.
    expect(perCall).toBeLessThan(5);
  }, 120_000);
});
