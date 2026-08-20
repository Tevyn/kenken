import { describe, expect, it } from 'vitest';
import { generatePuzzle } from './generator';
import { countSolutions, isSolved, solvePuzzle } from './index';
import { isLatinSquare } from './latin';
import { isConnected, cageSatisfied } from './cages';
import { paramsFor } from './difficulty';
import { DIFFICULTIES, MAX_SIZE, MIN_SIZE } from './types';
import type { Difficulty, Puzzle } from './types';

const SIZES = Array.from({ length: MAX_SIZE - MIN_SIZE + 1 }, (_unused, i) => MIN_SIZE + i);
const SEEDS = ['s0', 's1', 's2', 's3', 's4'];

/** Every (size, difficulty, seed) combination, as vitest `each` rows. */
const MATRIX: [number, Difficulty, string][] = SIZES.flatMap((size) =>
  DIFFICULTIES.flatMap((difficulty) =>
    SEEDS.map((seed) => [size, difficulty, seed] as [number, Difficulty, string]),
  ),
);

/**
 * Generation is deterministic, so the same request always yields the same
 * puzzle — memoising lets several test blocks inspect one puzzle without
 * paying to generate it again.
 */
const cache = new Map<string, Puzzle>();
function puzzleFor(size: number, difficulty: Difficulty, seed: string): Puzzle {
  const key = `${size}/${difficulty}/${seed}`;
  let puzzle = cache.get(key);
  if (!puzzle) {
    puzzle = generatePuzzle({ size, difficulty, seed });
    cache.set(key, puzzle);
  }
  return puzzle;
}

describe('generatePuzzle uniqueness', () => {
  it.each(MATRIX)(
    'a size %i, %s puzzle (seed %s) has exactly one solution',
    (size, difficulty, seed) => {
      const puzzle = puzzleFor(size, difficulty, seed);
      expect(countSolutions(puzzle, 2)).toBe(1);
    },
    120_000,
  );
});

describe('generatePuzzle solution', () => {
  it.each(MATRIX)(
    "the solver's answer for size %i, %s (seed %s) equals puzzle.solution",
    (size, difficulty, seed) => {
      const puzzle = puzzleFor(size, difficulty, seed);
      const solutions = solvePuzzle(puzzle, 2);
      expect(solutions).toHaveLength(1);
      expect(solutions[0]).toEqual(puzzle.solution);
      expect(isSolved(puzzle, puzzle.solution)).toBe(true);
    },
    120_000,
  );
});

describe('generatePuzzle structure', () => {
  it.each(MATRIX)('a size %i, %s puzzle (seed %s) is well formed', (size, difficulty, seed) => {
    const puzzle = puzzleFor(size, difficulty, seed);
    const params = paramsFor(size, difficulty);

    expect(puzzle.size).toBe(size);
    expect(puzzle.difficulty).toBe(difficulty);
    expect(puzzle.seed).toBe(seed);

    // The solution is a genuine Latin square.
    expect(puzzle.solution).toHaveLength(size * size);
    expect(isLatinSquare(puzzle.solution, size)).toBe(true);

    // Cages tile the grid, are connected, and their ids index the array.
    const seen = new Set<number>();
    puzzle.cages.forEach((cage, index) => {
      expect(cage.id).toBe(index);
      expect(cage.cells.length).toBeGreaterThan(0);
      expect(cage.cells.length).toBeLessThanOrEqual(params.maxCageSize);
      expect(isConnected(cage.cells, size)).toBe(true);
      expect(cage.cells.slice().sort((a, b) => a - b)).toEqual(cage.cells);
      for (const cell of cage.cells) {
        expect(cell).toBeGreaterThanOrEqual(0);
        expect(cell).toBeLessThan(size * size);
        expect(seen.has(cell)).toBe(false);
        seen.add(cell);
      }
    });
    expect(seen.size).toBe(size * size);

    // Every operator/target is satisfied by the solution values.
    for (const cage of puzzle.cages) {
      const values = cage.cells.map((c) => puzzle.solution[c]);
      expect(cageSatisfied(cage, values)).toBe(true);

      if (cage.op === '-' || cage.op === '/') expect(cage.cells).toHaveLength(2);
      if (cage.op === '=') expect(cage.cells).toHaveLength(1);
      if (cage.cells.length > 2) expect(['+', '*']).toContain(cage.op);
      if (cage.op === '/') {
        const hi = Math.max(...values);
        const lo = Math.min(...values);
        expect(hi % lo).toBe(0);
        expect(cage.target).toBe(hi / lo);
        expect(cage.target).toBeGreaterThan(1);
      }
      expect(Number.isInteger(cage.target)).toBe(true);
      expect(cage.target).toBeGreaterThan(0);
      expect(params.allowedOps.concat('=')).toContain(cage.op);
    }

    // Freebie budget for the tier is a hard invariant.
    const freebies = puzzle.cages.filter((c) => c.cells.length === 1).length;
    expect(freebies).toBeGreaterThanOrEqual(params.minFreebies);
    expect(freebies).toBeLessThanOrEqual(params.maxFreebies);
  });
});

