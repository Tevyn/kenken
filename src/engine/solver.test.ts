import { describe, expect, it } from 'vitest';
import { enumerateCageCombos, solve } from './solver';
import { countSolutions, solvePuzzle } from './index';
import type { Cage, Puzzle } from './types';

/**
 * The verified-unique 4x4 from `docs/KENKEN.md` §1.6, whose uniqueness was
 * established there by exhaustive enumeration of all 576 order-4 Latin squares.
 * A good independent check that the solver agrees with an exhaustive search.
 */
const DOC_PUZZLE: Puzzle = {
  size: 4,
  difficulty: 'medium',
  seed: 'kenken-md-1.6',
  solution: [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1],
  cages: [
    { id: 0, cells: [0, 4], op: '/', target: 3 },
    { id: 1, cells: [1, 5], op: '*', target: 8 },
    { id: 2, cells: [2, 3], op: '+', target: 7 },
    { id: 3, cells: [6, 10], op: '-', target: 3 },
    { id: 4, cells: [7, 11], op: '-', target: 1 },
    { id: 5, cells: [8, 12], op: '*', target: 8 },
    { id: 6, cells: [9, 13, 14], op: '*', target: 6 },
    { id: 7, cells: [15], op: '=', target: 1 },
  ],
};

describe('solve', () => {
  it('reproduces the exhaustively-verified 4x4 from the reference doc', () => {
    const result = solve(DOC_PUZZLE, { limit: 5 });
    expect(result.solutions).toHaveLength(1);
    expect(result.solutions[0]).toEqual(DOC_PUZZLE.solution);
  });

  it('solves that puzzle by pure propagation, with no guessing', () => {
    const result = solve(DOC_PUZZLE, { limit: 1 });
    expect(result.stats.guesses).toBe(0);
    expect(result.stats.maxDepth).toBe(0);
    expect(result.stats.solvedByPropagation).toBe(16);
  });

  it('finds every solution of an under-constrained puzzle', () => {
    // Two 2-cell "5+" cages per row: 1+4 and 2+3 either way round.
    const loose: Puzzle = {
      size: 4,
      difficulty: 'easy',
      seed: 'loose',
      solution: [1, 4, 2, 3, 4, 1, 3, 2, 2, 3, 1, 4, 3, 2, 4, 1],
      cages: [
        { id: 0, cells: [0, 1], op: '+', target: 5 },
        { id: 1, cells: [2, 3], op: '+', target: 5 },
        { id: 2, cells: [4, 5], op: '+', target: 5 },
        { id: 3, cells: [6, 7], op: '+', target: 5 },
        { id: 4, cells: [8, 9], op: '+', target: 5 },
        { id: 5, cells: [10, 11], op: '+', target: 5 },
        { id: 6, cells: [12, 13], op: '+', target: 5 },
        { id: 7, cells: [14, 15], op: '+', target: 5 },
      ],
    };
    expect(countSolutions(loose, 2)).toBe(2);
    expect(countSolutions(loose, 50)).toBeGreaterThan(2);
    for (const grid of solvePuzzle(loose, 10)) {
      for (const cage of loose.cages) {
        expect(grid[cage.cells[0]] + grid[cage.cells[1]]).toBe(5);
      }
    }
  });

  it('reports an impossible puzzle as having no solutions', () => {
    const impossible: Puzzle = {
      size: 3,
      difficulty: 'easy',
      seed: 'nope',
      solution: [1, 2, 3, 2, 3, 1, 3, 1, 2],
      cages: [
        { id: 0, cells: [0], op: '=', target: 1 },
        { id: 1, cells: [1], op: '=', target: 1 },
        { id: 2, cells: [2], op: '=', target: 1 },
        { id: 3, cells: [3, 4, 5], op: '+', target: 6 },
        { id: 4, cells: [6, 7, 8], op: '+', target: 6 },
      ],
    };
    expect(countSolutions(impossible, 5)).toBe(0);
    expect(solve(impossible, { limit: 1 }).infeasible).toBe(true);
  });

  it('reports a puzzle with an unreachable target as infeasible', () => {
    const bad: Puzzle = {
      size: 3,
      difficulty: 'easy',
      seed: 'bad-target',
      solution: [1, 2, 3, 2, 3, 1, 3, 1, 2],
      cages: [
        { id: 0, cells: [0, 1, 2], op: '+', target: 99 },
        { id: 1, cells: [3, 4, 5], op: '+', target: 6 },
        { id: 2, cells: [6, 7, 8], op: '+', target: 6 },
      ],
    };
    expect(countSolutions(bad, 2)).toBe(0);
  });

  it('honours the solution limit', () => {
    const size = 3;
    const openGrid: Puzzle = {
      size,
      difficulty: 'easy',
      seed: 'open',
      solution: [1, 2, 3, 2, 3, 1, 3, 1, 2],
      cages: [
        { id: 0, cells: [0, 1, 2], op: '+', target: 6 },
        { id: 1, cells: [3, 4, 5], op: '+', target: 6 },
        { id: 2, cells: [6, 7, 8], op: '+', target: 6 },
      ],
    };
    // All 12 order-3 Latin squares satisfy "every row sums to 6".
    expect(countSolutions(openGrid, 2)).toBe(2);
    expect(countSolutions(openGrid, 100)).toBe(12);
    expect(solvePuzzle(openGrid, 3)).toHaveLength(3);
  });

  it('stops early instead of hanging on a hopeless node budget', () => {
    const openGrid: Puzzle = {
      size: 6,
      difficulty: 'expert',
      seed: 'wide-open',
      solution: Array.from({ length: 36 }, (_unused, i) => (((i % 6) + Math.floor(i / 6)) % 6) + 1),
      cages: Array.from({ length: 6 }, (_unused, r) => ({
        id: r,
        cells: [0, 1, 2, 3, 4, 5].map((c) => r * 6 + c),
        op: '+' as const,
        target: 21,
      })),
    };
    const result = solve(openGrid, { limit: 1000, nodeLimit: 20 });
    expect(result.aborted).toBe(true);
  });

  it('ignores the stated solution when solving', () => {
    const lying: Puzzle = { ...DOC_PUZZLE, solution: new Array(16).fill(1) };
    expect(solvePuzzle(lying, 2)).toEqual([DOC_PUZZLE.solution]);
  });
});