describe('generatePuzzle determinism', () => {
  it.each(SIZES)('the same seed reproduces an identical %ix%i puzzle', (size) => {
    for (const difficulty of DIFFICULTIES) {
      const a = generatePuzzle({ size, difficulty, seed: 'repeatable' });
      const b = generatePuzzle({ size, difficulty, seed: 'repeatable' });
      expect(a).toEqual(b);
    }
  }, 120_000);

  it('different seeds generally produce different puzzles', () => {
    const signatures = new Set<string>();
    for (let s = 0; s < 12; s++) {
      const puzzle = generatePuzzle({ size: 5, difficulty: 'medium', seed: `unique-${s}` });
      signatures.add(JSON.stringify({ cages: puzzle.cages, solution: puzzle.solution }));
    }
    expect(signatures.size).toBe(12);
  }, 120_000);

  it('the same seed at a different difficulty produces a different puzzle', () => {
    const easy = generatePuzzle({ size: 6, difficulty: 'easy', seed: 'shared' });
    const expert = generatePuzzle({ size: 6, difficulty: 'expert', seed: 'shared' });
    expect(easy.cages).not.toEqual(expert.cages);
  }, 120_000);

  it('mints a random seed when none is given', () => {
    const a = generatePuzzle({ size: 4, difficulty: 'easy' });
    const b = generatePuzzle({ size: 4, difficulty: 'easy' });
    expect(a.seed).not.toBe(b.seed);
    expect(a.seed.length).toBeGreaterThan(0);
    // The minted seed must actually reproduce the puzzle.
    expect(generatePuzzle({ size: 4, difficulty: 'easy', seed: a.seed })).toEqual(a);
  }, 120_000);
});

describe('generatePuzzle argument validation', () => {
  it.each([2, 10, 0, -1, 4.5, NaN])('rejects size %s with a RangeError', (size) => {
    expect(() => generatePuzzle({ size, difficulty: 'easy', seed: 'x' })).toThrow(RangeError);
  });

  it('accepts every supported size', () => {
    for (const size of SIZES) {
      expect(() => generatePuzzle({ size, difficulty: 'easy', seed: 'ok' })).not.toThrow();
    }
  }, 120_000);

  it('rejects an unknown difficulty', () => {
    expect(() =>
      generatePuzzle({ size: 4, difficulty: 'impossible' as Difficulty, seed: 'x' }),
    ).toThrow(RangeError);
  });
});

describe('generatePuzzle performance', () => {
  it.each(SIZES)('generates a %ix%i puzzle of every tier quickly', (size) => {
    for (const difficulty of DIFFICULTIES) {
      const started = performance.now();
      const puzzle: Puzzle = generatePuzzle({ size, difficulty, seed: `perf-${size}-${difficulty}` });
      const elapsed = performance.now() - started;
      expect(puzzle.cages.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(3000);
    }
  }, 120_000);
});