describe('enumerateCageCombos', () => {
  const cage = (op: Cage['op'], target: number, cells: number[]): Cage => ({
    id: 0,
    cells,
    op,
    target,
  });

  it('lists every ordered pair for a 2-cell subtraction cage', () => {
    // Cells 0 and 1 share row 0 of a 4x4, so the values must differ.
    const combos = enumerateCageCombos(cage('-', 1, [0, 1]), 4);
    expect(combos).not.toBeNull();
    const asText = (combos as number[][]).map((c) => c.join(''));
    expect(asText.sort()).toEqual(['12', '21', '23', '32', '34', '43']);
  });

  it('only allows exact quotients for division', () => {
    const combos = enumerateCageCombos(cage('/', 2, [0, 1]), 4) as number[][];
    expect(combos.map((c) => c.join('')).sort()).toEqual(['12', '21', '24', '42']);
  });

  it('permits a repeated digit when the cells share neither row nor column', () => {
    // On a 4x4, cells 1 and 4 are in different rows and different columns.
    const combos = enumerateCageCombos(cage('+', 4, [1, 4]), 4) as number[][];
    expect(combos.map((c) => c.join(''))).toContain('22');
  });

  it('forbids a repeated digit inside one row of a cage', () => {
    const combos = enumerateCageCombos(cage('+', 4, [0, 1]), 4) as number[][];
    expect(combos.map((c) => c.join(''))).not.toContain('22');
  });

  it('handles single-cell cages', () => {
    expect(enumerateCageCombos(cage('=', 3, [0]), 4)).toEqual([[3]]);
    expect(enumerateCageCombos(cage('=', 9, [0]), 4)).toEqual([]);
  });

  it('rejects structurally illegal cages', () => {
    expect(enumerateCageCombos(cage('-', 1, [0, 1, 2]), 4)).toEqual([]);
    expect(enumerateCageCombos(cage('/', 2, [0, 1, 2]), 4)).toEqual([]);
    expect(enumerateCageCombos(cage('=', 2, [0, 1]), 4)).toEqual([]);
  });

  it('gives up when a cage exceeds the combination cap', () => {
    expect(enumerateCageCombos(cage('+', 20, [0, 1, 10, 11, 20]), 9, 5)).toBeNull();
  });

  it('never produces a combination that violates the cage arithmetic', () => {
    for (const c of [cage('+', 12, [0, 1, 5]), cage('*', 24, [0, 4, 8]), cage('-', 2, [0, 4])]) {
      const combos = enumerateCageCombos(c, 6) as number[][];
      expect(combos.length).toBeGreaterThan(0);
      for (const combo of combos) {
        expect(combo).toHaveLength(c.cells.length);
        if (c.op === '+') expect(combo.reduce((a, b) => a + b, 0)).toBe(c.target);
        if (c.op === '*') expect(combo.reduce((a, b) => a * b, 1)).toBe(c.target);
        if (c.op === '-') expect(Math.abs(combo[0] - combo[1])).toBe(c.target);
      }
    }
  });
});
